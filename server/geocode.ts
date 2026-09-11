import { buildGeocodeQueryVariants } from "../src/lib/geocodeQueries.js";
import type { ListingFormValues } from "../src/lib/listingData.js";

export type GeocodeResult = { lat: number; lng: number; county: string; approximate?: boolean };

const NOMINATIM_HEADERS = {
  Accept: "application/json",
  "User-Agent": "CircleProspectingAI/1.0 (geocode)",
} as const;

function googleMapsServerKey(): string | undefined {
  return (
    process.env.GOOGLE_MAPS_API_KEY?.trim() ||
    process.env.VITE_GOOGLE_MAPS_API_KEY?.trim() ||
    undefined
  );
}

const FETCH_MS = 12_000;

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), FETCH_MS);
  try {
    return await fetch(url, { ...init, signal: ac.signal });
  } finally {
    clearTimeout(t);
  }
}

async function geocodeNominatim(query: string): Promise<GeocodeResult> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=us&addressdetails=1&q=${encodeURIComponent(query)}`;
  const r = await fetchWithTimeout(url, { headers: NOMINATIM_HEADERS });
  if (!r.ok) throw new Error("geocode_failed");
  const rows = (await r.json()) as { lat?: string; lon?: string; address?: { county?: string } }[];
  const first = rows[0];
  const lat = Number(first?.lat);
  const lng = Number(first?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error("geocode_not_found");
  const county = (first?.address?.county || "").replace(/\s+County$/i, "").trim();
  return { lat, lng, county };
}

async function geocodeGoogle(query: string): Promise<GeocodeResult> {
  const key = googleMapsServerKey();
  if (!key) throw new Error("no_google_key");
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&components=country:US&key=${encodeURIComponent(key)}`;
  const r = await fetchWithTimeout(url);
  if (!r.ok) throw new Error("geocode_failed");
  const j = (await r.json()) as {
    status?: string;
    results?: {
      geometry?: { location?: { lat?: number; lng?: number } };
      address_components?: { long_name: string; types: string[] }[];
    }[];
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

function geocodeQueryVariantsFromString(query: string): string[] {
  const q = query.trim();
  const variants = [q];
  const noUnit = q.replace(/\s*#\S+/g, "").replace(/\s+,\s+/g, ", ").trim();
  if (noUnit.length >= 8 && noUnit !== q) variants.push(noUnit);
  const noUsa = q.replace(/,?\s*USA\s*$/i, "").trim();
  if (noUsa.length >= 8 && !variants.includes(noUsa)) variants.push(noUsa);
  return [...new Set(variants)];
}

function isZipOnlyQuery(q: string): boolean {
  return /^\d{5},\s*[A-Z]{2},\s*USA$/i.test(q.trim());
}

/** Geocode a US address (Google when configured, else OpenStreetMap). */
export async function geocodeUSAddressServer(
  query: string,
  form?: ListingFormValues
): Promise<GeocodeResult> {
  const variants = form ? buildGeocodeQueryVariants(form) : geocodeQueryVariantsFromString(query);
  if (!variants.length || variants[0]!.length < 8) throw new Error("address_too_short");
  let lastErr: unknown = new Error("geocode_not_found");
  for (let i = 0; i < variants.length; i++) {
    const q = variants[i]!;
    const approximate = isZipOnlyQuery(q);
    if (googleMapsServerKey()) {
      try {
        const r = await geocodeGoogle(q);
        return { ...r, approximate };
      } catch (e) {
        lastErr = e;
      }
    }
    try {
      const r = await geocodeNominatim(q);
      return { ...r, approximate };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("geocode_not_found");
}
