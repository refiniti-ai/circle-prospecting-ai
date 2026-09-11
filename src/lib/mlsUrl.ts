import type { ListingAgentRole } from "./listingAgents";
import type { ListingCampaignType } from "./listingData";
import {
  parseMlsCampaignPathSegment,
  resolveCampaignPath,
  type MlsCampaignPathSegment,
} from "./mlsCampaignPath";

/**
 * Canonical Buy Leads paths:
 * - /listed/mls/TB8500940 | /seller/mls/TB8500940 | /buyer/mls/TB8500940
 * - Legacy: /mls/TB8500940 (?campaign= still supported)
 */
export function buildMlsLeadsPath(
  mls: string,
  opts?: {
    campaignPath?: MlsCampaignPathSegment;
    /** @deprecated use campaignPath — seller→sold, buyer→buyer */
    agent?: ListingAgentRole;
    campaign?: ListingCampaignType;
    radius?: string;
    contactId?: string;
  }
): string {
  const id = mls.trim();
  if (!id) return "/buy-leads";
  const encoded = encodeURIComponent(id);

  const campaignPath =
    opts?.campaignPath ??
    (opts?.agent ? resolveCampaignPath({ agentRole: opts.agent }) : undefined);

  const path = campaignPath ? `/${campaignPath}/mls/${encoded}` : `/mls/${encoded}`;
  const qs = new URLSearchParams();
  if (opts?.campaign) qs.set("campaign", opts.campaign);
  if (opts?.radius) qs.set("radius", opts.radius);
  const contactId = opts?.contactId?.trim();
  if (contactId) qs.set("c", contactId);
  const q = qs.toString();
  return q ? `${path}?${q}` : path;
}

/** Full site path (same as buildMlsLeadsPath) for router navigate / Link. */
export function buildMlsLeadsUrl(
  mls: string,
  opts?: {
    campaignPath?: MlsCampaignPathSegment;
    agent?: ListingAgentRole;
    campaign?: ListingCampaignType;
    radius?: string;
    contactId?: string;
  }
): string {
  return buildMlsLeadsPath(mls, opts);
}

export function decodeMlsPathParam(raw: string | undefined): string {
  if (!raw) return "";
  try {
    return decodeURIComponent(raw).trim();
  } catch {
    return raw.trim();
  }
}

/** First path segment when route is /{segment}/mls/:mls */
export function campaignPathFromLocationPathname(pathname: string): MlsCampaignPathSegment | null {
  const seg = pathname.split("/").filter(Boolean)[0];
  return parseMlsCampaignPathSegment(seg);
}
