export type ParsedPlaceAddress = {
  streetLine: string;
  city: string;
  stateCode: string;
  zip: string;
  county: string;
  lat: number;
  lng: number;
  formattedAddress: string;
};

function component(
  parts: google.maps.GeocoderAddressComponent[] | undefined,
  type: string,
  short = false
): string {
  if (!parts?.length) return "";
  const hit = parts.find((c) => c.types.includes(type));
  if (!hit) return "";
  return (short ? hit.short_name : hit.long_name) || "";
}

export function formatCityStateZip(city: string, stateCode: string, zip: string): string {
  const c = city.trim();
  const s = stateCode.trim().toUpperCase();
  const z = zip.trim();
  if (!c && !s && !z) return "";
  if (!z) return [c, s].filter(Boolean).join(", ");
  return `${c}${c ? ", " : ""}${s} ${z}`.trim();
}

/** Parse a Places `place_changed` result into listing-friendly fields. */
export function parseGooglePlace(place: google.maps.places.PlaceResult): ParsedPlaceAddress | null {
  const loc = place.geometry?.location;
  if (!loc) return null;
  const lat = loc.lat();
  const lng = loc.lng();
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const ac = place.address_components ?? [];
  const streetNumber = component(ac, "street_number");
  const route = component(ac, "route");
  const streetLine =
    [streetNumber, route].filter(Boolean).join(" ").trim() ||
    (place.name?.trim() || place.formatted_address?.split(",")[0]?.trim() || "");

  const city =
    component(ac, "locality") ||
    component(ac, "postal_town") ||
    component(ac, "sublocality") ||
    component(ac, "administrative_area_level_3") ||
    "";

  const stateCode = component(ac, "administrative_area_level_1", true);
  const zip = component(ac, "postal_code");
  const county = component(ac, "administrative_area_level_2").replace(/\s+County$/i, "");

  return {
    streetLine,
    city,
    stateCode,
    zip,
    county,
    lat,
    lng,
    formattedAddress: place.formatted_address?.trim() || streetLine,
  };
}
