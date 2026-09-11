import { apiBase } from "./apiBase";
import type { ListingPayload } from "./listingData";
import { isDraftMls } from "./listingDraft";

export async function fetchIntroListingSnapshot(
  mls: string,
  signal?: AbortSignal
): Promise<ListingPayload | null> {
  const mlsQ = mls.trim();
  if (mlsQ.length < 3 || isDraftMls(mlsQ)) return null;
  try {
    const r = await fetch(`${apiBase()}/api/intro/listing-snapshot?mls=${encodeURIComponent(mlsQ)}`, {
      method: "GET",
      signal,
      headers: { Accept: "application/json" },
    });
    if (r.status === 404) return null;
    if (!r.ok) return null;
    const j = (await r.json()) as { listing?: ListingPayload };
    return j.listing?.mls ? j.listing : null;
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    if (e instanceof Error && e.name === "AbortError") throw e;
    return null;
  }
}

/** Fire-and-forget: one listing card, overwritten by MLS. */
export function persistIntroListingSnapshot(listing: ListingPayload): void {
  const mls = (listing.mls || "").trim();
  if (mls.length < 3 || isDraftMls(mls)) return;
  if (!Number.isFinite(listing.lat) || !Number.isFinite(listing.lng)) return;
  void fetch(`${apiBase()}/api/intro/listing-snapshot`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ listing }),
  }).catch(() => {
    /* ignore — checkout still works from GHL / session */
  });
}
