import mysql from "mysql2/promise";
import { rdsMysqlSsl } from "./rdsMysqlSsl.js";

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
    ssl: rdsMysqlSsl(),
  });
  return pool;
}

function fireAndForget(label: string, work: () => Promise<unknown>): void {
  if (!isCircleAppDbConfigured()) return;
  void work().catch((err: unknown) => {
    console.error(`[circleAppDb] ${label} failed; Google/local copy unchanged`, err);
  });
}

export function getCircleAppPool(): mysql.Pool {
  return getPool();
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

function asRecord(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    } catch {
      /* ignore */
    }
  }
  return {};
}

export async function getCircleClientAccount(email: string): Promise<{
  email: string;
  passwordHash: string;
  salt: string;
  updatedAt: string;
} | null> {
  if (!isCircleAppDbConfigured()) return null;
  const e = email.trim().toLowerCase();
  const [rows] = await getPool().query(
    `SELECT email, password_hash, salt, updated_at FROM client_accounts WHERE email = ? LIMIT 1`,
    [e]
  );
  const row = (rows as Array<Record<string, unknown>>)[0];
  if (!row?.password_hash || !row?.salt) return null;
  return {
    email: String(row.email),
    passwordHash: String(row.password_hash),
    salt: String(row.salt),
    updatedAt: String(row.updated_at ?? ""),
  };
}

export async function upsertCircleClientAccount(row: {
  email: string;
  passwordHash: string;
  salt: string;
  updatedAt: string;
}): Promise<void> {
  if (!isCircleAppDbConfigured()) return;
  await getPool().query(
    `INSERT INTO client_accounts (email, password_hash, salt, updated_at)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), salt = VALUES(salt),
       updated_at = VALUES(updated_at)`,
    [row.email, row.passwordHash, row.salt, row.updatedAt]
  );
}

export async function listCircleClientAccountEmails(): Promise<string[]> {
  if (!isCircleAppDbConfigured()) return [];
  const [rows] = await getPool().query(`SELECT email FROM client_accounts ORDER BY email ASC`);
  return (rows as Array<{ email: string }>).map((r) => String(r.email).toLowerCase());
}

export async function getCirclePurchasePayload(sessionId: string): Promise<Record<string, unknown> | null> {
  if (!isCircleAppDbConfigured()) return null;
  const [rows] = await getPool().query(
    `SELECT payload FROM purchases WHERE session_id = ? LIMIT 1`,
    [sessionId]
  );
  const row = (rows as Array<Record<string, unknown>>)[0];
  if (!row) return null;
  return asRecord(row.payload);
}

export async function listCirclePurchasePayloads(): Promise<Array<{ sessionId: string; payload: Record<string, unknown> }>> {
  if (!isCircleAppDbConfigured()) return [];
  const [rows] = await getPool().query(
    `SELECT session_id, payload FROM purchases ORDER BY notified_at DESC LIMIT 500`
  );
  return (rows as Array<Record<string, unknown>>).map((r) => ({
    sessionId: String(r.session_id),
    payload: asRecord(r.payload),
  }));
}
