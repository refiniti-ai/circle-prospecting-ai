import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type CmsEntry = {
  id: string;
  tenantId: string;
  kind: "blog" | "playbook";
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  status: "draft" | "published";
  updatedAt: string;
};

const __dir = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dir, "data", "platform", "cms.json");

type CmsDb = { entries: CmsEntry[]; updatedAt: string };

function ensureFile() {
  const dir = path.dirname(DATA);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DATA)) {
    fs.writeFileSync(DATA, JSON.stringify({ entries: [], updatedAt: new Date().toISOString() }, null, 2), "utf8");
  }
}

function readDb(): CmsDb {
  ensureFile();
  const db = JSON.parse(fs.readFileSync(DATA, "utf8")) as CmsDb;
  if (!Array.isArray(db.entries)) db.entries = [];
  return db;
}

function writeDb(db: CmsDb) {
  db.updatedAt = new Date().toISOString();
  fs.writeFileSync(DATA, JSON.stringify(db, null, 2), "utf8");
}

export function listCmsEntries(tenantId: string, publishedOnly = false) {
  const db = readDb();
  let entries = db.entries.filter((e) => e.tenantId === tenantId);
  if (publishedOnly) entries = entries.filter((e) => e.status === "published");
  return entries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function upsertCmsEntry(input: Omit<CmsEntry, "updatedAt">) {
  const db = readDb();
  const next: CmsEntry = { ...input, updatedAt: new Date().toISOString() };
  const idx = db.entries.findIndex((e) => e.id === next.id || (e.tenantId === next.tenantId && e.slug === next.slug));
  if (idx >= 0) db.entries[idx] = next;
  else db.entries.unshift(next);
  writeDb(db);
  return next;
}
