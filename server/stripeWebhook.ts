import type { Request, Response } from "express";
import Stripe from "stripe";
import { applyPaidCheckoutSessionSideEffects } from "./checkoutSessionSideEffects.js";
import { opsLog } from "./opsLog.js";

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
        await applyPaidCheckoutSessionSideEffects(s);
        opsLog("stripe_webhook_checkout_completed", { sessionId: s.id, eventId: event.id });
      } catch (err) {
        console.error("checkout.session.completed processing failed", err);
        res.status(500).json({ error: "webhook processing failed" });
        return;
      }
    }
    res.json({ received: true });
  };
}
