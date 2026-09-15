import Stripe from "stripe";
import { fulfillLeadPackFromSession } from "./leadFulfillment.js";
import { opsLog } from "./opsLog.js";
import {
  buildAdminPurchaseEmail,
  buildCustomerPurchaseEmail,
  buildTeamOrderEmailCopy,
  DEFAULT_ORDER_NOTIFICATION_EMAIL,
  getMailTransportInfo,
  sendTextEmail,
  splitPersonName,
} from "./mailer.js";
import { canonicalCheckoutEmail, normalizePhoneDigits } from "./checkoutIdentity.js";
import { updateGhlContactFields } from "./ghlContactFetch.js";
import { isAwsCrmMode } from "./circleCrmMode.js";
import { safeSendMetaPurchaseCapi } from "./metaCapi.js";
import { buildMlsCheckoutUrl } from "./payLinkTrack.js";
import { parseAgentRoleInput } from "../src/lib/listingAgents.js";
import { resolveRealMls } from "../src/lib/listingDraft.js";
import {
  serviceLineLabel,
  tierRowMeta,
  type LeadServiceLine,
  type LeadTierId,
} from "../src/lib/leadPricing.js";
import {
  hasPurchaseNotification,
  isAdminPurchaseEmailSent,
  isCustomerReceiptEmailSent,
  markAdminPurchaseEmailSent,
  markCustomerReceiptEmailSent,
  markPurchaseNotification,
  orderNumberFromSessionId,
} from "./purchaseConfirmStore.js";
import { markCheckoutPaid } from "./checkoutFunnelStore.js";

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
    if (session.metadata?.checkoutType === "lead_pack" || session.metadata?.checkoutType === "intro_campaign") {
      const n = session.metadata.requestedLeads || session.metadata.packSize || "";
      const svc = session.metadata.serviceLine ? String(session.metadata.serviceLine) : "";
      const tier = session.metadata.leadTier ? String(session.metadata.leadTier) : "";
      const bits = [n && `${n} leads`, svc, tier].filter(Boolean);
      const label = session.metadata.checkoutType === "intro_campaign" ? "Intro campaign" : "Lead pack";
      return [bits.length ? `${label} (${bits.join(" · ")})` : `${label} (${session.metadata.packSize || "unknown"} leads)`];
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

function parseOrderNotificationRecipients(): string[] {
  const raw =
    process.env.PURCHASE_NOTIFICATION_EMAIL?.trim() ||
    process.env.ADMIN_PURCHASE_EMAIL?.trim() ||
    DEFAULT_ORDER_NOTIFICATION_EMAIL;
  return raw
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter((s) => s.includes("@"));
}

function listingTypeFromCampaignType(campaignType: string | null | undefined): string | null {
  const t = (campaignType ?? "").trim().toLowerCase();
  if (t === "just_sold") return "Just Sold";
  if (t === "just_listed") return "Just Listed";
  return null;
}

function purchaseMailRadius(s: Stripe.Checkout.Session): string | null {
  const label = String(s.metadata?.radiusLabel || "").trim();
  if (label) return label;
  const miles = String(s.metadata?.radiusMiles || "").trim();
  return miles ? `${miles} mi` : null;
}

function purchaseMailPlan(s: Stripe.Checkout.Session): string | null {
  const sl = String(s.metadata?.serviceLine || "").trim() as LeadServiceLine;
  const tier = String(s.metadata?.leadTier || "").trim() as LeadTierId;
  const parts: string[] = [];
  if (sl) {
    try {
      parts.push(serviceLineLabel(sl));
    } catch {
      parts.push(sl);
    }
  }
  if (tier) {
    try {
      parts.push(tierRowMeta(tier).packageLabel);
    } catch {
      parts.push(tier);
    }
  }
  return parts.length ? parts.join(" · ") : null;
}

function purchaseMailHomes(s: Stripe.Checkout.Session, requestedLeads: number): string | null {
  if (Number.isFinite(requestedLeads) && requestedLeads > 0) {
    return requestedLeads.toLocaleString("en-US");
  }
  const raw = String(s.metadata?.requestedLeads || s.metadata?.packSize || "").trim();
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n.toLocaleString("en-US") : null;
}

function payLinkUrlFromSession(s: Stripe.Checkout.Session): string | null {
  const mls = resolveRealMls(s.metadata?.mls);
  if (!mls) return null;
  const agentRole = parseAgentRoleInput(String(s.metadata?.agentRole || "")) ?? undefined;
  return buildMlsCheckoutUrl(mls, {
    agentRole,
    listingType: listingTypeFromCampaignType(s.metadata?.campaignType),
  });
}

/**
 * Idempotent: persist purchase if missing, fulfill lead packs, send receipt/admin mail when appropriate.
 * Used by Stripe webhook and by POST /api/checkout/sync-paid-session (thank-you page for repeat buyers).
 */
export async function applyPaidCheckoutSessionSideEffects(s: Stripe.Checkout.Session): Promise<void> {
  if (s.payment_status !== "paid") {
    return;
  }

  try {
    markCheckoutPaid(s.id);
  } catch (err) {
    console.error("[checkoutFunnel] markCheckoutPaid failed", err);
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
      customerPhone: String(s.metadata?.customerPhone || "").trim() || customerPhoneDigits || null,
      amountTotalCents: s.amount_total,
      currency: s.currency || null,
      lineItems,
      leadServiceLine: s.metadata?.serviceLine ?? null,
      leadTier: s.metadata?.leadTier ?? null,
      requestedLeads: Number.isFinite(rlNum) ? rlNum : null,
      targetingSummary:
        [s.metadata?.city, s.metadata?.county, s.metadata?.zip].filter(Boolean).join(", ") || null,
      mls: resolveRealMls(s.metadata?.mls) || null,
      listingAddress: s.metadata?.listingAddress || null,
      agentName: s.metadata?.agentName || null,
      brokerage: s.metadata?.brokerage || null,
      campaignType: s.metadata?.campaignType || null,
      radiusLabel: s.metadata?.radiusLabel || null,
    });
  }

  let firstName = String(s.metadata?.firstName || "").trim();
  let lastName = String(s.metadata?.lastName || "").trim();
  if (!firstName && !lastName && s.metadata?.agentName) {
    const split = splitPersonName(s.metadata.agentName);
    firstName = split.firstName;
    lastName = split.lastName;
  }
  const purchaseMailArgs = {
    orderNumber,
    checkoutType: s.metadata?.checkoutType || "general",
    sessionId: s.id,
    lineItems,
    amountTotalCents: s.amount_total,
    currency: s.currency,
    firstName: firstName || null,
    lastName: lastName || null,
    agentEmail: customerEmail || String(s.metadata?.customerEmail || "").trim() || null,
    agentPhone: String(s.metadata?.customerPhone || "").trim() || customerPhoneDigits || null,
    payLinkUrl: payLinkUrlFromSession(s),
    listingAddress: s.metadata?.listingAddress || null,
    radius: purchaseMailRadius(s),
    plan: purchaseMailPlan(s),
    homesInOrder: purchaseMailHomes(s, rlNum),
    mls: resolveRealMls(s.metadata?.mls) || null,
  };

  if (customerEmail && !(await isCustomerReceiptEmailSent(s.id))) {
    const mail = buildCustomerPurchaseEmail(purchaseMailArgs);
    try {
      const customerSend = await sendTextEmail(customerEmail, mail.subject, mail.text, mail.html, {
        ghlExtras: mail.ghlFields,
      });
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

  const teamRecipients = parseOrderNotificationRecipients();
  // GHL already drops a copy of the customer Send Email into the account inbox.
  // A second API send (subject prefixed [Copy]) is the duplicate they were seeing.
  const skipTeamCopy = getMailTransportInfo().mode === "ghl";
  if (skipTeamCopy) {
    console.info("[purchase-email] Skipping extra team copy — GHL already copies the customer receipt", {
      sessionId: s.id,
    });
  } else if (teamRecipients.length && !(await isAdminPurchaseEmailSent(s.id))) {
    const teamMail = customerEmail
      ? buildTeamOrderEmailCopy({ ...purchaseMailArgs, customerEmail })
      : null;
    const adminMail =
      teamMail ??
      (() => {
        const plain = buildAdminPurchaseEmail({
          orderNumber,
          checkoutType: s.metadata?.checkoutType || "general",
          sessionId: s.id,
          customerEmail: customerEmail || undefined,
          lineItems,
          amountTotalCents: s.amount_total,
          currency: s.currency,
        });
        return { subject: plain.subject, text: plain.body, html: undefined, ghlFields: undefined };
      })();
    try {
      const teamSend = await sendTextEmail(
        teamRecipients.join(","),
        adminMail.subject,
        adminMail.text,
        adminMail.html,
        adminMail.ghlFields ? { ghlExtras: adminMail.ghlFields } : undefined
      );
      if (teamSend.mode !== "skipped") {
        await markAdminPurchaseEmailSent(s.id);
        console.info("[purchase-email] Team order copy sent", {
          sessionId: s.id,
          mode: teamSend.mode,
          recipients: teamRecipients.join(","),
        });
      }
    } catch (e) {
      console.error("[purchase-email] Team order copy send failed", s.id, e);
    }
  }

  const ghlContactId = (s.metadata?.ghlContactId || "").trim();
  if (ghlContactId && !isAwsCrmMode()) {
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

  if (s.metadata?.checkoutType === "lead_pack" || s.metadata?.checkoutType === "intro_campaign") {
    try {
      fulfillLeadPackFromSession(s);
    } catch (e) {
      console.error("[purchase] lead fulfillment failed after mail", s.id, e);
      opsLog("allocate_leads_failed", { sessionId: s.id, error: e instanceof Error ? e.message : "unknown" });
    }
  }

  opsLog("purchase_pipeline_ok", {
    sessionId: s.id,
    orderNumber,
    checkoutType: s.metadata?.checkoutType || "general",
  });

  safeSendMetaPurchaseCapi(s);
}
