import "dotenv/config";
import crypto from "node:crypto";
import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import multer from "multer";
import { parse } from "csv-parse/sync";
import { z } from "zod";
import Stripe from "stripe";
import { fetchOrderById, type RadiusId } from "./orderStore.js";
import { getUnitPrice, dollarsToCents, type PlanId } from "./pricing.js";
import { getCampaignTiers } from "./pricingGrid.js";
import { verifyHmacSha256 } from "./security.js";
import {
  totalCentsForSelection,
  leadCountFitsTier,
  serviceLineLabel,
  tierRowMeta,
  minLeadsForStripeForTier,
  publicPricingSnapshot,
  type LeadServiceLine,
  type LeadTierId,
} from "../src/lib/leadPricing.ts";
import { getSummary, upsertLeadsFromRows, getLeadsForEmail, estimateLeadCount } from "./leadStore.js";
import { signDashboardToken, verifyDashboardToken } from "./dashboardAuth.js";
import { fulfillLeadPackFromSession } from "./leadFulfillment.js";
import { createStripeWebhookHandler } from "./stripeWebhook.js";
import { processInboundNewListing } from "./newListingWorkflow.js";
import { listPurchaseNotifications, orderNumberFromSessionId } from "./purchaseConfirmStore.js";

const PORT = Number.parseInt(process.env.API_PORT || "8787", 10);
const app = express();
const isProd = process.env.NODE_ENV === "production";

const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173,http://127.0.0.1:5173")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.set("trust proxy", 1);
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(
  cors({
    origin: (orig, callback) => {
      if (!orig) {
        callback(null, true);
        return;
      }
      if (allowedOrigins.includes(orig)) {
        callback(null, true);
        return;
      }
      if (!isProd && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(orig)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    maxAge: 600,
  })
);

const generalLimit = rateLimit({ windowMs: 60_000, max: 200, standardHeaders: "draft-7", legacyHeaders: false });
const checkoutLimit = rateLimit({ windowMs: 60_000, max: 15, standardHeaders: "draft-7", legacyHeaders: false });
const webhookLimit = rateLimit({ windowMs: 60_000, max: 60, standardHeaders: "draft-7", legacyHeaders: false });

const rawJson = express.raw({ type: "application/json", limit: "256kb" });

async function handleInboundNewListing(req: Request, res: Response) {
  const secret = process.env.INBOUND_HMAC_SECRET;
  const buf = req.body as Buffer;
  if (!Buffer.isBuffer(buf) || buf.length === 0) {
    res.status(400).json({ error: "empty body" });
    return;
  }
  const sig = req.get("X-Circle-Signature") || req.get("X-Signature");
  const v = verifyHmacSha256(buf, sig, secret);
  if (secret) {
    if (!v.ok) {
      res.status(401).json({ error: "invalid signature" });
      return;
    }
  } else if (isProd) {
    res.status(503).json({ error: "inbound HMAC is required in production" });
    return;
  }
  let payload: unknown;
  try {
    payload = JSON.parse(buf.toString("utf8")) as unknown;
  } catch {
    res.status(400).json({ error: "invalid json" });
    return;
  }
  try {
    const result = await processInboundNewListing(payload);
    if (!result.ok) {
      res.status(result.status).json({ error: "payload invalid", details: result.error });
      return;
    }
    res.json({
      status: "accepted",
      orderId: result.orderId,
      orderLink: result.orderLink,
      workflow: result.workflow,
    });
  } catch (e) {
    console.error("new-listing workflow failed", e);
    res.status(500).json({ error: "workflow failed" });
  }
}

app.post("/api/new-listing", webhookLimit, rawJson, handleInboundNewListing);
app.post("/api/inbound/new-listing", webhookLimit, rawJson, handleInboundNewListing);

app.post(
  "/api/webhooks/stripe",
  webhookLimit,
  express.raw({ type: "application/json", limit: "2mb" }),
  createStripeWebhookHandler()
);

app.use(express.json({ limit: "48kb" }));

app.get("/api/health", generalLimit, (_req: Request, res: Response) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

const sessionIdQuery = z.object({ session_id: z.string().min(10).max(128) });

app.get("/api/checkout/confirmation", generalLimit, async (req: Request, res: Response) => {
  const parsed = sessionIdQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid session_id" });
    return;
  }
  const sk = process.env.STRIPE_SECRET_KEY;
  if (!sk) {
    res.status(503).json({ error: "stripe not configured" });
    return;
  }
  try {
    const stripe = new Stripe(sk);
    const session = await stripe.checkout.sessions.retrieve(parsed.data.session_id, { expand: ["line_items"] });
    const lineItems = (session.line_items?.data || []).map((line) => ({
      description: line.description || line.price?.nickname || "Item",
      quantity: line.quantity || 1,
      amountSubtotalCents: line.amount_subtotal,
      amountTotalCents: line.amount_total,
    }));
    res.json({
      orderNumber: orderNumberFromSessionId(session.id),
      sessionId: session.id,
      checkoutType: session.metadata?.checkoutType || "general",
      paymentStatus: session.payment_status,
      customerEmail: session.customer_details?.email || session.customer_email || session.metadata?.customerEmail || null,
      currency: session.currency || "usd",
      amountTotalCents: session.amount_total,
      lineItems,
    });
  } catch (err) {
    console.error("checkout confirmation", err);
    res.status(404).json({ error: "session not found" });
  }
});

app.get("/api/pricing", generalLimit, (_req: Request, res: Response) => {
  const tiers = getCampaignTiers();
  res.json({
    tiers: tiers.map((t) => ({
      min: t.min,
      max: t.max === Number.POSITIVE_INFINITY ? null : t.max,
      rates: t.rates,
    })),
  });
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 6 * 1024 * 1024 } });

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const key = process.env.ADMIN_API_KEY;
  if (!key) {
    res.status(503).json({ error: "ADMIN_API_KEY not set" });
    return;
  }
  const h = req.get("Authorization");
  if (h !== `Bearer ${key}`) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  next();
}

app.get("/api/public/lead-packs", generalLimit, (_req: Request, res: Response) => {
  res.json(publicPricingSnapshot());
});

const leadCountBody = z.object({
  city: z.string().optional(),
  county: z.string().optional(),
  zip: z.string().optional(),
  radiusMiles: z.coerce.number().optional(),
  includeContact: z.enum(["phones", "phones_email"]).optional(),
  occupancy: z.enum(["absentee", "owner"]).optional(),
  propertyTypes: z.array(z.string()).optional(),
  flags: z.array(z.string()).optional(),
});

app.post("/api/public/lead-count", generalLimit, (req: Request, res: Response) => {
  const parsed = leadCountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid body", details: parsed.error.flatten() });
    return;
  }
  const count = estimateLeadCount(parsed.data);
  res.json(count);
});

app.get("/api/admin/summary", generalLimit, requireAdmin, (_req: Request, res: Response) => {
  res.json({ inventory: getSummary() });
});

app.get("/api/admin/purchases", generalLimit, requireAdmin, (_req: Request, res: Response) => {
  res.json({ purchases: listPurchaseNotifications() });
});

app.post("/api/admin/leads/csv", generalLimit, requireAdmin, upload.single("file"), (req: Request, res: Response) => {
  const f = req.file;
  if (!f?.buffer) {
    res.status(400).json({ error: "file required" });
    return;
  }
  let records: Record<string, string>[];
  try {
    const text = f.buffer.toString("utf8");
    records = parse(text, { columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[];
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: "invalid csv" });
    return;
  }
  upsertLeadsFromRows(records);
  res.json({ ok: true, rows: records.length, summary: getSummary() });
});

const leadCheckout = z.object({
  serviceLine: z.enum(["ai_outreach", "live_callers", "hybrid", "data_only"]),
  leadTier: z.enum(["dabble", "starter", "growth", "scale"]),
  email: z.string().email(),
  requestedLeads: z.coerce.number().int().min(1).max(50_000),
  city: z.string().trim().max(80).optional(),
  county: z.string().trim().max(80).optional(),
  zip: z.string().trim().max(20).optional(),
  radiusMiles: z.coerce.number().positive().max(50).optional(),
});

app.post("/api/checkout/leads", checkoutLimit, async (req: Request, res: Response) => {
  const parsed = leadCheckout.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid body", details: parsed.error.flatten() });
    return;
  }
  const { serviceLine, leadTier, email, city, county, zip, radiusMiles, requestedLeads } = parsed.data;
  const sl = serviceLine as LeadServiceLine;
  const tier = leadTier as LeadTierId;
  if (!leadCountFitsTier(requestedLeads, tier)) {
    const meta = tierRowMeta(tier);
    const band =
      meta.maxLeads == null
        ? `${meta.minLeads.toLocaleString()}+`
        : `${meta.minLeads.toLocaleString()}–${meta.maxLeads.toLocaleString()}`;
    res.status(400).json({
      error: "lead_count_mismatch",
      message: `Lead count must match the selected plan (${meta.packageLabel}: ${band} homes).`,
      tier: leadTier,
    });
    return;
  }
  const unitAmountCents = totalCentsForSelection(sl, tier, requestedLeads);
  if (unitAmountCents < 50) {
    res.status(400).json({
      error: "below_minimum_charge",
      message: "Order total is below the card minimum ($0.50). Increase the number of leads.",
      minLeads: minLeadsForStripeForTier(sl, tier),
    });
    return;
  }
  const sk = process.env.STRIPE_SECRET_KEY;
  if (!sk) {
    res.status(503).json({ mode: "unconfigured", message: "Set STRIPE_SECRET_KEY" });
    return;
  }
  const stripe = new Stripe(sk);
  const base = getPublicBaseUrl();
  const idem = crypto.randomUUID().replace(/[^a-zA-Z0-9-]/g, "").slice(0, 40);
  const locationLabel = [city, county, zip].filter(Boolean).join(", ");
  const radiusLabel = radiusMiles ? `${radiusMiles} mi` : "";
  const targetingLabel = [locationLabel, radiusLabel].filter(Boolean).join(" • ");
  const tierLabel = tierRowMeta(tier).packageLabel;
  const productTitle = `${serviceLineLabel(sl)} — ${requestedLeads.toLocaleString()} homeowners (${tierLabel} plan)`;
  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      customer_email: email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: unitAmountCents,
            product_data: {
              name: productTitle,
              description: targetingLabel
                ? `Targeting: ${targetingLabel}. Delivery in dashboard after payment.`
                : "Qualified leads — delivery in your dashboard after payment (test mode ready).",
            },
          },
        },
      ],
      success_url: `${base}/order/success?session_id={CHECKOUT_SESSION_ID}&next=dashboard&claim=1`,
      cancel_url: `${base}/buy-leads?canceled=1`,
      client_reference_id: `leads-${idem}`,
      metadata: {
        checkoutType: "lead_pack",
        packSize: String(requestedLeads),
        serviceLine,
        leadTier: leadTier,
        customerEmail: email,
        city: city || "",
        county: county || "",
        zip: zip || "",
        radiusMiles: radiusMiles ? String(radiusMiles) : "",
        requestedLeads: String(requestedLeads),
      },
    },
    { idempotencyKey: `lead-${requestedLeads}-${serviceLine}-${leadTier}-${email}-${idem}`.slice(0, 90) }
  );
  if (!session.url) {
    res.status(500).json({ error: "no checkout url" });
    return;
  }
  res.json({ url: session.url, sessionId: session.id, unitAmountCents });
});

const claimBody = z.object({ sessionId: z.string().min(10) });

app.post("/api/auth/claim-leads", generalLimit, async (req: Request, res: Response) => {
  const parsed = claimBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid body" });
    return;
  }
  const sk = process.env.STRIPE_SECRET_KEY;
  if (!sk) {
    res.status(503).json({ error: "stripe not configured" });
    return;
  }
  const stripe = new Stripe(sk);
  const s = await stripe.checkout.sessions.retrieve(parsed.data.sessionId);
  if (s.payment_status !== "paid") {
    res.status(400).json({ error: "payment not complete" });
    return;
  }
  if (s.metadata?.checkoutType !== "lead_pack") {
    res.status(400).json({ error: "not a lead pack session" });
    return;
  }
  fulfillLeadPackFromSession(s);
  const email = s.customer_details?.email || s.customer_email || s.metadata?.customerEmail;
  if (!email) {
    res.status(400).json({ error: "no email on session" });
    return;
  }
  const token = await signDashboardToken(email);
  res.json({ token, email });
});

app.get("/api/my/leads", generalLimit, async (req: Request, res: Response) => {
  const auth = req.get("Authorization");
  const tok = auth?.startsWith("Bearer ") ? auth.slice(7) : undefined;
  if (!tok) {
    res.status(401).json({ error: "missing token" });
    return;
  }
  const email = await verifyDashboardToken(tok);
  if (!email) {
    res.status(401).json({ error: "invalid token" });
    return;
  }
  res.json({ email, leads: getLeadsForEmail(email) });
});

app.get("/api/my/leads/export", generalLimit, async (req: Request, res: Response) => {
  const auth = req.get("Authorization");
  const tok = auth?.startsWith("Bearer ") ? auth.slice(7) : undefined;
  if (!tok) {
    res.status(401).json({ error: "missing token" });
    return;
  }
  const email = await verifyDashboardToken(tok);
  if (!email) {
    res.status(401).json({ error: "invalid token" });
    return;
  }
  const leads = getLeadsForEmail(email);
  const header = ["id", "mls", "address", "city", "state", "zip", "listPrice", "phone", "email", "soldAt"].join(",");
  const lines = leads.map(
    (l) =>
      [l.id, l.mls, l.address, l.city, l.state, l.zip, l.listPrice, l.phone, l.email, l.soldAt || ""]
          .map((c) => `"${String(c).replace(/"/g, '""')}"`)
          .join(",")
  );
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="leads-${email.replace(/@/g, "-at-")}.csv"`);
  res.send([header, ...lines].join("\n"));
});

const planSchema = z.enum(["ai", "live", "pro"]);
const radiusSchema = z.enum(["subdivision", "q1", "h1", "m1", "zip"]);
const idParam = z.string().min(1).max(64);

app.get("/api/orders/:id", generalLimit, async (req: Request, res: Response) => {
  const id = idParam.safeParse(req.params.id);
  if (!id.success) {
    res.status(400).json({ error: "invalid id" });
    return;
  }
  try {
    const order = await fetchOrderById(id.data);
    if (!order) {
      res.status(404).json({ error: "order not found" });
      return;
    }
    res.json(order);
  } catch (e) {
    console.error(e);
    res.status(502).json({ error: "upstream order fetch failed" });
  }
});

const checkoutBody = z.object({
  orderId: z.string().min(1).max(64),
  plan: planSchema,
  radius: radiusSchema,
  clientIdempotency: z.string().min(8).max(256).optional(),
});

function getPublicBaseUrl() {
  return (process.env.APP_PUBLIC_URL || "http://localhost:5173").replace(/\/$/, "");
}

app.post("/api/checkout", checkoutLimit, async (req: Request, res: Response) => {
  const parsed = checkoutBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid body", details: parsed.error.flatten() });
    return;
  }
  const { orderId, plan, radius, clientIdempotency } = parsed.data;
  let order;
  try {
    order = await fetchOrderById(orderId);
  } catch (e) {
    console.error(e);
    res.status(502).json({ error: "order lookup failed" });
    return;
  }
  if (!order) {
    res.status(404).json({ error: "order not found" });
    return;
  }
  const homeCount = order.radii[radius as RadiusId].count;
  if (homeCount <= 0) {
    res.status(400).json({ error: "invalid radius count" });
    return;
  }
  const unit = getUnitPrice(homeCount, plan as PlanId);
  const total = homeCount * unit;
  const amountCents = dollarsToCents(total);
  if (amountCents < 50) {
    res.status(400).json({ error: "amount below minimum charge" });
    return;
  }

  const sk = process.env.STRIPE_SECRET_KEY;
  if (!sk) {
    res.status(503).json({
      mode: "unconfigured",
      message: "Stripe is not configured. Set STRIPE_SECRET_KEY on the API server.",
      amountCents,
      orderId,
      plan,
      radius,
    });
    return;
  }

  const stripe = new Stripe(sk);
  const base = getPublicBaseUrl();
  const idem = (clientIdempotency || crypto.randomUUID()).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40);
  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: amountCents,
            product_data: {
              name: `Circle prospecting — ${order.address} (${plan.toUpperCase()}, ${order.radii[radius as RadiusId].label})`,
              description: `${homeCount.toLocaleString()} homes, tiered rate computed on server`,
            },
          },
        },
      ],
      success_url: `${base}/order/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/order/${encodeURIComponent(orderId)}?canceled=1`,
      client_reference_id: idem,
      metadata: {
        checkoutType: "campaign",
        orderId,
        plan,
        radius,
        homeCount: String(homeCount),
        internalId: String(order.internalId),
      },
    },
    { idempotencyKey: `${idem}-${orderId}-${radius}-${plan}-${amountCents}`.slice(0, 90) }
  );

  if (!session.url) {
    res.status(500).json({ error: "no checkout url" });
    return;
  }
  res.json({ url: session.url, sessionId: session.id, amountCents });
});

const server = app.listen(PORT, () => {
  console.log(`API listening on http://127.0.0.1:${PORT} (CORS: ${allowedOrigins.join(", ")})`);
});
server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `[API] Port ${PORT} is already in use. If \`npm run dev\` is running, the API is already started — do not start \`dev:api\` again. Otherwise stop the other process or set API_PORT in .env to a free port.`
    );
    process.exit(1);
    return;
  }
  console.error("[API] Server error:", err);
  process.exit(1);
});
