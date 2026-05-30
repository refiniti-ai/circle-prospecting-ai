import {
  PALM_HARBOR_LISTING,
  applyListingFormValues,
  normalizeListingFormValues,
  parseListingAddressLine,
  type ListingCampaignType,
  type ListingFormValues,
  type ListingPayload,
} from "./listingData";

export { parseListingAddressLine } from "./listingData";

export function ghlHitToListingForm(hit: {
  name: string;
  email: string | null;
  phone: string | null;
  mls: string | null;
  listingAddress: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  realtorName: string | null;
  brokerageName: string | null;
}): ListingFormValues {
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
  geo: { lat: number; lng: number; county?: string },
  campaignType: ListingCampaignType = "just_listed"
): ListingPayload {
  const mls = form.mls.trim().toUpperCase() || `DRAFT-${Date.now()}`;
  const base: ListingPayload = {
    ...PALM_HARBOR_LISTING,
    id: mls.toLowerCase(),
    internalId: Date.now(),
    mls,
    campaignType,
  };
  return applyListingFormValues(base, form, geo);
}
