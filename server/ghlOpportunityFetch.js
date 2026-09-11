import axios from "axios";
import { opsLog } from "./opsLog.js";
const EMPTY_DEFINITIONS = {
    idToKey: {},
    keyToId: {},
    nameToKey: {},
};
let cachedDefinitions = null;
let cachedDefinitionsAt = 0;
const CACHE_TTL_MS = 5 * 60_000;
function ghlApiBase() {
    return (process.env.GHL_API_BASE_URL?.trim() || "https://services.leadconnectorhq.com").replace(/\/$/, "");
}
function ghlApiVersion() {
    return process.env.GHL_API_VERSION?.trim() || "2021-07-28";
}
function ghlLocationId() {
    return (process.env.GHL_LOCATION_ID?.trim() ||
        process.env.HIGHLEVEL_LOCATION_ID?.trim() ||
        null);
}
function pickString(v) {
    if (v == null)
        return null;
    if (typeof v === "string")
        return v.trim() || null;
    if (typeof v === "number" || typeof v === "boolean")
        return String(v);
    if (Array.isArray(v)) {
        const joined = v
            .map((x) => (typeof x === "string" ? x : x == null ? "" : String(x)))
            .filter((s) => s && s.trim())
            .join(", ");
        return joined || null;
    }
    return null;
}
function stripOpportunityFieldKeyPrefix(raw) {
    let s = raw.trim();
    if (!s)
        return s;
    if (s.startsWith("opportunity."))
        s = s.slice("opportunity.".length);
    return s;
}
function nameToShortKey(name) {
    return name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
}
function flattenCustomFields(arr, defs) {
    const out = {};
    for (const entry of arr) {
        if (!entry || typeof entry !== "object")
            continue;
        const val = pickString(entry.value ?? entry.field_value ?? entry.fieldValue);
        const inlineKey = (entry.key || entry.fieldKey || "").trim();
        const definitionKey = entry.id ? defs.idToKey[entry.id] : "";
        const nameKey = entry.name ? defs.nameToKey[entry.name.trim()] : "";
        const candidates = [
            definitionKey,
            inlineKey ? stripOpportunityFieldKeyPrefix(inlineKey) : "",
            nameKey,
            entry.name || "",
            entry.id || "",
        ]
            .map((s) => (s ? String(s).trim() : ""))
            .filter(Boolean);
        for (const key of candidates) {
            if (out[key] == null)
                out[key] = val;
            const lk = key.toLowerCase();
            if (out[lk] == null)
                out[lk] = val;
        }
    }
    return out;
}
/** Opportunity custom field definitions (model=opportunity). Cached 5 minutes. */
export async function getGhlOpportunityCustomFieldDefinitions(force = false) {
    const token = process.env.GHL_BEARER_TOKEN?.trim();
    const locationId = ghlLocationId();
    if (!token || !locationId)
        return EMPTY_DEFINITIONS;
    const now = Date.now();
    if (!force && cachedDefinitions && now - cachedDefinitionsAt < CACHE_TTL_MS) {
        return cachedDefinitions;
    }
    const url = `${ghlApiBase()}/locations/${encodeURIComponent(locationId)}/customFields?model=opportunity`;
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
            console.warn("[ghl] opportunity customFields fetch failed", r.status);
            return cachedDefinitions || EMPTY_DEFINITIONS;
        }
        const arr = Array.isArray(r.data?.customFields)
            ? r.data.customFields
            : Array.isArray(r.data?.customField)
                ? r.data.customField
                : [];
        const idToKey = {};
        const keyToId = {};
        const nameToKey = {};
        for (const f of arr) {
            const id = (f.id || "").trim();
            if (!id)
                continue;
            const rawKey = (f.fieldKey || f.key || "").trim();
            const short = rawKey ? stripOpportunityFieldKeyPrefix(rawKey) : f.name ? nameToShortKey(f.name) : "";
            if (!short)
                continue;
            idToKey[id] = short;
            keyToId[short] = id;
            keyToId[short.toLowerCase()] = id;
            if (f.name)
                nameToKey[f.name.trim()] = short;
        }
        cachedDefinitions = { idToKey, keyToId, nameToKey };
        cachedDefinitionsAt = now;
        return cachedDefinitions;
    }
    catch (e) {
        console.warn("[ghl] opportunity customFields fetch error", e instanceof Error ? e.message : e);
        return cachedDefinitions || EMPTY_DEFINITIONS;
    }
}
export function readOpportunityField(opp, key) {
    const k = key.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    if (opp.raw[k]?.trim())
        return opp.raw[k];
    if (opp.raw[key]?.trim())
        return opp.raw[key];
    const aliases = OPPORTUNITY_FIELD_ALIASES[k];
    if (aliases) {
        for (const alias of aliases) {
            const v = opp.raw[alias] ?? opp.raw[alias.toLowerCase()];
            if (v?.trim())
                return v;
        }
    }
    return null;
}
/** GHL slugifies labels: "1 Mile Home Owners" → `1_mile_home_owners`, etc. */
const OPPORTUNITY_FIELD_ALIASES = {
    one_fourth_mile_home_owners: ["14_mile_home_owners", "quarter_mile_home_owners", "qtr_mile_home_owners"],
    half_mile_home_owners: ["12_mile_home_owners", "half_mile", "half_mile_homeowners"],
    one_mile_home_owners: ["1_mile_home_owners", "one_mile", "mile_home_owners"],
    subdivision_home_owners: ["subdivision_homeowners"],
    zipcode_home_owners: ["zip_home_owners", "zip_code_home_owners"],
};
/** GET opportunity by id. Throws opportunity_not_found on 404. */
export async function fetchGhlOpportunity(opportunityId) {
    const token = process.env.GHL_BEARER_TOKEN?.trim();
    if (!token)
        throw new Error("ghl_not_configured");
    const [oppRes, defs] = await Promise.all([
        axios.get(`${ghlApiBase()}/opportunities/${encodeURIComponent(opportunityId)}`, {
            headers: {
                Authorization: `Bearer ${token}`,
                Version: ghlApiVersion(),
                Accept: "application/json",
            },
            timeout: 15_000,
            validateStatus: () => true,
        }),
        getGhlOpportunityCustomFieldDefinitions(),
    ]);
    if (oppRes.status === 404)
        throw new Error("opportunity_not_found");
    if (oppRes.status < 200 || oppRes.status >= 300) {
        const body = typeof oppRes.data === "string"
            ? oppRes.data.slice(0, 200)
            : JSON.stringify(oppRes.data).slice(0, 200);
        throw new Error(`ghl_opportunity_error_${oppRes.status}: ${body}`);
    }
    const data = (oppRes.data?.opportunity ?? oppRes.data);
    const customArr = Array.isArray(data.customFields)
        ? data.customFields
        : Array.isArray(data.customField)
            ? (data.customField)
            : [];
    const raw = flattenCustomFields(customArr, defs);
    const contactId = pickString(data.contactId) ??
        pickString(data.contact?.id) ??
        pickString(data.contact_id);
    return {
        id: opportunityId,
        contactId,
        raw,
        name: pickString(data.name) ??
            pickString(data.opportunityName) ??
            pickString(data.title) ??
            null,
        createdAt: opportunityCreatedAt(data),
    };
}
export function opportunityMls(opp) {
    return (readOpportunityField(opp, "mls") || readOpportunityField(opp, "MLS") || "").trim();
}
/** Parse MLS from GHL opportunity title, e.g. "Agent - W7885122 - …" or "Agent - O6264382 - …". */
export function extractMlsFromOpportunityName(name) {
    const n = (name || "").trim();
    if (!n)
        return "";
    const tb = n.match(/\b(TB[A-Z0-9]{4,})\b/i);
    if (tb?.[1])
        return tb[1].toUpperCase();
    const o = n.match(/\b(O\d{5,})\b/i);
    if (o?.[1])
        return o[1].toUpperCase();
    const w = n.match(/\b(W\d{5,})\b/i);
    if (w?.[1])
        return w[1].toUpperCase();
    const segmented = n.match(/\s-\s+([A-Z]\d{5,})\s+-\s/i);
    if (segmented?.[1])
        return segmented[1].toUpperCase();
    const letterDigits = n.match(/\b([A-Z]\d{6,})\b/i);
    if (letterDigits?.[1])
        return letterDigits[1].toUpperCase();
    return "";
}
export function opportunityAgentType(opp) {
    return (readOpportunityField(opp, "agent_type") ??
        readOpportunityField(opp, "agent_role") ??
        readOpportunityField(opp, "agent type") ??
        readOpportunityField(opp, "bor_s"));
}
export function opportunityListingType(opp) {
    return (readOpportunityField(opp, "listing_type") ??
        readOpportunityField(opp, "listing type") ??
        readOpportunityField(opp, "Listing Type") ??
        null);
}
function normalizeMlsValue(raw) {
    return (raw || "").trim().toUpperCase().replace(/\s+/g, "");
}
function opportunityCreatedAt(data) {
    return (pickString(data.createdAt) ??
        pickString(data.dateAdded) ??
        pickString(data.created_at) ??
        pickString(data.date_added) ??
        pickString(data.updatedAt) ??
        pickString(data.updated_at) ??
        null);
}
export function sortOpportunitiesNewestFirst(opps) {
    return [...opps].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
}
function mapOpportunityRecord(data, defs) {
    const id = String(data.id || data.opportunityId || "").trim();
    const customArr = Array.isArray(data.customFields)
        ? data.customFields
        : [];
    const raw = flattenCustomFields(customArr, defs);
    const contactId = pickString(data.contactId) ??
        pickString(data.contact_id) ??
        pickString(data.contact?.id);
    return {
        id,
        contactId,
        raw,
        name: pickString(data.name) ??
            pickString(data.opportunityName) ??
            pickString(data.title) ??
            null,
        createdAt: opportunityCreatedAt(data),
    };
}
function opportunityNameContainsMls(opp, mlsNorm) {
    const name = (opp.name || "").toUpperCase();
    if (!name)
        return false;
    const re = new RegExp(`\\b${mlsNorm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
    return re.test(name);
}
/** Best MLS for a listing opportunity — title wins when custom field was overwritten by a later lead. */
export function resolveOpportunityListingMls(opp) {
    const fromField = opportunityMls(opp).trim();
    const fromName = extractMlsFromOpportunityName(opp.name).trim();
    const fromLinks = opportunityMlsFromStoredLinks(opp).trim();
    if (fromName.length >= 3) {
        if (fromField.length >= 3 && payLinkMlsNorm(fromField) !== payLinkMlsNorm(fromName)) {
            return fromName;
        }
        return fromName;
    }
    if (fromField.length >= 3)
        return fromField;
    if (fromLinks.length >= 3)
        return fromLinks;
    return "";
}
function payLinkMlsNorm(raw) {
    return raw.trim().toUpperCase().replace(/\s+/g, "");
}
function opportunityMlsFromStoredLinks(opp) {
    for (const key of ["pay_link_url", "final_link_url", "buy_leads_url"]) {
        const url = readOpportunityField(opp, key) || "";
        const fromPath = url.match(/\/mls\/([A-Z0-9]{5,})/i);
        if (fromPath?.[1])
            return fromPath[1].toUpperCase();
        try {
            const u = new URL(url);
            const q = u.searchParams.get("mls") || u.searchParams.get("m");
            if (q && /^[A-Z0-9]{5,}$/i.test(q.trim()))
                return q.trim().toUpperCase();
        }
        catch {
            /* not a full URL */
        }
    }
    return "";
}
/** Exact MLS match only — avoids false positives (e.g. TEST971056 ⊃ TEST9710). */
export function opportunityMatchesMls(opp, mlsNorm) {
    const listingMls = normalizeMlsValue(resolveOpportunityListingMls(opp));
    if (listingMls.length >= 3 && listingMls === mlsNorm)
        return true;
    return opportunityNameContainsMls(opp, mlsNorm);
}
function opportunityHasConflictingListing(opp, mlsNorm) {
    const listingMls = normalizeMlsValue(resolveOpportunityListingMls(opp));
    if (listingMls.length >= 3 && listingMls !== mlsNorm)
        return true;
    return false;
}
async function enrichOpportunityMls(opp) {
    if (opportunityMls(opp).length >= 3)
        return opp;
    try {
        const full = await fetchGhlOpportunity(opp.id);
        if (opportunityMls(full).length >= 3)
            return full;
        const fromName = extractMlsFromOpportunityName(full.name);
        if (fromName.length >= 3) {
            return { ...full, raw: { ...full.raw, mls: fromName } };
        }
        return full;
    }
    catch {
        const fromName = extractMlsFromOpportunityName(opp.name);
        if (fromName.length >= 3) {
            return { ...opp, raw: { ...opp.raw, mls: fromName } };
        }
        return opp;
    }
}
function ghlErrorSnippet(data) {
    if (typeof data === "string")
        return data.slice(0, 500);
    try {
        return JSON.stringify(data).slice(0, 500);
    }
    catch {
        return "unparseable_response";
    }
}
export async function listGhlOpportunitiesForContact(contactId, limit = 50) {
    const token = process.env.GHL_BEARER_TOKEN?.trim();
    const locationId = ghlLocationId();
    if (!token || !locationId)
        throw new Error("ghl_not_configured");
    const defs = await getGhlOpportunityCustomFieldDefinitions();
    const collected = [];
    let startAfterId;
    let lastHttpStatus = null;
    let lastGhlError = null;
    const pageSize = Math.min(Math.max(limit, 1), 100);
    const maxPages = 5;
    for (let page = 0; page < maxPages && collected.length < limit; page++) {
        // GHL GET /opportunities/search — snake_case query params only (location_id required).
        const params = {
            location_id: locationId,
            contact_id: contactId,
            limit: String(pageSize),
            page: String(page + 1),
        };
        if (startAfterId)
            params.startAfterId = startAfterId;
        const searchRes = await axios.get(`${ghlApiBase()}/opportunities/search`, {
            headers: {
                Authorization: `Bearer ${token}`,
                Version: ghlApiVersion(),
                Accept: "application/json",
            },
            params,
            timeout: 25_000,
            validateStatus: () => true,
        });
        lastHttpStatus = searchRes.status;
        if (searchRes.status < 200 || searchRes.status >= 300) {
            lastGhlError = ghlErrorSnippet(searchRes.data);
            break;
        }
        const opportunities = Array.isArray(searchRes.data?.opportunities)
            ? searchRes.data.opportunities
            : Array.isArray(searchRes.data?.data)
                ? searchRes.data.data
                : [];
        for (const row of opportunities) {
            const hit = mapOpportunityRecord(row, defs);
            if (hit.id)
                collected.push(hit);
            if (collected.length >= limit) {
                return { opportunities: collected, httpStatus: lastHttpStatus, ghlError: null };
            }
        }
        if (opportunities.length < pageSize)
            break;
        const lastId = String(opportunities[opportunities.length - 1]?.id || "").trim();
        if (!lastId || lastId === startAfterId)
            break;
        startAfterId = lastId;
    }
    return { opportunities: collected, httpStatus: lastHttpStatus, ghlError: lastGhlError };
}
async function searchGhlOpportunitiesByContactAndMlsFilter(contactId, mlsNorm, defs) {
    const token = process.env.GHL_BEARER_TOKEN?.trim();
    const locationId = ghlLocationId();
    if (!token || !locationId)
        throw new Error("ghl_not_configured");
    const mlsFieldId = defs.keyToId.mls || defs.keyToId.MLS;
    const filterBodies = [];
    const base = { location_id: locationId, page: 1, limit: 25 };
    const contactFilter = { field: "contact_id", operator: "eq", value: contactId };
    if (mlsFieldId) {
        filterBodies.push({
            ...base,
            filters: [
                contactFilter,
                { field: `customFields.${mlsFieldId}`, operator: "eq", value: mlsNorm },
            ],
        });
    }
    filterBodies.push({
        ...base,
        filters: [contactFilter, { field: "customFields.mls", operator: "eq", value: mlsNorm }],
    });
    const attempts = [];
    for (const body of filterBodies) {
        try {
            const searchRes = await axios.post(`${ghlApiBase()}/opportunities/search`, body, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    Version: ghlApiVersion(),
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                timeout: 25_000,
                validateStatus: () => true,
            });
            const opportunities = Array.isArray(searchRes.data?.opportunities)
                ? searchRes.data.opportunities
                : Array.isArray(searchRes.data?.data)
                    ? searchRes.data.data
                    : [];
            attempts.push({ status: searchRes.status, count: opportunities.length });
            if (searchRes.status < 200 || searchRes.status >= 300)
                continue;
            const hits = opportunities
                .map((row) => mapOpportunityRecord(row, defs))
                .filter((h) => h.id && opportunityMatchesMls(h, mlsNorm));
            if (hits.length > 0)
                return { hits, attempts };
        }
        catch {
            attempts.push({ status: 0, count: 0 });
        }
    }
    return { hits: [], attempts };
}
function summarizeOpportunities(opps) {
    return opps
        .map((o) => {
        const field = opportunityMls(o) || "(no mls)";
        const nameMls = extractMlsFromOpportunityName(o.name);
        return nameMls && nameMls !== field ? `${o.id}:${field}~${nameMls}` : `${o.id}:${field}`;
    })
        .join("|")
        .slice(0, 500);
}
async function opportunityBelongsToContact(opp, contactId) {
    const cid = contactId.trim();
    if (!cid)
        return false;
    if ((opp.contactId || "").trim() === cid)
        return true;
    try {
        const full = await fetchGhlOpportunity(opp.id);
        return (full.contactId || "").trim() === cid;
    }
    catch {
        return false;
    }
}
async function filterOpportunitiesForContactAndMls(opps, contactId, mlsNorm) {
    const matched = [];
    for (const opp of opps) {
        if (!opportunityMatchesMls(opp, mlsNorm))
            continue;
        if (!(await opportunityBelongsToContact(opp, contactId)))
            continue;
        try {
            matched.push(await fetchGhlOpportunity(opp.id));
        }
        catch {
            matched.push(opp);
        }
    }
    return matched;
}
function opportunityScanMaxPages() {
    const n = Number.parseInt(process.env.GHL_OPP_MLS_SCAN_MAX_PAGES?.trim() || "8", 10);
    return Number.isFinite(n) && n >= 1 ? Math.min(n, 20) : 8;
}
/** GHL GET /opportunities/search?q=TB8419229 — fast text search by MLS in opportunity title. */
async function searchGhlOpportunitiesByTextQuery(mlsNorm, limit, defs) {
    const token = process.env.GHL_BEARER_TOKEN?.trim();
    const locationId = ghlLocationId();
    if (!token || !locationId)
        return [];
    const collected = [];
    try {
        const searchRes = await axios.get(`${ghlApiBase()}/opportunities/search`, {
            headers: {
                Authorization: `Bearer ${token}`,
                Version: ghlApiVersion(),
                Accept: "application/json",
            },
            params: {
                location_id: locationId,
                q: mlsNorm,
                limit: String(Math.min(Math.max(limit, 1), 25)),
                page: "1",
            },
            timeout: 25_000,
            validateStatus: () => true,
        });
        if (searchRes.status < 200 || searchRes.status >= 300)
            return [];
        const opportunities = Array.isArray(searchRes.data?.opportunities)
            ? searchRes.data.opportunities
            : Array.isArray(searchRes.data?.data)
                ? searchRes.data.data
                : [];
        for (const row of opportunities) {
            const hit = mapOpportunityRecord(row, defs);
            if (!hit.id)
                continue;
            let candidate = hit;
            if (opportunityMatchesMls(hit, mlsNorm)) {
                try {
                    candidate = await fetchGhlOpportunity(hit.id);
                }
                catch {
                    candidate = hit;
                }
                if (opportunityMatchesMls(candidate, mlsNorm)) {
                    collected.push(candidate);
                    if (collected.length >= limit)
                        return collected;
                }
                continue;
            }
            const enriched = await enrichOpportunityMls(hit);
            if (opportunityMatchesMls(enriched, mlsNorm)) {
                collected.push(enriched);
                if (collected.length >= limit)
                    return collected;
            }
        }
    }
    catch {
        /* fall through to filters / scan */
    }
    return collected;
}
/** Find opportunities by MLS across the location (multi-listing — contact.mls may be the latest only). */
export async function searchGhlOpportunitiesByMls(mls, limit = 12) {
    const token = process.env.GHL_BEARER_TOKEN?.trim();
    const locationId = ghlLocationId();
    if (!token || !locationId)
        throw new Error("ghl_not_configured");
    const mlsNorm = normalizeMlsValue(mls);
    if (mlsNorm.length < 3)
        return [];
    const defs = await getGhlOpportunityCustomFieldDefinitions();
    const fromQuery = await searchGhlOpportunitiesByTextQuery(mlsNorm, limit, defs);
    if (fromQuery.length > 0)
        return fromQuery;
    const mlsFieldId = defs.keyToId.mls || defs.keyToId.MLS;
    const filterBodies = [];
    const base = { location_id: locationId, page: 1, limit: Math.min(Math.max(limit, 1), 25) };
    if (mlsFieldId) {
        filterBodies.push({
            ...base,
            filters: [{ field: `customFields.${mlsFieldId}`, operator: "eq", value: mlsNorm }],
        });
    }
    filterBodies.push({
        ...base,
        filters: [{ field: "customFields.mls", operator: "eq", value: mlsNorm }],
    });
    const collected = [];
    for (const body of filterBodies) {
        try {
            const searchRes = await axios.post(`${ghlApiBase()}/opportunities/search`, body, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    Version: ghlApiVersion(),
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                timeout: 25_000,
                validateStatus: () => true,
            });
            if (searchRes.status < 200 || searchRes.status >= 300)
                continue;
            const opportunities = Array.isArray(searchRes.data?.opportunities)
                ? searchRes.data.opportunities
                : Array.isArray(searchRes.data?.data)
                    ? searchRes.data.data
                    : [];
            for (const row of opportunities) {
                const hit = mapOpportunityRecord(row, defs);
                if (!hit.id)
                    continue;
                const enriched = await enrichOpportunityMls(hit);
                if (opportunityMatchesMls(enriched, mlsNorm)) {
                    collected.push(enriched);
                    if (collected.length >= limit)
                        return collected;
                }
            }
            if (collected.length > 0)
                return collected;
        }
        catch {
            /* try next filter */
        }
    }
    /** POST custom-field filters often miss — paginate location opportunities and match MLS/name. */
    return scanGhlOpportunitiesForMlsInLocation(mlsNorm, limit, defs);
}
async function scanGhlOpportunitiesForMlsInLocation(mlsNorm, limit, defs) {
    const token = process.env.GHL_BEARER_TOKEN?.trim();
    const locationId = ghlLocationId();
    if (!token || !locationId)
        return [];
    const collected = [];
    const pageSize = 50;
    const maxPages = opportunityScanMaxPages();
    let startAfterId;
    for (let page = 0; page < maxPages && collected.length < limit; page++) {
        const params = {
            location_id: locationId,
            limit: String(pageSize),
            page: String(page + 1),
        };
        if (startAfterId)
            params.startAfterId = startAfterId;
        try {
            const searchRes = await axios.get(`${ghlApiBase()}/opportunities/search`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    Version: ghlApiVersion(),
                    Accept: "application/json",
                },
                params,
                timeout: 25_000,
                validateStatus: () => true,
            });
            if (searchRes.status < 200 || searchRes.status >= 300)
                break;
            const opportunities = Array.isArray(searchRes.data?.opportunities)
                ? searchRes.data.opportunities
                : Array.isArray(searchRes.data?.data)
                    ? searchRes.data.data
                    : [];
            for (const row of opportunities) {
                const hit = mapOpportunityRecord(row, defs);
                if (!hit.id)
                    continue;
                if (opportunityMatchesMls(hit, mlsNorm)) {
                    collected.push(hit);
                    if (collected.length >= limit)
                        return collected;
                    continue;
                }
                const enriched = await enrichOpportunityMls(hit);
                if (opportunityMatchesMls(enriched, mlsNorm)) {
                    collected.push(enriched);
                    if (collected.length >= limit)
                        return collected;
                }
            }
            if (opportunities.length < pageSize)
                break;
            const lastId = String(opportunities[opportunities.length - 1]?.id || "").trim();
            if (!lastId || lastId === startAfterId)
                break;
            startAfterId = lastId;
        }
        catch {
            break;
        }
    }
    return collected;
}
/**
 * Find an opportunity for a contact with a matching MLS custom field.
 * Used when generate-pay-link receives contactId + mls but no opportunityId.
 */
export async function findGhlOpportunityByContactAndMls(contactId, mls) {
    const mlsReceived = (mls || "").trim();
    const mlsNorm = normalizeMlsValue(mls);
    const cid = contactId.trim();
    const baseDebug = {
        contactId: cid,
        mlsReceived,
        mlsNorm,
        mlsFieldId: null,
        filterAttempts: "",
        listHttpStatus: null,
        listGhlError: null,
        listCount: 0,
        opportunities: "",
        matchedOpportunityId: null,
        reason: "",
    };
    if (mlsNorm.length < 3) {
        return { opportunityId: null, debug: { ...baseDebug, reason: "mls_too_short" } };
    }
    if (!cid) {
        return { opportunityId: null, debug: { ...baseDebug, reason: "missing_contact_id" } };
    }
    try {
        const defs = await getGhlOpportunityCustomFieldDefinitions();
        baseDebug.mlsFieldId = defs.keyToId.mls || defs.keyToId.MLS || null;
        const { hits: filtered, attempts } = await searchGhlOpportunitiesByContactAndMlsFilter(cid, mlsNorm, defs);
        baseDebug.filterAttempts = attempts.map((a) => `${a.status}:${a.count}`).join(",") || "none";
        if (filtered[0]?.id) {
            const id = filtered[0].id;
            baseDebug.matchedOpportunityId = id;
            baseDebug.opportunities = summarizeOpportunities(filtered);
            baseDebug.reason = "matched_filter_search";
            opsLog("opp_lookup", { ...baseDebug, result: "found" });
            return { opportunityId: id, debug: baseDebug };
        }
        /** Location text search finds opps missing from the contact list (common with 5+ listings). */
        try {
            const globalEarly = await searchGhlOpportunitiesByMls(mls, 12);
            const forContactEarly = sortOpportunitiesNewestFirst(await filterOpportunitiesForContactAndMls(globalEarly, cid, mlsNorm));
            if (forContactEarly[0]?.id) {
                baseDebug.matchedOpportunityId = forContactEarly[0].id;
                baseDebug.reason = "matched_global_mls_search";
                baseDebug.opportunities = summarizeOpportunities(forContactEarly);
                opsLog("opp_lookup", { ...baseDebug, result: "found_global_early" });
                return { opportunityId: forContactEarly[0].id, debug: baseDebug };
            }
        }
        catch {
            /* fall through to contact list */
        }
        const { opportunities: listed, httpStatus, ghlError } = await listGhlOpportunitiesForContact(cid, 100);
        baseDebug.listHttpStatus = httpStatus;
        baseDebug.listGhlError = ghlError;
        baseDebug.listCount = listed.length;
        const enriched = [];
        for (const opp of listed) {
            enriched.push(await enrichOpportunityMls(opp));
        }
        baseDebug.opportunities = summarizeOpportunities(enriched);
        const matches = enriched.filter((o) => opportunityMatchesMls(o, mlsNorm));
        const match = sortOpportunitiesNewestFirst(matches)[0];
        if (match?.id) {
            baseDebug.matchedOpportunityId = match.id;
            baseDebug.reason =
                matches.length > 1 ? "matched_newest_contact_list" : "matched_contact_list";
            opsLog("opp_lookup", { ...baseDebug, result: "found" });
            return { opportunityId: match.id, debug: baseDebug };
        }
        /** Contact list stale or MLS only in title — search location by MLS text. */
        try {
            const global = await searchGhlOpportunitiesByMls(mls, 12);
            const forContact = sortOpportunitiesNewestFirst(await filterOpportunitiesForContactAndMls(global, cid, mlsNorm));
            if (forContact[0]?.id) {
                baseDebug.matchedOpportunityId = forContact[0].id;
                baseDebug.reason = "matched_global_mls_search";
                baseDebug.opportunities = summarizeOpportunities(forContact);
                opsLog("opp_lookup", { ...baseDebug, result: "found_global" });
                return { opportunityId: forContact[0].id, debug: baseDebug };
            }
        }
        catch {
            /* fall through */
        }
        if (listed.length === 0) {
            baseDebug.reason =
                httpStatus != null && (httpStatus < 200 || httpStatus >= 300)
                    ? `ghl_list_http_${httpStatus}${ghlError ? `:${ghlError.slice(0, 120)}` : ""}`
                    : "no_opportunities_for_contact";
        }
        else {
            baseDebug.reason = "no_mls_match_on_opportunities";
        }
        opsLog("opp_lookup", {
            ...baseDebug,
            result: "none",
            note: "no_empty_mls_guess",
        });
        return { opportunityId: null, debug: baseDebug };
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : "lookup_failed";
        baseDebug.reason = msg;
        opsLog("opp_lookup", { ...baseDebug, result: "error", error: msg });
        return { opportunityId: null, debug: baseDebug };
    }
}
export async function listContactOpportunitiesSummary(contactId, limit = 50) {
    const { opportunities } = await listGhlOpportunitiesForContact(contactId, limit);
    const rows = [];
    for (const row of opportunities) {
        let full = row;
        try {
            full = await fetchGhlOpportunity(row.id);
        }
        catch {
            /* use list row */
        }
        const payLinkUrl = readOpportunityField(full, "pay_link_url");
        const finalLinkUrl = readOpportunityField(full, "final_link_url");
        rows.push({
            id: full.id,
            name: full.name ?? null,
            mls: resolveOpportunityListingMls(full) || null,
            mlsFromName: extractMlsFromOpportunityName(full.name) || null,
            mlsFromPayLink: opportunityMlsFromStoredLinks(full) || null,
            payLinkUrl,
            finalLinkUrl,
            listingAddress: readOpportunityField(full, "listing_address"),
            listingType: readOpportunityField(full, "listing_type") ??
                readOpportunityField(full, "listing type") ??
                readOpportunityField(full, "Listing Type"),
            createdAt: full.createdAt ?? null,
            subdivisionHomeOwners: readOpportunityField(full, "subdivision_home_owners"),
            oneFourthMileHomeOwners: readOpportunityField(full, "one_fourth_mile_home_owners") ??
                readOpportunityField(full, "14_mile_home_owners"),
            halfMileHomeOwners: readOpportunityField(full, "half_mile_home_owners") ??
                readOpportunityField(full, "12_mile_home_owners"),
            oneMileHomeOwners: readOpportunityField(full, "one_mile_home_owners") ??
                readOpportunityField(full, "1_mile_home_owners"),
            zipcodeHomeOwners: readOpportunityField(full, "zipcode_home_owners"),
        });
    }
    return rows;
}
/** Update opportunity custom fields. Keys are short names (e.g. pay_link_url). */
export async function updateGhlOpportunityFields(opportunityId, fields) {
    const token = process.env.GHL_BEARER_TOKEN?.trim();
    if (!token)
        return { ok: false, status: 0, message: "ghl_not_configured" };
    const entries = Object.entries(fields).filter(([, v]) => v !== null && v !== undefined && String(v).length > 0);
    if (!entries.length)
        return { ok: true, status: 204 };
    const defs = await getGhlOpportunityCustomFieldDefinitions();
    const customFields = entries.map(([rawKey, value]) => {
        const short = stripOpportunityFieldKeyPrefix(rawKey);
        const id = defs.keyToId[short] || defs.keyToId[short.toLowerCase()];
        if (id)
            return { id, field_value: String(value) };
        return { key: short, field_value: String(value) };
    });
    const r = await axios.put(`${ghlApiBase()}/opportunities/${encodeURIComponent(opportunityId)}`, { customFields }, {
        headers: {
            Authorization: `Bearer ${token}`,
            Version: ghlApiVersion(),
            "Content-Type": "application/json",
            Accept: "application/json",
        },
        timeout: 15_000,
        validateStatus: () => true,
    });
    if (r.status >= 200 && r.status < 300)
        return { ok: true, status: r.status };
    const msg = typeof r.data === "string" ? r.data.slice(0, 300) : JSON.stringify(r.data).slice(0, 300);
    return { ok: false, status: r.status, message: msg };
}
