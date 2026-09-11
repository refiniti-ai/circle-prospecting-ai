import { parseListingAddressLine } from "./listingData";

/** Street line → URL slug: `8915 59th Way N` → `8915-59th-way-n` */
export function slugifyListingStreet(street: string): string {
  const t = street.trim();
  if (!t) return "";
  return t
    .toLowerCase()
    .replace(/#/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

/** Full or partial listing address → optional path segment after MLS. */
export function listingAddressSlug(listingAddress: string | null | undefined): string {
  const raw = (listingAddress ?? "").trim();
  if (!raw) return "";
  const { streetAddress } = parseListingAddressLine(raw);
  const street = (streetAddress || raw.split(",")[0] || "").trim();
  return slugifyListingStreet(street);
}

export function decodeAddressSlugParam(raw: string | undefined): string {
  if (!raw) return "";
  try {
    return decodeURIComponent(raw).trim().toLowerCase();
  } catch {
    return raw.trim().toLowerCase();
  }
}
