import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getFirestoreDb } from "./firebaseAdmin.js";

export type PayLinkClickRecord = {
  id: string;
  contactId: string;
  mls: string;
  clickedAt: string;
  agentRole?: "buyer" | "seller";
  ip?: string;
  userAgent?: string;
  referer?: string;
};

const __dir = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dir, "data", "platform", "pay-link-clicks.json");
const COLLECTION = process.env.FIREBASE_PAY_LINK_CLICKS_COLLECTION?.trim() || "pay_link_clicks";
const MAX_FILE_ROWS = 5000;

type FileDb = { clicks: PayLinkClickRecord[]; updatedAt: string };

function ensureFile() {
  const dir = path.dirname(DATA);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DATA)) {
    fs.writeFileSync(
      DATA,
      JSON.stringify({ clicks: [], updatedAt: new Date().toISOString() }, null, 2),
      "utf8"
    );
  }
}

function readFileDb(): FileDb {
  ensureFile();
  const db = JSON.parse(fs.readFileSync(DATA, "utf8")) as FileDb;
  if (!Array.isArray(db.clicks)) db.clicks = [];
  return db;
}

function writeFileDb(db: FileDb) {
  db.updatedAt = new Date().toISOString();
  fs.writeFileSync(DATA, JSON.stringify(db, null, 2), "utf8");
}

export async function recordPayLinkClick(input: {
  contactId: string;
  mls: string;
  agentRole?: "buyer" | "seller";
  ip?: string;
  userAgent?: string;
  referer?: string;
}): Promise<PayLinkClickRecord> {
  const click: PayLinkClickRecord = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    contactId: input.contactId,
    mls: input.mls,
    clickedAt: new Date().toISOString(),
    agentRole: input.agentRole,
    ip: input.ip,
    userAgent: input.userAgent,
    referer: input.referer,
  };

  const db = getFirestoreDb();
  if (db) {
    try {
      await db.collection(COLLECTION).doc(click.id).set(click);
    } catch (err) {
      console.error("[payLinkClickStore] Firestore write failed", err);
    }
  }

  const fileDb = readFileDb();
  fileDb.clicks.push(click);
  if (fileDb.clicks.length > MAX_FILE_ROWS) fileDb.clicks = fileDb.clicks.slice(-MAX_FILE_ROWS);
  writeFileDb(fileDb);

  return click;
}

export async function countClicksForContact(contactId: string): Promise<number> {
  const id = contactId.trim();
  let n = 0;

  const fileDb = readFileDb();
  for (const c of fileDb.clicks) {
    if (c.contactId === id) n += 1;
  }

  const db = getFirestoreDb();
  if (db) {
    try {
      const snap = await db.collection(COLLECTION).where("contactId", "==", id).count().get();
      const fsCount = snap.data().count;
      if (fsCount > n) n = fsCount;
    } catch (err) {
      console.error("[payLinkClickStore] Firestore count failed", err);
    }
  }

  return n;
}

export async function listRecentPayLinkClicks(limit = 50): Promise<PayLinkClickRecord[]> {
  const cap = Math.min(Math.max(limit, 1), 200);
  const merged = new Map<string, PayLinkClickRecord>();

  const fileDb = readFileDb();
  for (const c of fileDb.clicks) merged.set(c.id, c);

  const db = getFirestoreDb();
  if (db) {
    try {
      const snap = await db
        .collection(COLLECTION)
        .orderBy("clickedAt", "desc")
        .limit(cap)
        .get();
      for (const doc of snap.docs) {
        const d = doc.data() as PayLinkClickRecord;
        if (d?.id) merged.set(d.id, d);
      }
    } catch (err) {
      console.error("[payLinkClickStore] Firestore list failed", err);
    }
  }

  return Array.from(merged.values())
    .sort((a, b) => b.clickedAt.localeCompare(a.clickedAt))
    .slice(0, cap);
}
