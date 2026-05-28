import Stripe from "stripe";
import { canonicalCheckoutEmail } from "./checkoutIdentity.js";
import { allocateLeads } from "./leadStore.js";
import { opsLog } from "./opsLog.js";

export function fulfillLeadPackFromSession(session: Stripe.Checkout.Session) {
  if (session.metadata?.checkoutType !== "lead_pack") return;
  const packSize = Number(session.metadata?.packSize || session.metadata?.requestedLeads || 0);
  const email = canonicalCheckoutEmail(session);
  if (!email || !packSize) {
    console.error("lead pack fulfillment: missing email or pack size", session.id);
    return;
  }
  const r = allocateLeads(email, packSize, session.id);
  if (!r.ok) {
    console.error("allocateLeads", r.error);
    opsLog("allocate_leads_failed", { sessionId: session.id, error: r.error });
  }
}
