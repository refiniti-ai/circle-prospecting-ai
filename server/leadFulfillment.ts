import Stripe from "stripe";
import { allocateLeads } from "./leadStore.js";

export function fulfillLeadPackFromSession(session: Stripe.Checkout.Session) {
  if (session.metadata?.checkoutType !== "lead_pack") return;
  const packSize = Number(session.metadata?.packSize || session.metadata?.requestedLeads || 0);
  const email = session.customer_details?.email || session.customer_email || session.metadata?.customerEmail;
  if (!email || !packSize) {
    console.error("lead pack fulfillment: missing email or pack size", session.id);
    return;
  }
  const r = allocateLeads(String(email), packSize, session.id);
  if (!r.ok) {
    console.error("allocateLeads", r.error);
  }
}
