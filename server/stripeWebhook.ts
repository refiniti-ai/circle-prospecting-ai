import type { Request, Response } from "express";
import Stripe from "stripe";
import { fulfillLeadPackFromSession } from "./leadFulfillment.js";
import { buildAdminPurchaseEmail, buildCustomerPurchaseEmail, sendTextEmail } from "./mailer.js";
import { hasPurchaseNotification, markPurchaseNotification, orderNumberFromSessionId } from "./purchaseConfirmStore.js";

function listLineItems(session: Stripe.Checkout.Session): string[] {
  const expanded = session.line_items?.data || [];
  if (!expanded.length) {
    if (session.metadata?.checkoutType === "lead_pack") {
      const n = session.metadata.requestedLeads || session.metadata.packSize || "";
      const svc = session.metadata.serviceLine ? String(session.metadata.serviceLine) : "";
      const tier = session.metadata.leadTier ? String(session.metadata.leadTier) : "";
      const bits = [n && `${n} leads`, svc, tier].filter(Boolean);
      return [bits.length ? `Lead pack (${bits.join(" · ")})` : `Lead pack (${session.metadata.packSize || "unknown"} leads)`];
    }
    if (session.metadata?.checkoutType === "campaign") {
      return [
        `Campaign ${String(session.metadata.plan || "").toUpperCase()} • radius ${session.metadata.radius || "n/a"} • ${session.metadata.homeCount || "n/a"} homes`,
      ];
    }
    return ["Purchase item"];
  }
  return expanded.map((line) => {
    const name = line.description || line.price?.nickname || "Item";
    const qty = line.quantity || 1;
    return `${name} x${qty}`;
  });
}

function parseAdminRecipients(): string[] {
  const raw = process.env.PURCHASE_NOTIFICATION_EMAIL || process.env.ADMIN_PURCHASE_EMAIL || "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function createStripeWebhookHandler() {
  return async (req: Request, res: Response) => {
    const sk = process.env.STRIPE_SECRET_KEY;
    const wh = process.env.STRIPE_WEBHOOK_SECRET;
    if (!sk) {
      res.status(503).json({ error: "STRIPE_SECRET_KEY missing" });
      return;
    }
    if (!wh) {
      if (process.env.NODE_ENV === "production") {
        res.status(503).json({ error: "STRIPE_WEBHOOK_SECRET required in production" });
        return;
      }
      res.json({ received: true, note: "webhook secret not set — use Stripe CLI in dev" });
      return;
    }
    const stripe = new Stripe(sk);
    const sig = req.get("stripe-signature");
    const body = req.body;
    if (!Buffer.isBuffer(body) || !sig) {
      res.status(400).send("bad request");
      return;
    }
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, sig, wh);
    } catch (err) {
      console.error("webhook verify", err);
      res.status(400).send("sig");
      return;
    }
    if (event.type === "checkout.session.completed") {
      try {
        const minimal = event.data.object as Stripe.Checkout.Session;
        const s = await stripe.checkout.sessions.retrieve(minimal.id, { expand: ["line_items"] });
        if (s.metadata?.checkoutType === "lead_pack") {
          fulfillLeadPackFromSession(s);
        }

        if (!(await hasPurchaseNotification(s.id))) {
          const orderNumber = orderNumberFromSessionId(s.id);
          const customerEmail = s.customer_details?.email || s.customer_email || s.metadata?.customerEmail;
          const lineItems = listLineItems(s);

          if (customerEmail) {
            const mail = buildCustomerPurchaseEmail({
              orderNumber,
              checkoutType: s.metadata?.checkoutType || "general",
              sessionId: s.id,
              lineItems,
              amountTotalCents: s.amount_total,
              currency: s.currency,
            });
            await sendTextEmail(customerEmail, mail.subject, mail.body);
          }

          const adminRecipients = parseAdminRecipients();
          if (adminRecipients.length) {
            const adminMail = buildAdminPurchaseEmail({
              orderNumber,
              checkoutType: s.metadata?.checkoutType || "general",
              sessionId: s.id,
              customerEmail: customerEmail || undefined,
              lineItems,
              amountTotalCents: s.amount_total,
              currency: s.currency,
            });
            await sendTextEmail(adminRecipients.join(","), adminMail.subject, adminMail.body);
          }

          const rlRaw = s.metadata?.requestedLeads || s.metadata?.packSize;
          const rlNum = rlRaw ? Number.parseInt(String(rlRaw), 10) : NaN;
          await markPurchaseNotification(s.id, {
            orderNumber,
            notifiedAt: new Date().toISOString(),
            checkoutType: s.metadata?.checkoutType || "general",
            customerEmail: customerEmail || null,
            amountTotalCents: s.amount_total,
            currency: s.currency || null,
            lineItems,
            leadServiceLine: s.metadata?.serviceLine ?? null,
            leadTier: s.metadata?.leadTier ?? null,
            requestedLeads: Number.isFinite(rlNum) ? rlNum : null,
            targetingSummary:
              [s.metadata?.city, s.metadata?.county, s.metadata?.zip].filter(Boolean).join(", ") || null,
          });
        }
      } catch (err) {
        console.error("checkout.session.completed processing failed", err);
        res.status(500).json({ error: "webhook processing failed" });
        return;
      }
    }
    res.json({ received: true });
  };
}
