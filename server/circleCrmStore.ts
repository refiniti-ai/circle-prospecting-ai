import crypto from "node:crypto";
import { getCircleAppPool, isCircleAppDbConfigured } from "./circleAppDb.js";

export type CircleContactRecord = {
  id: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  brokerage: string | null;
  payload: Record<string, unknown>;
  updatedAt: string;
};

export type CirclePayLinkRecord = {
  id: string;
  contactId: string;
  mls: string;
  campaignPath: string | null;
  agentRole: string | null;
  payLinkUrl: string;
  trackedUrl: string;
  stripeCheckoutUrl: string | null;
  payload: Record<string, unknown>;
  updatedAt: string;
};

let tablesReady: Promise<void> | null = null;

export async function ensureCircleCrmTables(): Promise<void> {
  if (!isCircleAppDbConfigured()) return;
  if (!tablesReady) {
    tablesReady = createCrmTables().catch((err) => {
      tablesReady = null;
      throw err;
    });
  }
  await tablesReady;
}

async function createCrmTables(): Promise<void> {
  const pool = getCircleAppPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS contacts (
      id VARCHAR(64) NOT NULL,
      email VARCHAR(255) NULL,
      name VARCHAR(255) NULL,
      phone VARCHAR(64) NULL,
      brokerage VARCHAR(255) NULL,
      payload JSON NOT NULL,
      updated_at DATETIME(3) NOT NULL,
      PRIMARY KEY (id),
      KEY idx_contacts_email (email)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pay_links (
      id VARCHAR(64) NOT NULL,
      contact_id VARCHAR(64) NOT NULL,
      mls VARCHAR(40) NOT NULL,
      campaign_path VARCHAR(24) NULL,
      agent_role VARCHAR(24) NULL,
      pay_link_url VARCHAR(768) NOT NULL,
      tracked_url VARCHAR(768) NOT NULL,
      stripe_checkout_url VARCHAR(768) NULL,
      payload JSON NOT NULL,
      updated_at DATETIME(3) NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_pay_links_mls_path (mls, campaign_path),
      KEY idx_pay_links_mls (mls)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS checkout_links (
      id VARCHAR(64) NOT NULL,
      contact_id VARCHAR(64) NOT NULL,
      session_id VARCHAR(128) NOT NULL,
      url VARCHAR(768) NOT NULL,
      plan VARCHAR(120) NULL,
      amount_cents INT NULL,
      payload JSON NOT NULL,
      updated_at DATETIME(3) NOT NULL,
      PRIMARY KEY (id),
      KEY idx_checkout_links_contact (contact_id),
      KEY idx_checkout_links_session (session_id)
    )
  `);
  try {
    await pool.query(`ALTER TABLE pay_links DROP INDEX uq_pay_links_contact_mls`);
  } catch {
    /* already dropped or never created */
  }
  try {
    await pool.query(
      `ALTER TABLE pay_links ADD UNIQUE KEY uq_pay_links_mls_path (mls, campaign_path)`
    );
  } catch {
    /* already exists */
  }
}

function asRecord(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      /* ignore */
    }
  }
  return {};
}

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

export function newCircleContactId(): string {
  return `circ_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

export async function findCircleContactByEmail(email: string): Promise<CircleContactRecord | null> {
  await ensureCircleCrmTables();
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  const [rows] = await getCircleAppPool().query(
    `SELECT id, email, name, phone, brokerage, payload, updated_at
     FROM contacts WHERE email = ? ORDER BY updated_at DESC LIMIT 1`,
    [normalized]
  );
  const row = (rows as Array<Record<string, unknown>>)[0];
  return row ? mapContact(row) : null;
}

export async function getCircleContact(id: string): Promise<CircleContactRecord | null> {
  await ensureCircleCrmTables();
  const [rows] = await getCircleAppPool().query(
    `SELECT id, email, name, phone, brokerage, payload, updated_at FROM contacts WHERE id = ? LIMIT 1`,
    [id.trim()]
  );
  const row = (rows as Array<Record<string, unknown>>)[0];
  return row ? mapContact(row) : null;
}

export async function searchCircleContacts(query: string, limit = 12): Promise<CircleContactRecord[]> {
  await ensureCircleCrmTables();
  const q = query.trim();
  if (q.length < 2) return [];
  const like = `%${q.replace(/[%_]/g, "\\$&")}%`;
  const [rows] = await getCircleAppPool().query(
    `SELECT id, email, name, phone, brokerage, payload, updated_at
     FROM contacts
     WHERE email LIKE ? OR name LIKE ? OR phone LIKE ? OR id = ?
     ORDER BY updated_at DESC
     LIMIT ${Math.min(Math.max(limit, 1), 50)}`,
    [like, like, like, q]
  );
  return (rows as Array<Record<string, unknown>>).map(mapContact);
}

export async function upsertCircleContact(input: {
  id?: string | null;
  email?: string | null;
  name?: string | null;
  phone?: string | null;
  brokerage?: string | null;
  payload?: Record<string, unknown>;
}): Promise<CircleContactRecord> {
  await ensureCircleCrmTables();
  const email = input.email?.trim().toLowerCase() || null;
  let id = input.id?.trim() || "";
  if (!id && email) {
    const existing = await findCircleContactByEmail(email);
    if (existing) id = existing.id;
  }
  if (!id) id = newCircleContactId();

  const prev = await getCircleContact(id);
  const payload = { ...(prev?.payload ?? {}), ...(input.payload ?? {}) };
  const name = input.name?.trim() || prev?.name || null;
  const phone = input.phone?.trim() || prev?.phone || null;
  const brokerage = input.brokerage?.trim() || prev?.brokerage || null;
  const now = new Date();

  await getCircleAppPool().query(
    `INSERT INTO contacts (id, email, name, phone, brokerage, payload, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       email = COALESCE(VALUES(email), email),
       name = COALESCE(VALUES(name), name),
       phone = COALESCE(VALUES(phone), phone),
       brokerage = COALESCE(VALUES(brokerage), brokerage),
       payload = VALUES(payload),
       updated_at = VALUES(updated_at)`,
    [id, email ?? prev?.email ?? null, name, phone, brokerage, JSON.stringify(payload), now]
  );
  const saved = await getCircleContact(id);
  if (!saved) throw new Error("contact_upsert_failed");
  return saved;
}

export async function upsertCirclePayLink(input: {
  contactId?: string | null;
  mls: string;
  campaignPath?: string | null;
  agentRole?: string | null;
  payLinkUrl: string;
  trackedUrl: string;
  stripeCheckoutUrl?: string | null;
  payload?: Record<string, unknown>;
}): Promise<CirclePayLinkRecord> {
  await ensureCircleCrmTables();
  const mls = input.mls.trim().toUpperCase();
  const campaignPath = (input.campaignPath || "listed").trim();
  const contactId = input.contactId?.trim() || "roofs";
  const id = crypto.createHash("sha256").update(`${mls}:${campaignPath}`).digest("hex").slice(0, 32);
  const prev = await getCirclePayLinkByMlsPath(mls, campaignPath);
  const payload = { ...(prev?.payload ?? {}), ...(input.payload ?? {}) };
  const now = new Date();
  await getCircleAppPool().query(
    `INSERT INTO pay_links
       (id, contact_id, mls, campaign_path, agent_role, pay_link_url, tracked_url, stripe_checkout_url, payload, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       campaign_path = VALUES(campaign_path),
       agent_role = VALUES(agent_role),
       pay_link_url = VALUES(pay_link_url),
       tracked_url = VALUES(tracked_url),
       stripe_checkout_url = COALESCE(VALUES(stripe_checkout_url), stripe_checkout_url),
       payload = VALUES(payload),
       updated_at = VALUES(updated_at)`,
    [
      prev?.id ?? id,
      contactId,
      mls,
      campaignPath,
      input.agentRole ?? prev?.agentRole ?? null,
      input.payLinkUrl,
      input.trackedUrl,
      input.stripeCheckoutUrl ?? prev?.stripeCheckoutUrl ?? null,
      JSON.stringify(payload),
      now,
    ]
  );
  const saved = await getCirclePayLinkByMlsPath(mls, campaignPath);
  if (!saved) throw new Error("pay_link_upsert_failed");
  return saved;
}

export async function getCirclePayLinkByMlsPath(
  mls: string,
  campaignPath: string
): Promise<CirclePayLinkRecord | null> {
  await ensureCircleCrmTables();
  const [rows] = await getCircleAppPool().query(
    `SELECT id, contact_id, mls, campaign_path, agent_role, pay_link_url, tracked_url, stripe_checkout_url, payload, updated_at
     FROM pay_links WHERE mls = ? AND campaign_path = ? LIMIT 1`,
    [mls.trim().toUpperCase(), campaignPath.trim()]
  );
  const row = (rows as Array<Record<string, unknown>>)[0];
  return row ? mapPayLink(row) : null;
}

export async function getCirclePayLink(contactId: string, mls: string): Promise<CirclePayLinkRecord | null> {
  await ensureCircleCrmTables();
  const [rows] = await getCircleAppPool().query(
    `SELECT id, contact_id, mls, campaign_path, agent_role, pay_link_url, tracked_url, stripe_checkout_url, payload, updated_at
     FROM pay_links WHERE (contact_id = ? AND mls = ?) OR mls = ?
     ORDER BY updated_at DESC LIMIT 1`,
    [contactId.trim(), mls.trim().toUpperCase(), mls.trim().toUpperCase()]
  );
  const row = (rows as Array<Record<string, unknown>>)[0];
  return row ? mapPayLink(row) : null;
}

export async function listCirclePayLinksForMls(mls: string, limit = 12): Promise<CirclePayLinkRecord[]> {
  await ensureCircleCrmTables();
  const cap = Math.min(Math.max(limit, 1), 50);
  const [rows] = await getCircleAppPool().query(
    `SELECT id, contact_id, mls, campaign_path, agent_role, pay_link_url, tracked_url, stripe_checkout_url, payload, updated_at
     FROM pay_links WHERE mls = ? ORDER BY updated_at DESC LIMIT ${cap}`,
    [mls.trim().toUpperCase()]
  );
  return (rows as Array<Record<string, unknown>>).map(mapPayLink);
}

export async function listCirclePayLinksForContact(contactId: string, limit = 50): Promise<CirclePayLinkRecord[]> {
  await ensureCircleCrmTables();
  const cap = Math.min(Math.max(limit, 1), 50);
  const [rows] = await getCircleAppPool().query(
    `SELECT id, contact_id, mls, campaign_path, agent_role, pay_link_url, tracked_url, stripe_checkout_url, payload, updated_at
     FROM pay_links WHERE contact_id = ? ORDER BY updated_at DESC LIMIT ${cap}`,
    [contactId.trim()]
  );
  return (rows as Array<Record<string, unknown>>).map(mapPayLink);
}

export async function insertCircleCheckoutLink(input: {
  contactId: string;
  sessionId: string;
  url: string;
  plan?: string | null;
  amountCents?: number | null;
  payload?: Record<string, unknown>;
}): Promise<void> {
  await ensureCircleCrmTables();
  const id = crypto.randomUUID().replace(/-/g, "").slice(0, 32);
  await getCircleAppPool().query(
    `INSERT INTO checkout_links (id, contact_id, session_id, url, plan, amount_cents, payload, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.contactId.trim(),
      input.sessionId,
      input.url,
      input.plan ?? null,
      input.amountCents ?? null,
      JSON.stringify(input.payload ?? {}),
      new Date(),
    ]
  );
}

function mapContact(row: Record<string, unknown>): CircleContactRecord {
  return {
    id: String(row.id),
    email: str(row.email),
    name: str(row.name),
    phone: str(row.phone),
    brokerage: str(row.brokerage),
    payload: asRecord(row.payload),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at ?? ""),
  };
}

function mapPayLink(row: Record<string, unknown>): CirclePayLinkRecord {
  return {
    id: String(row.id),
    contactId: String(row.contact_id),
    mls: String(row.mls),
    campaignPath: str(row.campaign_path),
    agentRole: str(row.agent_role),
    payLinkUrl: String(row.pay_link_url ?? ""),
    trackedUrl: String(row.tracked_url ?? ""),
    stripeCheckoutUrl: str(row.stripe_checkout_url),
    payload: asRecord(row.payload),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at ?? ""),
  };
}
