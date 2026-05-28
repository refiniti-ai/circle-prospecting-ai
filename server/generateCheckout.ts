import type { Request, Response } from "express";
import crypto from "node:crypto";
import axios from "axios";
import Stripe from "stripe";
import { z } from "zod";
import { opsLog } from "./opsLog.js";

/**
 * POST /api/generate-checkout
 *
 * GHL automation entry point: takes a GHL contact + plan + amount, creates a
 * Stripe Checkout Session, writes the session URL back to the GHL contact's
 * custom field (default key `stripe_checkout_url`), and returns the URL.
 *
 * Body:
 *   {
 *     "contactId": "ghl-contact-id",
 *     "email":     "buyer@example.com",
 *     "plan":      "Just Listed AI · 500 homes",
 *     "amount":    99            // USD dollars (float allowed)
 *   }
 *
 * Optional security: if GENERATE_CHECKOUT_TOKEN is set on the server, callers
 * must send the same value via header `X-Webhook-Token`. Leave unset in dev.
 */

const bodySchema = z.object({
  contactId: z.string().trim().min(1).max(120),
  email: z.string().trim().email(),
  plan: z.string().trim().min(1).max(120),
  /** USD dollars. Accepts integer or float. Will be rounded to cents. */
  amount: z.coerce.number().positive().max(100_000),
  /** Optional currency override; defaults to USD. */
  currency: z.string().trim().length(3).optional(),
  /** Optional override for success URL (must be https in prod). */
  successUrl: z.string().url().optional(),
  /** Optional override for cancel URL (must be https in prod). */
  cancelUrl: z.string().url().optional(),
});

export type GenerateCheckoutBody = z.infer<typeof bodySchema>;

type GhlUpdateResult =
  | { mode: "configured"; status: number }
  | { mode: "webhook"; status: number }
  | { mode: "skipped"; reason: string }
  | { mode: "error"; status?: number; message: string };

function publicSiteBase(): string {
  return (process.env.APP_PUBLIC_URL || "https://circle-prospecting-ai.web.app").replace(/\/$/, "");
}

/**
 * Writes the Stripe checkout URL back to a GHL contact custom field.
 *
 * Two strategies (env-driven):
 *   1) Direct LeadConnector v2 API (preferred). Requires GHL_BEARER_TOKEN.
 *      Optional: GHL_API_BASE_URL, GHL_API_VERSION,
 *                GHL_CHECKOUT_URL_FIELD_ID (custom field id from GHL Settings),
 *                GHL_CHECKOUT_URL_FIELD_KEY (defaults to "stripe_checkout_url").
 *   2) Inbound Webhook fallback. If GHL_UPSERT_CONTACT_URL is set we POST the
 *      payload there instead — your existing GHL automation can map it.
 */
export async function updateGhlCheckoutUrl(args: {
  contactId: string;
  email: string;
  plan: string;
  amount: number;
  url: string;
  sessionId: string;
}): Promise<GhlUpdateResult> {
  const token = process.env.GHL_BEARER_TOKEN?.trim();
  const webhookUrl = process.env.GHL_UPSERT_CONTACT_URL?.trim();

  if (!token && !webhookUrl) {
    return { mode: "skipped", reason: "Set GHL_BEARER_TOKEN (direct API) or GHL_UPSERT_CONTACT_URL (webhook) to enable contact update." };
  }

  const fieldKey = (process.env.GHL_CHECKOUT_URL_FIELD_KEY?.trim() || "stripe_checkout_url");
  const fieldId = process.env.GHL_CHECKOUT_URL_FIELD_ID?.trim();

  if (token) {
    const apiBase = (process.env.GHL_API_BASE_URL?.trim() || "https://services.leadconnectorhq.com").replace(/\/$/, "");
    const version = process.env.GHL_API_VERSION?.trim() || "2021-07-28";

    const customFields: Array<Record<string, string>> = [];
    if (fieldId) customFields.push({ id: fieldId, field_value: args.url });
    customFields.push({ key: fieldKey, field_value: args.url });

    try {
      const r = await axios.put(
        `${apiBase}/contacts/${encodeURIComponent(args.contactId)}`,
        { customFields, email: args.email },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Version: version,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          timeout: 15_000,
          validateStatus: () => true,
        }
      );
      if (r.status >= 200 && r.status < 300) {
        return { mode: "configured", status: r.status };
      }
      return { mode: "error", status: r.status, message: typeof r.data === "string" ? r.data.slice(0, 300) : JSON.stringify(r.data).slice(0, 300) };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "ghl_request_failed";
      return { mode: "error", message: msg };
    }
  }

  try {
    const r = await axios.post(
      webhookUrl as string,
      {
        contactId: args.contactId,
        email: args.email,
        customFields: { [fieldKey]: args.url },
        source: "circle-prospecting-ai · /api/generate-checkout",
        sessionId: args.sessionId,
        plan: args.plan,
        amount: args.amount,
      },
      {
        headers: { "Content-Type": "application/json" },
        timeout: 15_000,
        validateStatus: () => true,
      }
    );
    if (r.status >= 200 && r.status < 300) return { mode: "webhook", status: r.status };
    return { mode: "error", status: r.status, message: typeof r.data === "string" ? r.data.slice(0, 300) : JSON.stringify(r.data).slice(0, 300) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ghl_webhook_failed";
    return { mode: "error", message: msg };
  }
}

export function createGenerateCheckoutHandler() {
  return async function generateCheckoutHandler(req: Request, res: Response): Promise<void> {
    const requiredToken = process.env.GENERATE_CHECKOUT_TOKEN?.trim();
    if (requiredToken) {
      const presented = String(req.header("x-webhook-token") || "").trim();
      if (presented !== requiredToken) {
        res.status(401).json({ error: "unauthorized", message: "Missing or invalid X-Webhook-Token header." });
        return;
      }
    }

    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_body", details: parsed.error.flatten() });
      return;
    }
    const { contactId, email, plan, amount } = parsed.data;
    const currency = (parsed.data.currency || "usd").toLowerCase();
    const amountCents = Math.round(amount * 100);
    if (amountCents < 50) {
      res.status(400).json({ error: "amount_below_minimum", message: "Amount must be at least $0.50." });
      return;
    }

    const sk = process.env.STRIPE_SECRET_KEY?.trim();
    if (!sk) {
      res.status(503).json({ error: "stripe_not_configured", message: "Set STRIPE_SECRET_KEY on the API server." });
      return;
    }
    const stripe = new Stripe(sk);
    const base = publicSiteBase();
    const idem = crypto.randomUUID().replace(/[^a-zA-Z0-9-]/g, "").slice(0, 40);

    let session: Stripe.Checkout.Session;
    try {
      session = await stripe.checkout.sessions.create(
        {
          mode: "payment",
          customer_email: email,
          client_reference_id: `ghl-${contactId}`,
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency,
                unit_amount: amountCents,
                product_data: {
                  name: plan,
                  description: `Pre-generated for GHL contact ${contactId}`,
                },
              },
            },
          ],
          success_url: parsed.data.successUrl || `${base}/order/success?session_id={CHECKOUT_SESSION_ID}&ghl=${encodeURIComponent(contactId)}`,
          cancel_url: parsed.data.cancelUrl || `${base}/?canceled=1&ghl=${encodeURIComponent(contactId)}`,
          metadata: {
            checkoutType: "ghl_generated",
            ghlContactId: contactId,
            plan,
            amountUsd: String(amount),
            customerEmail: email,
            source: "generate-checkout",
          },
        },
        { idempotencyKey: `ghl-${contactId}-${amountCents}-${idem}`.slice(0, 90) }
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "stripe_session_create_failed";
      opsLog("generate_checkout_stripe_failed", { contactId, message: msg });
      res.status(502).json({ error: "stripe_failed", message: msg });
      return;
    }

    if (!session.url) {
      res.status(500).json({ error: "no_checkout_url" });
      return;
    }

    const ghl = await updateGhlCheckoutUrl({
      contactId,
      email,
      plan,
      amount,
      url: session.url,
      sessionId: session.id,
    });

    opsLog("generate_checkout_session_created", {
      sessionId: session.id,
      contactId,
      amountCents,
      ghlMode: ghl.mode,
    });

    res.json({
      ok: true,
      url: session.url,
      sessionId: session.id,
      amountCents,
      currency,
      ghl,
    });
  };
}
