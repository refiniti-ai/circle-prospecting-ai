import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getFirestoreDb } from "./firebaseAdmin.js";

export type RadiusId = "subdivision" | "q1" | "h1" | "m1" | "zip";

export type ListingPayload = {
  id: string;
  internalId: number;
  mls: string;
  address: string;
  cityStateZip: string;
  county: string;
  listPrice: string;
  agentName: string;
  email: string;
  phone: string;
  brokerage: string;
  lat: number;
  lng: number;
  zip: string;
  createdAt?: string;
  radii: Record<RadiusId, { label: string; count: number }>;
};

const __dir = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dir, "data", "orders.json");

const DEMO: ListingPayload = {
  id: "948",
  internalId: 948,
  mls: "TB8494774",
  address: "1840 SALEM CT",
  cityStateZip: "Dunedin, FL 34698",
  county: "Pinellas",
  listPrice: "$950,000",
  agentName: "Jeffrey Borham, PA",
  email: "jeff@jeffborham.com",
  phone: "866-308-7109",
  brokerage: "EXP Realty LLC",
  lat: 28.0028,
  lng: -82.7897,
  zip: "34698",
  createdAt: "2026-04-09T16:01:00-04:00",
  radii: {
    subdivision: { label: "Subdivision", count: 8 },
    q1: { label: "� Mile", count: 134 },
    h1: { label: "� Mile", count: 739 },
    m1: { label: "1 Mile", count: 4035 },
    zip: { label: "ZIP (34698)", count: 16766 },
  },
};

type Db = { orders: ListingPayload[]; updatedAt: string };
type FirestoreOrderDoc = ListingPayload & { updatedAt: string };
const ORDER_COLLECTION = process.env.FIREBASE_ORDERS_COLLECTION?.trim() || "orders";

function ensureFile() {
  const dir = path.dirname(DATA);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DATA)) {
    const empty: Db = { orders: [DEMO], updatedAt: new Date().toISOString() };
    fs.writeFileSync(DATA, JSON.stringify(empty, null, 2), "utf8");
  }
}

function readDb(): Db {
  ensureFile();
  const db = JSON.parse(fs.readFileSync(DATA, "utf8")) as Db;
  if (!Array.isArray(db.orders)) db.orders = [DEMO];
  return db;
}

function writeDb(db: Db) {
  db.updatedAt = new Date().toISOString();
  fs.writeFileSync(DATA, JSON.stringify(db, null, 2), "utf8");
}

function cloneForId(id: string): ListingPayload {
  const n = Number.parseInt(id, 10);
  return {
    ...DEMO,
    id,
    internalId: Number.isFinite(n) ? n : DEMO.internalId,
  };
}

export function upsertOrder(order: ListingPayload): ListingPayload {
  const firestore = getFirestoreDb();
  if (firestore) {
    const doc: FirestoreOrderDoc = {
      ...order,
      id: String(order.id || order.internalId),
      internalId: Number(order.internalId),
      updatedAt: new Date().toISOString(),
    };
    // Firestore is optional: never let credential/network errors crash the API process.
    void firestore
      .collection(ORDER_COLLECTION)
      .doc(doc.id)
      .set(doc, { merge: true })
      .catch((err: unknown) => {
        console.error("[orderStore] Firestore write failed; continuing with local fallback", err);
      });
  }
  const db = readDb();
  const idx = db.orders.findIndex((o) => o.id === order.id || o.internalId === order.internalId || o.mls === order.mls);
  if (idx >= 0) db.orders[idx] = { ...db.orders[idx], ...order };
  else db.orders.unshift(order);
  writeDb(db);
  return order;
}

export function getLocalOrderById(id: string): ListingPayload | null {
  if (!id) return null;
  const db = readDb();
  const found = db.orders.find((o) => o.id === id || String(o.internalId) === id || o.mls === id);
  if (found) return found;
  if (/^\d+$/.test(id)) return cloneForId(id);
  return null;
}

async function getFirestoreOrderById(id: string): Promise<ListingPayload | null> {
  const db = getFirestoreDb();
  if (!db) return null;
  try {
    const fromDoc = await db.collection(ORDER_COLLECTION).doc(id).get();
    if (fromDoc.exists) return fromDoc.data() as ListingPayload;

    if (/^\d+$/.test(id)) {
      const n = Number.parseInt(id, 10);
      const q = await db.collection(ORDER_COLLECTION).where("internalId", "==", n).limit(1).get();
      if (!q.empty) return q.docs[0]!.data() as ListingPayload;
    }

    const byMls = await db.collection(ORDER_COLLECTION).where("mls", "==", id).limit(1).get();
    if (!byMls.empty) return byMls.docs[0]!.data() as ListingPayload;
  } catch (err) {
    console.error("[orderStore] Firestore read failed; using local fallback", err);
    return null;
  }
  return null;
}

export async function fetchOrderById(id: string, signal?: AbortSignal): Promise<ListingPayload | null> {
  if (!id || id.length > 64) return null;
  const fromFs = await getFirestoreOrderById(id);
  if (fromFs) return fromFs;

  const local = getLocalOrderById(id);
  if (local) return local;

  const base = process.env.ORDER_UPSTREAM_URL?.replace(/\/$/, "");
  if (base) {
    const url = `${base}/api/orders/${encodeURIComponent(id)}`;
    const headers: Record<string, string> = { Accept: "application/json" };
    const t = process.env.ORDER_UPSTREAM_TOKEN;
    if (t) headers.Authorization = `Bearer ${t}`;
    const res = await fetch(url, { signal, headers });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Upstream order API ${res.status}`);
    const j = (await res.json()) as ListingPayload;
    void upsertOrder(j);
    return j;
  }

  if (/^\d+$/.test(id)) return cloneForId(id);
  return null;
}

export function allOrders() {
  if (getFirestoreDb()) return [DEMO];
  return readDb().orders;
}

export { DEMO as sampleListing };
