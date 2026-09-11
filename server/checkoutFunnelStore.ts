import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { introPromoMlsPath } from "../src/lib/introDeepLink.js";
import { resolveCampaignPath, type MlsCampaignPathSegment } from "../src/lib/mlsCampaignPath.js";
import { getFirestoreDb } from "./firebaseAdmin.js";

export type CheckoutFunnelStatus = "started" | "paid" | "canceled" | "expired";

export type CheckoutFunnelRecord = {
  sessionId: string;
  status: CheckoutFunnelStatus;
  source: "buy_leads" | "pay_link" | "campaign" | "ghl_generated";
  checkoutType: string;
  serviceLine?: string | null;
  leadTier?: string | null;
  requestedLeads?: number | null;
  amountCents?: number | null;
  customerEmail?: string | null;
  mls?: string | null;
  listingAddress?: string | null;
  /** Site path they checked out from, e.g. /99promo/listed/mls/7825074 */
  pagePath?: string | null;
  startedAt: string;
  updatedAt: string;
  completedAt?: string | null;
};

export type CheckoutFunnelSummary = {
  continued: number;
  paid: number;
  stopped: number;
  inProgress: number;
  conversionRate: number;
  updatedAt: string;
  recentStopped: CheckoutFunnelRecord[];
  unpaid: CheckoutFunnelRecord[];
};

const __dir = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dir, "data", "platform", "checkout-funnel.json");
const COLLECTION = process.env.FIREBASE_CHECKOUT_FUNNEL_COLLECTION?.trim() || "checkout_funnel";
const MAX_FILE_ROWS = 5000;
const IN_PROGRESS_MS = 24 * 60 * 60 * 1000;

type FileDb = { sessions: CheckoutFunnelRecord[]; updatedAt: string };

function ensureFile() {
  const dir = path.dirname(DATA);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DATA)) {
    fs.writeFileSync(
      DATA,
      JSON.stringify({ sessions: [], updatedAt: new Date().toISOString() }, null, 2),
      "utf8"
    );
  }
}

function readFileDb(): FileDb {
  ensureFile();
  const db = JSON.parse(fs.readFileSync(DATA, "utf8")) as FileDb;
  if (!Array.isArray(db.sessions)) db.sessions = [];
  return db;
}

function writeFileDb(db: FileDb) {
  db.updatedAt = new Date().toISOString();
  fs.writeFileSync(DATA, JSON.stringify(db, null, 2), "utf8");
}

function upsertRecord(record: CheckoutFunnelRecord) {
  const fileDb = readFileDb();
  const idx = fileDb.sessions.findIndex((s) => s.sessionId === record.sessionId);
  if (idx >= 0) fileDb.sessions[idx] = record;
  else fileDb.sessions.push(record);
  if (fileDb.sessions.length > MAX_FILE_ROWS) {
    fileDb.sessions = fileDb.sessions.slice(-MAX_FILE_ROWS);
  }
  writeFileDb(fileDb);

  const db = getFirestoreDb();
  if (db) {
    void db
      .collection(COLLECTION)
      .doc(record.sessionId)
      .set(record)
      .catch((err) => console.error("[checkoutFunnelStore] Firestore write failed", err));
  }
}

function readRecord(sessionId: string): CheckoutFunnelRecord | null {
  const fileDb = readFileDb();
  return fileDb.sessions.find((s) => s.sessionId === sessionId) ?? null;
}

export function listingFunnelPagePath(input: {
  intro?: boolean;
  mls?: string | null;
  campaignType?: string | null;
  agentRole?: string | null;
}): string | null {
  const mls = (input.mls || "").trim();
  const intro = Boolean(input.intro);
  if (!mls) return intro ? "/99promo/checkout" : null;
  const role = input.agentRole === "buyer" || input.agentRole === "seller" ? input.agentRole : null;
  const pathSegment: MlsCampaignPathSegment | undefined =
    input.campaignType === "just_sold" || input.campaignType === "seller"
      ? "seller"
      : input.campaignType === "just_listed" || input.campaignType === "listed"
        ? "listed"
        : undefined;
  const campaign = resolveCampaignPath({ agentRole: role, pathSegment });
  return intro ? introPromoMlsPath(mls, campaign) : `/${campaign}/mls/${encodeURIComponent(mls)}`;
}

export function recordCheckoutStarted(input: {
  sessionId: string;
  source: CheckoutFunnelRecord["source"];
  checkoutType: string;
  serviceLine?: string | null;
  leadTier?: string | null;
  requestedLeads?: number | null;
  amountCents?: number | null;
  customerEmail?: string | null;
  mls?: string | null;
  listingAddress?: string | null;
  pagePath?: string | null;
}): CheckoutFunnelRecord {
  const now = new Date().toISOString();
  const existing = readRecord(input.sessionId);
  if (existing) return existing;

  const record: CheckoutFunnelRecord = {
    sessionId: input.sessionId,
    status: "started",
    source: input.source,
    checkoutType: input.checkoutType,
    serviceLine: input.serviceLine ?? null,
    leadTier: input.leadTier ?? null,
    requestedLeads: input.requestedLeads ?? null,
    amountCents: input.amountCents ?? null,
    customerEmail: input.customerEmail?.trim().toLowerCase() || null,
    mls: (input.mls || "").trim() || null,
    listingAddress: (input.listingAddress || "").trim() || null,
    pagePath: (input.pagePath || "").trim() || null,
    startedAt: now,
    updatedAt: now,
    completedAt: null,
  };
  upsertRecord(record);
  return record;
}

function markTerminal(sessionId: string, status: Exclude<CheckoutFunnelStatus, "started">): boolean {
  const id = sessionId.trim();
  if (!id) return false;
  const existing = readRecord(id);
  if (existing?.status === "paid") return false;
  if (existing?.status === status) return true;

  const now = new Date().toISOString();
  if (existing) {
    upsertRecord({
      ...existing,
      status,
      updatedAt: now,
      completedAt: now,
    });
    return true;
  }

  const db = getFirestoreDb();
  if (db) {
    void db
      .collection(COLLECTION)
      .doc(id)
      .set({ sessionId: id, status, updatedAt: now, completedAt: now }, { merge: true })
      .catch((err) => console.error("[checkoutFunnelStore] Firestore status merge failed", err));
  }
  return true;
}

export function markCheckoutPaid(sessionId: string): boolean {
  const id = sessionId.trim();
  if (!id) return false;
  const existing = readRecord(id);
  const now = new Date().toISOString();
  const record: CheckoutFunnelRecord = existing
    ? { ...existing, status: "paid", updatedAt: now, completedAt: now }
    : {
        sessionId: id,
        status: "paid",
        source: "buy_leads",
        checkoutType: "unknown",
        startedAt: now,
        updatedAt: now,
        completedAt: now,
      };
  upsertRecord(record);
  return true;
}

export function markCheckoutCanceled(sessionId: string): boolean {
  return markTerminal(sessionId, "canceled");
}

export function markCheckoutExpired(sessionId: string): boolean {
  return markTerminal(sessionId, "expired");
}

function isStopped(record: CheckoutFunnelRecord, nowMs: number): boolean {
  if (record.status === "paid") return false;
  if (record.status === "canceled" || record.status === "expired") return true;
  const startedMs = Date.parse(record.startedAt);
  return Number.isFinite(startedMs) && nowMs - startedMs > IN_PROGRESS_MS;
}

function isInProgress(record: CheckoutFunnelRecord, nowMs: number): boolean {
  if (record.status !== "started") return false;
  const startedMs = Date.parse(record.startedAt);
  return Number.isFinite(startedMs) && nowMs - startedMs <= IN_PROGRESS_MS;
}

async function listAllRecords(): Promise<CheckoutFunnelRecord[]> {
  const merged = new Map<string, CheckoutFunnelRecord>();
  const fileDb = readFileDb();
  for (const s of fileDb.sessions) merged.set(s.sessionId, s);

  const db = getFirestoreDb();
  if (db) {
    try {
      const snap = await db.collection(COLLECTION).orderBy("startedAt", "desc").limit(MAX_FILE_ROWS).get();
      for (const doc of snap.docs) {
        const d = doc.data() as CheckoutFunnelRecord;
        if (d?.sessionId) merged.set(d.sessionId, d);
      }
    } catch (err) {
      console.error("[checkoutFunnelStore] Firestore list failed", err);
    }
  }

  return Array.from(merged.values()).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

/** Ensures historical paid orders appear in funnel metrics (pre-tracking purchases). */
export function backfillCheckoutFunnelFromPurchase(input: {
  sessionId: string;
  checkoutType: string;
  notifiedAt: string;
  customerEmail?: string | null;
  leadServiceLine?: string | null;
  leadTier?: string | null;
  requestedLeads?: number | null;
  amountCents?: number | null;
}) {
  const id = input.sessionId.trim();
  if (!id) return;
  const existing = readRecord(id);
  if (existing?.status === "paid") return;
  const at = input.notifiedAt || new Date().toISOString();
  const record: CheckoutFunnelRecord = {
    sessionId: id,
    status: "paid",
    source: input.checkoutType === "ghl_pay_link" ? "pay_link" : "buy_leads",
    checkoutType: input.checkoutType,
    serviceLine: input.leadServiceLine ?? null,
    leadTier: input.leadTier ?? null,
    requestedLeads: input.requestedLeads ?? null,
    amountCents: input.amountCents ?? null,
    customerEmail: input.customerEmail?.trim().toLowerCase() || null,
    startedAt: existing?.startedAt ?? at,
    updatedAt: at,
    completedAt: at,
  };
  upsertRecord(record);
}

export async function getCheckoutFunnelSummary(): Promise<CheckoutFunnelSummary> {
  const sessions = await listAllRecords();
  const nowMs = Date.now();
  let paid = 0;
  let stopped = 0;
  let inProgress = 0;

  for (const s of sessions) {
    if (s.status === "paid") paid += 1;
    else if (isInProgress(s, nowMs)) inProgress += 1;
    else if (isStopped(s, nowMs)) stopped += 1;
  }

  const continued = sessions.length;
  const conversionRate = continued > 0 ? Math.round((paid / continued) * 1000) / 10 : 0;
  const unpaid = sessions.filter((s) => s.status !== "paid").slice(0, 800);
  const recentStopped = unpaid.slice(0, 8);

  return {
    continued,
    paid,
    stopped,
    inProgress,
    conversionRate,
    updatedAt: new Date().toISOString(),
    recentStopped,
    unpaid,
  };
}
