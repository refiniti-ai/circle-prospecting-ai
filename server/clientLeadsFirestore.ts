import { getFirestoreDb } from "./firebaseAdmin.js";
import type { Lead } from "./leadTypes.js";

const COL = process.env.FIREBASE_CLIENT_LEADS_COLLECTION?.trim() || "client_delivery_leads";

function rowFromDoc(docId: string, d: Record<string, unknown>): Lead {
  return {
    id: String(d.id ?? docId),
    address: String(d.address ?? ""),
    city: String(d.city ?? ""),
    state: String(d.state ?? ""),
    zip: String(d.zip ?? ""),
    mls: String(d.mls ?? ""),
    listPrice: String(d.listPrice ?? "—"),
    propertyType: String(d.propertyType ?? ""),
    phone: String(d.phone ?? ""),
    email: String(d.email ?? ""),
    status: d.status === "sold" || d.status === "available" ? d.status : "sold",
    soldToEmail: d.soldToEmail != null ? String(d.soldToEmail) : undefined,
    stripeSessionId: d.stripeSessionId != null ? String(d.stripeSessionId) : undefined,
    soldAt: d.soldAt != null ? String(d.soldAt) : undefined,
  };
}

/** Upsert allocated rows (document id = lead id). Chunks to respect Firestore 500-op batch limit. */
export async function syncClientLeadsToFirestore(leads: Lead[]): Promise<void> {
  const db = getFirestoreDb();
  if (!db || leads.length === 0) return;
  const toSync = leads.filter((l) => l.status === "sold" && l.soldToEmail && l.stripeSessionId);
  const chunkSize = 400;
  for (let i = 0; i < toSync.length; i += chunkSize) {
    const slice = toSync.slice(i, i + chunkSize);
    const batch = db.batch();
    for (const l of slice) {
      const ref = db.collection(COL).doc(l.id);
      batch.set(
        ref,
        {
          id: l.id,
          address: l.address,
          city: l.city,
          state: l.state,
          zip: l.zip,
          mls: l.mls,
          listPrice: l.listPrice,
          propertyType: l.propertyType,
          phone: l.phone,
          email: l.email,
          status: l.status,
          soldToEmail: l.soldToEmail!.toLowerCase(),
          stripeSessionId: l.stripeSessionId,
          soldAt: l.soldAt ?? null,
        },
        { merge: true }
      );
    }
    try {
      await batch.commit();
    } catch (e) {
      console.error("[clientLeadsFirestore] batch write failed", e);
    }
  }
}

/** All delivery rows for this customer email (for dashboard + CSV). */
export async function fetchClientLeadsForEmail(email: string): Promise<Lead[]> {
  const db = getFirestoreDb();
  if (!db) return [];
  const e = email.trim().toLowerCase();
  if (!e.includes("@")) return [];
  try {
    const snap = await db.collection(COL).where("soldToEmail", "==", e).get();
    const out: Lead[] = [];
    for (const doc of snap.docs) {
      out.push(rowFromDoc(doc.id, doc.data()));
    }
    return out.sort((a, b) => (b.soldAt || "").localeCompare(a.soldAt || ""));
  } catch (e) {
    console.error("[clientLeadsFirestore] query failed", e);
    return [];
  }
}
