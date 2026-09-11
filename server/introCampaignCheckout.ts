import type { Request, Response } from "express";
import Stripe from "stripe";
import { z } from "zod";
import { normalizePhoneDigits } from "./checkoutIdentity.js";
import { recordCheckoutStarted, listingFunnelPagePath } from "./checkoutFunnelStore.js";
import { effectiveCheckoutAvailable } from "./leadStore.js";
import { splitPersonName } from "./mailer.js";
import { resolveRealMls } from "../src/lib/listingDraft.js";
import { serviceLineLabel, tierRowMeta } from "../src/lib/leadPricing.js";
import { productionSiteBase } from "../src/lib/siteUrl.js";

export const INTRO_CAMPAIGN_HOMES = 250;
export const INTRO_CAMPAIGN_PRICE_CENTS = 9900;
export const INTRO_CAMPAIGN_SERVICE_LINE = "live_callers" as const;
export const INTRO_CAMPAIGN_TIER = "starter" as const;
export const INTRO_CHECKOUT_TYPE = "intro_campaign";

const introCheckoutBody = z.object({
  email: z.string().trim().email().max(160),
  phone: z.string().trim().min(10).max(40),
  city: z.string().trim().max(80).optional(),
  county: z.string().trim().max(80).optional(),
  zip: z.string().trim().max(20).optional(),
  radiusMiles: z.number().finite().positive().max(100).optional(),
  campaignType: z.enum(["just_listed", "just_sold"]).optional(),
  agentRole: z.enum(["buyer", "seller"]).optional(),
  mls: z.string().trim().max(64).optional(),
  listingAddress: z.string().trim().max(240).optional(),
  agentName: z.string().trim().max(120).optional(),
  brokerage: z.string().trim().max(120).optional(),
  radiusLabel: z.string().trim().max(80).optional(),
  pagePath: z.string().trim().max(200).optional(),
});

function publicBaseUrl(): string {
  return productionSiteBase();
}

function safeRecordCheckoutStarted(input: Parameters<typeof recordCheckoutStarted>[0]) {
  try {
    recordCheckoutStarted(input);
  } catch (err) {
    console.error("[introCampaign] recordCheckoutStarted failed", err);
  }
}

export async function handleIntroEligibility(req: Request, res: Response): Promise<void> {
  const email = String(req.query.email ?? "").trim();
  if (!email.includes("@")) {
    res.status(400).json({ eligible: false, reason: "invalid_email", message: "Enter a valid email." });
    return;
  }
  res.json({ eligible: true });
}

export async function handleIntroCampaignCheckout(req: Request, res: Response): Promise<void> {
  const parsed = introCheckoutBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid body", details: parsed.error.flatten() });
    return;
  }
  const {
    email,
    phone,
    city,
    county,
    zip,
    radiusMiles,
    campaignType,
    agentRole,
    mls,
    listingAddress,
    agentName,
    brokerage,
    radiusLabel: radiusRingLabel,
    pagePath: pagePathRaw,
  } = parsed.data;

  const emailNorm = email.trim().toLowerCase();

  const phoneDigits = normalizePhoneDigits(phone);
  if (phoneDigits.length < 10) {
    res.status(400).json({ error: "invalid_phone", message: "Phone must include at least 10 digits." });
    return;
  }

  const requestedLeads = INTRO_CAMPAIGN_HOMES;
  const checkoutAvailable = effectiveCheckoutAvailable();
  if (requestedLeads > checkoutAvailable) {
    res.status(409).json({
      error: "insufficient_inventory",
      message: `Only ${checkoutAvailable.toLocaleString()} lead(s) are available in inventory (intro offer requires ${requestedLeads.toLocaleString()}).`,
      available: checkoutAvailable,
      requested: requestedLeads,
    });
    return;
  }

  const sk = process.env.STRIPE_SECRET_KEY;
  if (!sk) {
    res.status(503).json({ mode: "unconfigured", message: "Set STRIPE_SECRET_KEY" });
    return;
  }

  const stripe = new Stripe(sk);
  const base = publicBaseUrl();
  const idem = crypto.randomUUID().replace(/[^a-zA-Z0-9-]/g, "").slice(0, 40);
  const locationLabel = [city, county, zip].filter(Boolean).join(", ");
  const radiusMilesLabel = radiusMiles ? `${radiusMiles} mi` : "";
  const targetingLabel = [locationLabel, radiusRingLabel || radiusMilesLabel].filter(Boolean).join(" • ");
  const tierLabel = tierRowMeta(INTRO_CAMPAIGN_TIER).packageLabel;
  const campaignLabel =
    campaignType === "just_sold" ? "Just sold" : campaignType === "just_listed" ? "Just listed" : "";
  const productTitle = `${campaignLabel ? `${campaignLabel} · ` : ""}First-Time Offer — ${serviceLineLabel(INTRO_CAMPAIGN_SERVICE_LINE)} — ${requestedLeads.toLocaleString()} homeowners`;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: emailNorm,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: INTRO_CAMPAIGN_PRICE_CENTS,
          product_data: {
            name: productTitle,
            description: [
              "Introductory first-time customer offer — $99 for 250 homeowners.",
              campaignLabel && `Campaign: ${campaignLabel} neighborhood promotion`,
              targetingLabel && `Area: ${targetingLabel}`,
              "Professional live callers · delivery in your dashboard after payment.",
            ]
              .filter(Boolean)
              .join(" "),
          },
        },
      },
    ],
    success_url: `${base}/order/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/99promo/checkout?canceled=1&session_id={CHECKOUT_SESSION_ID}`,
    client_reference_id: `intro-${idem}`,
    metadata: {
      checkoutType: INTRO_CHECKOUT_TYPE,
      packSize: String(requestedLeads),
      serviceLine: INTRO_CAMPAIGN_SERVICE_LINE,
      leadTier: INTRO_CAMPAIGN_TIER,
      customerEmail: emailNorm,
      customerPhone: phoneDigits,
      city: city || "",
      county: county || "",
      zip: zip || "",
      radiusMiles: radiusMiles ? String(radiusMiles) : "",
      requestedLeads: String(requestedLeads),
      campaignType: campaignType ?? "",
      agentRole: agentRole ?? "",
      promoCode: "",
      mls: resolveRealMls(mls) || "",
      listingAddress: listingAddress || "",
      agentName: agentName || "",
      firstName: splitPersonName(agentName || "").firstName,
      lastName: splitPersonName(agentName || "").lastName,
      brokerage: brokerage || "",
      radiusLabel: radiusRingLabel || "",
    },
  });

  const mlsNorm = resolveRealMls(mls) || "";
  const pagePath =
    (pagePathRaw || "").trim() ||
    listingFunnelPagePath({
      intro: true,
      mls: mlsNorm,
      campaignType,
      agentRole,
    });

  safeRecordCheckoutStarted({
    sessionId: session.id,
    source: "buy_leads",
    checkoutType: INTRO_CHECKOUT_TYPE,
    customerEmail: emailNorm,
    requestedLeads,
    serviceLine: INTRO_CAMPAIGN_SERVICE_LINE,
    leadTier: INTRO_CAMPAIGN_TIER,
    amountCents: INTRO_CAMPAIGN_PRICE_CENTS,
    mls: mlsNorm,
    listingAddress: listingAddress || null,
    pagePath,
  });

  res.json({
    url: session.url,
    sessionId: session.id,
    unitAmountCents: INTRO_CAMPAIGN_PRICE_CENTS,
    tierLabel,
  });
}
