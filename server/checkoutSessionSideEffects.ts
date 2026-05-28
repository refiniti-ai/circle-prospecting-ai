import Stripe from "stripe";
import { fulfillLeadPackFromSession } from "./leadFulfillment.js";
import { opsLog } from "./opsLog.js";
import { buildAdminPurchaseEmail, buildCustomerPurchaseEmail, sendTextEmail } from "./mailer.js";
import { canonicalCheckoutEmail, normalizePhoneDigits } from "./checkoutIdentity.js";
import { updateGhlContactFields } from "./ghlContactFetch.js";
import {
  hasPurchaseNotification,
  isAdminPurchaseEmailSent,
  isCustomerReceiptEmailSent,
  markAdminPurchaseEmailSent,
  markCustomerReceiptEmailSent,
  markPurchaseNotification,
  orderNumberFromSessionId,
} from "./purchaseConfirmStore.js";

/**
 * Format a date in Eastern Time (America/New_York handles EST/EDT automatically).
 * Example output: "May 25, 2026 01:45 AM EDT"
 */
function formatPaidAtEastern(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const month = get("month");
  const day = get("day");
  const year = get("year");
  const hour = get("hour");
  const minute = get("minute");
  const dayPeriod = get("dayPeriod");
  const tz = get("timeZoneName") || "ET";
  return `${month} ${day}, ${year} ${hour}:${minute} ${dayPeriod} ${tz}`;
}

export function listLineItemsForCheckoutSession(session: Stripe.Checkout.Session): string[] {
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

/**
 * Idempotent: persist purchase if missing, fulfill lead packs, send receipt/admin mail when appropriate.
 * Used by Stripe webhook and by POST /api/checkout/sync-paid-session (thank-you page for repeat buyers).
 */
export async function applyPaidCheckoutSessionSideEffects(s: Stripe.Checkout.Session): Promise<void> {
  if (s.payment_status !== "paid") {
    return;
  }

  if (s.metadata?.checkoutType === "lead_pack") {
    fulfillLeadPackFromSession(s);
  }

  const orderNumber = orderNumberFromSessionId(s.id);
  const customerEmail = canonicalCheckoutEmail(s);
  const lineItems = listLineItemsForCheckoutSession(s);
  const rlRaw = s.metadata?.requestedLeads || s.metadata?.packSize;
  const rlNum = rlRaw ? Number.parseInt(String(rlRaw), 10) : NaN;
  const pd = normalizePhoneDigits(String(s.metadata?.customerPhone || ""));
  const customerPhoneDigits = pd.length >= 10 ? pd.slice(-10) : null;

  if (!(await hasPurchaseNotification(s.id))) {
    await markPurchaseNotification(s.id, {
      orderNumber,
      notifiedAt: new Date().toISOString(),
      checkoutType: s.metadata?.checkoutType || "general",
      customerEmail,
      customerPhoneDigits,
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

  if (customerEmail && !(await isCustomerReceiptEmailSent(s.id))) {
    const mail = buildCustomerPurchaseEmail({
      orderNumber,
      checkoutType: s.metadata?.checkoutType || "general",
      sessionId: s.id,
      lineItems,
      amountTotalCents: s.amount_total,
      currency: s.currency,
    });
    try {
      const customerSend = await sendTextEmail(customerEmail, mail.subject, mail.text, mail.html);
      if (customerSend.mode === "skipped") {
        console.warn(
          "[purchase-email] Customer receipt not sent: no GHL_MAIL_WEBHOOK_URL, RESEND_API_KEY, or SMTP_* on the server (check Cloud Run env)."
        );
      } else {
        await markCustomerReceiptEmailSent(s.id);
        console.info("[purchase-email] Customer receipt sent", { sessionId: s.id, mode: customerSend.mode });
      }
    } catch (e) {
      console.error("[purchase-email] Customer receipt send failed", s.id, e);
    }
  } else if (!customerEmail) {
    console.warn(
      "[purchase-email] No customer email on Checkout session — enable 'Collect customer email' in Stripe Checkout or ensure metadata.customerEmail is set.",
      { sessionId: s.id }
    );
  }

  const adminRecipients = parseAdminRecipients();
  if (adminRecipients.length && !(await isAdminPurchaseEmailSent(s.id))) {
    const adminMail = buildAdminPurchaseEmail({
      orderNumber,
      checkoutType: s.metadata?.checkoutType || "general",
      sessionId: s.id,
      customerEmail: customerEmail || undefined,
      lineItems,
      amountTotalCents: s.amount_total,
      currency: s.currency,
    });
    try {
      const adminSend = await sendTextEmail(adminRecipients.join(","), adminMail.subject, adminMail.body);
      if (adminSend.mode !== "skipped") {
        await markAdminPurchaseEmailSent(s.id);
        console.info("[purchase-email] Admin notify sent", { sessionId: s.id, mode: adminSend.mode });
      }
    } catch (e) {
      console.error("[purchase-email] Admin notify send failed", s.id, e);
    }
  }

  const ghlContactId = (s.metadata?.ghlContactId || "").trim();
  if (ghlContactId) {
    try {
      const amountUsd = typeof s.amount_total === "number" ? (s.amount_total / 100).toFixed(2) : "";
      const fields: Record<string, string> = {
        payment_status: "paid",
        stripe_session_id: s.id,
        paid_at: formatPaidAtEastern(new Date()),
      };
      if (amountUsd) fields.paid_amount = amountUsd;
      const r = await updateGhlContactFields(ghlContactId, fields);
      if (!r.ok) {
        console.warn("[ghl-writeback] paid update failed", { sessionId: s.id, ghlContactId, status: r.status, message: r.message });
      } else {
        opsLog("ghl_contact_paid_writeback", { sessionId: s.id, ghlContactId });
      }
    } catch (e) {
      console.error("[ghl-writeback] error", e);
    }
  }

  opsLog("purchase_pipeline_ok", {
    sessionId: s.id,
    orderNumber,
    checkoutType: s.metadata?.checkoutType || "general",
  });
}
