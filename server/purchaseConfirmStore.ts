import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getFirestoreDb } from "./firebaseAdmin.js";

export type LeadWorkStatus = "pending" | "completed";

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
  /** Admin: neighborhood / lead-pack fulfillment tracked in dashboard */
  leadWorkStatus?: LeadWorkStatus | null;
  /** Set after customer order receipt email is successfully handed to GHL/Resend/SMTP */
  customerReceiptEmailSentAt?: string | null;
  /** Set after admin new-purchase notify is successfully sent */
  adminPurchaseEmailSentAt?: string | null;
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

/** Plain object safe for Firestore (no undefined). Omit leadWorkStatus unless set so merge does not wipe admin fulfillment. */
function purchaseDocData(sessionId: string, record: PurchaseNotificationRecord & { sessionId?: string }) {
  const base = {
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
  let out: Record<string, unknown> =
    record.leadWorkStatus === "pending" || record.leadWorkStatus === "completed"
      ? { ...base, leadWorkStatus: record.leadWorkStatus }
      : base;
  if (record.customerReceiptEmailSentAt) {
    out = { ...out, customerReceiptEmailSentAt: record.customerReceiptEmailSentAt };
  }
  if (record.adminPurchaseEmailSentAt) {
    out = { ...out, adminPurchaseEmailSentAt: record.adminPurchaseEmailSentAt };
  }
  return out;
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
  const prev = log.sessions[sessionId];
  const merged: SessionEntry = {
    ...(prev ?? {}),
    ...record,
    leadWorkStatus: prev?.leadWorkStatus ?? record.leadWorkStatus ?? null,
    customerReceiptEmailSentAt: prev?.customerReceiptEmailSentAt ?? record.customerReceiptEmailSentAt,
    adminPurchaseEmailSentAt: prev?.adminPurchaseEmailSentAt ?? record.adminPurchaseEmailSentAt,
  };
  log.sessions[sessionId] = merged;
  writeLog(log);

  const db = getFirestoreDb();
  if (db) {
    try {
      await db
        .collection(PURCHASE_COLLECTION)
        .doc(sessionId)
        .set(purchaseDocData(sessionId, { ...merged, sessionId }), { merge: true });
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
    leadWorkStatus: raw.leadWorkStatus === "completed" || raw.leadWorkStatus === "pending" ? raw.leadWorkStatus : null,
    customerReceiptEmailSentAt: raw.customerReceiptEmailSentAt != null ? String(raw.customerReceiptEmailSentAt) : null,
    adminPurchaseEmailSentAt: raw.adminPurchaseEmailSentAt != null ? String(raw.adminPurchaseEmailSentAt) : null,
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
          leadWorkStatus:
            d.leadWorkStatus === "completed" || d.leadWorkStatus === "pending" ? d.leadWorkStatus : null,
          customerReceiptEmailSentAt:
            d.customerReceiptEmailSentAt != null ? String(d.customerReceiptEmailSentAt) : null,
          adminPurchaseEmailSentAt: d.adminPurchaseEmailSentAt != null ? String(d.adminPurchaseEmailSentAt) : null,
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

function receiptSentAtFromEntry(raw: SessionEntry | undefined): string | null {
  const v = raw?.customerReceiptEmailSentAt;
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function adminEmailSentAtFromEntry(raw: SessionEntry | undefined): string | null {
  const v = raw?.adminPurchaseEmailSentAt;
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export async function isCustomerReceiptEmailSent(sessionId: string): Promise<boolean> {
  const id = sessionId.trim();
  if (!id) return false;
  const log = readLog();
  const fromFile = receiptSentAtFromEntry(log.sessions[id]);
  if (fromFile) return true;
  const db = getFirestoreDb();
  if (!db) return false;
  try {
    const snap = await db.collection(PURCHASE_COLLECTION).doc(id).get();
    if (!snap.exists) return false;
    const v = snap.data()?.customerReceiptEmailSentAt;
    return typeof v === "string" && v.trim().length > 0;
  } catch (err) {
    console.error("[purchaseConfirmStore] isCustomerReceiptEmailSent", err);
    return false;
  }
}

export async function isAdminPurchaseEmailSent(sessionId: string): Promise<boolean> {
  const id = sessionId.trim();
  if (!id) return false;
  const log = readLog();
  if (adminEmailSentAtFromEntry(log.sessions[id])) return true;
  const db = getFirestoreDb();
  if (!db) return false;
  try {
    const snap = await db.collection(PURCHASE_COLLECTION).doc(id).get();
    if (!snap.exists) return false;
    const v = snap.data()?.adminPurchaseEmailSentAt;
    return typeof v === "string" && v.trim().length > 0;
  } catch (err) {
    console.error("[purchaseConfirmStore] isAdminPurchaseEmailSent", err);
    return false;
  }
}

export async function markCustomerReceiptEmailSent(sessionId: string): Promise<void> {
  const id = sessionId.trim();
  if (!id) return;
  const iso = new Date().toISOString();
  const log = readLog();
  if (log.sessions[id]) {
    log.sessions[id] = { ...log.sessions[id], customerReceiptEmailSentAt: iso };
    writeLog(log);
  }
  const db = getFirestoreDb();
  if (db) {
    try {
      await db.collection(PURCHASE_COLLECTION).doc(id).set({ customerReceiptEmailSentAt: iso }, { merge: true });
    } catch (err) {
      console.error("[purchaseConfirmStore] markCustomerReceiptEmailSent Firestore failed", err);
    }
  }
}

export async function markAdminPurchaseEmailSent(sessionId: string): Promise<void> {
  const id = sessionId.trim();
  if (!id) return;
  const iso = new Date().toISOString();
  const log = readLog();
  if (log.sessions[id]) {
    log.sessions[id] = { ...log.sessions[id], adminPurchaseEmailSentAt: iso };
    writeLog(log);
  }
  const db = getFirestoreDb();
  if (db) {
    try {
      await db.collection(PURCHASE_COLLECTION).doc(id).set({ adminPurchaseEmailSentAt: iso }, { merge: true });
    } catch (err) {
      console.error("[purchaseConfirmStore] markAdminPurchaseEmailSent Firestore failed", err);
    }
  }
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
export async function setPurchaseLeadWorkStatus(sessionId: string, status: LeadWorkStatus): Promise<boolean> {
  const id = sessionId.trim();
  if (!id) return false;
  const log = readLog();
  const inFile = Boolean(log.sessions[id]);
  let inFs = false;
  const db = getFirestoreDb();
  if (db) {
    try {
      const snap = await db.collection(PURCHASE_COLLECTION).doc(id).get();
      inFs = snap.exists;
    } catch (err) {
      console.error("[purchaseConfirmStore] Firestore read for leadWorkStatus", err);
    }
  }
  if (!inFile && !inFs) return false;

  if (log.sessions[id]) {
    log.sessions[id] = { ...log.sessions[id], leadWorkStatus: status };
    writeLog(log);
  }
  if (db) {
    try {
      await db.collection(PURCHASE_COLLECTION).doc(id).set({ leadWorkStatus: status }, { merge: true });
    } catch (err) {
      console.error("[purchaseConfirmStore] Firestore leadWorkStatus update failed", err);
      return inFile;
    }
  }
  return true;
}

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
