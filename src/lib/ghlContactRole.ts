import type { GhlContactSearchHit } from "./buyLeadsSearchApi";
import { campaignTypeFromListingType } from "./listingCampaignType";
import {
  campaignPathFromListingType,
  type MlsCampaignPathSegment,
} from "./mlsCampaignPath";
import { parseAgentRoleInput, type ListingAgentRole } from "./listingAgents";
import type { ListingPayload } from "./listingData";

/** GHL Agent Type / Listing Type → buyer or seller (welcome-email links). */
export function agentRoleFromGhlHit(
  hit: Pick<GhlContactSearchHit, "agentType" | "listingType">
): ListingAgentRole | null {
  const fromAgentType = parseAgentRoleInput(hit.agentType);
  if (fromAgentType) return fromAgentType;
  const campaign = campaignTypeFromListingType(hit.listingType);
  if (campaign === "just_sold") return "seller";
  if (campaign === "just_listed") return "buyer";
  return null;
}

export function filterGhlHitsByAgentRole(
  hits: GhlContactSearchHit[],
  role: ListingAgentRole,
  opts?: { strict?: boolean }
): GhlContactSearchHit[] {
  const matched = hits.filter((h) => agentRoleFromGhlHit(h) === role);
  if (matched.length > 0) return matched;
  return opts?.strict ? [] : hits;
}

export function pickGhlHitForAgentRole(
  hits: GhlContactSearchHit[],
  role: ListingAgentRole,
  strict = false
): GhlContactSearchHit | null {
  const filtered = filterGhlHitsByAgentRole(hits, role, { strict });
  return filtered[0] ?? null;
}

export function ghlHitAgentLabel(hit: Pick<GhlContactSearchHit, "agentType" | "listingType">): string {
  const role = agentRoleFromGhlHit(hit);
  if (role === "seller") return "Listing agent";
  if (role === "buyer") return "Buyer's agent";
  if (hit.agentType?.trim()) return hit.agentType.trim();
  if (hit.listingType?.trim()) return hit.listingType.trim();
  return "Agent";
}

/** Filter MLS search hits for manual search / picker (buyer vs seller). */
export function resolveGhlHitsForSearch(
  hits: GhlContactSearchHit[],
  opts?: { agentRole?: ListingAgentRole | null; contactId?: string | null }
): { visible: GhlContactSearchHit[]; autoPick: GhlContactSearchHit | null } {
  const contactId = opts?.contactId?.trim();
  if (contactId) {
    const byId = hits.find((h) => h.id === contactId);
    if (byId) return { visible: [byId], autoPick: byId };
  }

  const role = opts?.agentRole;
  if (role) {
    const visible = filterGhlHitsByAgentRole(hits, role, { strict: true });
    if (visible.length === 1) return { visible, autoPick: visible[0]! };
    return { visible, autoPick: null };
  }

  return { visible: hits, autoPick: null };
}

/** Canonical /listed|sold|buyer/mls/… from loaded listing data. */
export function campaignPathFromListingPayload(
  listing: Pick<ListingPayload, "listingType" | "campaignType" | "agentType">
): MlsCampaignPathSegment | null {
  const fromListing = campaignPathFromListingType(listing.listingType);
  if (fromListing) return fromListing;
  const fromGhl = agentRoleFromGhlHit({
    agentType: listing.agentType ?? null,
    listingType: listing.listingType ?? null,
  });
  if (fromGhl === "buyer") return "buyer";
  if (fromGhl === "seller") return listing.campaignType === "just_sold" ? "seller" : "listed";
  if (listing.campaignType === "just_sold") return "seller";
  if (listing.campaignType === "just_listed") return "listed";
  return null;
}

/** @deprecated use campaignPathFromListingPayload */
export function agentRoleFromListingPayload(
  listing: Pick<ListingPayload, "listingType" | "campaignType" | "agentType">
): ListingAgentRole | null {
  const path = campaignPathFromListingPayload(listing);
  if (path) return path === "buyer" ? "buyer" : "seller";
  const fromGhl = agentRoleFromGhlHit({
    agentType: listing.agentType ?? null,
    listingType: listing.listingType ?? null,
  });
  if (fromGhl) return fromGhl;
  if (listing.campaignType === "just_sold") return "seller";
  if (listing.campaignType === "just_listed") return "buyer";
  return null;
}
