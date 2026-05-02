export type RadiusId = "subdivision" | "q1" | "h1" | "m1" | "zip";

export type ListingPayload = {
  id: string;
  internalId: number;
  mls: string;
  address: string;
  cityStateZip: string;
  county: string;
  listPrice: string;
  agentName: string;
  email: string;
  phone: string;
  brokerage: string;
  lat: number;
  lng: number;
  zip: string;
  createdAt?: string;
  radii: Record<RadiusId, { label: string; count: number }>;
};

/** Demo data from your spec — API can replace this at runtime. */
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
  createdAt: "2026-04-09T16:01:00.000Z",
  radii: {
    subdivision: { label: "Subdivision", count: 8 },
    q1: { label: "¼ Mile", count: 134 },
    h1: { label: "½ Mile", count: 739 },
    m1: { label: "1 Mile", count: 4035 },
    zip: { label: "ZIP (34698)", count: 16766 },
  },
};

/** Offline / resilience fallback (same shape as the API). */
export function getLocalDemoOrder(id: string | undefined): ListingPayload | null {
  if (!id) return null;
  if (id === SAMPLE_LISTING.id || id === String(SAMPLE_LISTING.internalId)) {
    return SAMPLE_LISTING;
  }
  if (!/^\d+$/.test(id)) return null;
  const n = Number.parseInt(id, 10);
  return { ...SAMPLE_LISTING, id, internalId: Number.isFinite(n) ? n : SAMPLE_LISTING.internalId };
}
