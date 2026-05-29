import { apiBase } from "./apiBase";
import type { ListingPayload } from "./listingData";
import { fetchOrderById } from "./apiClient";

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
};

const NOMINATIM_HEADERS = {
  Accept: "application/json",
  "User-Agent": "CircleProspectingAI/1.0 (buy-leads address search)",
};

export async function geocodeAddressLine(
  line: string,
  signal?: AbortSignal
): Promise<{ lat: number; lng: number; county: string }> {
  const q = line.trim();
  if (!q) throw new Error("Enter a property address.");
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=us&q=${encodeURIComponent(q)}`;
  const r = await fetch(url, { headers: NOMINATIM_HEADERS, signal });
  if (!r.ok) throw new Error("Could not look up that address.");
  const rows = (await r.json()) as { lat?: string; lon?: string; address?: { county?: string } }[];
  const first = rows[0];
  const lat = Number(first?.lat);
  const lng = Number(first?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error("Address not found. Try a more complete street, city, and state.");
  }
  const county = (first?.address?.county || "").replace(/\s+County$/i, "");
  return { lat, lng, county };
}

export async function searchListingByMls(mls: string, signal?: AbortSignal): Promise<ListingPayload> {
  return fetchOrderById(mls.trim(), signal);
}

export async function searchGhlContactsByMls(mls: string, signal?: AbortSignal): Promise<GhlContactSearchHit[]> {
  const r = await fetch(`${apiBase()}/api/ghl-contacts/search-by-mls?mls=${encodeURIComponent(mls.trim())}`, {
    method: "GET",
    signal,
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
    headers: { Accept: "application/json" },
  });
  if (!r.ok) {
    const j = (await r.json().catch(() => ({}))) as { message?: string };
    throw new Error(j.message || "Could not load contact.");
  }
  const j = (await r.json()) as { prefill: GhlContactSearchHit };
  return j.prefill;
}
