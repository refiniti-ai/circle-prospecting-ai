import { apiBase, isApiBaseConfigured } from "./apiBase";
import { buildGeocodeQueryVariants } from "./geocodeQueries";
import type { ListingFormValues } from "./listingData";
import { googleMapsApiKey } from "./googleMapsConfig";
import { trafficSourceHeaders } from "./trafficSource";

const NOMINATIM_HEADERS = {
  Accept: "application/json",
  "User-Agent": "CircleProspectingAI/1.0 (geocode)",
} as const;

export type GeocodeResult = { lat: number; lng: number; county: string; approximate?: boolean };

export function geocodeUserMessage(err: unknown): string {
  if (!(err instanceof Error)) return "Could not look up that address.";
  if (err.message === "geocode_not_found" || err.message === "address_too_short") {
    return "Address not found. Check street, city, state, and ZIP.";
  }
  if (err.message === "geocode_failed") return "Address lookup failed. Try again in a moment.";
  return "Could not look up that address.";
}

async function geocodeNominatim(query: string, signal?: AbortSignal): Promise<GeocodeResult> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=us&addressdetails=1&q=${encodeURIComponent(query)}`;
  const r = await fetch(url, { headers: NOMINATIM_HEADERS, signal });
  if (!r.ok) throw new Error("geocode_failed");
  const rows = (await r.json()) as { lat?: string; lon?: string; address?: { county?: string } }[];
  const first = rows[0];
  const lat = Number(first?.lat);
  const lng = Number(first?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error("geocode_not_found");
  const county = (first?.address?.county || "").replace(/\s+County$/i, "").trim();
  return { lat, lng, county };
}

async function geocodeGoogle(query: string, signal?: AbortSignal): Promise<GeocodeResult> {
  const key = googleMapsApiKey();
  if (!key) throw new Error("no_google_key");
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&components=country:US&key=${encodeURIComponent(key)}`;
  const r = await fetch(url, { signal });
  if (!r.ok) throw new Error("geocode_failed");
  const j = (await r.json()) as {
    status?: string;
    results?: { geometry?: { location?: { lat?: number; lng?: number } }; address_components?: { long_name: string; types: string[] }[] }[];
  };
  if (j.status !== "OK" || !j.results?.[0]?.geometry?.location) throw new Error("geocode_not_found");
  const loc = j.results[0].geometry!.location!;
  const lat = loc.lat!;
  const lng = loc.lng!;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error("geocode_not_found");
  let county = "";
  for (const c of j.results[0].address_components ?? []) {
    if (c.types.includes("administrative_area_level_2")) {
      county = c.long_name.replace(/\s+County$/i, "").trim();
      break;
    }
  }
  return { lat, lng, county };
}

async function geocodeViaApi(
  query: string,
  form: ListingFormValues | undefined,
  signal?: AbortSignal
): Promise<GeocodeResult> {
  const params = new URLSearchParams({ address: query });
  if (form?.streetAddress?.trim()) {
    params.set("street", form.streetAddress.trim());
    params.set("city", form.city.trim());
    params.set("state", form.stateCode.trim());
    params.set("zip", form.zip.trim());
  }
  if (form?.mls?.trim()) params.set("mls", form.mls.trim());
  if (form?.agentName?.trim()) params.set("agent", form.agentName.trim());
  if (form?.email?.trim()) params.set("email", form.email.trim());
  if (form?.phone?.trim()) params.set("phone", form.phone.trim());
  const r = await fetch(`${apiBase()}/api/geocode?${params.toString()}`, {
    method: "GET",
    signal,
    headers: trafficSourceHeaders(),
  });
  if (r.status === 404) throw new Error("geocode_not_found");
  if (!r.ok) throw new Error("geocode_failed");
  const j = (await r.json()) as GeocodeResult;
  if (!Number.isFinite(j.lat) || !Number.isFinite(j.lng)) throw new Error("geocode_not_found");
  return { lat: j.lat, lng: j.lng, county: j.county || "", approximate: j.approximate };
}

function geocodeQueryVariantsFromString(query: string): string[] {
  const q = query.trim();
  const variants = [q];
  const noUnit = q.replace(/\s*#\S+/g, "").replace(/\s+,\s+/g, ", ").trim();
  if (noUnit.length >= 8 && noUnit !== q) variants.push(noUnit);
  return [...new Set(variants)];
}

/** Geocode a US listing address (API → Google → OpenStreetMap). */
export async function geocodeUSAddress(
  query: string,
  signal?: AbortSignal,
  form?: ListingFormValues
): Promise<GeocodeResult> {
  const variants = form ? buildGeocodeQueryVariants(form) : geocodeQueryVariantsFromString(query);
  if (!variants.length || variants[0]!.length < 8) throw new Error("address_too_short");
  let lastErr: unknown = new Error("geocode_not_found");
  for (const q of variants) {
    if (isApiBaseConfigured()) {
      try {
        return await geocodeViaApi(q, form, signal);
      } catch (e) {
        lastErr = e;
      }
    }
    if (googleMapsApiKey()) {
      try {
        const r = await geocodeGoogle(q, signal);
        return { ...r, approximate: /^\d{5},\s*[A-Z]{2},\s*USA$/i.test(q) };
      } catch (e) {
        lastErr = e;
      }
    }
    try {
      const r = await geocodeNominatim(q, signal);
      return { ...r, approximate: /^\d{5},\s*[A-Z]{2},\s*USA$/i.test(q) };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("geocode_not_found");
}
