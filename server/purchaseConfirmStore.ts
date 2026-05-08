import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getFirestoreDb } from "./firebaseAdmin.js";

export type PurchaseNotificationRecord = {
  orderNumber: string;
  notifiedAt: string;
  checkoutType: string;
  customerEmail: string | null;
  /** Last 10 digits from checkout metadata; helps identity login without Stripe round-trips. */
  customerPhoneDigits?: string | null;
  amountTotalCents: number | null;
  currency: string | null;
  lineItems: string[];
  /** From Stripe Checkout metadata when checkoutType is lead_pack */
  leadServiceLine?: string | null;
  leadTier?: string | null;
  requestedLeads?: number | null;
  targetingSummary?: string | null;
};

type SessionEntryV1 = { orderNumber: string; notifiedAt: string };
type SessionEntry = SessionEntryV1 & Partial<Omit<PurchaseNotificationRecord, "orderNumber" | "notifiedAt">>;

type PurchaseLog = {
  sessions: Record<string, SessionEntry>;
};

const __dir = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dir, "data", "purchase-confirmations.json");

const PURCHASE_COLLECTION =
  process.env.FIREBASE_PURCHASES_COLLECTION?.trim() || "purchase_notifications";

function ensureFile() {
  const dir = path.dirname(DATA);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DATA)) {
    const empty: PurchaseLog = { sessions: {} };
    fs.writeFileSync(DATA, JSON.stringify(empty, null, 2), "utf8");
  }
}

function readLog(): PurchaseLog {
  ensureFile();
  const raw = JSON.parse(fs.readFileSync(DATA, "utf8")) as PurchaseLog;
  if (!raw.sessions || typeof raw.sessions !== "object") raw.sessions = {};
  return raw;
}

function writeLog(log: PurchaseLog) {
  fs.writeFileSync(DATA, JSON.stringify(log, null, 2), "utf8");
}

/** Plain object safe for Firestore (no undefined). */
function purchaseDocData(sessionId: string, record: PurchaseNotificationRecord & { sessionId?: string }) {
  return {
    sessionId,
    orderNumber: record.orderNumber,
    notifiedAt: record.notifiedAt,
    checkoutType: record.checkoutType,
    customerEmail: record.customerEmail,
    customerPhoneDigits: record.customerPhoneDigits ?? null,
    amountTotalCents: record.amountTotalCents,
    currency: record.currency,
    lineItems: record.lineItems,
    leadServiceLine: record.leadServiceLine ?? null,
    leadTier: record.leadTier ?? null,
    requestedLeads: record.requestedLeads ?? null,
    targetingSummary: record.targetingSummary ?? null,
  };
}

export async function hasPurchaseNotification(sessionId: string): Promise<boolean> {
  const log = readLog();
  if (Boolean(log.sessions[sessionId])) return true;
  const db = getFirestoreDb();
  if (!db) return false;
  try {
    const snap = await db.collection(PURCHASE_COLLECTION).doc(sessionId).get();
    return snap.exists;
  } catch (err) {
    console.error("[purchaseConfirmStore] Firestore read failed for hasPurchase", err);
    return false;
  }
}

export async function markPurchaseNotification(
  sessionId: string,
  record: Omit<PurchaseNotificationRecord, "orderNumber"> & { orderNumber: string }
) {
  const log = readLog();
  log.sessions[sessionId] = record;
  writeLog(log);

  const db = getFirestoreDb();
  if (db) {
    try {
      await db
        .collection(PURCHASE_COLLECTION)
        .doc(sessionId)
        .set(purchaseDocData(sessionId, { ...record, sessionId }), { merge: true });
    } catch (err) {
      console.error("[purchaseConfirmStore] Firestore write failed; local JSON saved", err);
    }
  }
}

function rowsFromFile(): (PurchaseNotificationRecord & { sessionId: string })[] {
  const log = readLog();
  return Object.entries(log.sessions).map(([sessionId, raw]) => ({
    sessionId,
    orderNumber: raw.orderNumber,
    notifiedAt: raw.notifiedAt,
    checkoutType: raw.checkoutType ?? "unknown",
    customerEmail: raw.customerEmail ?? null,
    customerPhoneDigits: raw.customerPhoneDigits ?? null,
    amountTotalCents: raw.amountTotalCents ?? null,
    currency: raw.currency ?? null,
    lineItems: raw.lineItems ?? [],
    leadServiceLine: raw.leadServiceLine ?? null,
    leadTier: raw.leadTier ?? null,
    requestedLeads: raw.requestedLeads ?? null,
    targetingSummary: raw.targetingSummary ?? null,
  }));
}

/** Newest first — merges Firestore + local JSON (Firestore wins per session id). */
export async function listPurchaseNotifications(): Promise<(PurchaseNotificationRecord & { sessionId: string })[]> {
  const fromFile = rowsFromFile();
  const merged = new Map<string, PurchaseNotificationRecord & { sessionId: string }>();
  for (const r of fromFile) merged.set(r.sessionId, r);

  const db = getFirestoreDb();
  if (db) {
    try {
      const snap = await db.collection(PURCHASE_COLLECTION).get();
      for (const doc of snap.docs) {
        const d = doc.data();
        const sessionId = doc.id;
        merged.set(sessionId, {
          sessionId,
          orderNumber: String(d.orderNumber ?? ""),
          notifiedAt: String(d.notifiedAt ?? ""),
          checkoutType: String(d.checkoutType ?? "unknown"),
          customerEmail: d.customerEmail != null ? String(d.customerEmail) : null,
          customerPhoneDigits: d.customerPhoneDigits != null ? String(d.customerPhoneDigits) : null,
          amountTotalCents: typeof d.amountTotalCents === "number" ? d.amountTotalCents : null,
          currency: d.currency != null ? String(d.currency) : null,
          lineItems: Array.isArray(d.lineItems) ? (d.lineItems as string[]) : [],
          leadServiceLine: d.leadServiceLine != null ? String(d.leadServiceLine) : null,
          leadTier: d.leadTier != null ? String(d.leadTier) : null,
          requestedLeads: typeof d.requestedLeads === "number" ? d.requestedLeads : null,
          targetingSummary: d.targetingSummary != null ? String(d.targetingSummary) : null,
        });
      }
    } catch (err) {
      console.error("[purchaseConfirmStore] Firestore list failed; using file-only", err);
    }
  }

  const rows = Array.from(merged.values());
  rows.sort((a, b) => (a.notifiedAt < b.notifiedAt ? 1 : -1));
  return rows;
}

export function orderNumberFromSessionId(sessionId: string): string {
  const compact = sessionId.replace(/^cs_(test|live)_/, "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const tail = compact.slice(-10).padStart(10, "0");
  return `CP-${tail}`;
}

/** Purchases tied to this email (e.g. client dashboard after JWT or future Google login). */
export async function listPurchasesForEmail(email: string): Promise<(PurchaseNotificationRecord & { sessionId: string })[]> {
  const e = email.trim().toLowerCase();
  if (!e.includes("@")) return [];
  const all = await listPurchaseNotifications();
  return all.filter((p) => (p.customerEmail || "").trim().toLowerCase() === e);
}

/** Newest first (same order as listPurchaseNotifications). */
export async function listLeadPackSessionIdsForEmail(email: string): Promise<string[]> {
  const e = email.trim().toLowerCase();
  if (!e.includes("@")) return [];
  const all = await listPurchaseNotifications();
  const out: string[] = [];
  for (const p of all) {
    if (p.checkoutType === "lead_pack" && (p.customerEmail || "").trim().toLowerCase() === e) {
      out.push(p.sessionId);
    }
  }
  return out;
}
