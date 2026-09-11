import { apiBase } from "./apiBase";
import { campaignTypeFromListingType } from "./listingCampaignType";
import type { ListingCampaignType } from "./listingData";

export const INTRO_MAX_AGENT_SEARCH_HITS = 3;
export const INTRO_MAX_LISTINGS_PER_KIND = 1;

export type IntroListingKind = "listed" | "sold" | "buyer";

export type IntroGhlOpportunitySummary = {
  id: string;
  name: string | null;
  mls: string | null;
  listingAddress: string | null;
  listingType: string | null;
  createdAt: string | null;
  payLinkUrl: string | null;
  finalLinkUrl: string | null;
};

export type IntroListingOption = IntroGhlOpportunitySummary & {
  campaignType: ListingCampaignType;
  kind: IntroListingKind;
};

function opportunityMls(opp: IntroGhlOpportunitySummary): string | null {
  const m = (opp.mls || "").trim();
  return m.length >= 3 ? m.toUpperCase() : null;
}

function opportunityUrls(opp: IntroGhlOpportunitySummary): string {
  return `${opp.payLinkUrl || ""} ${opp.finalLinkUrl || ""}`.toLowerCase();
}

function isBuyerSideOpportunity(opp: IntroGhlOpportunitySummary): boolean {
  const url = opportunityUrls(opp);
  if (/\/buyer\/mls\//.test(url)) return true;

  const listingType = (opp.listingType || "").toLowerCase();
  if (listingType.includes("buyer")) return true;

  const name = (opp.name || "").toLowerCase();
  return name.includes("buyer") || name.includes("buy side");
}

function isSoldOpportunity(opp: IntroGhlOpportunitySummary): boolean {
  const fromField = campaignTypeFromListingType(opp.listingType);
  if (fromField === "just_sold") return true;

  const url = opportunityUrls(opp);
  if (/\/seller\/mls\//.test(url) || /\/sold\/mls\//.test(url)) return true;

  const name = (opp.name || "").toLowerCase();
  return name.includes("just sold") || /\bsold\b/.test(name);
}

function classifyIntroListing(opp: IntroGhlOpportunitySummary): IntroListingKind | null {
  if (isBuyerSideOpportunity(opp)) return "buyer";
  if (isSoldOpportunity(opp)) return "sold";

  const fromField = campaignTypeFromListingType(opp.listingType);
  if (fromField === "just_listed") return "listed";

  const url = opportunityUrls(opp);
  if (/\/listed\/mls\//.test(url)) return "listed";

  const name = (opp.name || "").toLowerCase();
  if (name.includes("just listed") || /\blisted\b/.test(name)) return "listed";

  return null;
}

function campaignTypeForKind(kind: IntroListingKind): ListingCampaignType {
  return kind === "sold" ? "just_sold" : "just_listed";
}

function sortNewestFirst(rows: IntroGhlOpportunitySummary[]): IntroGhlOpportunitySummary[] {
  return [...rows].sort((a, b) => {
    const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
    const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
    if (tb !== ta) return tb - ta;
    return (b.mls || "").localeCompare(a.mls || "");
  });
}

function dedupeByMls(rows: IntroGhlOpportunitySummary[]): IntroGhlOpportunitySummary[] {
  const seen = new Set<string>();
  const out: IntroGhlOpportunitySummary[] = [];
  for (const row of rows) {
    const mls = opportunityMls(row);
    if (!mls || seen.has(mls)) continue;
    seen.add(mls);
    out.push(row);
  }
  return out;
}

/** Latest listing, sold, and buyer-side close — one each when available. */
export function pickIntroListingOptions(
  opportunities: IntroGhlOpportunitySummary[],
  maxPerKind = INTRO_MAX_LISTINGS_PER_KIND
): { listed: IntroListingOption[]; sold: IntroListingOption[]; buyer: IntroListingOption[] } {
  const withMls = dedupeByMls(sortNewestFirst(opportunities.filter((o) => opportunityMls(o))));

  const listed: IntroListingOption[] = [];
  const sold: IntroListingOption[] = [];
  const buyer: IntroListingOption[] = [];

  for (const row of withMls) {
    const kind = classifyIntroListing(row);
    if (!kind) continue;

    const option: IntroListingOption = {
      ...row,
      kind,
      campaignType: campaignTypeForKind(kind),
    };

    if (kind === "listed" && listed.length < maxPerKind) listed.push(option);
    else if (kind === "sold" && sold.length < maxPerKind) sold.push(option);
    else if (kind === "buyer" && buyer.length < maxPerKind) buyer.push(option);
  }

  return { listed, sold, buyer };
}

export async function fetchIntroContactOpportunities(
  contactId: string,
  signal?: AbortSignal
): Promise<IntroGhlOpportunitySummary[]> {
  const cid = contactId.trim();
  const r = await fetch(`${apiBase()}/api/ghl-contacts/${encodeURIComponent(cid)}/opportunities`, {
    method: "GET",
    signal,
    headers: { Accept: "application/json" },
  });
  if (!r.ok) {
    const j = (await r.json().catch(() => ({}))) as { message?: string };
    throw new Error(j.message || "Could not load agent listings.");
  }
  const j = (await r.json()) as { opportunities?: IntroGhlOpportunitySummary[] };
  return Array.isArray(j.opportunities) ? j.opportunities : [];
}
