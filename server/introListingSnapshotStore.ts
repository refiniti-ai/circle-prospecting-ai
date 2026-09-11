import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ListingPayload } from "../src/lib/listingData.js";
import { getFirestoreDb } from "./firebaseAdmin.js";

const COLLECTION = process.env.FIREBASE_INTRO_LISTING_SNAPSHOTS_COLLECTION?.trim() || "intro_listing_snapshots";
const MAX_FILE_ROWS = 2000;
const MAX_JSON_CHARS = 24_000;

const __dir = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dir, "data", "intro-listing-snapshots.json");

export type IntroListingSnapshotRecord = {
  mls: string;
  listing: ListingPayload;
  updatedAt: string;
};

type FileDb = { rows: Record<string, IntroListingSnapshotRecord> };

export function normalizeIntroSnapshotMls(raw: string): string {
  const t = raw.trim();
  if (/^\d{5,9}$/.test(t)) return t;
  return t.toUpperCase().replace(/\s+/g, "");
}

export function introSnapshotDocId(mls: string): string {
  const mlsQ = normalizeIntroSnapshotMls(mls);
  return mlsQ.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 80);
}

function ensureFile() {
  const dir = path.dirname(DATA);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DATA)) {
    fs.writeFileSync(DATA, JSON.stringify({ rows: {} } satisfies FileDb, null, 2), "utf8");
  }
}

function readFileDb(): FileDb {
  ensureFile();
  try {
    const raw = JSON.parse(fs.readFileSync(DATA, "utf8")) as FileDb;
    if (!raw.rows || typeof raw.rows !== "object") raw.rows = {};
    return raw;
  } catch {
    return { rows: {} };
  }
}

function writeFileDb(db: FileDb) {
  const keys = Object.keys(db.rows);
  if (keys.length > MAX_FILE_ROWS) {
    const sorted = keys.sort((a, b) => (db.rows[a]?.updatedAt || "").localeCompare(db.rows[b]?.updatedAt || ""));
    for (const k of sorted.slice(0, keys.length - MAX_FILE_ROWS)) {
      delete db.rows[k];
    }
  }
  fs.writeFileSync(DATA, JSON.stringify(db, null, 2), "utf8");
}

export function isIntroListingSnapshot(listing: unknown): listing is ListingPayload {
  if (!listing || typeof listing !== "object") return false;
  const o = listing as ListingPayload;
  const mls = typeof o.mls === "string" ? o.mls.trim() : "";
  if (mls.length < 3 || /^DRAFT[-_]/i.test(mls)) return false;
  if (!Number.isFinite(o.lat) || !Number.isFinite(o.lng)) return false;
  try {
    if (JSON.stringify(listing).length > MAX_JSON_CHARS) return false;
  } catch {
    return false;
  }
  return true;
}

export async function upsertIntroListingSnapshot(listing: ListingPayload): Promise<IntroListingSnapshotRecord> {
  const mls = normalizeIntroSnapshotMls(listing.mls);
  const record: IntroListingSnapshotRecord = {
    mls,
    listing: { ...listing, mls, id: mls.toLowerCase() },
    updatedAt: new Date().toISOString(),
  };
  const docId = introSnapshotDocId(mls);

  const db = getFirestoreDb();
  if (db) {
    try {
      await db.collection(COLLECTION).doc(docId).set(record, { merge: true });
    } catch (err) {
      console.error("[introListingSnapshot] Firestore write failed", err);
    }
  }

  const fileDb = readFileDb();
  fileDb.rows[docId] = record;
  writeFileDb(fileDb);
  return record;
}

export async function getIntroListingSnapshot(mls: string): Promise<ListingPayload | null> {
  const mlsQ = normalizeIntroSnapshotMls(mls);
  if (mlsQ.length < 3) return null;
  const docId = introSnapshotDocId(mlsQ);

  const db = getFirestoreDb();
  if (db) {
    try {
      const snap = await db.collection(COLLECTION).doc(docId).get();
      const data = snap.data() as IntroListingSnapshotRecord | undefined;
      if (data?.listing && isIntroListingSnapshot(data.listing)) return data.listing;
    } catch (err) {
      console.error("[introListingSnapshot] Firestore read failed", err);
    }
  }

  const row = readFileDb().rows[docId];
  if (row?.listing && isIntroListingSnapshot(row.listing)) return row.listing;
  return null;
}
