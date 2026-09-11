import { apiBase } from "./apiBase";
import { fetchOrderById } from "./apiClient";
import { geocodeUSAddress, geocodeUserMessage } from "./geocodeAddress";
import { pickGhlHitForAgentRole } from "./ghlContactRole";
import { buildListingFromGhlPrefill, ghlHitToListingForm } from "./listingDraft";
import { listingAddressGeocodeQuery, type ListingPayload } from "./listingData";
import type { ListingAgentRole } from "./listingAgents";

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
  try {
    return await geocodeUSAddress(line, signal);
  } catch (e) {
    throw new Error(geocodeUserMessage(e));
  }
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
  signal?: AbortSignal
): Promise<ListingPayload> {
  const form = ghlHitToListingForm(full);
  const geoQuery = listingAddressGeocodeQuery(form);
  let geo: { lat: number; lng: number; county: string } | undefined;
  if (geoQuery.length >= 10) {
    try {
      geo = await geocodeAddressLine(geoQuery, signal);
    } catch {
      /* Page will retry geocode from form fields */
    }
  }
  return buildListingFromGhlPrefill(full, geo);
}

/** Load one GHL contact by id (welcome email ?c= or tracked /go redirect). */
export async function resolveListingByGhlContactId(
  contactId: string,
  expectedMls?: string,
  signal?: AbortSignal
): Promise<ListingPayload> {
  const full = await fetchGhlContactPrefill(contactId.trim(), signal);
  if (expectedMls?.trim()) {
    const want = expectedMls.trim().toUpperCase();
    const got = (full.mls || "").trim().toUpperCase();
    if (got && got !== want) {
      throw new Error(`Contact MLS ${full.mls} does not match ${expectedMls}.`);
    }
  }
  return listingFromGhlPrefillHit(full, signal);
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
    pick = pickGhlHitForAgentRole(hits, opts.agentRole) ?? undefined;
  } else if (opts?.autoPickMultiple) {
    pick = hits[0];
  }

  if (!pick) {
    throw new MultipleGhlMlsHitsError(hits);
  }

  const full = await fetchGhlContactPrefill(pick.id, signal);
  return listingFromGhlPrefillHit(full, signal);
}

function looksLikeGhlMlsId(mls: string): boolean {
  return /^TB\d+/i.test(mls.trim());
}

/** MLS search: GHL first for TB… MLS numbers, then legacy order API. */
export async function resolveListingByMls(
  mls: string,
  opts?: ResolveListingByMlsOptions
): Promise<ListingPayload> {
  const signal = opts?.signal;
  const mlsQ = mls.trim();

  if (opts?.contactId?.trim()) {
    return resolveListingByGhlContactId(opts.contactId, mlsQ, signal);
  }

  const ghlOpts = {
    signal,
    agentRole: opts?.agentRole,
    autoPickMultiple: opts?.autoPickMultiple,
  };

  if (looksLikeGhlMlsId(mlsQ)) {
    try {
      return await resolveListingFromGhlMls(mlsQ, ghlOpts);
    } catch (e) {
      if (e instanceof MultipleGhlMlsHitsError) throw e;
      try {
        return await searchListingByMls(mlsQ, signal);
      } catch {
        throw e;
      }
    }
  }
  try {
    return await searchListingByMls(mlsQ, signal);
  } catch {
    return resolveListingFromGhlMls(mlsQ, ghlOpts);
  }
}

export async function searchGhlContactsByMls(mls: string, signal?: AbortSignal): Promise<GhlContactSearchHit[]> {
  const r = await fetch(`${apiBase()}/api/ghl-contacts/search-by-mls?mls=${encodeURIComponent(mls.trim())}`, {
    method: "GET",
    signal,
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (r.status === 503) {
    const j = (await r.json()) as { message?: string };
    throw new Error(j.message || "GHL search is not configured on the server.");
  }
  if (!r.ok) {
    const j = (await r.json().catch(() => ({}))) as { message?: string };
    throw new Error(j.message || "MLS search failed.");
  }
  const j = (await r.json()) as { results?: GhlContactSearchHit[] };
  return j.results ?? [];
}

export async function searchGhlContacts(q: string, signal?: AbortSignal): Promise<GhlContactSearchHit[]> {
  const r = await fetch(`${apiBase()}/api/ghl-contacts/search?q=${encodeURIComponent(q.trim())}`, {
    method: "GET",
    signal,
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (r.status === 503) {
    const j = (await r.json()) as { message?: string };
    throw new Error(j.message || "GHL search is not configured on the server.");
  }
  if (!r.ok) {
    const j = (await r.json().catch(() => ({}))) as { message?: string };
    throw new Error(j.message || "Agent search failed.");
  }
  const j = (await r.json()) as { results?: GhlContactSearchHit[] };
  return j.results ?? [];
}

export async function fetchGhlContactPrefill(contactId: string, signal?: AbortSignal): Promise<GhlContactSearchHit> {
  const r = await fetch(`${apiBase()}/api/ghl-contacts/${encodeURIComponent(contactId)}/prefill`, {
    method: "GET",
    signal,
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!r.ok) {
    const j = (await r.json().catch(() => ({}))) as { message?: string };
    throw new Error(j.message || "Could not load contact.");
  }
  const j = (await r.json()) as { prefill: GhlContactSearchHit };
  return j.prefill;
}
