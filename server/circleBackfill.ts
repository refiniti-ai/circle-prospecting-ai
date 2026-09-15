import type { QueryDocumentSnapshot } from "firebase-admin/firestore";
import { isCircleAppDbConfigured, getCircleAppPool } from "./circleAppDb.js";
import { isAwsCrmMode } from "./circleCrmMode.js";
import { getFirestoreDb } from "./firebaseAdmin.js";

const PAGE = 200;

function envCol(name: string, fallback: string): string {
  return process.env[name]?.trim() || fallback;
}

async function eachPage(
  collection: string,
  fn: (id: string, data: Record<string, unknown>) => Promise<void>
): Promise<number> {
  const db = getFirestoreDb();
  if (!db) return 0;
  let last: QueryDocumentSnapshot | undefined;
  let n = 0;
  for (;;) {
    let q = db.collection(collection).limit(PAGE);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;
    for (const doc of snap.docs) {
      await fn(doc.id, (doc.data() ?? {}) as Record<string, unknown>);
      n += 1;
    }
    last = snap.docs[snap.docs.length - 1];
    if (snap.size < PAGE) break;
  }
  return n;
}

function str(v: unknown, fallback = ""): string {
  if (v == null) return fallback;
  return String(v);
}

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** One-way copy Google → MySQL `circle`. Does not delete Google. Idempotent upserts. */
export async function backfillCircleFromFirestore(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  if (isAwsCrmMode()) {
    console.log("[circleBackfill] skipped (CIRCLE_CRM_MODE=aws; not reading Google)");
    return counts;
  }
  if (!isCircleAppDbConfigured() || !getFirestoreDb()) {
    console.log("[circleBackfill] skipped (circle db or Firestore not configured)");
    return counts;
  }
  const pool = getCircleAppPool();
  const now = () => new Date();

  counts.orders = await eachPage(envCol("FIREBASE_ORDERS_COLLECTION", "orders"), async (id, d) => {
    await pool.query(
      `INSERT INTO orders (id, internal_id, mls, payload, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE internal_id = VALUES(internal_id), mls = VALUES(mls),
         payload = VALUES(payload), updated_at = VALUES(updated_at)`,
      [id, num(d.internalId), d.mls != null ? str(d.mls) : null, JSON.stringify({ ...d, id }), now()]
    );
  });

  counts.purchases = await eachPage(
    envCol("FIREBASE_PURCHASES_COLLECTION", "purchase_notifications"),
    async (id, d) => {
      await pool.query(
        `INSERT INTO purchases (session_id, order_number, notified_at, checkout_type, customer_email,
           amount_total_cents, currency, mls, payload, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE order_number = VALUES(order_number), notified_at = VALUES(notified_at),
           checkout_type = VALUES(checkout_type), customer_email = VALUES(customer_email),
           amount_total_cents = VALUES(amount_total_cents), currency = VALUES(currency),
           mls = VALUES(mls), payload = VALUES(payload), updated_at = VALUES(updated_at)`,
        [
          id,
          str(d.orderNumber),
          str(d.notifiedAt, now().toISOString()),
          str(d.checkoutType, "unknown"),
          d.customerEmail != null ? str(d.customerEmail) : null,
          num(d.amountTotalCents),
          d.currency != null ? str(d.currency) : null,
          d.mls != null ? str(d.mls) : null,
          JSON.stringify({ sessionId: id, ...d }),
          now(),
        ]
      );
    }
  );

  counts.checkout_funnel = await eachPage(
    envCol("FIREBASE_CHECKOUT_FUNNEL_COLLECTION", "checkout_funnel"),
    async (id, d) => {
      await pool.query(
        `INSERT INTO checkout_funnel (session_id, status, source, checkout_type, mls, started_at, updated_at, payload)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE status = VALUES(status), source = VALUES(source),
           checkout_type = VALUES(checkout_type), mls = VALUES(mls), started_at = VALUES(started_at),
           updated_at = VALUES(updated_at), payload = VALUES(payload)`,
        [
          id,
          str(d.status, "started"),
          str(d.source, "buy_leads"),
          str(d.checkoutType, "unknown"),
          d.mls != null ? str(d.mls) : null,
          str(d.startedAt, now().toISOString()),
          str(d.updatedAt, now().toISOString()),
          JSON.stringify({ sessionId: id, ...d }),
        ]
      );
    }
  );

  counts.client_accounts = await eachPage(
    envCol("FIREBASE_CLIENT_ACCOUNTS_COLLECTION", "client_accounts"),
    async (id, d) => {
      const email = str(d.email || id).toLowerCase();
      if (!email || !d.passwordHash || !d.salt) return;
      await pool.query(
        `INSERT INTO client_accounts (email, password_hash, salt, updated_at)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), salt = VALUES(salt),
           updated_at = VALUES(updated_at)`,
        [email, str(d.passwordHash), str(d.salt), str(d.updatedAt, now().toISOString())]
      );
    }
  );

  counts.client_delivery_leads = await eachPage(
    envCol("FIREBASE_CLIENT_LEADS_COLLECTION", "client_delivery_leads"),
    async (id, d) => {
      const email = str(d.soldToEmail).toLowerCase();
      if (!email) return;
      await pool.query(
        `INSERT INTO client_delivery_leads (id, sold_to_email, stripe_session_id, mls, payload, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE sold_to_email = VALUES(sold_to_email),
           stripe_session_id = VALUES(stripe_session_id), mls = VALUES(mls),
           payload = VALUES(payload), updated_at = VALUES(updated_at)`,
        [
          id,
          email,
          d.stripeSessionId != null ? str(d.stripeSessionId) : null,
          d.mls != null ? str(d.mls) : null,
          JSON.stringify({ ...d, id }),
          now(),
        ]
      );
    }
  );

  counts.pay_link_clicks = await eachPage(
    envCol("FIREBASE_PAY_LINK_CLICKS_COLLECTION", "pay_link_clicks"),
    async (id, d) => {
      await pool.query(
        `INSERT INTO pay_link_clicks (id, contact_id, mls, clicked_at, payload)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE contact_id = VALUES(contact_id), mls = VALUES(mls),
           clicked_at = VALUES(clicked_at), payload = VALUES(payload)`,
        [
          id,
          str(d.contactId),
          d.mls != null ? str(d.mls) : null,
          str(d.clickedAt, now().toISOString()),
          JSON.stringify({ ...d, id }),
        ]
      );
    }
  );

  counts.search_catcher = await eachPage(
    envCol("FIREBASE_SEARCH_CATCHER_COLLECTION", "search_catcher"),
    async (id, d) => {
      await pool.query(
        `INSERT INTO search_catcher (id, created_at, kind, query_text, payload)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE created_at = VALUES(created_at), kind = VALUES(kind),
           query_text = VALUES(query_text), payload = VALUES(payload)`,
        [
          id,
          str(d.createdAt, now().toISOString()),
          str(d.kind, "agent"),
          str(d.query).slice(0, 255),
          JSON.stringify({ ...d, id }),
        ]
      );
    }
  );

  counts.intro_listing_snapshots = await eachPage(
    envCol("FIREBASE_INTRO_LISTING_SNAPSHOTS_COLLECTION", "intro_listing_snapshots"),
    async (id, d) => {
      const mls = str(d.mls || id);
      if (mls.length < 3) return;
      await pool.query(
        `INSERT INTO intro_listing_snapshots (mls, payload, updated_at)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE payload = VALUES(payload), updated_at = VALUES(updated_at)`,
        [mls, JSON.stringify(d), str(d.updatedAt, now().toISOString())]
      );
    }
  );

  counts.password_reset_tokens = await eachPage(
    envCol("FIREBASE_PASSWORD_RESET_COLLECTION", "password_reset_tokens"),
    async (id, d) => {
      await pool.query(
        `INSERT INTO password_reset_tokens (token, kind, email, expires_at)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE kind = VALUES(kind), email = VALUES(email), expires_at = VALUES(expires_at)`,
        [id, str(d.kind, "client"), str(d.email), str(d.expiresAt)]
      );
    }
  );

  console.log("[circleBackfill] copied", counts);
  return counts;
}
