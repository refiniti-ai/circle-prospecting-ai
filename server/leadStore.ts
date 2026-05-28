import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import type { Lead, LeadInventory } from "./leadTypes.js";
import { fetchClientLeadsForEmail, syncClientLeadsToFirestore } from "./clientLeadsFirestore.js";


const __dir = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dir, "data", "inventory.json");

function ensureFile() {
  const dir = path.dirname(DATA);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DATA)) {
    const empty: LeadInventory = { leads: [], lastUpdated: new Date().toISOString() };
    fs.writeFileSync(DATA, JSON.stringify(empty, null, 2), "utf8");
  }
}

export function readInventory(): LeadInventory {
  ensureFile();
  const j = JSON.parse(fs.readFileSync(DATA, "utf8")) as LeadInventory;
  if (!j.leads) j.leads = [];
  return j;
}

function writeInventory(inv: LeadInventory) {
  inv.lastUpdated = new Date().toISOString();
  fs.writeFileSync(DATA, JSON.stringify(inv, null, 2), "utf8");
}

export function upsertLeadsFromRows(rows: Record<string, string>[]) {
  const inv = readInventory();
  for (const row of rows) {
    const address = (row.address || row.Address || row.street || "").trim();
    const city = (row.city || row.City || "").trim();
    const state = (row.state || row.State || row.st || "").trim();
    const zip = (row.zip || row.Zip || row.postal || "").trim();
    if (!address || !city || !state || !zip) continue;
    const mls = (row.mls || row.MLS || row.mls_id || row.id || "").trim();
    const baseId = mls || `${address}|${zip}`;
    const id = mls ? mls : `L-${createHash("sha256").update(baseId).digest("hex").slice(0, 14).toUpperCase()}`;
    if (inv.leads.some((l) => l.id === id)) continue;
    const lead: Lead = {
      id,
      address,
      city,
      state,
      zip: zip.slice(0, 10),
      mls: mls || id,
      listPrice: (row.listPrice || row.price || row["List price"] || "—") as string,
      propertyType: (row.type || row.propertyType || "Residential") as string,
      phone: (row.phone || row.Phone || "") as string,
      email: (row.email || row.Email || "") as string,
      status: "available",
    };
    inv.leads.push(lead);
  }
  writeInventory(inv);
  return inv;
}

export function getSummary() {
  const inv = readInventory();
  const available = inv.leads.filter((l) => l.status === "available").length;
  const sold = inv.leads.filter((l) => l.status === "sold").length;
  return { total: inv.leads.length, available, sold, updatedAt: inv.lastUpdated };
}

export async function getLeadsForEmail(email: string): Promise<Lead[]> {
  const e = email.trim().toLowerCase();
  const fromFile = readInventory()
    .leads.filter((l) => l.status === "sold" && (l.soldToEmail || "").toLowerCase() === e)
    .sort((a, b) => (b.soldAt || "").localeCompare(a.soldAt || ""));

  let fromCloud: Lead[] = [];
  try {
    fromCloud = await fetchClientLeadsForEmail(e);
  } catch (err) {
    console.error("[leadStore] Firestore client leads read failed; file only", err);
  }
  if (fromCloud.length === 0) return fromFile;

  const map = new Map<string, Lead>();
  for (const l of fromFile) map.set(l.id, l);
  for (const l of fromCloud) {
    const prev = map.get(l.id);
    if (!prev || (l.soldAt || "") >= (prev.soldAt || "")) map.set(l.id, l);
  }
  return Array.from(map.values()).sort((a, b) => (b.soldAt || "").localeCompare(a.soldAt || ""));
}

export function allocateLeads(email: string, count: number, stripeSessionId: string): { ok: true; leads: Lead[]; duplicate?: boolean } | { ok: false; error: string } {
  const inv = readInventory();
  const bySession = inv.leads.filter((l) => l.stripeSessionId === stripeSessionId);
  if (bySession.length > 0) {
    void syncClientLeadsToFirestore(bySession);
    return { ok: true, leads: bySession, duplicate: true };
  }
  const available = inv.leads.filter((l) => l.status === "available");
  if (available.length < count) {
    return { ok: false, error: `Only ${available.length} lead(s) in inventory. Upload more CSV in admin.` };
  }
  const take = available.slice(0, count);
  const now = new Date().toISOString();
  for (const t of take) {
    const lead = inv.leads.find((l) => l.id === t.id);
    if (lead) {
      lead.status = "sold";
      lead.soldToEmail = email.toLowerCase();
      lead.stripeSessionId = stripeSessionId;
      lead.soldAt = now;
    }
  }
  writeInventory(inv);
  void syncClientLeadsToFirestore(take);
  return { ok: true, leads: take };
}

export type LeadCountFilter = {
  city?: string;
  county?: string;
  zip?: string;
  radiusMiles?: number;
  includeContact?: "phones" | "phones_email";
  occupancy?: "absentee" | "owner";
  propertyTypes?: string[];
  flags?: string[];
};

export function estimateLeadCount(filter: LeadCountFilter) {
  const inv = readInventory();
  let leads = inv.leads.filter((l) => l.status === "available");
  if (filter.zip) leads = leads.filter((l) => l.zip.startsWith(filter.zip!.slice(0, 5)));
  if (filter.city) leads = leads.filter((l) => l.city.toLowerCase().includes(filter.city!.toLowerCase()));
  if (filter.county) {
    // inventory has no county column; keep soft no-op to preserve API shape
  }
  if (filter.propertyTypes?.length) {
    leads = leads.filter((l) =>
      filter.propertyTypes!.some((p) => l.propertyType.toLowerCase().includes(p.replace(/_/g, " ").toLowerCase()))
    );
  }

  // Normalization: larger radius monotonically increases modeled reach (area grows with radius).
  let normalized = leads.length;
  const r = Number.isFinite(filter.radiusMiles) ? Math.max(0.25, Number(filter.radiusMiles)) : 1;
  const radiusMultiplier = Math.min(6, 0.5 + (r / 0.25) * 0.38);
  normalized = Math.round(normalized * radiusMultiplier);
  if (filter.occupancy === "owner") normalized = Math.round(normalized * 0.8);
  if (filter.includeContact === "phones") normalized = Math.round(normalized * 1.05);
  if (filter.flags?.length) normalized = Math.round(normalized * Math.max(0.55, 1 - filter.flags.length * 0.08));
  normalized = leads.length === 0 ? 0 : Math.max(1, normalized);

  return {
    available: normalized,
    baseAvailableInInventory: leads.length,
    inventoryUpdatedAt: inv.lastUpdated,
  };
}
