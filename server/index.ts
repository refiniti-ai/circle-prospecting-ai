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
  type LeadServiceLine,
  type LeadTierId,
} from "../src/lib/leadPricing.ts";
import { getSummary, upsertLeadsFromRows, getLeadsForEmail, estimateLeadCount } from "./leadStore.js";
import { signAdminToken, signDashboardToken, verifyAdminToken, verifyDashboardToken } from "./dashboardAuth.js";
import { fulfillLeadPackFromSession } from "./leadFulfillment.js";
import { emailMatchesSession, normalizePhoneDigits, phonesMatch } from "./checkoutIdentity.js";
import { createStripeWebhookHandler } from "./stripeWebhook.js";
import { processInboundNewListing } from "./newListingWorkflow.js";
import {
  listPurchaseNotifications,
  listPurchasesForEmail,
  markPurchaseNotification,
  orderNumberFromSessionId,
} from "./purchaseConfirmStore.js";
import { getFirestoreDb } from "./firebaseAdmin.js";

/** Cloud Run sets PORT (usually 8080); local dev uses API_PORT or 8787. */
const PORT = Number.parseInt(process.env.PORT || process.env.API_PORT || "8080", 10);

const app = express();
const isProd = process.env.NODE_ENV === "production";

function buildAllowedOrigins(): string[] {
  const fromEnv = (process.env.CORS_ORIGIN || "http://localhost:5173,http://127.0.0.1:5173")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const appPublic = process.env.APP_PUBLIC_URL?.trim().replace(/\/$/, "");
  if (appPublic?.startsWith("http")) {
    try {
      const u = new URL(appPublic);
      const origin = u.origin;
      if (!fromEnv.includes(origin)) fromEnv.push(origin);
      // Firebase Hosting uses both *.web.app and *.firebaseapp.com for the same app; CORS must allow both.
      const host = u.hostname;
      if (host.endsWith(".web.app")) {
        const slug = host.slice(0, -".web.app".length);
        const sibling = `https://${slug}.firebaseapp.com`;
        if (!fromEnv.includes(sibling)) fromEnv.push(sibling);
      } else if (host.endsWith(".firebaseapp.com")) {
        const slug = host.slice(0, -".firebaseapp.com".length);
        const sibling = `https://${slug}.web.app`;
        if (!fromEnv.includes(sibling)) fromEnv.push(sibling);
      }
    } catch {
      /* ignore bad URL */
    }
  }
  return fromEnv;
}

const allowedOrigins = buildAllowedOrigins();

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

app.post(
  "/api/webhooks/stripe",
  webhookLimit,
  express.raw({ type: "application/json", limit: "2mb" }),
  createStripeWebhookHandler()
);

app.use(express.json({ limit: "48kb" }));

app.get("/api/health", generalLimit, (_req: Request, res: Response) => {
  let firestore = false;
  try {
    firestore = Boolean(getFirestoreDb());
  } catch {
    firestore = false;
  }
  res.json({ status: "ok", time: new Date().toISOString(), firestore });
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

function timingSafeStringEq(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "utf8");
    const bb = Buffer.from(b, "utf8");
    if (ba.length !== bb.length) return false;
    return crypto.timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const h = req.get("Authorization");
  if (!h?.startsWith("Bearer ")) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const tok = h.slice(7).trim();
  if (await verifyAdminToken(tok)) {
    next();
    return;
  }
  const legacy = process.env.ADMIN_API_KEY?.trim();
  if (legacy && timingSafeStringEq(tok, legacy)) {
    next();
    return;
  }
  res.status(401).json({ error: "unauthorized" });
}

const adminLoginBody = z.object({
  username: z.string().min(1).max(128),
  password: z.string().min(1).max(256),
});

/** Username + password → short-lived JWT for /api/admin/* (no ADMIN_API_KEY needed in the browser). */
app.post("/api/auth/admin-login", generalLimit, async (req: Request, res: Response) => {
  const parsed = adminLoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid body", details: parsed.error.flatten() });
    return;
  }
  const adminUser = (process.env.ADMIN_USERNAME || "admin").trim();
  const adminPass = process.env.ADMIN_PASSWORD?.trim();
  if (!adminPass) {
    res.status(503).json({
      error: "admin_login_not_configured",
      message: "Set ADMIN_PASSWORD on the server. Use DASHBOARD_JWT_SECRET (32+ chars in production) to sign admin sessions.",
    });
    return;
  }
  const { username, password } = parsed.data;
  if (username.trim() !== adminUser || !timingSafeStringEq(password, adminPass)) {
    res.status(401).json({ error: "invalid_credentials", message: "Invalid username or password." });
    return;
  }
  try {
    const token = await signAdminToken();
    res.json({ token });
  } catch (e) {
    console.error("admin-login sign", e);
    res.status(503).json({
      error: "admin_token_unavailable",
      message: "Set DASHBOARD_JWT_SECRET (32+ random characters in production).",
    });
  }
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

app.get("/api/admin/purchases", generalLimit, requireAdmin, async (_req: Request, res: Response) => {
  res.json({ purchases: await listPurchaseNotifications() });
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
  /** Collected before checkout; must match when signing in after payment. */
  phone: z.string().min(10, "Enter a valid phone number"),
  requestedLeads: z.coerce.number().int().min(1).max(50_000),
  city: z.string().trim().max(80).optional(),
  county: z.string().trim().max(80).optional(),
  zip: z.string().trim().max(20).optional(),
  radiusMiles: z.coerce.number().positive().max(50).optional(),
  campaignType: z.enum(["just_listed", "just_sold"]).optional(),
});

app.post("/api/checkout/leads", checkoutLimit, async (req: Request, res: Response) => {
  const parsed = leadCheckout.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid body", details: parsed.error.flatten() });
    return;
  }
  const { serviceLine, leadTier, email, phone, city, county, zip, radiusMiles, requestedLeads, campaignType } = parsed.data;
  const phoneDigits = normalizePhoneDigits(phone);
  if (phoneDigits.length < 10) {
    res.status(400).json({ error: "invalid_phone", message: "Phone must include at least 10 digits." });
    return;
  }
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
  const campaignLabel =
    campaignType === "just_sold" ? "Just sold" : campaignType === "just_listed" ? "Just listed" : "";
  const productTitle = `${campaignLabel ? `${campaignLabel} · ` : ""}${serviceLineLabel(sl)} — ${requestedLeads.toLocaleString()} homeowners (${tierLabel})`;
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
              description: [
                campaignLabel && `Campaign: ${campaignLabel} neighborhood promotion`,
                targetingLabel && `Area: ${targetingLabel}`,
                "Delivery and files in your dashboard after payment.",
              ]
                .filter(Boolean)
                .join(" "),
            },
          },
        },
      ],
      success_url: `${base}/order/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/buy-leads?canceled=1`,
      client_reference_id: `leads-${idem}`,
      metadata: {
        checkoutType: "lead_pack",
        packSize: String(requestedLeads),
        serviceLine,
        leadTier: leadTier,
        customerEmail: email,
        customerPhone: phoneDigits,
        city: city || "",
        county: county || "",
        zip: zip || "",
        radiusMiles: radiusMiles ? String(radiusMiles) : "",
        requestedLeads: String(requestedLeads),
        campaignType: campaignType ?? "",
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

const claimBody = z.object({
  sessionId: z.string().min(10),
  email: z.string().email(),
  phone: z.string().min(7),
});

app.post("/api/auth/claim-leads", generalLimit, async (req: Request, res: Response) => {
  const parsed = claimBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid body", details: parsed.error.flatten() });
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
  if (!emailMatchesSession(s, parsed.data.email)) {
    res.status(400).json({
      error: "identity_mismatch",
      message: "Email does not match this order. Use the same email you entered before checkout.",
    });
    return;
  }
  const metaPhone = s.metadata?.customerPhone?.trim() ?? "";
  if (normalizePhoneDigits(metaPhone).length >= 10) {
    if (!phonesMatch(metaPhone, parsed.data.phone)) {
      res.status(400).json({
        error: "identity_mismatch",
        message: "Phone number does not match this order. Use the same phone you entered before checkout.",
      });
      return;
    }
  }
  const emailCanon = parsed.data.email.trim().toLowerCase();
  // Always attach the verified claim email to this session so /api/my/purchases matches the JWT
  // (webhook may have stored null email or a different Stripe-normalized value).
  const orderNumber = orderNumberFromSessionId(s.id);
  const rlRaw = s.metadata?.requestedLeads || s.metadata?.packSize;
  const rlNum = rlRaw ? Number.parseInt(String(rlRaw), 10) : NaN;
  const campaign = s.metadata?.campaignType ? String(s.metadata.campaignType) : "";
  await markPurchaseNotification(s.id, {
    orderNumber,
    notifiedAt: new Date().toISOString(),
    checkoutType: "lead_pack",
    customerEmail: emailCanon,
    amountTotalCents: s.amount_total,
    currency: s.currency || null,
    lineItems: [campaign ? `Neighborhood promotion (${campaign})` : "Neighborhood lead pack"],
    leadServiceLine: s.metadata?.serviceLine ?? null,
    leadTier: s.metadata?.leadTier ?? null,
    requestedLeads: Number.isFinite(rlNum) ? rlNum : null,
    targetingSummary:
      [s.metadata?.city, s.metadata?.county, s.metadata?.zip].filter(Boolean).join(", ") || null,
  });
  fulfillLeadPackFromSession(s);
  const token = await signDashboardToken(emailCanon);
  res.json({ token, email: emailCanon });
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
  res.json({ email, leads: await getLeadsForEmail(email) });
});

app.get("/api/my/purchases", generalLimit, async (req: Request, res: Response) => {
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
  const purchases = await listPurchasesForEmail(email);
  res.json({ email, purchases });
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
  const leads = await getLeadsForEmail(email);
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

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`API listening on port ${PORT}`);
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
