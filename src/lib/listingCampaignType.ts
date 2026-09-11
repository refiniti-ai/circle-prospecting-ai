import type { ListingCampaignType } from "./listingData";
import type { ListingAgentRole } from "./listingAgents";
import { campaignForAgentRole } from "./listingAgents";
import type { MlsCampaignPathSegment } from "./mlsCampaignPath";

/** GHL custom field "Listing Type" (e.g. "Just Listed", "Just Sold"). */
export function campaignTypeFromListingType(raw: string | null | undefined): ListingCampaignType | undefined {
  if (!raw?.trim()) return undefined;
  const v = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (v.includes("just_listed") || v === "listed" || v === "new_listing") return "just_listed";
  if (v.includes("just_sold") || v === "sold") return "just_sold";
  return undefined;
}

export type CampaignTypeLockSource = "url" | "ghl";

/** Locks campaign when ?campaign= or GHL Listing Type is present. */
export function resolveLockedCampaignType(opts: {
  campaignFromUrl?: ListingCampaignType | null;
  listingType?: string | null;
}): { lock: ListingCampaignType | null; source: CampaignTypeLockSource | null } {
  if (opts.campaignFromUrl) return { lock: opts.campaignFromUrl, source: "url" };
  const fromGhl = campaignTypeFromListingType(opts.listingType);
  if (fromGhl) return { lock: fromGhl, source: "ghl" };
  return { lock: null, source: null };
}

/** URL ?campaign= wins; then path segment; then agent path; then default. */
export function resolveCampaignTypeForListing(opts: {
  campaignFromUrl?: ListingCampaignType | null;
  campaignPath?: MlsCampaignPathSegment | null;
  listingCampaignType?: ListingCampaignType;
  agentRole?: ListingAgentRole | null;
  fallback?: ListingCampaignType;
}): ListingCampaignType {
  if (opts.campaignFromUrl) return opts.campaignFromUrl;
  if (opts.campaignPath) return opts.campaignPath === "seller" ? "just_sold" : "just_listed";
  if (opts.listingCampaignType) return opts.listingCampaignType;
  if (opts.agentRole) return campaignForAgentRole(opts.agentRole);
  return opts.fallback ?? "just_listed";
}
