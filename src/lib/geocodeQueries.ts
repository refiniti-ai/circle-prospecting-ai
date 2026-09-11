import type { ListingFormValues } from "./listingData";
import { listingAddressGeocodeQuery } from "./listingData";

/** Expand common MLS/GHL street suffix abbreviations for geocoders. */
export function expandStreetAbbrev(street: string): string {
  return street.replace(
    /\b(CT|ST|DR|RD|LN|AVE|BLVD|CIR|PL|TRL|WAY|PKWY|HWY)\b\.?$/i,
    (m) => {
      const map: Record<string, string> = {
        CT: "Court",
        ST: "Street",
        DR: "Drive",
        RD: "Road",
        LN: "Lane",
        AVE: "Avenue",
        BLVD: "Boulevard",
        CIR: "Circle",
        PL: "Place",
        TRL: "Trail",
        WAY: "Way",
        PKWY: "Parkway",
        HWY: "Highway",
      };
      const key = m.replace(/\./g, "").toUpperCase();
      return map[key] ?? m;
    }
  );
}

/** Ordered geocode strings — most specific first, ZIP-area fallback last. */
export function buildGeocodeQueryVariants(form: ListingFormValues): string[] {
  const street = form.streetAddress.trim();
  const city = form.city.trim();
  const state = form.stateCode.trim().toUpperCase().slice(0, 2);
  const zip = form.zip.trim().replace(/\D/g, "").slice(0, 5);
  const expanded = expandStreetAbbrev(street);
  const out: string[] = [];

  const push = (s: string) => {
    const t = s.replace(/\s+/g, " ").replace(/,\s*,/g, ",").trim();
    if (t.length >= 8 && !out.includes(t)) out.push(t);
  };

  push(listingAddressGeocodeQuery(form));

  if (street && zip && state) {
    push(`${street}, ${zip}, ${state}, USA`);
    push(`${expanded}, ${zip}, ${state}, USA`);
  }
  if (street && city && state && zip) {
    push(`${street}, ${city}, ${state} ${zip}, USA`);
    if (expanded !== street) push(`${expanded}, ${city}, ${state} ${zip}, USA`);
  }
  if (street && state && zip && city) {
    push(`${street}, ${city}, ${state}, USA`);
  }
  if (zip.length === 5 && state) {
    push(`${zip}, ${state}, USA`);
  }

  return out;
}
