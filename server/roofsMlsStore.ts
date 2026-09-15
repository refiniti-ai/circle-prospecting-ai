import mysql from "mysql2/promise";
import type { ListingAgentInfo } from "../src/lib/listingAgents.ts";
import type { ListingPayload } from "../src/lib/listingData.ts";
import { ZIP_RING_LABEL } from "../src/lib/listingData.ts";
import { rdsMysqlSsl } from "./rdsMysqlSsl.js";

export type RoofsMlsStatus = "active" | "coming_soon" | "pending" | "closed";

type MlsPropertyRow = {
  status: string | null;
  mls: string | null;
  buy_price: number | string | null;
  street: string | null;
  unit_no: string | null;
  zip: string | null;
  bedrooms: number | string | null;
  bathrooms: number | string | null;
  year_built: number | string | null;
  legal_subdivision: string | null;
  sub_type: string | null;
  list_date: Date | string | null;
  close_at: Date | string | null;
  geo_lat: number | string | null;
  geo_long: number | string | null;
  listing_photo_url: string | null;
  hc_radius_025: number | string | null;
  hc_radius_05: number | string | null;
  hc_radius_1: number | string | null;
  hc_zip: number | string | null;
  hc_subdivision: number | string | null;
  state_id: number | null;
  county_id: number | null;
  city_id: number | null;
  agent_id: number | null;
  buyer_agent_id: number | null;
  state_name: string | null;
  county_name: string | null;
  city_name: string | null;
  seller_name: string | null;
  seller_email: string | null;
  seller_phone: string | null;
  seller_company: string | null;
  buyer_name: string | null;
  buyer_email: string | null;
  buyer_phone: string | null;
  buyer_company: string | null;
};

const LISTING_SQL = `
SELECT
  p.status, p.mls, p.buy_price, p.street, p.unit_no, p.zip,
  p.bedrooms, p.bathrooms, p.year_built, p.legal_subdivision, p.sub_type,
  p.list_date, p.close_at, p.geo_lat, p.geo_long, p.listing_photo_url,
  p.hc_radius_025, p.hc_radius_05, p.hc_radius_1, p.hc_zip, p.hc_subdivision,
  p.state_id, p.county_id, p.city_id, p.agent_id, p.buyer_agent_id,
  st.name AS state_name,
  co.name AS county_name,
  ci.name AS city_name,
  sa.name AS seller_name,
  sa.email AS seller_email,
  sa.phone AS seller_phone,
  sa.company_name AS seller_company,
  ba.name AS buyer_name,
  ba.email AS buyer_email,
  ba.phone AS buyer_phone,
  ba.company_name AS buyer_company
FROM mls_properties p
LEFT JOIN state st ON st.id = p.state_id
LEFT JOIN county co ON co.id = p.county_id
LEFT JOIN city ci ON ci.id = p.city_id
LEFT JOIN mls_agents sa ON sa.id = p.agent_id
LEFT JOIN mls_agents ba ON ba.id = p.buyer_agent_id
WHERE p.mls = ?
ORDER BY
  CASE p.status
    WHEN 'coming_soon' THEN 0
    WHEN 'active' THEN 1
    WHEN 'pending' THEN 2
    WHEN 'closed' THEN 3
    ELSE 4
  END
LIMIT 8
`;

let pool: mysql.Pool | null = null;

export function isRoofsDbConfigured(): boolean {
  return Boolean(
    process.env.ROOFS_DB_HOST?.trim() &&
      process.env.ROOFS_DB_USER?.trim() &&
      process.env.ROOFS_DB_PASSWORD &&
      process.env.ROOFS_DB_NAME?.trim()
  );
}

function getPool(): mysql.Pool {
  if (pool) return pool;
  pool = mysql.createPool({
    host: process.env.ROOFS_DB_HOST!.trim(),
    port: Number(process.env.ROOFS_DB_PORT || "3306"),
    user: process.env.ROOFS_DB_USER!.trim(),
    password: process.env.ROOFS_DB_PASSWORD,
    database: process.env.ROOFS_DB_NAME!.trim() || "roofs",
    waitForConnections: true,
    connectionLimit: 4,
    enableKeepAlive: true,
    ssl: rdsMysqlSsl(),
  });
  return pool;
}

function num(v: number | string | null | undefined): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function homeCount(v: number | string | null | undefined): number {
  const n = num(v);
  return n == null ? 0 : Math.max(0, Math.round(n));
}

function str(v: string | null | undefined): string {
  return (v ?? "").trim();
}

function statusFromRaw(raw: string | null | undefined): RoofsMlsStatus | null {
  const s = str(raw).toLowerCase();
  if (s === "active" || s === "coming_soon" || s === "pending" || s === "closed") return s;
  return null;
}

function pickRow(rows: MlsPropertyRow[], prefer?: RoofsMlsStatus | null): MlsPropertyRow | null {
  if (!rows.length) return null;
  if (prefer) {
    const match = rows.find((r) => statusFromRaw(r.status) === prefer);
    if (match) return match;
  }
  return rows[0] ?? null;
}

function formatPrice(raw: number | string | null | undefined): string {
  const n = num(raw);
  if (n == null) return "$—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function agentFrom(
  name: string | null,
  email: string | null,
  phone: string | null,
  company: string | null
): ListingAgentInfo {
  return {
    name: str(name),
    email: str(email),
    phone: str(phone),
    brokerage: str(company),
  };
}

function listingTypeLabel(status: RoofsMlsStatus | null): string {
  if (status === "coming_soon") return "Coming Soon";
  if (status === "closed") return "Just Sold";
  if (status === "pending") return "Pending";
  return "Just Listed";
}

export function listingFromRoofsRow(row: MlsPropertyRow): ListingPayload {
  const mls = str(row.mls).toUpperCase();
  const status = statusFromRaw(row.status);
  const latN = num(row.geo_lat) ?? 0;
  const lngN = num(row.geo_long) ?? 0;
  const lat = latN === 0 && lngN === 0 ? 0 : latN;
  const lng = latN === 0 && lngN === 0 ? 0 : lngN;
  const street = [str(row.street), str(row.unit_no)].filter(Boolean).join(" ");
  const city = str(row.city_name);
  const state = str(row.state_name);
  const zip = str(row.zip);
  const cityStateZip = [city, [state, zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const seller = agentFrom(row.seller_name, row.seller_email, row.seller_phone, row.seller_company);
  const buyer = agentFrom(row.buyer_name, row.buyer_email, row.buyer_phone, row.buyer_company);
  const primary = seller.name || seller.email || seller.phone ? seller : buyer;
  const listDate = row.list_date ? new Date(row.list_date) : null;

  return {
    id: mls.toLowerCase(),
    internalId: Number.parseInt(mls.replace(/\D/g, "").slice(-8) || "0", 10) || 0,
    mls,
    address: street,
    cityStateZip,
    county: str(row.county_name),
    listPrice: formatPrice(row.buy_price),
    agentName: primary.name,
    email: primary.email,
    phone: primary.phone,
    brokerage: primary.brokerage,
    sellerAgent: seller,
    buyerAgent: buyer,
    lat,
    lng,
    zip,
    campaignType: status === "closed" ? "just_sold" : "just_listed",
    listingType: listingTypeLabel(status),
    listingPhotoUrl: str(row.listing_photo_url) || null,
    createdAt: listDate && !Number.isNaN(listDate.getTime()) ? listDate.toISOString() : undefined,
    radii: {
      subdivision: { label: "Subdivision", count: homeCount(row.hc_subdivision) },
      q1: { label: "1/4 Mile", count: homeCount(row.hc_radius_025) },
      h1: { label: "1/2 Mile", count: homeCount(row.hc_radius_05) },
      m1: { label: "1 Mile", count: homeCount(row.hc_radius_1) },
      zip: { label: ZIP_RING_LABEL, count: homeCount(row.hc_zip) },
    },
  };
}

export async function getRoofsListingByMls(
  mls: string,
  preferStatus?: RoofsMlsStatus | null
): Promise<ListingPayload | null> {
  if (!isRoofsDbConfigured()) return null;
  const mlsQ = mls.trim();
  if (mlsQ.length < 3) return null;

  const [rows] = await getPool().query<mysql.RowDataPacket[]>(LISTING_SQL, [mlsQ]);
  const typed = rows as unknown as MlsPropertyRow[];
  const row = pickRow(typed, preferStatus);
  if (!row) return null;
  return listingFromRoofsRow(row);
}
