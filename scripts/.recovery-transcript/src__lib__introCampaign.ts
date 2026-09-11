import { apiBase } from "./apiBase";
import type { BuyLeadsSearchResult } from "../components/BuyLeadsSearch";
import {
  listingFormValuesFromPayload,
  type ListingFormValues,
  type ListingPayload,
} from "./listingData";
import { buildDraftListingFromForm } from "./listingDraft";
import type { CampaignPropertyType } from "./leadsApi";
import type { LeadServiceLine, LeadTierId } from "./leadPricing";

import { firstTimeCustomerAgentPath } from "./introAgentPhone";

export const INTRO_CAMPAIGN = {
  path: "/first-time-customer",
  checkoutPath: "/first-time-customer/checkout",
  /** Shareable link — loads latest listings for the $99 intro offer. */
  agentPath: firstTimeCustomerAgentPath,
  storageKey: "cpai_intro_campaign_draft",
  /** Mobile + laptop hero — public/marketing/first-customer-banner.webp */
  bannerImage: "/marketing/first-customer-banner.webp",
  /** Large desktop only (≥1440px) — wide crop for short hero, no extra zoom */
  bannerImageDesktop: "/marketing/first-time-customer-desktop-wide.webp",
  homes: 250,
  priceCents: 9900,
  priceUsd: 99,
  serviceLine: "live_callers" as LeadServiceLine,
  leadTier: "starter" as LeadTierId,
  checkoutType: "intro_campaign",
} as const;

export type IntroCampaignDraft = {
  listing: ListingPayload;
  form: ListingFormValues;
  mapLat: number;
  mapLng: number;
  county: string;
  campaignType?: CampaignPropertyType;
  agentRole?: "buyer" | "seller";
};

export function draftFromSearchResult(result: BuyLeadsSearchResult): IntroCampaignDraft {
  if (result.kind === "listing") {
    const listing = result.listing;
    const form = listingFormValuesFromPayload(listing);
    return {
      listing,
      form,
      mapLat: listing.lat,
      mapLng: listing.lng,
      county: listing.county,
      campaignType: listing.campaignType,
    };
  }
  const listing = buildDraftListingFromForm(result.form, result.geo, "just_listed");
  return {
    listing,
    form: result.form,
    mapLat: result.geo.lat,
    mapLng: result.geo.lng,
    county: result.geo.county,
    campaignType: "just_listed",
  };
}

export function saveIntroCampaignDraft(draft: IntroCampaignDraft): void {
  sessionStorage.setItem(INTRO_CAMPAIGN.storageKey, JSON.stringify(draft));
}

export function readIntroCampaignDraft(): IntroCampaignDraft | null {
  try {
    const raw = sessionStorage.getItem(INTRO_CAMPAIGN.storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as IntroCampaignDraft;
    if (!parsed?.listing || !parsed?.form) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearIntroCampaignDraft(): void {
  sessionStorage.removeItem(INTRO_CAMPAIGN.storageKey);
}

export async function checkIntroEligibility(
  email: string,
  signal?: AbortSignal
): Promise<{ eligible: boolean; reason?: string; message?: string }> {
  const r = await fetch(
    `${apiBase()}/api/public/intro-eligibility?email=${encodeURIComponent(email.trim())}`,
    { signal, headers: { Accept: "application/json" } }
  );
  if (!r.ok) {
    return { eligible: false, reason: "check_failed", message: "Could not verify offer eligibility." };
  }
  return (await r.json()) as { eligible: boolean; reason?: string; message?: string };
}

export type IntroCheckoutContext = {
  city?: string;
  county?: string;
  zip?: string;
  radiusMiles?: number;
  campaignType?: CampaignPropertyType;
  agentRole?: "buyer" | "seller";
  mls?: string;
  listingAddress?: string;
  agentName?: string;
  brokerage?: string;
  radiusLabel?: string;
};

export async function startIntroCheckout(
  email: string,
  phone: string,
  context?: IntroCheckoutContext,
  signal?: AbortSignal
): Promise<{ url: string; sessionId: string; unitAmountCents: number }> {
  const r = await fetch(`${apiBase()}/api/checkout/intro-campaign`, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      email,
      phone,
      city: context?.city,
      county: context?.county,
      zip: context?.zip,
      radiusMiles: context?.radiusMiles,
      campaignType: context?.campaignType,
      agentRole: context?.agentRole,
      mls: context?.mls,
      listingAddress: context?.listingAddress,
      agentName: context?.agentName,
      brokerage: context?.brokerage,
      radiusLabel: context?.radiusLabel,
    }),
  });
  const data = (await r.json()) as {
    url?: string;
    sessionId?: string;
    unitAmountCents?: number;
    message?: string;
    error?: string;
  };
  if (!r.ok) {
    throw new Error(data.message || data.error || "Checkout could not start.");
  }
  if (!data.url || !data.sessionId) {
    throw new Error("Checkout response was incomplete.");
  }
  return {
    url: data.url,
    sessionId: data.sessionId,
    unitAmountCents: data.unitAmountCents ?? INTRO_CAMPAIGN.priceCents,
  };
}
