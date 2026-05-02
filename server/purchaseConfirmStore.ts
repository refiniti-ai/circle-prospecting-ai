import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type PurchaseNotificationRecord = {
  orderNumber: string;
  notifiedAt: string;
  checkoutType: string;
  customerEmail: string | null;
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

export function hasPurchaseNotification(sessionId: string): boolean {
  const log = readLog();
  return Boolean(log.sessions[sessionId]);
}

export function markPurchaseNotification(sessionId: string, record: Omit<PurchaseNotificationRecord, "orderNumber"> & { orderNumber: string }) {
  const log = readLog();
  log.sessions[sessionId] = record;
  writeLog(log);
}

/** Newest first */
export function listPurchaseNotifications(): (PurchaseNotificationRecord & { sessionId: string })[] {
  const log = readLog();
  const rows: (PurchaseNotificationRecord & { sessionId: string })[] = Object.entries(log.sessions).map(([sessionId, raw]) => ({
    sessionId,
    orderNumber: raw.orderNumber,
    notifiedAt: raw.notifiedAt,
    checkoutType: raw.checkoutType ?? "unknown",
    customerEmail: raw.customerEmail ?? null,
    amountTotalCents: raw.amountTotalCents ?? null,
    currency: raw.currency ?? null,
    lineItems: raw.lineItems ?? [],
    leadServiceLine: raw.leadServiceLine ?? null,
    leadTier: raw.leadTier ?? null,
    requestedLeads: raw.requestedLeads ?? null,
    targetingSummary: raw.targetingSummary ?? null,
  }));
  rows.sort((a, b) => (a.notifiedAt < b.notifiedAt ? 1 : -1));
  return rows;
}

export function orderNumberFromSessionId(sessionId: string): string {
  const compact = sessionId.replace(/^cs_(test|live)_/, "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const tail = compact.slice(-10).padStart(10, "0");
  return `CP-${tail}`;
}
