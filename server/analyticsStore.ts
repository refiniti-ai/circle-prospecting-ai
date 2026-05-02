import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type AnalyticsEvent = {
  id: string;
  event: string;
  tenantId: string;
  userId?: string;
  value?: number;
  metadata?: Record<string, string>;
  createdAt: string;
};

const __dir = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dir, "data", "platform", "analytics.json");

type AnalyticsDb = { events: AnalyticsEvent[]; updatedAt: string };

function ensureFile() {
  const dir = path.dirname(DATA);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DATA)) {
    fs.writeFileSync(DATA, JSON.stringify({ events: [], updatedAt: new Date().toISOString() }, null, 2), "utf8");
  }
}

function readDb(): AnalyticsDb {
  ensureFile();
  const db = JSON.parse(fs.readFileSync(DATA, "utf8")) as AnalyticsDb;
  if (!Array.isArray(db.events)) db.events = [];
  return db;
}

function writeDb(db: AnalyticsDb) {
  db.updatedAt = new Date().toISOString();
  fs.writeFileSync(DATA, JSON.stringify(db, null, 2), "utf8");
}

export function trackEvent(input: Omit<AnalyticsEvent, "id" | "createdAt">) {
  const db = readDb();
  const event: AnalyticsEvent = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    ...input,
  };
  db.events.push(event);
  if (db.events.length > 5000) db.events = db.events.slice(-5000);
  writeDb(db);
  return event;
}

export function getAnalyticsSummary(tenantId?: string) {
  const db = readDb();
  const events = tenantId ? db.events.filter((e) => e.tenantId === tenantId) : db.events;
  const counts: Record<string, number> = {};
  for (const e of events) counts[e.event] = (counts[e.event] || 0) + 1;
  return {
    total: events.length,
    counts,
    latest: events.slice(-25).reverse(),
    updatedAt: db.updatedAt,
  };
}
