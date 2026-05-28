import type { LeadServiceLine, LeadTierId } from "../src/lib/leadPricing.js";
import type { RadiusId } from "./orderStore.js";

const RADIUS_IDS = new Set<RadiusId>(["subdivision", "q1", "h1", "m1", "zip"]);
const SERVICE_LINES = new Set<LeadServiceLine>(["ai_outreach", "live_callers", "hybrid", "data_only"]);
const TIERS = new Set<LeadTierId>(["dabble", "starter", "growth", "scale"]);

const KNOWN_KEYS = new Set([
  "order",
  "orderid",
  "order_id",
  "internalid",
  "internal_id",
  "id",
  "mls",
  "radius",
  "radiusid",
  "radius_id",
  "ring",
  "homes",
  "homecount",
  "home_count",
  "requestedleads",
  "requested_leads",
  "packsize",
  "pack_size",
  "serviceline",
  "service_line",
  "service",
  "product",
  "leadtier",
  "lead_tier",
  "tier",
  "plan",
  "campaign",
  "campaigntype",
  "campaign_type",
  "address",
  "listingaddress",
  "listing_address",
  "agentname",
  "agent_name",
  "email",
  "agentemail",
  "agent_email",
  "phone",
  "agentphone",
  "agent_phone",
  "brokerage",
  "city",
  "county",
  "state",
  "zip",
  "listprice",
  "list_price",
]);

function normKey(k: string): string {
  return k.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function firstString(q: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = q[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (Array.isArray(v) && typeof v[0] === "string" && v[0].trim()) return v[0].trim();
  }
  return undefined;
}

function parseRadius(raw: string | undefined): RadiusId | undefined {
  if (!raw) return undefined;
  const v = raw.trim().toLowerCase().replace(/\s+/g, "");
  if (RADIUS_IDS.has(v as RadiusId)) return v as RadiusId;
  if (v === "0.25" || v === "quarter" || v === "q1mile") return "q1";
  if (v === "0.5" || v === "half" || v === "h1mile") return "h1";
  if (v === "1" || v === "1mile" || v === "m1mile") return "m1";
  if (v === "zipcode" || v === "zip") return "zip";
  if (v === "sub" || v === "subdiv") return "subdivision";
  return undefined;
}

function parseServiceLine(raw: string | undefined): LeadServiceLine | undefined {
  if (!raw) return undefined;
  const v = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (SERVICE_LINES.has(v as LeadServiceLine)) return v as LeadServiceLine;
  if (v === "ai" || v === "aioutreach") return "ai_outreach";
  if (v === "live" || v === "callers" || v === "livecaller") return "live_callers";
  if (v === "hybrid" || v === "ai_live") return "hybrid";
  if (v === "data" || v === "dataonly") return "data_only";
  return undefined;
}

function parseTier(raw: string | undefined): LeadTierId | undefined {
  if (!raw) return undefined;
  const v = raw.trim().toLowerCase();
  if (TIERS.has(v as LeadTierId)) return v as LeadTierId;
  return undefined;
}

function parseCampaign(raw: string | undefined): "just_listed" | "just_sold" | undefined {
  if (!raw) return undefined;
  const v = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (v === "just_listed" || v === "listed" || v === "new_listing") return "just_listed";
  if (v === "just_sold" || v === "sold") return "just_sold";
  return undefined;
}

function parseHomes(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const n = Number.parseInt(raw.replace(/,/g, ""), 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export type ParsedDocumentFields = {
  orderId?: string;
  mls?: string;
  radiusId?: RadiusId;
  homes?: number;
  serviceLine?: LeadServiceLine;
  leadTier?: LeadTierId;
  campaignType?: "just_listed" | "just_sold";
  address?: string;
  agentName?: string;
  email?: string;
  phone?: string;
  brokerage?: string;
  city?: string;
  county?: string;
  state?: string;
  zip?: string;
  listPrice?: string;
  /** GHL / workflow fields not mapped to core pricing — shown on the document. */
  extras: { key: string; label: string; value: string }[];
};

export function parseDocumentQuery(query: Record<string, unknown>): ParsedDocumentFields {
  const flat: Record<string, string> = {};
  for (const [k, v] of Object.entries(query)) {
    if (typeof v === "string") flat[normKey(k)] = v;
    else if (Array.isArray(v) && typeof v[0] === "string") flat[normKey(k)] = v[0];
  }

  const orderId = firstString(flat, ["order", "orderid", "order_id", "internalid", "internal_id", "id"]);
  const extras: { key: string; label: string; value: string }[] = [];
  for (const [k, v] of Object.entries(flat)) {
    if (!v.trim() || KNOWN_KEYS.has(k)) continue;
    extras.push({
      key: k,
      label: k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      value: v,
    });
  }

  return {
    orderId,
    mls: firstString(flat, ["mls"]),
    radiusId: parseRadius(firstString(flat, ["radius", "radiusid", "radius_id", "ring"])),
    homes: parseHomes(firstString(flat, ["homes", "homecount", "home_count", "requestedleads", "requested_leads", "packsize", "pack_size"])),
    serviceLine: parseServiceLine(firstString(flat, ["serviceline", "service_line", "service", "product"])),
    leadTier: parseTier(firstString(flat, ["leadtier", "lead_tier", "tier", "plan"])),
    campaignType: parseCampaign(firstString(flat, ["campaign", "campaigntype", "campaign_type"])),
    address: firstString(flat, ["address", "listingaddress", "listing_address"]),
    agentName: firstString(flat, ["agentname", "agent_name"]),
    email: firstString(flat, ["email", "agentemail", "agent_email"]),
    phone: firstString(flat, ["phone", "agentphone", "agent_phone"]),
    brokerage: firstString(flat, ["brokerage"]),
    city: firstString(flat, ["city"]),
    county: firstString(flat, ["county"]),
    state: firstString(flat, ["state"]),
    zip: firstString(flat, ["zip"]),
    listPrice: firstString(flat, ["listprice", "list_price"]),
    extras,
  };
}
