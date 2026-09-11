import {
  PALM_HARBOR_LISTING,
  applyListingFormValues,
  normalizeListingFormValues,
  parseListingAddressLine,
  type ListingCampaignType,
  type ListingFormValues,
  type ListingPayload,
  type RadiusId,
} from "./listingData";
import { campaignTypeFromListingType } from "./listingCampaignType";

export { parseListingAddressLine } from "./listingData";

/** Placeholder MLS from manual form entry — not a real board MLS number. */
export function isDraftMls(mls: string | null | undefined): boolean {
  return /^DRAFT[-_]/i.test((mls ?? "").trim());
}

/** First non-empty MLS that is not a DRAFT placeholder. */
export function resolveRealMls(...candidates: (string | null | undefined)[]): string | undefined {
  for (const raw of candidates) {
    const t = (raw ?? "").trim();
    if (t && !isDraftMls(t)) return t;
  }
  return undefined;
}

export type GhlListingPrefill = {
  name: string;
  email: string | null;
  phone: string | null;
  mls: string | null;
  listingAddress: string | null;
  listingPhotoUrl?: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  realtorName: string | null;
  brokerageName: string | null;
  listingType?: string | null;
  agentType?: string | null;
  subdivisionHomeOwners?: string | null;
  oneFourthMileHomeOwners?: string | null;
  halfMileHomeOwners?: string | null;
  oneMileHomeOwners?: string | null;
  zipcodeHomeOwners?: string | null;
};

function parseGhlHomeCount(v: string | null | undefined): number | null {
  if (v == null || String(v).trim() === "") return null;
  const n = Number.parseInt(String(v).replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function mergeRadiiFromGhl(
  base: ListingPayload["radii"],
  counts: {
    subdivision?: string | null;
    q1?: string | null;
    h1?: string | null;
    m1?: string | null;
    zip?: string | null;
  }
): ListingPayload["radii"] {
  const next = { ...base };
  const apply = (id: RadiusId, raw: string | null | undefined) => {
    const n = parseGhlHomeCount(raw);
    if (n != null) next[id] = { ...next[id], count: n };
  };
  apply("subdivision", counts.subdivision);
  apply("q1", counts.q1);
  apply("h1", counts.h1);
  apply("m1", counts.m1);
  apply("zip", counts.zip);
  return next;
}

export function ghlHitToListingForm(hit: GhlListingPrefill): ListingFormValues {
  const fromAddr = parseListingAddressLine(hit.listingAddress || "");
  return normalizeListingFormValues({
    mls: (hit.mls || "").trim(),
    agentName: (hit.realtorName || hit.name || "").trim(),
    email: (hit.email || "").trim(),
    phone: (hit.phone || "").trim(),
    brokerage: (hit.brokerageName || "").trim(),
    streetAddress: fromAddr.streetAddress,
    city: fromAddr.city || (hit.city || "").trim(),
    stateCode: fromAddr.stateCode || (hit.state || "").trim().toUpperCase().slice(0, 2),
    zip: fromAddr.zip || (hit.zip || "").trim().replace(/\D/g, "").slice(0, 5),
  });
}

/** Build a checkout-ready listing from manual / search form values. */
export function buildDraftListingFromForm(
  form: ListingFormValues,
  geo?: { lat: number; lng: number; county?: string },
  campaignType: ListingCampaignType = "just_listed",
  listingType?: string | null,
  listingPhotoUrl?: string | null
): ListingPayload {
  const mls = form.mls.trim().toUpperCase() || `DRAFT-${Date.now()}`;
  const base: ListingPayload = {
    ...PALM_HARBOR_LISTING,
    id: mls.toLowerCase(),
    internalId: Date.now(),
    mls,
    campaignType,
    listingType: listingType ?? undefined,
    listingPhotoUrl: listingPhotoUrl?.trim() || undefined,
    lat: 0,
    lng: 0,
  };
  return applyListingFormValues(base, form, geo);
}

/** GHL contact prefill → listing payload (radii + photo from custom fields). */
export function buildListingFromGhlPrefill(
  hit: GhlListingPrefill,
  geo?: { lat: number; lng: number; county?: string }
): ListingPayload {
  const form = ghlHitToListingForm(hit);
  const campaign = campaignTypeFromListingType(hit.listingType) ?? "just_listed";
  let listing = buildDraftListingFromForm(form, geo, campaign, hit.listingType, hit.listingPhotoUrl);
  listing = {
    ...listing,
    agentType: hit.agentType ?? undefined,
    radii: mergeRadiiFromGhl(listing.radii, {
      subdivision: hit.subdivisionHomeOwners,
      q1: hit.oneFourthMileHomeOwners,
      h1: hit.halfMileHomeOwners,
      m1: hit.oneMileHomeOwners,
      zip: hit.zipcodeHomeOwners,
    }),
  };
  return listing;
}
