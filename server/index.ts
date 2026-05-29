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
  assertCheckoutServiceLineAllowed,
  isValidBetaPromoCode,
  normalizePromoCode,
  type LeadServiceLine,
  type LeadTierId,
} from "../src/lib/leadPricing.ts";
import { getSummary, upsertLeadsFromRows, getLeadsForEmail, estimateLeadCount } from "./leadStore.js";
import { buildInvoiceDocument, buildQuoteDocument } from "./documentBuilder.js";
import { signAdminToken, signDashboardToken, verifyAdminToken, verifyDashboardToken } from "./dashboardAuth.js";
import {
  canonicalCheckoutEmail,
  emailMatchesSession,
  normalizePhoneDigits,
  phonesMatch,
} from "./checkoutIdentity.js";
import { getStoredAdminAuth, upsertStoredAdminAuth } from "./adminAccountStore.js";
import {
  getClientAccount,
  hashPassword,
  listClientAccountEmails,
  upsertClientPassword,
  verifyPassword,
} from "./clientAccountStore.js";
import {
  buildContactFormEmail,
  buildPasswordResetEmailContent,
  getMailTransportInfo,
  sendTextEmail,
} from "./mailer.js";
import { opsLog } from "./opsLog.js";
import { createPasswordResetToken, deletePasswordResetToken, takePasswordResetToken } from "./passwordResetStore.js";
import { applyPaidCheckoutSessionSideEffects } from "./checkoutSessionSideEffects.js";
import { createStripeWebhookHandler } from "./stripeWebhook.js";
import { createGenerateCheckoutHandler } from "./generateCheckout.js";
import {
  fetchGhlContact,
  fetchGhlContactPrefill,
  searchGhlContacts,
  updateGhlContactFields,
  asInt,
  PAY_LINK_FIELD_KEYS,
} from "./ghlContactFetch.js";
import { signPayLinkToken, verifyPayLinkToken } from "./payLinkToken.js";
import { tierFromLeadCount } from "../src/lib/leadPricing.ts";
import { processInboundNewListing } from "./newListingWorkflow.js";
import {
  listLeadPackSessionIdsForEmail,
  listPurchaseNotifications,
  listPurchasesForEmail,
  orderNumberFromSessionId,
  setPurchaseLeadWorkStatus,
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
const contactLimit = rateLimit({ windowMs: 60_000, max: 8, standardHeaders: "draft-7", legacyHeaders: false });
const checkoutLimit = rateLimit({ windowMs: 60_000, max: 15, standardHeaders: "draft-7", legacyHeaders: false });
const webhookLimit = rateLimit({ windowMs: 60_000, max: 60, standardHeaders: "draft-7", legacyHeaders: false });

function publicSiteBase() {
  return (process.env.APP_PUBLIC_URL || "http://localhost:5173").replace(/\/$/, "");
}

async function deliverPasswordResetEmail(
  to: string,
  subject: string,
  resetLink: string,
  kind: "client" | "admin"
): Promise<boolean> {
  const { text, html } = buildPasswordResetEmailContent(resetLink, kind);
  const r = await sendTextEmail(to, subject, text, html, {
    ghlExtras: {
      resetLink,
      passwordResetUrl: resetLink,
      reset_url: resetLink,
    },
  });
  return r.mode !== "skipped";
}

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
app.use(express.urlencoded({ extended: true, limit: "48kb" }));

const clientLoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
});

app.post("/api/auth/client-login", generalLimit, async (req: Request, res: Response) => {
  const parsed = clientLoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid body", details: parsed.error.flatten() });
    return;
  }
  const email = parsed.data.email.trim().toLowerCase();
  const acc = await getClientAccount(email);
  if (!acc || !(await verifyPassword(parsed.data.password, acc.salt, acc.passwordHash))) {
    res.status(401).json({ error: "invalid_credentials", message: "Invalid email or password." });
    return;
  }
  const token = await signDashboardToken(email);
  res.json({ token, email });
});

app.get("/api/health", generalLimit, (_req: Request, res: Response) => {
  let firestore = false;
  try {
    firestore = Boolean(getFirestoreDb());
  } catch {
    firestore = false;
  }
  const mail = getMailTransportInfo();
  res.json({
    status: "ok",
    time: new Date().toISOString(),
    firestore,
    mailTransport: mail.mode,
    mailConfigured: mail.configured,
    ...(!mail.configured ? { mailSetupHint: mail.setupHint } : {}),
  });
});

const sessionIdQuery = z.object({ session_id: z.string().min(10).max(128) });

/** Dynamic quote from order id + GHL/custom-field query params (same keys as Stripe metadata). */
app.get("/api/documents/quote", generalLimit, async (req: Request, res: Response) => {
  try {
    const doc = await buildQuoteDocument(req.query as Record<string, unknown>);
    if (!doc) {
      res.status(400).json({
        error: "missing_fields",
        message: "Provide order (or mls) plus homes/serviceLine/leadTier, or load a saved listing order id.",
      });
      return;
    }
    res.json(doc);
  } catch (e) {
    console.error("documents/quote", e);
    res.status(500).json({ error: "quote_build_failed" });
  }
});

/** Paid invoice from Stripe Checkout session_id. */
app.get("/api/documents/invoice", generalLimit, async (req: Request, res: Response) => {
  const parsed = sessionIdQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid session_id" });
    return;
  }
  try {
    const doc = await buildInvoiceDocument(parsed.data.session_id);
    if (!doc) {
      res.status(404).json({ error: "invoice_not_found" });
      return;
    }
    res.json(doc);
  } catch (e) {
    console.error("documents/invoice", e);
    res.status(404).json({ error: "invoice_not_found" });
  }
});

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
    const customerEmail = canonicalCheckoutEmail(session);
    const dashboardAccountExists = customerEmail ? (await getClientAccount(customerEmail)) != null : false;
    res.json({
      orderNumber: orderNumberFromSessionId(session.id),
      sessionId: session.id,
      checkoutType: session.metadata?.checkoutType || "general",
      paymentStatus: session.payment_status,
      customerEmail,
      dashboardAccountExists,
      currency: session.currency || "usd",
      amountTotalCents: session.amount_total,
      lineItems,
    });
  } catch (err) {
    console.error("checkout confirmation", err);
    res.status(404).json({ error: "session not found" });
  }
});

const syncPaidSessionBody = z.object({ session_id: z.string().min(10).max(128) });

/** Idempotent: record purchase / emails when webhook is delayed (esp. repeat buyers who skip password setup). */
app.post("/api/checkout/sync-paid-session", checkoutLimit, async (req: Request, res: Response) => {
  const parsed = syncPaidSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid body", details: parsed.error.flatten() });
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
    if (session.payment_status !== "paid") {
      res.status(400).json({ error: "not_paid", paymentStatus: session.payment_status });
      return;
    }
    await applyPaidCheckoutSessionSideEffects(session);
    opsLog("sync_paid_session_ok", { sessionId: session.id });
    res.json({ ok: true, orderNumber: orderNumberFromSessionId(session.id) });
  } catch (err) {
    console.error("sync-paid-session", err);
    res.status(400).json({ error: "session_failed" });
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
  const envPass = process.env.ADMIN_PASSWORD?.trim();
  const stored = await getStoredAdminAuth();
  if (!stored && !envPass) {
    res.status(503).json({
      error: "admin_login_not_configured",
      message: "Set ADMIN_PASSWORD on the server (and optionally ADMIN_USERNAME).",
    });
    return;
  }
  const { username, password } = parsed.data;
  if (username.trim() !== adminUser) {
    res.status(401).json({ error: "invalid_credentials", message: "Invalid username or password." });
    return;
  }
  let authed = false;
  if (stored && stored.username === adminUser) {
    authed = await verifyPassword(password, stored.salt, stored.passwordHash);
  } else if (envPass) {
    authed = timingSafeStringEq(password, envPass);
  }
  if (!authed) {
    res.status(401).json({ error: "invalid_credentials", message: "Invalid username or password." });
    return;
  }
  try {
    const token = await signAdminToken();
    res.json({ token });
  } catch (e) {
    console.error("admin-login sign", e);
    res.status(503).json({ error: "admin_token_unavailable", message: "Could not create admin session." });
  }
});

const emailOnlyBody = z.object({ email: z.string().email() });
const passwordResetCompleteBody = z.object({
  token: z.string().min(16).max(512),
  password: z.string().min(8).max(200),
});

app.post("/api/auth/client-password-reset-request", checkoutLimit, async (req: Request, res: Response) => {
  const parsed = emailOnlyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid body", details: parsed.error.flatten() });
    return;
  }
  const email = parsed.data.email.trim().toLowerCase();
  const acc = await getClientAccount(email);
  if (!acc) {
    res.json({ ok: true });
    return;
  }
  const token = await createPasswordResetToken("client", email);
  const link = `${publicSiteBase()}/login?client_reset=${encodeURIComponent(token)}`;
  const sent = await deliverPasswordResetEmail(email, "Reset your Circle Prospecting AI password", link, "client");
  if (!sent) {
    await deletePasswordResetToken(token);
    res.status(503).json({
      error: "email_not_configured",
      message:
        "Email is not configured on the server. Add RESEND_API_KEY, GHL_MAIL_WEBHOOK_URL, or SMTP_* on Cloud Run—or ask an admin to create a reset link from Admin → Overview.",
    });
    return;
  }
  res.json({ ok: true });
});

app.post("/api/auth/client-password-reset", checkoutLimit, async (req: Request, res: Response) => {
  const parsed = passwordResetCompleteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid body", details: parsed.error.flatten() });
    return;
  }
  const payload = await takePasswordResetToken(parsed.data.token);
  if (!payload || payload.kind !== "client") {
    res.status(400).json({ error: "invalid_token", message: "This link is invalid or has expired. Request a new reset." });
    return;
  }
  const acc = await getClientAccount(payload.email);
  if (!acc) {
    res.status(400).json({ error: "invalid_token", message: "This link is invalid or has expired." });
    return;
  }
  try {
    const { passwordHash, salt } = await hashPassword(parsed.data.password);
    await upsertClientPassword(payload.email, passwordHash, salt);
    res.json({ ok: true });
  } catch (err) {
    console.error("[client-password-reset]", err);
    res.status(500).json({ error: "failed", message: "Could not update password." });
  }
});

app.post("/api/auth/admin-password-reset-request", checkoutLimit, async (req: Request, res: Response) => {
  const parsed = emailOnlyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid body", details: parsed.error.flatten() });
    return;
  }
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!adminEmail) {
    res.status(503).json({
      error: "admin_email_not_configured",
      message: "Set ADMIN_EMAIL on the server to the address that should receive admin reset links.",
    });
    return;
  }
  const email = parsed.data.email.trim().toLowerCase();
  if (email !== adminEmail) {
    res.json({ ok: true });
    return;
  }
  const token = await createPasswordResetToken("admin", email);
  const link = `${publicSiteBase()}/login?tab=admin&admin_reset=${encodeURIComponent(token)}`;
  const sent = await deliverPasswordResetEmail(
    adminEmail,
    "Reset your Circle Prospecting AI admin password",
    link,
    "admin"
  );
  if (!sent) {
    await deletePasswordResetToken(token);
    res.status(503).json({
      error: "email_not_configured",
      message:
        "Email is not configured on the server. Add RESEND_API_KEY, GHL_MAIL_WEBHOOK_URL, or SMTP_* on Cloud Run.",
    });
    return;
  }
  res.json({ ok: true });
});

app.post("/api/auth/admin-password-reset", checkoutLimit, async (req: Request, res: Response) => {
  const parsed = passwordResetCompleteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid body", details: parsed.error.flatten() });
    return;
  }
  const payload = await takePasswordResetToken(parsed.data.token);
  if (!payload || payload.kind !== "admin") {
    res.status(400).json({ error: "invalid_token", message: "This link is invalid or has expired. Request a new reset." });
    return;
  }
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!adminEmail || payload.email !== adminEmail) {
    res.status(400).json({ error: "invalid_token", message: "This link is invalid or has expired." });
    return;
  }
  const adminUser = (process.env.ADMIN_USERNAME || "admin").trim();
  try {
    const { passwordHash, salt } = await hashPassword(parsed.data.password);
    await upsertStoredAdminAuth(adminUser, passwordHash, salt);
    res.json({ ok: true });
  } catch (err) {
    console.error("[admin-password-reset]", err);
    res.status(500).json({ error: "failed", message: "Could not update password." });
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

const contactFormBody = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().email(),
  phone: z.string().trim().max(40).optional(),
  message: z.string().trim().min(10).max(8000),
  /** Honeypot — must stay empty. */
  company: z.string().optional(),
});

/** Public contact form → CONTACT_INBOX_EMAIL or info@circleprospecting.ai */
app.post("/api/public/contact", contactLimit, async (req: Request, res: Response) => {
  const parsed = contactFormBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid body", details: parsed.error.flatten() });
    return;
  }
  if (parsed.data.company?.trim()) {
    res.json({ ok: true });
    return;
  }
  const inbox = process.env.CONTACT_INBOX_EMAIL?.trim() || "info@circleprospecting.ai";
  const { subject, text, html } = buildContactFormEmail({
    name: parsed.data.name,
    email: parsed.data.email,
    phone: parsed.data.phone,
    message: parsed.data.message,
  });
  try {
    const sent = await sendTextEmail(inbox, subject, text, html);
    if (sent.mode === "skipped") {
      res.status(503).json({
        error: "mail_not_configured",
        message: "Email is not configured on the server. Please write to info@circleprospecting.ai directly.",
      });
      return;
    }
  } catch (e) {
    console.error("[contact form]", e);
    res.status(502).json({
      error: "send_failed",
      message: "Could not deliver your message. Email info@circleprospecting.ai directly.",
    });
    return;
  }
  res.json({ ok: true });
});

const adminChangePasswordBody = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: z.string().min(8).max(200),
});

app.post("/api/admin/change-password", generalLimit, requireAdmin, async (req: Request, res: Response) => {
  const parsed = adminChangePasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid body", details: parsed.error.flatten() });
    return;
  }
  const adminUser = (process.env.ADMIN_USERNAME || "admin").trim();
  const envPass = process.env.ADMIN_PASSWORD?.trim();
  const stored = await getStoredAdminAuth();
  if (!stored && !envPass) {
    res.status(503).json({
      error: "admin_not_configured",
      message: "Admin password is not configured on the server.",
    });
    return;
  }
  const { currentPassword, newPassword } = parsed.data;
  let currentOk = false;
  if (stored && stored.username === adminUser) {
    currentOk = await verifyPassword(currentPassword, stored.salt, stored.passwordHash);
  } else if (envPass) {
    currentOk = timingSafeStringEq(currentPassword, envPass);
  }
  if (!currentOk) {
    res.status(401).json({
      error: "invalid_current_password",
      message: "Current password is incorrect.",
    });
    return;
  }
  try {
    const { passwordHash, salt } = await hashPassword(newPassword);
    await upsertStoredAdminAuth(adminUser, passwordHash, salt);
    res.json({ ok: true });
  } catch (err) {
    console.error("[admin-change-password]", err);
    res.status(500).json({ error: "failed", message: "Could not update password." });
  }
});

app.get("/api/admin/summary", generalLimit, requireAdmin, (_req: Request, res: Response) => {
  res.json({ inventory: getSummary() });
});

app.get("/api/admin/purchases", generalLimit, requireAdmin, async (_req: Request, res: Response) => {
  res.json({ purchases: await listPurchaseNotifications() });
});

const leadWorkStatusBody = z.object({
  status: z.enum(["pending", "completed"]),
});

/** Shared by PATCH + POST: some Hosting / proxy paths mishandle PATCH and return SPA HTML. */
async function adminPurchaseLeadWorkHandler(req: Request, res: Response) {
  const sessionId = String(req.params.sessionId ?? "").trim();
  const parsed = leadWorkStatusBody.safeParse(req.body);
  if (!sessionId || !parsed.success) {
    res.status(400).json({ error: "invalid_request", message: "session id and status required." });
    return;
  }
  const ok = await setPurchaseLeadWorkStatus(sessionId, parsed.data.status);
  if (!ok) {
    res.status(404).json({ error: "not_found", message: "No purchase with that id." });
    return;
  }
  res.json({ ok: true, sessionId, status: parsed.data.status });
}

app.patch("/api/admin/purchases/:sessionId/lead-work", checkoutLimit, requireAdmin, adminPurchaseLeadWorkHandler);
app.post("/api/admin/purchases/:sessionId/lead-work", checkoutLimit, requireAdmin, adminPurchaseLeadWorkHandler);

const adminLeadWorkBody = z.object({
  sessionId: z.string().min(1),
  status: z.enum(["pending", "completed"]),
});

/** Fixed URL + JSON body (no session in path): avoids Hosting/proxy edge cases that return SPA HTML for long / encoded paths. */
app.post("/api/admin/lead-work", checkoutLimit, requireAdmin, async (req: Request, res: Response) => {
  const parsed = adminLeadWorkBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_request", message: "sessionId and status required." });
    return;
  }
  const sessionId = parsed.data.sessionId.trim();
  const ok = await setPurchaseLeadWorkStatus(sessionId, parsed.data.status);
  if (!ok) {
    res.status(404).json({ error: "not_found", message: "No purchase with that id." });
    return;
  }
  res.json({ ok: true, sessionId, status: parsed.data.status });
});

/** One-time client reset URL for ops when transactional email is off or undeliverable. */
app.post("/api/admin/client-password-reset-link", checkoutLimit, requireAdmin, async (req: Request, res: Response) => {
  const parsed = emailOnlyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid body", details: parsed.error.flatten() });
    return;
  }
  const email = parsed.data.email.trim().toLowerCase();
  const acc = await getClientAccount(email);
  if (!acc) {
    res.status(404).json({ error: "not_found", message: "No dashboard account for that email." });
    return;
  }
  const token = await createPasswordResetToken("client", email);
  const link = `${publicSiteBase()}/login?client_reset=${encodeURIComponent(token)}`;
  res.json({ ok: true, link, expiresInMinutes: 60 });
});

app.get("/api/admin/client-accounts", generalLimit, requireAdmin, async (_req: Request, res: Response) => {
  const emails = await listClientAccountEmails();
  res.json({ count: emails.length, emails });
});

app.get("/api/admin/system", generalLimit, requireAdmin, (_req: Request, res: Response) => {
  let firestore = false;
  try {
    firestore = Boolean(getFirestoreDb());
  } catch {
    firestore = false;
  }
  const mail = getMailTransportInfo();
  res.json({
    status: "ok" as const,
    time: new Date().toISOString(),
    firestore,
    inventory: getSummary(),
    nodeEnv: process.env.NODE_ENV || null,
    stripe: Boolean(process.env.STRIPE_SECRET_KEY?.trim()),
    webhookSecret: Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim()),
    mail: mail.configured,
    mailTransport: mail.mode,
    mailSetupHint: mail.configured ? undefined : mail.setupHint,
    adminEmail: Boolean(process.env.ADMIN_EMAIL?.trim()),
    appPublicUrl: Boolean(process.env.APP_PUBLIC_URL?.trim()),
  });
});

const mailTestBody = z.object({
  to: z.string().email().optional(),
});

/** Sends one test message through the configured transport (GHL first). Use to verify GHL_MAIL_WEBHOOK_URL + workflow. */
app.post("/api/admin/mail-test", checkoutLimit, requireAdmin, async (req: Request, res: Response) => {
  const parsed = mailTestBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "invalid body", details: parsed.error.flatten() });
    return;
  }
  const to =
    parsed.data.to?.trim().toLowerCase() ||
    process.env.ADMIN_EMAIL?.trim().toLowerCase() ||
    process.env.PURCHASE_NOTIFICATION_EMAIL?.split(",")[0]?.trim().toLowerCase();
  if (!to) {
    res.status(400).json({
      error: "no_recipient",
      message: 'Send JSON { "to": "you@domain.com" } or set ADMIN_EMAIL / PURCHASE_NOTIFICATION_EMAIL on the server.',
    });
    return;
  }
  const ghl = Boolean(process.env.GHL_MAIL_WEBHOOK_URL?.trim());
  const resend = Boolean(process.env.RESEND_API_KEY?.trim());
  const smtpOk = Boolean(process.env.SMTP_HOST?.trim() && process.env.SMTP_USER?.trim() && process.env.SMTP_PASS?.trim());
  if (!ghl && !resend && !smtpOk) {
    res.status(503).json({
      error: "mail_not_configured",
      message: "Set GHL_MAIL_WEBHOOK_URL (and optional GHL_BEARER_TOKEN), or RESEND_API_KEY, or SMTP_* on Cloud Run.",
    });
    return;
  }
  try {
    const r = await sendTextEmail(
      to,
      "Circle Prospecting AI — mail test",
      "If you received this, transactional mail from the API is working.\n\nThis was triggered by POST /api/admin/mail-test."
    );
    res.json({ ok: true, mode: r.mode, to });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[mail-test]", e);
    res.status(502).json({ ok: false, error: "send_failed", message: msg });
  }
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
  agentRole: z.enum(["buyer", "seller"]).optional(),
  promoCode: z.string().trim().max(40).optional(),
});

function resolveLeadPackCheckout(
  serviceLine: LeadServiceLine,
  leadTier: LeadTierId,
  homes: number,
  promoCodeRaw?: string
):
  | { ok: true; totalCents: number; promoCode: string | undefined }
  | { ok: false; status: number; error: string; message: string; minLeads?: number } {
  const blocked = assertCheckoutServiceLineAllowed(serviceLine);
  if (blocked) {
    return { ok: false, status: 400, error: "service_unavailable", message: blocked };
  }
  const promoInput = normalizePromoCode(promoCodeRaw);
  const promoActive = promoInput ? isValidBetaPromoCode(promoInput) : false;
  if (promoInput && !promoActive) {
    return { ok: false, status: 400, error: "invalid_promo", message: "Promo code is not valid." };
  }
  const promoCode = promoActive ? promoInput : undefined;
  const totalCents = totalCentsForSelection(serviceLine, leadTier, homes, promoCode);
  if (totalCents < 50) {
    return {
      ok: false,
      status: 400,
      error: "below_minimum_charge",
      message: "Order total is below the card minimum ($0.50). Increase the number of leads.",
      minLeads: minLeadsForStripeForTier(serviceLine, leadTier, promoCode),
    };
  }
  return { ok: true, totalCents, promoCode };
}

/**
 * GHL-driven dynamic checkout: contactId + email + plan + amount → Stripe Checkout URL,
 * and writes the URL back to the GHL contact custom field `stripe_checkout_url`.
 * See server/generateCheckout.ts for env vars (GHL_BEARER_TOKEN, GENERATE_CHECKOUT_TOKEN, etc.).
 */
app.post("/api/generate-checkout", checkoutLimit, createGenerateCheckoutHandler());

/**
 * Generate a signed /pay/:contactId URL and write it back to the GHL contact custom field
 * `pay_link_url` (override via GHL_PAY_LINK_FIELD_KEY). Call this from your GHL workflow
 * once when a contact is created. Body: { contactId }.
 */
const generatePayLinkBody = z.preprocess(
  (raw) => {
    if (typeof raw !== "object" || raw === null) return raw;
    const o = raw as Record<string, unknown>;
    const q = (req: unknown) => (typeof req === "string" ? req.trim() : req);
    return {
      contactId:
        q(o.contactId) ||
        q(o.contactid) ||
        q(o.contact_id) ||
        q(o.ContactId) ||
        q(o.id) ||
        q((o as { contact?: { id?: unknown } }).contact?.id) ||
        "",
    };
  },
  z.object({
    contactId: z.string().trim().min(1).max(120),
  })
);

app.post("/api/generate-pay-link", checkoutLimit, async (req: Request, res: Response) => {
  const requiredToken = process.env.GENERATE_CHECKOUT_TOKEN?.trim();
  if (requiredToken) {
    const presented = String(req.header("x-webhook-token") || "").trim();
    if (presented !== requiredToken) {
      res.status(401).json({ error: "unauthorized", message: "Missing or invalid X-Webhook-Token header." });
      return;
    }
  }

  const parsed = generatePayLinkBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body", details: parsed.error.flatten() });
    return;
  }
  const { contactId } = parsed.data;
  const token = signPayLinkToken(contactId);
  const base = (process.env.APP_PUBLIC_URL || "https://circle-prospecting-ai.web.app").replace(/\/$/, "");
  const url = `${base}/pay/${encodeURIComponent(contactId)}?t=${token}`;

  const fieldKey = (process.env.GHL_PAY_LINK_FIELD_KEY?.trim() || "pay_link_url");
  let ghl: { ok: boolean; status: number; message?: string } = { ok: false, status: 0, message: "ghl_not_configured" };
  try {
    ghl = await updateGhlContactFields(contactId, { [fieldKey]: url });
  } catch (e) {
    ghl = { ok: false, status: 0, message: e instanceof Error ? e.message : "ghl_update_failed" };
  }

  opsLog("pay_link_generated", { contactId, ghlOk: ghl.ok, ghlStatus: ghl.status });
  res.json({ ok: true, url, token, ghl });
});

/** Search GHL contacts for Buy Leads (name, email, or phone). */
app.get("/api/ghl-contacts/search", generalLimit, async (req: Request, res: Response) => {
  const q = String(req.query.q || "").trim();
  if (q.length < 2) {
    res.status(400).json({ error: "query_too_short", message: "Enter at least 2 characters." });
    return;
  }
  if (q.length > 120) {
    res.status(400).json({ error: "query_too_long" });
    return;
  }
  try {
    const results = await searchGhlContacts(q, 12);
    res.json({ ok: true, results });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "search_failed";
    if (msg === "ghl_not_configured") {
      res.status(503).json({
        error: "ghl_not_configured",
        message: "Set GHL_BEARER_TOKEN and GHL_LOCATION_ID on the server.",
      });
      return;
    }
    console.error("ghl_contacts_search", msg);
    res.status(502).json({ error: "ghl_search_failed", message: msg });
  }
});

/** Full contact prefill for Buy Leads after picking a search result. */
app.get("/api/ghl-contacts/:contactId/prefill", generalLimit, async (req: Request, res: Response) => {
  const contactId = String(req.params.contactId || "").trim();
  if (!contactId || contactId.length > 64) {
    res.status(400).json({ error: "invalid_contact_id" });
    return;
  }
  try {
    const prefill = await fetchGhlContactPrefill(contactId);
    res.json({ ok: true, prefill });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "prefill_failed";
    if (msg === "ghl_not_configured") {
      res.status(503).json({ error: "ghl_not_configured" });
      return;
    }
    if (msg === "contact_not_found") {
      res.status(404).json({ error: "contact_not_found" });
      return;
    }
    console.error("ghl_contact_prefill", msg);
    res.status(502).json({ error: "ghl_prefill_failed", message: msg });
  }
});

/**
 * Fetch a GHL contact (limited to the fields surfaced on /pay). Requires signed token.
 * GET /api/ghl-contact/:contactId?t=<token>
 */
app.get("/api/ghl-contact/:contactId", generalLimit, async (req: Request, res: Response) => {
  const contactId = String(req.params.contactId || "").trim();
  const token = String(req.query.t || "").trim();
  if (!contactId) {
    res.status(400).json({ error: "missing_contact_id" });
    return;
  }
  if (!verifyPayLinkToken(contactId, token)) {
    res.status(401).json({ error: "invalid_token", message: "This pay link is missing or expired." });
    return;
  }
  try {
    const contact = await fetchGhlContact(contactId);
    res.json({ ok: true, contact, fieldKeys: PAY_LINK_FIELD_KEYS });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "contact_fetch_failed";
    if (msg === "ghl_not_configured") {
      res.status(503).json({ error: "ghl_not_configured", message: "Set GHL_BEARER_TOKEN on the server." });
      return;
    }
    if (msg === "contact_not_found") {
      res.status(404).json({ error: "contact_not_found", message: "No GHL contact matches this link." });
      return;
    }
    console.error("ghl_contact_fetch", msg);
    res.status(502).json({ error: "ghl_error", message: msg });
  }
});

/**
 * Create a Stripe Checkout Session from a GHL contact + selected plan.
 * Body: { contactId, t, serviceLine, leadTier, homes, radiusLabel? }.
 */
const checkoutFromContactBody = z.object({
  contactId: z.string().trim().min(1).max(120),
  t: z.string().trim().min(1).max(64),
  serviceLine: z.enum(["ai_outreach", "live_callers", "hybrid", "data_only"]),
  leadTier: z.enum(["dabble", "starter", "growth", "scale"]),
  homes: z.coerce.number().int().positive().max(50_000),
  radiusLabel: z.string().trim().max(80).optional(),
  promoCode: z.string().trim().max(40).optional(),
});

app.post("/api/checkout/from-contact", checkoutLimit, async (req: Request, res: Response) => {
  const parsed = checkoutFromContactBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body", details: parsed.error.flatten() });
    return;
  }
  const { contactId, t, serviceLine, leadTier, homes, radiusLabel, promoCode } = parsed.data;
  if (!verifyPayLinkToken(contactId, t)) {
    res.status(401).json({ error: "invalid_token" });
    return;
  }

  const pricing = resolveLeadPackCheckout(serviceLine as LeadServiceLine, leadTier as LeadTierId, homes, promoCode);
  if (!pricing.ok) {
    res.status(pricing.status).json({ error: pricing.error, message: pricing.message, minLeads: pricing.minLeads });
    return;
  }
  const { totalCents, promoCode: activePromo } = pricing;

  const sk = process.env.STRIPE_SECRET_KEY?.trim();
  if (!sk) {
    res.status(503).json({ error: "stripe_not_configured", message: "Set STRIPE_SECRET_KEY on the server." });
    return;
  }

  let contact;
  try {
    contact = await fetchGhlContact(contactId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "contact_fetch_failed";
    res.status(502).json({ error: "ghl_error", message: msg });
    return;
  }

  const customerEmail = contact.email || contact.fields.email || undefined;
  if (!customerEmail) {
    res.status(400).json({ error: "no_email", message: "Contact has no email; cannot create checkout." });
    return;
  }

  const stripe = new Stripe(sk);
  const base = (process.env.APP_PUBLIC_URL || "https://circle-prospecting-ai.web.app").replace(/\/$/, "");
  const tierMeta = tierRowMeta(leadTier as LeadTierId);
  const productTitle = `${serviceLineLabel(serviceLine as LeadServiceLine)} — ${homes.toLocaleString()} homeowners (${tierMeta.packageLabel})`;
  const idem = crypto.randomUUID().replace(/[^a-zA-Z0-9-]/g, "").slice(0, 40);

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        customer_email: customerEmail,
        client_reference_id: `ghl-${contactId}`,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: totalCents,
              product_data: {
                name: productTitle,
                description: [
                  contact.fields.listing_address && `Listing: ${contact.fields.listing_address}`,
                  radiusLabel && `Ring: ${radiusLabel}`,
                  contact.fields.mls && `MLS: ${contact.fields.mls}`,
                ]
                  .filter(Boolean)
                  .join(" · "),
              },
            },
          },
        ],
        success_url: `${base}/order/success?session_id={CHECKOUT_SESSION_ID}&ghl=${encodeURIComponent(contactId)}`,
        cancel_url: `${base}/pay/${encodeURIComponent(contactId)}?t=${t}&canceled=1`,
        metadata: {
          checkoutType: "ghl_pay_link",
          ghlContactId: contactId,
          serviceLine,
          leadTier,
          requestedLeads: String(homes),
          packSize: String(homes),
          radiusLabel: radiusLabel || "",
          customerEmail,
          customerPhone: contact.phone || contact.fields.phone || "",
          city: contact.fields.city || "",
          zip: contact.fields.zip_code || "",
          mls: contact.fields.mls || "",
          listingAddress: contact.fields.listing_address || "",
          promoCode: activePromo || "",
        },
      },
      { idempotencyKey: `pay-${contactId}-${homes}-${serviceLine}-${leadTier}-${idem}`.slice(0, 90) }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "stripe_failed";
    res.status(502).json({ error: "stripe_failed", message: msg });
    return;
  }

  if (!session.url) {
    res.status(500).json({ error: "no_checkout_url" });
    return;
  }

  opsLog("pay_link_checkout_created", { sessionId: session.id, contactId, totalCents });
  res.json({ ok: true, url: session.url, sessionId: session.id, totalCents });
});

app.post("/api/checkout/leads", checkoutLimit, async (req: Request, res: Response) => {
  const parsed = leadCheckout.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid body", details: parsed.error.flatten() });
    return;
  }
  const { serviceLine, leadTier, email, phone, city, county, zip, radiusMiles, requestedLeads, campaignType, agentRole, promoCode } =
    parsed.data;
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
  const pricing = resolveLeadPackCheckout(sl, tier, requestedLeads, promoCode);
  if (!pricing.ok) {
    res.status(pricing.status).json({
      error: pricing.error,
      message: pricing.message,
      minLeads: pricing.minLeads,
    });
    return;
  }
  const { totalCents: unitAmountCents, promoCode: activePromo } = pricing;
  const invSummary = getSummary();
  if (invSummary.total > 0 && invSummary.available < requestedLeads) {
    res.status(409).json({
      error: "insufficient_inventory",
      message: `Only ${invSummary.available.toLocaleString()} lead(s) are available in inventory (you requested ${requestedLeads.toLocaleString()}). Upload more leads in Admin or choose a smaller pack.`,
      available: invSummary.available,
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
        agentRole: agentRole ?? "",
        promoCode: activePromo || "",
      },
    },
    { idempotencyKey: `lead-${requestedLeads}-${serviceLine}-${leadTier}-${email}-${idem}`.slice(0, 90) }
  );
  if (!session.url) {
    res.status(500).json({ error: "no checkout url" });
    return;
  }
  opsLog("checkout_lead_session_created", { sessionId: session.id, requestedLeads });
  res.json({ url: session.url, sessionId: session.id, unitAmountCents });
});

/**
 * One idempotent pipeline for paid lead-pack sessions: Firestore purchase row, fulfillment, receipt/admin mail.
 * Used after password set, session claim, and overlaps with webhook + thank-you sync — all safe to call repeatedly.
 */
async function finalizeLeadPackDashboardClaim(
  s: Stripe.Checkout.Session,
  emailRaw: string
): Promise<{ token: string; email: string }> {
  const emailCanon = emailRaw.trim().toLowerCase();
  if (s.payment_status === "paid") {
    await applyPaidCheckoutSessionSideEffects(s);
  }
  const token = await signDashboardToken(emailCanon);
  return { token, email: emailCanon };
}

const setClientPasswordBody = z.object({
  sessionId: z.string().min(10),
  password: z.string().min(8).max(200),
});

/** After lead-pack checkout: set password using Stripe session proof, sync purchase + fulfillment, return dashboard JWT. */
app.post("/api/auth/set-client-password", checkoutLimit, async (req: Request, res: Response) => {
  const parsed = setClientPasswordBody.safeParse(req.body);
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
  let s: Stripe.Checkout.Session;
  try {
    s = await stripe.checkout.sessions.retrieve(parsed.data.sessionId, { expand: ["line_items"] });
  } catch (err) {
    console.error("[set-client-password] retrieve", err);
    res.status(400).json({ error: "invalid_session" });
    return;
  }
  if (s.payment_status !== "paid") {
    res.status(400).json({ error: "payment not complete" });
    return;
  }
  if (s.metadata?.checkoutType !== "lead_pack") {
    res.status(400).json({
      error: "not_lead_pack",
      message: "Account passwords apply to lead-pack purchases only.",
    });
    return;
  }
  const email = canonicalCheckoutEmail(s);
  if (!email) {
    res.status(400).json({ error: "no_email_on_session", message: "No email on this checkout session." });
    return;
  }
  try {
    const { passwordHash, salt } = await hashPassword(parsed.data.password);
    await upsertClientPassword(email, passwordHash, salt);
    const out = await finalizeLeadPackDashboardClaim(s, email);
    res.json(out);
  } catch (err) {
    console.error("[set-client-password]", err);
    res.status(500).json({ error: "failed", message: "Could not save password." });
  }
});

const claimBody = z.object({
  sessionId: z.string().min(10),
  email: z.string().email(),
  phone: z.string().min(7),
});

const claimIdentityBody = z.object({
  email: z.string().email(),
  phone: z.string().min(7),
});

/** Sign in with email + phone only — looks up stored purchases (Firestore/local) then verifies Stripe session. */
app.post("/api/auth/claim-leads-identity", checkoutLimit, async (req: Request, res: Response) => {
  const parsed = claimIdentityBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid body", details: parsed.error.flatten() });
    return;
  }
  const sk = process.env.STRIPE_SECRET_KEY;
  if (!sk) {
    res.status(503).json({ error: "stripe not configured" });
    return;
  }
  const phoneDigits = normalizePhoneDigits(parsed.data.phone);
  if (phoneDigits.length < 10) {
    res.status(400).json({ error: "invalid_phone", message: "Phone must include at least 10 digits." });
    return;
  }
  const stripe = new Stripe(sk);
  const emailRaw = parsed.data.email;
  const sessionIds = await listLeadPackSessionIdsForEmail(emailRaw);
  let matched: Stripe.Checkout.Session | null = null;
  for (const sid of sessionIds.slice(0, 25)) {
    try {
      const s = await stripe.checkout.sessions.retrieve(sid);
      if (s.payment_status !== "paid") continue;
      if (s.metadata?.checkoutType !== "lead_pack") continue;
      if (!emailMatchesSession(s, emailRaw)) continue;
      const metaPhone = s.metadata?.customerPhone?.trim() ?? "";
      if (normalizePhoneDigits(metaPhone).length < 10) continue;
      if (!phonesMatch(metaPhone, parsed.data.phone)) continue;
      matched = s;
      break;
    } catch (err) {
      console.error("[claim-leads-identity] retrieve", sid, err);
    }
  }
  if (!matched) {
    res.status(404).json({
      error: "no_match",
      message:
        "No paid lead order found for this email and phone. Use the same details as at checkout. If you just paid, wait a moment for your receipt to process, then try again.",
    });
    return;
  }
  try {
    const expanded = await stripe.checkout.sessions.retrieve(matched.id, { expand: ["line_items"] });
    const out = await finalizeLeadPackDashboardClaim(expanded, emailRaw);
    res.json(out);
  } catch (err) {
    console.error("[claim-leads-identity] finalize", err);
    res.status(500).json({ error: "claim_failed", message: "Could not complete sign-in." });
  }
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
  const s = await stripe.checkout.sessions.retrieve(parsed.data.sessionId, { expand: ["line_items"] });
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
  const out = await finalizeLeadPackDashboardClaim(s, parsed.data.email);
  res.json(out);
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
  res.json({
    email,
    purchases: purchases.map((p) => {
      const paymentStatus = "Paid" as const;
      /** Lead pack / campaign: mirror admin “Mark complete” so the client Status column updates. */
      const orderStatus =
        p.checkoutType === "lead_pack" || p.checkoutType === "campaign"
          ? p.leadWorkStatus === "completed"
            ? ("Completed" as const)
            : ("Processing" as const)
          : ("Confirmed" as const);
      return {
        ...p,
        leadWorkStatus: p.leadWorkStatus ?? null,
        paymentStatus,
        orderStatus,
      };
    }),
  });
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
  return publicSiteBase();
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
  const buyerEmail = order.email?.trim();
  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      ...(buyerEmail ? { customer_email: buyerEmail } : {}),
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
        ...(buyerEmail ? { customerEmail: buyerEmail } : {}),
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

/** Avoid Express’s default HTML “Cannot POST /api/…” — the SPA treats non-JSON as a Hosting/rewrite failure. */
app.use("/api", (req: Request, res: Response) => {
  res.status(404).json({
    error: "not_found",
    path: req.originalUrl,
    message:
      "This API path is not implemented on this server build. Redeploy Cloud Run from the current repo (includes POST /api/checkout/sync-paid-session).",
  });
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
