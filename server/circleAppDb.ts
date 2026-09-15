import mysql from "mysql2/promise";

/** Business-data MySQL (`circle` on new-production). Listings stay in `roofs`. */
let pool: mysql.Pool | null = null;

export function isCircleAppDbConfigured(): boolean {
  return Boolean(
    process.env.ROOFS_DB_HOST?.trim() &&
      process.env.ROOFS_DB_USER?.trim() &&
      process.env.ROOFS_DB_PASSWORD &&
      (process.env.CIRCLE_APP_DB_NAME?.trim() || process.env.CIRCLE_APP_DB_ENABLED === "1")
  );
}

function getPool(): mysql.Pool {
  if (pool) return pool;
  pool = mysql.createPool({
    host: process.env.ROOFS_DB_HOST!.trim(),
    port: Number(process.env.ROOFS_DB_PORT || "3306"),
    user: process.env.ROOFS_DB_USER!.trim(),
    password: process.env.ROOFS_DB_PASSWORD,
    database: process.env.CIRCLE_APP_DB_NAME?.trim() || "circle",
    waitForConnections: true,
    connectionLimit: 4,
    enableKeepAlive: true,
    ssl: { rejectUnauthorized: true },
  });
  return pool;
}

function fireAndForget(label: string, work: () => Promise<unknown>): void {
  if (!isCircleAppDbConfigured()) return;
  void work().catch((err: unknown) => {
    console.error(`[circleAppDb] ${label} failed; Google/local copy unchanged`, err);
  });
}

export function dualWriteOrder(doc: Record<string, unknown> & { id: string }): void {
  fireAndForget("order upsert", async () => {
    const now = new Date();
    await getPool().query(
      `INSERT INTO orders (id, internal_id, mls, payload, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE internal_id = VALUES(internal_id), mls = VALUES(mls),
         payload = VALUES(payload), updated_at = VALUES(updated_at)`,
      [doc.id, doc.internalId ?? null, doc.mls ?? null, JSON.stringify(doc), now]
    );
  });
}

export function dualWritePurchase(sessionId: string, record: Record<string, unknown>): void {
  fireAndForget("purchase upsert", async () => {
    const now = new Date();
    await getPool().query(
      `INSERT INTO purchases (session_id, order_number, notified_at, checkout_type, customer_email,
         amount_total_cents, currency, mls, payload, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE order_number = VALUES(order_number), notified_at = VALUES(notified_at),
         checkout_type = VALUES(checkout_type), customer_email = VALUES(customer_email),
         amount_total_cents = VALUES(amount_total_cents), currency = VALUES(currency),
         mls = VALUES(mls), payload = VALUES(payload), updated_at = VALUES(updated_at)`,
      [
        sessionId,
        record.orderNumber ?? "",
        record.notifiedAt ?? now.toISOString(),
        record.checkoutType ?? "unknown",
        record.customerEmail ?? null,
        record.amountTotalCents ?? null,
        record.currency ?? null,
        record.mls ?? null,
        JSON.stringify({ sessionId, ...record }),
        now,
      ]
    );
  });
}
