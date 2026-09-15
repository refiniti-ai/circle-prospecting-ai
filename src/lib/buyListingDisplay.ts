import { formatCityStateZip } from "./placesAddress";
import type { ListingCampaignType, ListingFormValues, ListingPayload, RadiusId } from "./listingData";
import { radiusRingLabel } from "./listingData";
import type { MlsCampaignPathSegment } from "./mlsCampaignPath";

export type ListingDisplayFields = {
  street: string;
  cityLine: string;
  mls: string;
  streetDisplay: string;
  campaignLabel: string;
  campaignBadge: string;
  campaignPrefix: string;
  campaignDisplayKind: "just_listed" | "just_sold" | "coming_soon";
  mlsMeta: string;
};

/** City/state line only when we have a real city — avoids orphan values like "FL". */
export function listingCityLine(
  form: Pick<ListingFormValues, "city" | "stateCode" | "zip">,
  listing: Pick<ListingPayload, "cityStateZip">
): string {
  const city = form.city.trim();
  if (city) {
    return formatCityStateZip(city, form.stateCode, form.zip);
  }
  const csz = listing.cityStateZip.trim();
  return csz.includes(",") ? csz : "";
}

export function resolveListingDisplayFields(
  form: ListingFormValues,
  listing: ListingPayload,
  campaignType: ListingCampaignType,
  campaignPath?: MlsCampaignPathSegment | null
): ListingDisplayFields {
  const street = form.streetAddress.trim() || listing.address.trim();
  const cityLine = listingCityLine(form, listing);
  const mls = form.mls.trim() || listing.mls.trim();
  const comingSoon = campaignPath === "cs";
  const campaignDisplayKind = comingSoon ? "coming_soon" : campaignType;
  const campaignLabel = comingSoon ? "Coming Soon" : campaignType === "just_listed" ? "Just Listed" : "Just Sold";
  const campaignBadge = comingSoon ? "COMING SOON" : campaignType === "just_listed" ? "JUST LISTED" : "JUST SOLD";
  const campaignPrefix = comingSoon ? "Coming soon" : campaignType === "just_listed" ? "Just listed" : "Just sold";
  const mlsMeta = `MLS # ${mls || "—"} | Single Family`;

  return {
    street,
    cityLine,
    mls,
    streetDisplay: street,
    campaignLabel,
    campaignBadge,
    campaignPrefix,
    campaignDisplayKind,
    mlsMeta,
  };
}

export function radiusSummaryLine(radiusId: RadiusId, label: string, count: number): string {
  return `${radiusRingLabel(radiusId, label)} • ${count.toLocaleString()} homes`;
}
