import axios from "axios";
import { getGhlCachedStale, setGhlCached, withGhlCache, coalesceGhlRequest } from "./ghlResponseCache.js";
import {
  fetchGhlOpportunity,
  findGhlOpportunityByContactAndMls,
  opportunityAgentType,
  opportunityMatchesMls,
  opportunityMls,
  readOpportunityField,
  searchGhlOpportunitiesByMls,
  sortOpportunitiesNewestFirst,
  type GhlOpportunityView,
} from "./ghlOpportunityFetch.js";

/** Custom fields we surface on the /pay/:contactId page. */
export const PAY_LINK_FIELD_KEYS = [
  "first_name",
  "last_name",
  "email",
  "phone",
  "city",
  "state",
  "realtor_name",
  "team_name",
  "brokerage_name",
  "homeowner_name",
  "preferred_channel",
  "listing_link",
  "listing_photo_url",
  "listing_address",
  "motivation",
  "timeline",
  "referral_name",
  "referral_phone",
  "referral_email",
  "referral_notes",
  "subdivision_home_owners",
  "zipcode_home_owners",
  "subdivision",
  "one_fourth_mile_home_owners",
  "half_mile_home_owners",
  "one_mile_home_owners",
  "intent",
  "has_agent",
  "follow_up_date",
  "zip_code",
  "mls",
] as const;

export type PayLinkFieldKey = (typeof PAY_LINK_FIELD_KEYS)[number];

export type GhlContactView = {
  id: string;
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  fields: Record<PayLinkFieldKey, string | null>;
  /** All custom fields we got back from GHL, keyed by key/name (for debugging / future fields). */
  raw: Record<string, string | null>;
};

function ghlApiBase(): string {
  return (process.env.GHL_API_BASE_URL?.trim() || "https://services.leadconnectorhq.com").replace(/\/$/, "");
}

function ghlApiVersion(): string {
  return process.env.GHL_API_VERSION?.trim() || "2021-07-28";
}

function ghlLocationId(): string | null {
  return (
    process.env.GHL_LOCATION_ID?.trim() ||
    process.env.HIGHLEVEL_LOCATION_ID?.trim() ||
    null
  );
}

function pickString(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) {
    const joined = v
      .map((x) => (typeof x === "string" ? x : x == null ? "" : String(x)))
      .filter((s) => s && s.trim())
      .join(", ");
    return joined || null;
  }
  return null;
}

type GhlCustomFieldEntry = {
  id?: string;
  key?: string;
  fieldKey?: string;
  name?: string;
  value?: unknown;
  field_value?: unknown;
  fieldValue?: unknown;
};

/* ----------------------------------------------------------------------- */
/* Custom field definitions cache                                          */
/*                                                                          */
/* The v2 contacts endpoint returns customFields as `[{ id, value }]`      */
/* where `id` is the field UUID (NOT a friendly name). To map back to      */
/* our short keys (e.g. "subdivision_home_owners") we have to fetch the    */
/* location's custom field definitions and build an id→key map.            */
/* ----------------------------------------------------------------------- */

type FieldDefinitionEntry = {
  id?: string;
  name?: string;
  fieldKey?: string;
  key?: string;
  dataType?: string;
};

type CustomFieldDefinitions = {
  /** GHL field id → our short key (e.g. "subdivision_home_owners"). */
  idToKey: Record<string, string>;
  /** Our short key → GHL field id. */
  keyToId: Record<string, string>;
  /** Friendly name → our short key. */
  nameToKey: Record<string, string>;
};

const EMPTY_DEFINITIONS: CustomFieldDefinitions = {
  idToKey: {},
  keyToId: {},
  nameToKey: {},
};

let cachedDefinitions: CustomFieldDefinitions | null = null;
let cachedDefinitionsAt = 0;
const CACHE_TTL_MS = 5 * 60_000;

function stripFieldKeyPrefix(raw: string): string {
  let s = raw.trim();
  if (!s) return s;
  if (s.startsWith("contact.")) s = s.slice("contact.".length);
  return s;
}

/** Normalise a friendly field name into our short snake_case key. */
function nameToShortKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Fetch custom field definitions for the configured location. Cached for 5 minutes. */
export async function getGhlCustomFieldDefinitions(force = false): Promise<CustomFieldDefinitions> {
  const token = process.env.GHL_BEARER_TOKEN?.trim();
  const locationId = ghlLocationId();
  if (!token || !locationId) return EMPTY_DEFINITIONS;

  const now = Date.now();
  if (!force && cachedDefinitions && now - cachedDefinitionsAt < CACHE_TTL_MS) {
    return cachedDefinitions;
  }

  const url = `${ghlApiBase()}/locations/${encodeURIComponent(locationId)}/customFields?model=contact`;
  try {
    const r = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Version: ghlApiVersion(),
        Accept: "application/json",
      },
      timeout: 15_000,
      validateStatus: () => true,
    });
    if (r.status < 200 || r.status >= 300) {
      console.warn("[ghl] customFields fetch failed", r.status);
      return cachedDefinitions || EMPTY_DEFINITIONS;
    }
    const arr = Array.isArray(r.data?.customFields)
      ? (r.data.customFields as FieldDefinitionEntry[])
      : Array.isArray(r.data?.customField)
        ? (r.data.customField as FieldDefinitionEntry[])
        : [];
    const idToKey: Record<string, string> = {};
    const keyToId: Record<string, string> = {};
    const nameToKey: Record<string, string> = {};
    for (const f of arr) {
      const id = (f.id || "").trim();
      if (!id) continue;
      const rawKey = (f.fieldKey || f.key || "").trim();
      const short = rawKey ? stripFieldKeyPrefix(rawKey) : f.name ? nameToShortKey(f.name) : "";
      if (!short) continue;
      idToKey[id] = short;
      keyToId[short] = id;
      keyToId[short.toLowerCase()] = id;
      if (f.name) nameToKey[f.name.trim()] = short;
    }
    cachedDefinitions = { idToKey, keyToId, nameToKey };
    cachedDefinitionsAt = now;
    return cachedDefinitions;
  } catch (e) {
    console.warn("[ghl] customFields fetch error", e instanceof Error ? e.message : e);
    return cachedDefinitions || EMPTY_DEFINITIONS;
  }
}

/**
 * Normalise GHL custom field array into a `{ shortKey: value }` map.
 * Handles both shapes:
 *   - definition lookup: `{ id: "<uuid>", value: "..." }` (v2 contacts endpoint)
 *   - inline keys: `{ key: "subdivision_home_owners", value: "..." }` (some webhooks)
 */
function flattenCustomFields(
  arr: GhlCustomFieldEntry[],
  defs: CustomFieldDefinitions
): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const entry of arr) {
    if (!entry || typeof entry !== "object") continue;
    const val = pickString(entry.value ?? entry.field_value ?? entry.fieldValue);

    const inlineKey = (entry.key || entry.fieldKey || "").trim();
    const definitionKey = entry.id ? defs.idToKey[entry.id] : "";
    const nameKey = entry.name ? defs.nameToKey[entry.name.trim()] : "";

    const candidates = [definitionKey, inlineKey ? stripFieldKeyPrefix(inlineKey) : "", nameKey, entry.name || "", entry.id || ""]
      .map((s) => (s ? String(s).trim() : ""))
      .filter(Boolean);

    for (const key of candidates) {
      if (out[key] == null) out[key] = val;
      const lk = key.toLowerCase();
      if (out[lk] == null) out[lk] = val;
    }
  }
  return out;
}

/**
 * GET contact from GHL by id. Requires GHL_BEARER_TOKEN.
 *
 * Returns a sanitised view containing only the fields we surface on the pay page.
 * Throws Error("ghl_not_configured") if no token is set.
 * Throws Error("contact_not_found") on 404.
 */
export async function fetchGhlContact(contactId: string): Promise<GhlContactView> {
  const token = process.env.GHL_BEARER_TOKEN?.trim();
  if (!token) throw new Error("ghl_not_configured");

  const [contactRes, defs] = await Promise.all([
    axios.get(`${ghlApiBase()}/contacts/${encodeURIComponent(contactId)}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Version: ghlApiVersion(),
        Accept: "application/json",
      },
      timeout: 15_000,
      validateStatus: () => true,
    }),
    getGhlCustomFieldDefinitions(),
  ]);

  if (contactRes.status === 404) throw new Error("contact_not_found");
  if (contactRes.status < 200 || contactRes.status >= 300) {
    const body =
      typeof contactRes.data === "string"
        ? contactRes.data.slice(0, 200)
        : JSON.stringify(contactRes.data).slice(0, 200);
    throw new Error(`ghl_error_${contactRes.status}: ${body}`);
  }

  const data = (contactRes.data?.contact ?? contactRes.data) as Record<string, unknown>;
  const customArr = Array.isArray(data.customFields)
    ? (data.customFields as GhlCustomFieldEntry[])
    : Array.isArray((data as { customField?: unknown }).customField)
      ? ((data as { customField: GhlCustomFieldEntry[] }).customField)
      : [];
  const raw = flattenCustomFields(customArr, defs);

  // GHL strips non-alphanumeric from field labels so "1/4 Mile Home Owners"
  // becomes `14_mile_home_owners`, "1/2 Mile" becomes `12_mile_home_owners`,
  // and "1 Mile Home Owners" becomes `1_mile_home_owners`. Map those to ours.
  const KEY_ALIASES: Record<PayLinkFieldKey, string[]> = {
    one_fourth_mile_home_owners: ["14_mile_home_owners", "quarter_mile_home_owners", "qtr_mile_home_owners"],
    half_mile_home_owners: ["12_mile_home_owners", "half_mile", "half_mile_homeowners"],
    one_mile_home_owners: ["1_mile_home_owners", "one_mile", "mile_home_owners"],
    subdivision_home_owners: ["subdivision_homeowners"],
    zipcode_home_owners: ["zip_home_owners", "zip_code_home_owners"],
    realtor_name: ["agent_name"],
    brokerage_name: ["brokerage"],
    team_name: ["team"],
    homeowner_name: ["homeowner"],
    listing_link: ["listing_url"],
    listing_photo_url: ["listing_image_url", "listing_photo", "photo_url", "listing_image"],
    follow_up_date: ["followup_date", "follow_up"],
    zip_code: ["postal_code", "postalcode", "zip"],
    first_name: [], last_name: [], email: [], phone: [], city: [], state: [],
    preferred_channel: [], listing_address: [], motivation: [], timeline: [],
    referral_name: [], referral_phone: [], referral_email: [], referral_notes: [],
    subdivision: [], intent: [], has_agent: [], mls: [],
  };

  const fields = {} as Record<PayLinkFieldKey, string | null>;
  for (const key of PAY_LINK_FIELD_KEYS) {
    let value = raw[key] ?? raw[key.toLowerCase()] ?? null;
    if (value == null) {
      for (const alias of KEY_ALIASES[key] || []) {
        const v = raw[alias] ?? raw[alias.toLowerCase()];
        if (v != null) {
          value = v;
          break;
        }
      }
    }
    fields[key] = value;
  }

  fields.first_name = fields.first_name ?? pickString(data.firstName) ?? pickString(data.first_name);
  fields.last_name = fields.last_name ?? pickString(data.lastName) ?? pickString(data.last_name);
  fields.email = fields.email ?? pickString(data.email);
  fields.phone = fields.phone ?? pickString(data.phone);
  fields.city = fields.city ?? pickString(data.city);
  fields.state = fields.state ?? pickString(data.state);
  fields.zip_code =
    fields.zip_code ??
    pickString((data as { postalCode?: unknown }).postalCode) ??
    pickString((data as { zip?: unknown }).zip);

  return {
    id: contactId,
    email: pickString(data.email),
    phone: pickString(data.phone),
    firstName: pickString(data.firstName) ?? pickString(data.first_name),
    lastName: pickString(data.lastName) ?? pickString(data.last_name),
    fields,
    raw,
  };
}

/**
 * Update arbitrary GHL custom fields on a contact via direct API.
 *
 * Prefers field UUIDs (more reliable). Falls back to key-based payload when
 * definitions can't be loaded. Pass entries keyed by our short name
 * (e.g. "pay_link_url") or the GHL key (e.g. "contact.pay_link_url").
 */
export async function updateGhlContactFields(
  contactId: string,
  fields: Record<string, string | number | null>
): Promise<{ ok: boolean; status: number; message?: string }> {
  const token = process.env.GHL_BEARER_TOKEN?.trim();
  if (!token) return { ok: false, status: 0, message: "ghl_not_configured" };

  const entries = Object.entries(fields).filter(
    ([, v]) => v !== null && v !== undefined && String(v).length > 0
  );
  if (!entries.length) return { ok: true, status: 204 };

  const defs = await getGhlCustomFieldDefinitions();

  type Payload = { id?: string; key?: string; field_value: string };
  const customFields: Payload[] = entries.map(([rawKey, value]) => {
    const short = stripFieldKeyPrefix(rawKey);
    const id = defs.keyToId[short] || defs.keyToId[short.toLowerCase()];
    if (id) return { id, field_value: String(value) };
    return { key: short, field_value: String(value) };
  });

  const r = await axios.put(
    `${ghlApiBase()}/contacts/${encodeURIComponent(contactId)}`,
    { customFields },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Version: ghlApiVersion(),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      timeout: 15_000,
      validateStatus: () => true,
    }
  );
  if (r.status >= 200 && r.status < 300) return { ok: true, status: r.status };
  const msg = typeof r.data === "string" ? r.data.slice(0, 300) : JSON.stringify(r.data).slice(0, 300);
  return { ok: false, status: r.status, message: msg };
}

export type GhlContactSearchHit = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  mls: string | null;
  listingAddress: string | null;
  listingPhotoUrl: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  realtorName: string | null;
  brokerageName: string | null;
  listingType: string | null;
  agentType: string | null;
  subdivisionHomeOwners: string | null;
  oneFourthMileHomeOwners: string | null;
  halfMileHomeOwners: string | null;
  oneMileHomeOwners: string | null;
  zipcodeHomeOwners: string | null;
};

function contactDisplayName(data: Record<string, unknown>): string {
  const first = pickString(data.firstName) ?? pickString(data.first_name);
  const last = pickString(data.lastName) ?? pickString(data.last_name);
  const joined = [first, last].filter(Boolean).join(" ").trim();
  return joined || pickString(data.name) || pickString(data.companyName) || "Contact";
}

function mapSearchHit(data: Record<string, unknown>, defs: CustomFieldDefinitions): GhlContactSearchHit {
  const customArr = Array.isArray(data.customFields)
    ? (data.customFields as GhlCustomFieldEntry[])
    : [];
  const raw = flattenCustomFields(customArr, defs);
  const pick = (key: string) => raw[key] ?? raw[key.toLowerCase()] ?? null;
  return {
    id: String(data.id || data.contactId || "").trim(),
    name: contactDisplayName(data),
    email: pickString(data.email),
    phone: pickString(data.phone),
    mls: pick("mls"),
    listingAddress: pick("listing_address"),
    listingPhotoUrl: pick("listing_photo_url"),
    city: pickString(data.city) ?? pick("city"),
    state: pickString(data.state) ?? pick("state"),
    zip:
      pickString((data as { postalCode?: unknown }).postalCode) ??
      pick("zip_code") ??
      pick("zip"),
    realtorName: pick("realtor_name"),
    brokerageName: pick("brokerage_name") ?? pickString(data.companyName),
    listingType:
      pick("listing_type") ??
      raw["listing type"] ??
      raw.listingtype ??
      null,
    agentType:
      pick("agent_type") ??
      pick("agent_role") ??
      raw["agent type"] ??
      raw.bor_s ??
      null,
    subdivisionHomeOwners: pick("subdivision_home_owners"),
    oneFourthMileHomeOwners: pick("one_fourth_mile_home_owners"),
    halfMileHomeOwners: pick("half_mile_home_owners"),
    oneMileHomeOwners: pick("one_mile_home_owners"),
    zipcodeHomeOwners: pick("zipcode_home_owners"),
  };
}

function ghlSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const GHL_CONTACT_SEARCH_CACHE_MS = 5 * 60_000;
const GHL_CONTACT_SEARCH_STALE_MS = 30 * 60_000;

async function searchGhlContactsUncached(query: string, limit: number): Promise<GhlContactSearchHit[]> {
  const token = process.env.GHL_BEARER_TOKEN?.trim();
  const locationId = ghlLocationId();
  if (!token || !locationId) throw new Error("ghl_not_configured");

  const q = query.trim();
  if (q.length < 2) return [];

  const defs = await getGhlCustomFieldDefinitions();
  const retryDelaysMs = [0, 1_000, 3_000, 6_000];
  let lastStatus = 0;
  let lastBody = "";

  for (let attempt = 0; attempt < retryDelaysMs.length; attempt++) {
    const delay = retryDelaysMs[attempt] ?? 0;
    if (delay > 0) await ghlSleep(delay);

    const searchRes = await axios.post(
      `${ghlApiBase()}/contacts/search`,
      {
        locationId,
        page: 1,
        pageLimit: Math.min(Math.max(limit, 1), 25),
        query: q,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Version: ghlApiVersion(),
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        timeout: 20_000,
        validateStatus: () => true,
      }
    );

    if (searchRes.status >= 200 && searchRes.status < 300) {
      const contacts = Array.isArray(searchRes.data?.contacts)
        ? (searchRes.data.contacts as Record<string, unknown>[])
        : Array.isArray(searchRes.data?.data)
          ? (searchRes.data.data as Record<string, unknown>[])
          : [];

      return contacts
        .map((c) => mapSearchHit(c, defs))
        .filter((h) => h.id.length > 0);
    }

    lastStatus = searchRes.status;
    lastBody =
      typeof searchRes.data === "string"
        ? searchRes.data.slice(0, 200)
        : JSON.stringify(searchRes.data).slice(0, 200);

    if (searchRes.status !== 429) break;
  }

  throw new Error(`ghl_search_${lastStatus}: ${lastBody}`);
}

/**
 * Search GHL contacts by name, email, or phone (location sub-account).
 * Requires GHL_BEARER_TOKEN and GHL_LOCATION_ID.
 */
export async function searchGhlContacts(query: string, limit = 12): Promise<GhlContactSearchHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const cacheKey = `contact-search:v1:${q.toLowerCase()}:${Math.min(Math.max(limit, 1), 25)}`;
  return coalesceGhlRequest(cacheKey, async () => {
    const { fresh, stale } = getGhlCachedStale<GhlContactSearchHit[]>(cacheKey, GHL_CONTACT_SEARCH_STALE_MS);
    if (fresh) return fresh;

    try {
      const results = await searchGhlContactsUncached(q, limit);
      setGhlCached(cacheKey, results, GHL_CONTACT_SEARCH_CACHE_MS);
      return results;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (stale && /429|too many/i.test(msg)) {
        console.warn("[ghl] contact search rate limited — serving stale cache", q);
        return stale;
      }
      throw e;
    }
  });
}

function normalizeMlsValue(raw: string | null | undefined): string {
  return (raw || "").trim().toUpperCase().replace(/\s+/g, "");
}

async function ghlSearchWithBody(
  body: Record<string, unknown>,
  defs: CustomFieldDefinitions,
  limit: number
): Promise<GhlContactSearchHit[]> {
  const token = process.env.GHL_BEARER_TOKEN?.trim();
  if (!token) throw new Error("ghl_not_configured");

  const searchRes = await axios.post(`${ghlApiBase()}/contacts/search`, body, {
    headers: {
      Authorization: `Bearer ${token}`,
      Version: ghlApiVersion(),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    timeout: 25_000,
    validateStatus: () => true,
  });

  if (searchRes.status < 200 || searchRes.status >= 300) {
    const bodyText =
      typeof searchRes.data === "string"
        ? searchRes.data.slice(0, 200)
        : JSON.stringify(searchRes.data).slice(0, 200);
    throw new Error(`ghl_search_${searchRes.status}: ${bodyText}`);
  }

  const contacts = Array.isArray(searchRes.data?.contacts)
    ? (searchRes.data.contacts as Record<string, unknown>[])
    : Array.isArray(searchRes.data?.data)
      ? (searchRes.data.data as Record<string, unknown>[])
      : [];

  return contacts
    .map((c) => mapSearchHit(c, defs))
    .filter((h) => h.id.length > 0)
    .slice(0, limit);
}

/** Scan recent contacts when filter search is unavailable (MLS is not in GHL text search). */
async function scanGhlContactsForMls(
  locationId: string,
  mlsNorm: string,
  defs: CustomFieldDefinitions,
  limit: number
): Promise<GhlContactSearchHit[]> {
  const token = process.env.GHL_BEARER_TOKEN?.trim();
  if (!token) throw new Error("ghl_not_configured");

  const matched: GhlContactSearchHit[] = [];
  let startAfterId: string | undefined;
  const pageSize = 100;
  const maxPages = 15;

  for (let page = 0; page < maxPages && matched.length < limit; page++) {
    const params: Record<string, string> = {
      locationId,
      limit: String(pageSize),
    };
    if (startAfterId) params.startAfterId = startAfterId;

    const listRes = await axios.get(`${ghlApiBase()}/contacts/`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Version: ghlApiVersion(),
        Accept: "application/json",
      },
      params,
      timeout: 25_000,
      validateStatus: () => true,
    });

    if (listRes.status < 200 || listRes.status >= 300) break;

    const contacts = Array.isArray(listRes.data?.contacts)
      ? (listRes.data.contacts as Record<string, unknown>[])
      : [];

    for (const c of contacts) {
      const hit = mapSearchHit(c, defs);
      const hitMls = normalizeMlsValue(hit.mls);
      if (!hitMls) continue;
      if (hitMls === mlsNorm || hitMls.includes(mlsNorm) || mlsNorm.includes(hitMls)) {
        matched.push(hit);
        if (matched.length >= limit) return matched;
      }
    }

    if (contacts.length < pageSize) break;
    const lastId = String(contacts[contacts.length - 1]?.id || "").trim();
    if (!lastId || lastId === startAfterId) break;
    startAfterId = lastId;
  }

  return matched;
}

/**
 * Find GHL contacts by MLS custom field. Text search does not index MLS — we filter
 * on customFields.mls and fall back to scanning location contacts.
 */
const GHL_READ_CACHE_MS = 90_000;

/** Opportunity rows are the source of truth for MLS-specific radius counts and listing fields. */
async function contactHitsFromOpportunitiesForMls(
  mls: string,
  limit: number
): Promise<GhlContactSearchHit[]> {
  const opps = await searchGhlOpportunitiesByMls(mls, limit);
  const fromOpps: GhlContactSearchHit[] = [];
  for (const opp of opps) {
    const cid = opp.contactId?.trim();
    if (!cid) continue;
    try {
      const base = await prefillFromContactId(cid);
      const full = await fetchGhlOpportunity(opp.id);
      fromOpps.push(overlayOpportunityOnPrefill(base, full, mls));
    } catch {
      continue;
    }
    if (fromOpps.length >= limit) break;
  }
  return fromOpps;
}

async function overlayFromGlobalMlsOpportunity(
  hit: GhlListingContactHit,
  mls: string
): Promise<GhlContactSearchHit | GhlContactPrefillHit | null> {
  const mlsNorm = normalizeMlsValue(mls);
  try {
    const global = await searchGhlOpportunitiesByMls(mls, 8);
    const match = sortOpportunitiesNewestFirst(
      global.filter((o) => opportunityMatchesMls(o, mlsNorm))
    )[0];
    if (!match?.id) return null;
    const full = await fetchGhlOpportunity(match.id);
    if (!opportunityMatchesMls(full, mlsNorm)) return null;
    return overlayOpportunityOnPrefill(hit, full, mls);
  } catch {
    return null;
  }
}

async function searchGhlContactsByMlsUncached(mls: string, limit = 12): Promise<GhlContactSearchHit[]> {
  const token = process.env.GHL_BEARER_TOKEN?.trim();
  const locationId = ghlLocationId();
  if (!token || !locationId) throw new Error("ghl_not_configured");

  const mlsNorm = normalizeMlsValue(mls);
  if (mlsNorm.length < 3) return [];

  /** Opportunity-first — contact.mls can point at the wrong person when multiple agents share a listing. */
  try {
    const fromOpps = await contactHitsFromOpportunitiesForMls(mls, limit);
    if (fromOpps.length > 0) return fromOpps;
  } catch {
    /* fall through to contact-field search */
  }

  const defs = await getGhlCustomFieldDefinitions();
  const mlsFieldId = defs.keyToId.mls || defs.keyToId.MLS;

  const filterBodies: Record<string, unknown>[] = [];
  const base = { locationId, page: 1, pageLimit: Math.min(Math.max(limit, 1), 25) };

  if (mlsFieldId) {
    filterBodies.push({
      ...base,
      filters: [{ field: `customFields.${mlsFieldId}`, operator: "eq", value: mlsNorm }],
    });
    filterBodies.push({
      ...base,
      filters: [{ field: `customFields.${mlsFieldId}`, operator: "contains", value: mlsNorm }],
    });
  }
  filterBodies.push({
    ...base,
    filters: [{ field: "customFields.mls", operator: "eq", value: mlsNorm }],
  });

  for (const body of filterBodies) {
    try {
      const hits = await ghlSearchWithBody(body, defs, limit);
      const matched = hits.filter((h) => normalizeMlsValue(h.mls) === mlsNorm);
      if (matched.length > 0) return enrichContactHitsFromOpportunity(matched, mls);
    } catch {
      /* try next filter shape */
    }
  }

  const scanned = await scanGhlContactsForMls(locationId, mlsNorm, defs, limit);
  if (scanned.length > 0) return enrichContactHitsFromOpportunity(scanned, mls);

  try {
    return await contactHitsFromOpportunitiesForMls(mls, limit);
  } catch {
    return [];
  }
}

export async function searchGhlContactsByMls(mls: string, limit = 12): Promise<GhlContactSearchHit[]> {
  const mlsNorm = normalizeMlsValue(mls);
  if (mlsNorm.length < 3) return [];
  const key = `mls-search:v6:${mlsNorm}:${limit}`;
  return withGhlCache(key, GHL_READ_CACHE_MS, () => searchGhlContactsByMlsUncached(mls, limit));
}

export type GhlContactPrefillHit = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  mls: string | null;
  listingAddress: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  realtorName: string | null;
  brokerageName: string | null;
  agentType: string | null;
  listingType: string | null;
  listingPhotoUrl: string | null;
  subdivisionHomeOwners: string | null;
  oneFourthMileHomeOwners: string | null;
  halfMileHomeOwners: string | null;
  oneMileHomeOwners: string | null;
  zipcodeHomeOwners: string | null;
};

function parseListingAddressTail(line: string | null | undefined): {
  city: string | null;
  state: string | null;
  zip: string | null;
} {
  const parts = (line || "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 3) return { city: null, state: null, zip: null };
  const zipPart = parts[parts.length - 1] ?? "";
  const statePart = parts[parts.length - 2] ?? "";
  const cityPart = parts[parts.length - 3] ?? "";
  const zip = /^\d{5}/.test(zipPart) ? zipPart.slice(0, 5) : null;
  const state = /^[A-Z]{2}$/i.test(statePart) ? statePart.toUpperCase() : null;
  return { city: cityPart || null, state, zip };
}

type GhlListingContactHit = GhlContactPrefillHit | GhlContactSearchHit;

function overlayOpportunityOnPrefill(
  hit: GhlListingContactHit,
  opp: GhlOpportunityView,
  requestedMls?: string
): GhlContactPrefillHit {
  const pick = (key: string) => readOpportunityField(opp, key);
  const listingType =
    pick("listing_type") ?? pick("listing type") ?? pick("Listing Type") ?? hit.listingType;
  const agentType = opportunityAgentType(opp) ?? hit.agentType;
  const listingAddress = pick("listing_address") ?? hit.listingAddress;
  const fromAddr = parseListingAddressTail(listingAddress);
  const want = requestedMls?.trim();
  return {
    ...hit,
    /** URL/search MLS wins — opp custom field may have been overwritten by a later lead. */
    mls: (want && want.length >= 3 ? want : null) || opportunityMls(opp) || hit.mls,
    listingAddress,
    listingPhotoUrl:
      pick("listing_photo_url") ?? pick("listing_image_url") ?? hit.listingPhotoUrl,
    city: pick("city") ?? fromAddr.city ?? hit.city,
    state: pick("state") ?? fromAddr.state ?? hit.state,
    zip: pick("zip_code") ?? pick("zip") ?? fromAddr.zip ?? hit.zip,
    listingType,
    agentType,
    /** Radius counts always from opportunity — contact fields are often stale on multi-listing agents. */
    subdivisionHomeOwners: pick("subdivision_home_owners"),
    oneFourthMileHomeOwners:
      pick("one_fourth_mile_home_owners") ?? pick("14_mile_home_owners"),
    halfMileHomeOwners: pick("half_mile_home_owners") ?? pick("12_mile_home_owners"),
    oneMileHomeOwners: pick("one_mile_home_owners") ?? pick("1_mile_home_owners"),
    zipcodeHomeOwners: pick("zipcode_home_owners"),
  };
}

/** Load matching opportunity and overlay listing + radius fields onto a contact hit. */
async function enrichContactHitFromOpportunity(
  hit: GhlContactSearchHit,
  mls: string
): Promise<GhlContactSearchHit> {
  const mlsNorm = normalizeMlsValue(mls);
  const { opportunityId } = await findGhlOpportunityByContactAndMls(hit.id, mls);
  if (opportunityId) {
    const opp = await fetchGhlOpportunity(opportunityId);
    return overlayOpportunityOnPrefill(hit, opp, mls);
  }
  try {
    const global = await searchGhlOpportunitiesByMls(mls, 8);
    for (const row of global) {
      if ((row.contactId || "").trim() !== hit.id.trim()) continue;
      try {
        const full = await fetchGhlOpportunity(row.id);
        if (opportunityMatchesMls(full, mlsNorm)) {
          return overlayOpportunityOnPrefill(hit, full, mls);
        }
      } catch {
        continue;
      }
    }
  } catch {
    /* no opportunity on this contact */
  }
  const fromGlobal = await overlayFromGlobalMlsOpportunity(hit, mls);
  return fromGlobal ?? hit;
}

async function enrichContactHitsFromOpportunity(
  hits: GhlContactSearchHit[],
  mls: string
): Promise<GhlContactSearchHit[]> {
  const out: GhlContactSearchHit[] = [];
  for (const hit of hits) {
    if (!hit.id) continue;
    out.push(await enrichContactHitFromOpportunity(hit, mls));
  }
  return out;
}

async function prefillFromContactId(contactId: string): Promise<GhlContactPrefillHit> {
  const c = await fetchGhlContact(contactId);
  const name = [c.firstName, c.lastName].filter(Boolean).join(" ").trim() || c.fields.realtor_name || "Contact";
  const listingType =
    c.raw.listing_type ??
    c.raw["listing type"] ??
    c.raw.listingtype ??
    null;

  const agentType =
    c.raw.agent_type ??
    c.raw.agent_role ??
    c.raw["agent type"] ??
    c.raw.bor_s ??
    null;

  const photo =
    c.fields.listing_photo_url ??
    c.raw.listing_photo_url ??
    c.raw.listing_image_url ??
    c.raw.listing_photo ??
    null;

  return {
    id: c.id,
    name,
    email: c.email,
    phone: c.phone,
    mls: c.fields.mls,
    listingAddress: c.fields.listing_address,
    listingPhotoUrl: photo,
    city: c.fields.city,
    state: c.fields.state,
    zip: c.fields.zip_code,
    realtorName: c.fields.realtor_name,
    brokerageName: c.fields.brokerage_name,
    listingType,
    agentType,
    subdivisionHomeOwners: c.fields.subdivision_home_owners,
    oneFourthMileHomeOwners: c.fields.one_fourth_mile_home_owners,
    halfMileHomeOwners: c.fields.half_mile_home_owners,
    oneMileHomeOwners: c.fields.one_mile_home_owners,
    zipcodeHomeOwners: c.fields.zipcode_home_owners,
  };
}

/**
 * Buy Leads prefill from a GHL contact id.
 * When `requestedMls` differs from contact.mls (multi-listing agent), load listing from that opportunity.
 */
async function fetchGhlContactPrefillUncached(
  contactId: string,
  requestedMls?: string
): Promise<GhlContactPrefillHit> {
  const base = await prefillFromContactId(contactId);
  const want = requestedMls?.trim();
  if (!want || want.length < 3) {
    return base;
  }

  const { opportunityId } = await findGhlOpportunityByContactAndMls(contactId, want);
  if (opportunityId) {
    const opp = await fetchGhlOpportunity(opportunityId);
    return overlayOpportunityOnPrefill(base, opp, want);
  }

  try {
    const global = await searchGhlOpportunitiesByMls(want, 8);
    const match = sortOpportunitiesNewestFirst(
      global.filter(
        (o) =>
          (o.contactId || "").trim() === contactId.trim() &&
          opportunityMatchesMls(o, normalizeMlsValue(want))
      )
    )[0];
    if (match?.id) {
      const opp = await fetchGhlOpportunity(match.id);
      return overlayOpportunityOnPrefill(base, opp, want);
    }
    for (const hit of global) {
      if (!hit.id) continue;
      try {
        const full = await fetchGhlOpportunity(hit.id);
        if (
          (full.contactId || "").trim() === contactId.trim() &&
          opportunityMatchesMls(full, normalizeMlsValue(want))
        ) {
          return overlayOpportunityOnPrefill(base, full, want);
        }
      } catch {
        /* try next */
      }
    }
    const fromGlobal = await overlayFromGlobalMlsOpportunity(base, want);
    if (fromGlobal) return fromGlobal;
  } catch {
    /* fall through */
  }

  return { ...base, mls: want };
}

export async function fetchGhlContactPrefill(
  contactId: string,
  requestedMls?: string
): Promise<GhlContactPrefillHit> {
  const cid = contactId.trim();
  const mlsKey = (requestedMls || "").trim().toUpperCase();
  const key = `prefill:v6:${cid}:${mlsKey}`;
  return withGhlCache(key, GHL_READ_CACHE_MS, () => fetchGhlContactPrefillUncached(cid, requestedMls));
}

/** Parse a GHL numeric custom field like "789" or "1,234". Returns null when unusable. */
export function asInt(v: string | null | undefined): number | null {
  if (!v) return null;
  const n = Number.parseInt(String(v).replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}
