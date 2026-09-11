import { apiBase } from "./apiBase";
import { fetchOrderById } from "./apiClient";
import { agentRoleFromGhlHit, pickGhlHitForAgentRole } from "./ghlContactRole";
import { resolveCampaignPath } from "./mlsCampaignPath";
import { buildListingFromGhlPrefill } from "./listingDraft";
import { buildMlsLeadsUrl } from "./mlsUrl";
import type { ListingPayload } from "./listingData";
import type { ListingAgentRole } from "./listingAgents";
import { writeListingCache, buildListingCacheKey } from "./listingCache";
import { trafficSourceHeaders } from "./trafficSource";

export type GhlContactSearchHit = {
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
  /** GHL Agent Type — Listing (seller) / Buyer. */
  agentType: string | null;
  /** GHL custom field — "Just Listed" / "Just Sold". */
  listingType: string | null;
  listingPhotoUrl: string | null;
  subdivisionHomeOwners: string | null;
  oneFourthMileHomeOwners: string | null;
  halfMileHomeOwners: string | null;
  oneMileHomeOwners: string | null;
  zipcodeHomeOwners: string | null;
};

export type ResolveListingByMlsOptions = {
  signal?: AbortSignal;
  /** From /seller/mls/… or /buyer/mls/… — auto-pick matching GHL contact. */
  agentRole?: ListingAgentRole | null;
  /** From ?c= on welcome / tracked links — load this contact directly. */
  contactId?: string | null;
  /** When true, pick a contact instead of throwing on multiple MLS hits. */
  autoPickMultiple?: boolean;
};

export async function geocodeAddressLine(
  line: string,
  signal?: AbortSignal
): Promise<{ lat: number; lng: number; county: string }> {
  const { geocodeUSAddress, geocodeUserMessage } = await import("./geocodeAddress");
  try {
    return await geocodeUSAddress(line, signal);
  } catch (e) {
    throw new Error(geocodeUserMessage(e));
  }
}

/** User-facing message for GHL contact / agent search failures (not geocoding). */
export function ghlSearchUserMessage(err: unknown): string {
  if (!(err instanceof Error)) return "Could not search contacts. Try again in a moment.";
  const msg = err.message.trim();
  if (!msg) return "Could not search contacts. Try again in a moment.";
  if (/429|too many requests|too many searches/i.test(msg)) {
    return "Too many searches right now — wait a moment and try again.";
  }
  if (/ghl_not_configured|not configured on the server/i.test(msg)) return msg;
  if (msg.startsWith("geocode_")) return msg;
  return msg;
}

const GHL_CLIENT_CACHE_MS = 90_000;
const GHL_AGENT_SEARCH_CACHE_MS = 5 * 60_000;
const mlsSearchCache = new Map<string, { at: number; data: GhlContactSearchHit[] }>();
const agentSearchCache = new Map<string, { at: number; data: GhlContactSearchHit[] }>();
const prefillCache = new Map<string, { at: number; data: GhlContactSearchHit }>();
const inflightSearches = new Map<string, Promise<GhlContactSearchHit[]>>();

function coalesceSearch(key: string, fn: () => Promise<GhlContactSearchHit[]>): Promise<GhlContactSearchHit[]> {
  const existing = inflightSearches.get(key);
  if (existing) return existing;
  const pending = fn().finally(() => {
    if (inflightSearches.get(key) === pending) inflightSearches.delete(key);
  });
  inflightSearches.set(key, pending);
  return pending;
}

function readClientCache<T>(
  map: Map<string, { at: number; data: T }>,
  key: string,
  ttlMs = GHL_CLIENT_CACHE_MS
): T | null {
  const hit = map.get(key);
  if (!hit || Date.now() - hit.at > ttlMs) {
    map.delete(key);
    return null;
  }
  return hit.data;
}

function writeClientCache<T>(map: Map<string, { at: number; data: T }>, key: string, data: T): void {
  map.set(key, { at: Date.now(), data });
}

export async function searchListingByMls(mls: string, signal?: AbortSignal): Promise<ListingPayload> {
  return fetchOrderById(mls.trim(), signal);
}

export class MultipleGhlMlsHitsError extends Error {
  readonly hits: GhlContactSearchHit[];
  constructor(hits: GhlContactSearchHit[]) {
    super(`multiple_ghl_hits`);
    this.name = "MultipleGhlMlsHitsError";
    this.hits = hits;
  }
}

async function listingFromGhlPrefillHit(
  full: GhlContactSearchHit,
  _signal?: AbortSignal,
  expectedMls?: string
): Promise<ListingPayload> {
  const listing = buildListingFromGhlPrefill(full);
  const mlsQ = expectedMls?.trim().toUpperCase();
  if (mlsQ && mlsQ.length >= 3) {
    return { ...listing, mls: mlsQ, id: mlsQ.toLowerCase() };
  }
  return listing;
}

function cacheResolvedListing(
  mls: string,
  listing: ListingPayload,
  opts?: Pick<ResolveListingByMlsOptions, "contactId" | "agentRole">
): void {
  writeListingCache(
    buildListingCacheKey({
      mls,
      contactId: opts?.contactId,
      agentRole: opts?.agentRole,
    }),
    listing
  );
}

/** Load one GHL contact by id (welcome email ?c= or tracked /go redirect). */
export async function resolveListingByGhlContactId(
  contactId: string,
  expectedMls?: string,
  signal?: AbortSignal
): Promise<ListingPayload> {
  const full = await fetchGhlContactPrefill(contactId.trim(), signal, expectedMls?.trim());
  return listingFromGhlPrefillHit(full, signal, expectedMls);
}

async function resolveListingFromGhlMls(
  mlsQ: string,
  opts?: Pick<ResolveListingByMlsOptions, "signal" | "agentRole" | "autoPickMultiple">
): Promise<ListingPayload> {
  const signal = opts?.signal;
  const hits = await searchGhlContactsByMls(mlsQ, signal);
  if (hits.length === 0) {
    throw new Error(`No listing found for MLS ${mlsQ}.`);
  }

  let pick: GhlContactSearchHit | undefined;
  if (hits.length === 1) {
    pick = hits[0];
  } else if (opts?.agentRole) {
    pick = pickGhlHitForAgentRole(hits, opts.agentRole, Boolean(opts.autoPickMultiple)) ?? undefined;
  } else if (opts?.autoPickMultiple) {
    pick = hits[0];
  }

  if (!pick) {
    throw new MultipleGhlMlsHitsError(hits);
  }

  const full = await fetchGhlContactPrefill(pick.id, signal, mlsQ);
  const listing = await listingFromGhlPrefillHit(full, signal, mlsQ);
  cacheResolvedListing(mlsQ, listing, opts);
  return listing;
}

function looksLikeGhlMlsId(mls: string): boolean {
  const q = mls.trim();
  return /^TB\d+/i.test(q) || /^O\d{5,}/i.test(q);
}

/** MLS search: GHL first when a contact/opportunity exists, then legacy order API. */
export async function resolveListingByMls(
  mls: string,
  opts?: ResolveListingByMlsOptions
): Promise<ListingPayload> {
  const signal = opts?.signal;
  const mlsQ = mls.trim();

  if (opts?.contactId?.trim()) {
    try {
      const listing = await resolveListingByGhlContactId(opts.contactId, mlsQ, signal);
      cacheResolvedListing(mlsQ, listing, opts);
      return listing;
    } catch (e) {
      const msg = e instanceof Error ? e.message.toLowerCase() : "";
      if (!msg.includes("not found") && !msg.includes("could not load contact")) {
        throw e;
      }
      /* Bad ?c= on old links — fall back to MLS-only lookup via opportunities. */
    }
  }

  const ghlOpts = {
    signal,
    agentRole: opts?.agentRole,
    autoPickMultiple: opts?.autoPickMultiple,
  };

  if (looksLikeGhlMlsId(mlsQ)) {
    try {
      const listing = await resolveListingFromGhlMls(mlsQ, ghlOpts);
      cacheResolvedListing(mlsQ, listing, opts);
      return listing;
    } catch (e) {
      if (e instanceof MultipleGhlMlsHitsError) throw e;
      try {
        const listing = await searchListingByMls(mlsQ, signal);
        cacheResolvedListing(mlsQ, listing, opts);
        return listing;
      } catch {
        throw e;
      }
    }
  }
  try {
    const listing = await resolveListingFromGhlMls(mlsQ, ghlOpts);
    cacheResolvedListing(mlsQ, listing, opts);
    return listing;
  } catch (e) {
    if (e instanceof MultipleGhlMlsHitsError) throw e;
    const listing = await searchListingByMls(mlsQ, signal);
    cacheResolvedListing(mlsQ, listing, opts);
    return listing;
  }
}

export async function searchGhlContactsByMls(
  mls: string,
  signal?: AbortSignal,
  opts?: { skipCache?: boolean }
): Promise<GhlContactSearchHit[]> {
  const mlsQ = mls.trim().toUpperCase();
  const cacheKey = `mls:${mlsQ}`;
  if (!opts?.skipCache) {
    const cached = readClientCache(mlsSearchCache, cacheKey);
    if (cached) return cached;
  }

  const run = async () => {
    if (!opts?.skipCache) {
      const cachedNow = readClientCache(mlsSearchCache, cacheKey);
      if (cachedNow) return cachedNow;
    }

    const r = await fetch(`${apiBase()}/api/ghl-contacts/search-by-mls?mls=${encodeURIComponent(mls.trim())}`, {
      method: "GET",
      signal,
      cache: opts?.skipCache ? "no-store" : undefined,
      headers: trafficSourceHeaders(),
    });
    if (r.status === 503) {
      const j = (await r.json()) as { message?: string };
      throw new Error(j.message || "GHL search is not configured on the server.");
    }
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as { message?: string };
      throw new Error(j.message || (r.status === 429 ? "Too many requests" : "MLS search failed."));
    }
    const j = (await r.json()) as { results?: GhlContactSearchHit[] };
    const results = j.results ?? [];
    if (results.length || !opts?.skipCache) {
      writeClientCache(mlsSearchCache, cacheKey, results);
    }
    return results;
  };

  if (opts?.skipCache) return run();
  return coalesceSearch(cacheKey, run);
}

export async function searchGhlContacts(q: string, signal?: AbortSignal): Promise<GhlContactSearchHit[]> {
  const trimmed = q.trim();
  const cacheKey = trimmed.toLowerCase();
  const cached = readClientCache(agentSearchCache, cacheKey, GHL_AGENT_SEARCH_CACHE_MS);
  if (cached) return cached;

  return coalesceSearch(`agent:${cacheKey}`, async () => {
    const cachedNow = readClientCache(agentSearchCache, cacheKey, GHL_AGENT_SEARCH_CACHE_MS);
    if (cachedNow) return cachedNow;

    const r = await fetch(`${apiBase()}/api/ghl-contacts/search?q=${encodeURIComponent(trimmed)}`, {
      method: "GET",
      signal,
      cache: "no-store",
      headers: trafficSourceHeaders(),
    });
    if (r.status === 503) {
      const j = (await r.json()) as { message?: string };
      throw new Error(j.message || "GHL search is not configured on the server.");
    }
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as { message?: string };
      throw new Error(j.message || (r.status === 429 ? "Too many requests" : "Agent search failed."));
    }
    const j = (await r.json()) as { results?: GhlContactSearchHit[] };
    const results = j.results ?? [];
    writeClientCache(agentSearchCache, cacheKey, results);
    return results;
  });
}

/** Canonical checkout URL for a GHL contact (legacy /buy-leads?c= links). */
export function mlsLeadsUrlForGhlContact(hit: GhlContactSearchHit, contactId: string): string | null {
  const mls = (hit.mls || "").trim();
  if (mls.length < 3) return null;
  const campaignPath = resolveCampaignPath({
    listingType: hit.listingType,
    agentType: hit.agentType,
    agentRole: agentRoleFromGhlHit(hit) ?? undefined,
  });
  return buildMlsLeadsUrl(mls, { campaignPath, contactId: contactId.trim() });
}

export async function fetchGhlContactPrefill(contactId: string, signal?: AbortSignal, mls?: string): Promise<GhlContactSearchHit> {
  const cid = contactId.trim();
  const mlsQ = (mls || "").trim().toUpperCase();
  const cacheKey = `prefill:v6:${cid}:${mlsQ}`;
  const cached = readClientCache(prefillCache, cacheKey);
  if (cached) return cached;

  const qs = new URLSearchParams();
  if (mls?.trim()) qs.set("mls", mls.trim());
  const tail = qs.toString();
  const r = await fetch(`${apiBase()}/api/ghl-contacts/${encodeURIComponent(cid)}/prefill${tail ? `?${tail}` : ""}`, {
    method: "GET",
    signal,
    headers: { Accept: "application/json" },
  });
  if (!r.ok) {
    const j = (await r.json().catch(() => ({}))) as { message?: string };
    throw new Error(j.message || "Could not load contact.");
  }
  const j = (await r.json()) as { prefill: GhlContactSearchHit };
  writeClientCache(prefillCache, cacheKey, j.prefill);
  return j.prefill;
}
