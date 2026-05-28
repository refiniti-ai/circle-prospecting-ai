import type { ListingAgentInfo } from "./listingAgents";
import { formatCityStateZip } from "./placesAddress";

export type RadiusId = "subdivision" | "q1" | "h1" | "m1" | "zip";

export const LISTING_RADIUS_ORDER: readonly RadiusId[] = ["subdivision", "q1", "h1", "m1", "zip"] as const;

/** Miles sent to lead-count / checkout when a listing ring is selected. */
export function radiusMilesFromId(id: RadiusId): number {
  switch (id) {
    case "subdivision":
      return 0.15;
    case "q1":
      return 0.25;
    case "h1":
      return 0.5;
    case "m1":
      return 1;
    case "zip":
      return 3;
    default:
      return 1;
  }
}

export type ListingCampaignType = "just_listed" | "just_sold";

export type ListingPayload = {
  id: string;
  internalId: number;
  mls: string;
  address: string;
  cityStateZip: string;
  county: string;
  listPrice: string;
  /** Legacy primary agent — kept in sync with seller when present. */
  agentName: string;
  email: string;
  phone: string;
  brokerage: string;
  sellerAgent?: ListingAgentInfo;
  buyerAgent?: ListingAgentInfo;
  lat: number;
  lng: number;
  zip: string;
  /** When set, Buy Leads uses this instead of manual campaign selection. */
  campaignType?: ListingCampaignType;
  createdAt?: string;
  radii: Record<RadiusId, { label: string; count: number }>;
};

export type ListingFormValues = {
  mls: string;
  agentName: string;
  email: string;
  phone: string;
  brokerage: string;
  streetAddress: string;
  city: string;
  stateCode: string;
  zip: string;
};

export function listingFormValuesFromPayload(l: ListingPayload): ListingFormValues {
  const { city, stateCode, zip } = parseListingLocation(l);
  return {
    mls: l.mls,
    agentName: l.agentName,
    email: l.email,
    phone: l.phone,
    brokerage: l.brokerage,
    streetAddress: l.address,
    city,
    stateCode,
    zip: l.zip || zip,
  };
}

export function applyListingFormValues(
  l: ListingPayload,
  v: ListingFormValues,
  geo?: { lat?: number; lng?: number; county?: string }
): ListingPayload {
  const cityStateZip = formatCityStateZip(v.city, v.stateCode, v.zip) || l.cityStateZip;
  return {
    ...l,
    mls: v.mls.trim() || l.mls,
    agentName: v.agentName.trim() || l.agentName,
    email: v.email.trim(),
    phone: v.phone.trim(),
    brokerage: v.brokerage.trim(),
    address: v.streetAddress.trim() || l.address,
    cityStateZip,
    zip: v.zip.trim() || l.zip,
    county: (geo?.county?.trim() || l.county).replace(/\s+County$/i, "") || l.county,
    lat: geo?.lat ?? l.lat,
    lng: geo?.lng ?? l.lng,
  };
}

const EMPTY_LISTING_FORM: ListingFormValues = {
  mls: "",
  agentName: "",
  email: "",
  phone: "",
  brokerage: "",
  streetAddress: "",
  city: "",
  stateCode: "FL",
  zip: "",
};

export function emptyListingFormValues(): ListingFormValues {
  return { ...EMPTY_LISTING_FORM };
}

export function listingAddressGeocodeQuery(v: ListingFormValues): string {
  return [v.streetAddress, v.city, v.stateCode, v.zip, "USA"].filter((p) => p.trim().length > 0).join(", ").trim();
}

/** Parse `Palm Harbor, FL 34685` from listing records. */
export function parseListingLocation(l: ListingPayload): { city: string; stateCode: string; zip: string } {
  const m = l.cityStateZip.match(/^([^,]+),\s*([A-Z]{2})\s+(\d{5})/);
  return {
    city: (m?.[1] ?? "").trim(),
    stateCode: (m?.[2] ?? "FL").trim(),
    zip: (l.zip || m?.[3] || "").trim(),
  };
}

/**
 * Demo listing (Dunedin, FL) for maps, order previews, and `/order/948`—replace via API in production.
 * Agent/broker fields reflect a realistic campaign example, not an endorsement.
 */
export const SAMPLE_LISTING: ListingPayload = {
  id: "948",
  internalId: 948,
  mls: "TB8494774",
  address: "1840 SALEM CT",
  cityStateZip: "Dunedin, FL 34698",
  county: "Pinellas",
  listPrice: "$950,000",
  agentName: "Jeffrey Borham, PA",
  email: "jeff@jeffborham.com",
  phone: "866-308-7109",
  brokerage: "EXP Realty LLC",
  lat: 28.0028,
  lng: -82.7897,
  zip: "34698",
  campaignType: "just_listed",
  createdAt: "2026-04-09T16:01:00.000Z",
  radii: {
    subdivision: { label: "Subdivision", count: 8 },
    q1: { label: "¼ Mile", count: 134 },
    h1: { label: "½ Mile", count: 739 },
    m1: { label: "1 Mile", count: 4035 },
    zip: { label: "ZIP (34698)", count: 16766 },
  },
};

/** Palm Harbor example from client workflow mock (TB8502524). */
export const PALM_HARBOR_LISTING: ListingPayload = {
  id: "tb8502524",
  internalId: 8502524,
  mls: "TB8502524",
  address: "1775 STABLE TRL",
  cityStateZip: "Palm Harbor, FL 34685",
  county: "Pinellas",
  listPrice: "$—",
  agentName: "Jeffrey Borham, PA",
  email: "jeff@jeffborham.com",
  phone: "866-308-7109",
  brokerage: "EXP REALTY LLC",
  lat: 28.078,
  lng: -82.737,
  zip: "34685",
  campaignType: "just_listed",
  createdAt: "2026-05-16T12:00:00.000Z",
  radii: {
    subdivision: { label: "Subdivision", count: 50 },
    q1: { label: "1/4 Mile", count: 370 },
    h1: { label: "1/2 Mile", count: 789 },
    m1: { label: "1 Mile", count: 3359 },
    zip: { label: "34685 ZipCode", count: 7319 },
  },
};

/** Client example 1 — buyer agent orders (St Petersburg). */
export const ST_PETE_DUAL_AGENT_LISTING: ListingPayload = {
  id: "tb8479039",
  internalId: 8479039,
  mls: "TB8479039",
  address: "467 31ST AVE N",
  cityStateZip: "Saint Petersburg, FL 33704",
  county: "Pinellas",
  listPrice: "$—",
  agentName: "Elizabeth Miller",
  email: "elizmiller1@aol.com",
  phone: "727-415-9991",
  brokerage: "MILLER REALTY & MANAGEMENT",
  sellerAgent: {
    name: "Elizabeth Miller",
    email: "elizmiller1@aol.com",
    phone: "727-415-9991",
    brokerage: "MILLER REALTY & MANAGEMENT",
  },
  buyerAgent: {
    name: "Ken Lenoir",
    email: "ken@stpeteluxuryrealtors.com",
    phone: "727-423-1078",
    brokerage: "KELLER WILLIAMS ST PETE REALTY",
  },
  lat: 27.7912,
  lng: -82.6342,
  zip: "33704",
  campaignType: "just_listed",
  createdAt: "2026-05-18T12:00:00.000Z",
  radii: {
    subdivision: { label: "Subdivision", count: 55 },
    q1: { label: "1/4 Mile", count: 459 },
    h1: { label: "1/2 Mile", count: 1569 },
    m1: { label: "1 Mile", count: 6488 },
    zip: { label: "33704 ZipCode", count: 6957 },
  },
};

/** Client example 2 — seller agent Just sold order (Tarpon Springs). */
export const TARPON_DUAL_AGENT_LISTING: ListingPayload = {
  id: "tb8445798",
  internalId: 8445798,
  mls: "TB8445798",
  address: "1933 GOLFVIEW DR #1933",
  cityStateZip: "Tarpon Springs, FL 34689",
  county: "Pinellas",
  listPrice: "$—",
  agentName: "Drew Moser",
  email: "drewmoserrealtor@gmail.com",
  phone: "727-641-0151",
  brokerage: "EXP REALTY LLC",
  sellerAgent: {
    name: "Drew Moser",
    email: "drewmoserrealtor@gmail.com",
    phone: "727-641-0151",
    brokerage: "EXP REALTY LLC",
  },
  buyerAgent: {
    name: "Jenny Neumeyer",
    email: "flrealtorjenny@gmail.com",
    phone: "727-482-2656",
    brokerage: "KELLER WILLIAMS REALTY- PALM H",
  },
  lat: 28.131,
  lng: -82.756,
  zip: "34689",
  campaignType: "just_sold",
  createdAt: "2026-05-18T12:00:00.000Z",
  radii: {
    subdivision: { label: "Subdivision", count: 96 },
    q1: { label: "1/4 Mile", count: 459 },
    h1: { label: "1/2 Mile", count: 760 },
    m1: { label: "1 Mile", count: 3900 },
    zip: { label: "34689 ZipCode", count: 11900 },
  },
};

const LOCAL_BY_MLS: Record<string, ListingPayload> = {
  [SAMPLE_LISTING.mls.toUpperCase()]: SAMPLE_LISTING,
  [PALM_HARBOR_LISTING.mls.toUpperCase()]: PALM_HARBOR_LISTING,
  [ST_PETE_DUAL_AGENT_LISTING.mls.toUpperCase()]: ST_PETE_DUAL_AGENT_LISTING,
  [TARPON_DUAL_AGENT_LISTING.mls.toUpperCase()]: TARPON_DUAL_AGENT_LISTING,
};

/** Offline / resilience fallback (same shape as the API). */
export function getLocalDemoOrder(id: string | undefined): ListingPayload | null {
  if (!id) return null;
  const key = id.trim();
  const byMls = LOCAL_BY_MLS[key.toUpperCase()];
  if (byMls) return byMls;
  if (key === SAMPLE_LISTING.id || key === String(SAMPLE_LISTING.internalId)) {
    return SAMPLE_LISTING;
  }
  if (
    key.toLowerCase() === PALM_HARBOR_LISTING.id.toLowerCase() ||
    key === String(PALM_HARBOR_LISTING.internalId)
  ) {
    return PALM_HARBOR_LISTING;
  }
  if (key.toUpperCase() === ST_PETE_DUAL_AGENT_LISTING.mls) return ST_PETE_DUAL_AGENT_LISTING;
  if (key.toUpperCase() === TARPON_DUAL_AGENT_LISTING.mls) return TARPON_DUAL_AGENT_LISTING;
  if (!/^\d+$/.test(key)) return null;
  const n = Number.parseInt(key, 10);
  return { ...SAMPLE_LISTING, id: key, internalId: Number.isFinite(n) ? n : SAMPLE_LISTING.internalId };
}

/** Resolve listing from `?order=` or `?mls=` (API first; caller falls back to local). */
export function resolveLocalListing(ref: string | undefined): ListingPayload | null {
  return getLocalDemoOrder(ref);
}
