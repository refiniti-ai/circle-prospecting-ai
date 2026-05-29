import {
  PALM_HARBOR_LISTING,
  applyListingFormValues,
  type ListingCampaignType,
  type ListingFormValues,
  type ListingPayload,
} from "./listingData";

/** Parse "123 Main St, Tampa, FL 33601" or messy GHL lines into form fields. */
export function parseListingAddressLine(line: string): Pick<ListingFormValues, "streetAddress" | "city" | "stateCode" | "zip"> {
  const raw = line.trim();
  if (!raw) return { streetAddress: "", city: "", stateCode: "", zip: "" };

  const trailing = raw.match(/,\s*([^,]+?),\s*([A-Za-z]{2})\s+(\d{5})(?:-\d{4})?\s*$/);
  if (trailing) {
    const city = trailing[1].trim();
    const stateCode = trailing[2].toUpperCase();
    const zip = trailing[3];
    let streetAddress = raw.slice(0, trailing.index).replace(/,\s*$/, "").trim();
    const dupTail = new RegExp(
      `,\\s*${city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*,\\s*${stateCode}\\s*,?\\s*${zip}.*$`,
      "i"
    );
    streetAddress = streetAddress.replace(dupTail, "").trim();
    if (!streetAddress && raw.includes(",")) {
      streetAddress = raw.split(",")[0]?.trim() || raw;
    }
    return { streetAddress, city, stateCode, zip };
  }

  const withZip = raw.match(/^(.+?),\s*([^,]+?),\s*([A-Za-z]{2})\s+(\d{5})(?:-\d{4})?$/);
  if (withZip) {
    return {
      streetAddress: withZip[1].trim(),
      city: withZip[2].trim(),
      stateCode: withZip[3].toUpperCase(),
      zip: withZip[4],
    };
  }
  const noZip = raw.match(/^(.+?),\s*([^,]+?),\s*([A-Za-z]{2})$/);
  if (noZip) {
    return {
      streetAddress: noZip[1].trim(),
      city: noZip[2].trim(),
      stateCode: noZip[3].toUpperCase(),
      zip: "",
    };
  }
  return { streetAddress: raw, city: "", stateCode: "", zip: "" };
}

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
  return {
    mls: (hit.mls || "").trim(),
    agentName: (hit.realtorName || hit.name || "").trim(),
    email: (hit.email || "").trim(),
    phone: (hit.phone || "").trim(),
    brokerage: (hit.brokerageName || "").trim(),
    streetAddress: fromAddr.streetAddress,
    city: fromAddr.city || (hit.city || "").trim(),
    stateCode: fromAddr.stateCode || (hit.state || "").trim().toUpperCase().slice(0, 2),
    zip: fromAddr.zip || (hit.zip || "").trim().replace(/\D/g, "").slice(0, 5),
  };
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
