import { createHash } from "node:crypto";
import type Stripe from "stripe";
import { canonicalCheckoutEmail, normalizePhoneDigits } from "./checkoutIdentity.js";
import { orderNumberFromSessionId } from "./purchaseConfirmStore.js";
import { productionSiteBase } from "../src/lib/siteUrl.js";

const PIXEL_ID = process.env.META_PIXEL_ID?.trim() || process.env.FACEBOOK_PIXEL_ID?.trim() || "1369877655256076";

function capiToken(): string {
  return process.env.META_CAPI_ACCESS_TOKEN?.trim() || process.env.FACEBOOK_CAPI_ACCESS_TOKEN?.trim() || "";
}

function sha256Norm(raw: string): string {
  return createHash("sha256").update(raw.trim().toLowerCase(), "utf8").digest("hex");
}

function hashedEmail(email: string | null | undefined): string | null {
  const e = (email || "").trim().toLowerCase();
  if (!e.includes("@")) return null;
  return sha256Norm(e);
}

function hashedPhone(raw: string | null | undefined): string | null {
  const digits = normalizePhoneDigits(String(raw || ""));
  if (digits.length < 10) return null;
  const e164 = digits.length === 10 ? `1${digits}` : digits;
  return sha256Norm(e164);
}

export async function sendMetaPurchaseCapi(session: Stripe.Checkout.Session): Promise<void> {
  const token = capiToken();
  if (!token) return;
  if (session.payment_status !== "paid") return;

  const value =
    typeof session.amount_total === "number" && Number.isFinite(session.amount_total)
      ? session.amount_total / 100
      : null;
  if (value == null || value < 0) return;

  const email = hashedEmail(canonicalCheckoutEmail(session));
  const phone = hashedPhone(session.metadata?.customerPhone);
  const user_data: Record<string, unknown> = {
    external_id: sha256Norm(session.id),
  };
  if (email) user_data.em = [email];
  if (phone) user_data.ph = [phone];

  const currency = (session.currency || "usd").toUpperCase();
  const orderNumber = orderNumberFromSessionId(session.id);
  const payload: Record<string, unknown> = {
    data: [
      {
        event_name: "Purchase",
        event_time: Math.floor(Date.now() / 1000),
        event_id: session.id,
        event_source_url: `${productionSiteBase()}/order/success?session_id=${encodeURIComponent(session.id)}`,
        action_source: "website",
        user_data,
        custom_data: {
          currency,
          value,
          order_id: orderNumber,
          content_type: "product",
          content_ids: [orderNumber],
          num_items: 1,
        },
      },
    ],
  };
  const testCode = process.env.META_CAPI_TEST_EVENT_CODE?.trim();
  if (testCode) payload.test_event_code = testCode;

  const url = `https://graph.facebook.com/v21.0/${encodeURIComponent(PIXEL_ID)}/events?access_token=${encodeURIComponent(token)}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const body = (await r.text()).slice(0, 240);
    throw new Error(`meta_capi_${r.status}:${body}`);
  }
}

export function safeSendMetaPurchaseCapi(session: Stripe.Checkout.Session): void {
  void sendMetaPurchaseCapi(session).catch((err) => {
    console.error("[metaCapi] Purchase send failed", err instanceof Error ? err.message : err);
  });
}
