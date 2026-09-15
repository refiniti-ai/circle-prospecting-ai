import { apiBase } from "./apiBase";
import type { ListingPayload } from "./listingData";
import type { MlsCampaignPathSegment } from "./mlsCampaignPath";
import { trafficSourceHeaders } from "./trafficSource";

export function roofsStatusFromCampaignPath(
  path: MlsCampaignPathSegment | null | undefined
): "coming_soon" | "active" | "closed" | undefined {
  if (path === "cs") return "coming_soon";
  if (path === "seller") return "closed";
  if (path === "listed" || path === "buyer") return "active";
  return undefined;
}

/** Housing Leads RDS (`roofs.mls_properties`). 404/503 → caller falls back to GHL. */
export async function fetchRoofsListingByMls(
  mls: string,
  opts?: { signal?: AbortSignal; status?: string }
): Promise<ListingPayload | null> {
  const mlsQ = mls.trim();
  if (mlsQ.length < 3) return null;
  const qs = new URLSearchParams({ mls: mlsQ });
  if (opts?.status) qs.set("status", opts.status);
  try {
    const r = await fetch(`${apiBase()}/api/listings/mls?${qs.toString()}`, {
      method: "GET",
      signal: opts?.signal,
      cache: "no-store",
      headers: trafficSourceHeaders(),
    });
    if (r.status === 404 || r.status === 503) return null;
    if (!r.ok) return null;
    const data = (await r.json()) as { listing?: ListingPayload };
    return data.listing ?? null;
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    return null;
  }
}
