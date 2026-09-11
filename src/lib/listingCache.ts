import type { ListingPayload } from "./listingData";

const PREFIX = "cpai_listing_v1:";
const TTL_MS = 5 * 60_000;

export type ListingCacheKeyParts = {
  mls: string;
  contactId?: string | null;
  agentRole?: string | null;
};

export function buildListingCacheKey(parts: ListingCacheKeyParts): string {
  const mls = parts.mls.trim().toUpperCase();
  const contact = (parts.contactId || "").trim();
  const role = (parts.agentRole || "").trim().toLowerCase();
  return `${PREFIX}${mls}|${contact}|${role}`;
}

export function readListingCache(key: string): ListingPayload | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; listing: ListingPayload };
    if (!parsed?.listing || Date.now() - parsed.at > TTL_MS) {
      sessionStorage.removeItem(key);
      return null;
    }
    return parsed.listing;
  } catch {
    return null;
  }
}

export function writeListingCache(key: string, listing: ListingPayload): void {
  try {
    sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), listing }));
  } catch {
    /* quota or private mode */
  }
}
