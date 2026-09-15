import type { ListingCampaignType } from "./listingData";
import { campaignTypeFromListingType, isComingSoonListingType } from "./listingCampaignType";
import { parseAgentRoleInput, type ListingAgentRole } from "./listingAgents";

/** Canonical checkout path segment: /listed|cs|seller|buyer/mls/{MLS} */
export type MlsCampaignPathSegment = "listed" | "cs" | "seller" | "buyer";

const PATH_SEGMENTS: MlsCampaignPathSegment[] = ["listed", "cs", "seller", "buyer"];

export function parseMlsCampaignPathSegment(raw: string | null | undefined): MlsCampaignPathSegment | null {
  if (!raw?.trim()) return null;
  const t = raw.trim().toLowerCase();
  if (t === "listed" || t === "list" || t === "just_listed") return "listed";
  if (t === "cs" || t === "coming_soon" || t === "coming-soon" || t === "comingsoon") return "cs";
  if (t === "seller" || t === "s" || t === "listing" || t === "sold" || t === "just_sold") return "seller";
  if (t === "buyer" || t === "b") return "buyer";
  return null;
}

/** Pricing/checkout type. Coming Soon (`/cs`) uses the same numbers as Just Listed. */
export function campaignTypeFromPathSegment(seg: MlsCampaignPathSegment): ListingCampaignType {
  return seg === "seller" ? "just_sold" : "just_listed";
}

export function agentRoleFromCampaignPath(seg: MlsCampaignPathSegment): ListingAgentRole {
  return seg === "buyer" ? "buyer" : "seller";
}

export function campaignPathFromListingType(
  listingType: string | null | undefined
): MlsCampaignPathSegment | null {
  if (isComingSoonListingType(listingType)) return "cs";
  const campaign = campaignTypeFromListingType(listingType);
  if (campaign === "just_sold") return "seller";
  if (campaign === "just_listed") return "listed";
  return null;
}

/** Best /listed|cs|seller|buyer segment for pay links and canonical URLs. */
export function resolveCampaignPath(opts: {
  pathSegment?: string | null;
  listingType?: string | null;
  agentType?: string | null;
  agentRole?: ListingAgentRole | null;
}): MlsCampaignPathSegment {
  const fromPath = parseMlsCampaignPathSegment(opts.pathSegment);
  if (fromPath) return fromPath;

  const role = opts.agentRole ?? parseAgentRoleInput(opts.agentType);
  if (role === "buyer") return "buyer";

  const fromListing = campaignPathFromListingType(opts.listingType);
  if (fromListing) return fromListing;

  if (role === "seller") return "seller";
  return "listed";
}

export function parseCampaignPathFromUrl(url: string): MlsCampaignPathSegment | null {
  const m = url.match(/\/(listed|cs|seller|buyer)\/mls\//i);
  if (m?.[1]) return parseMlsCampaignPathSegment(m[1]);
  if (/\/sold\/mls\//i.test(url)) return "seller";
  return null;
}

export function isMlsCampaignPathSegment(raw: string): raw is MlsCampaignPathSegment {
  return (PATH_SEGMENTS as string[]).includes(raw);
}
