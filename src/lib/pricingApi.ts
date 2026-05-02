import { apiBase } from "./apiBase";
import type { CampaignTier, PlanId } from "./pricing";

export type PricingApiResponse = {
  tiers: { min: number; max: number | null; rates: Record<PlanId, number> }[];
};

function pricingUrl(): string {
  const b = apiBase();
  return b ? `${b}/api/pricing` : "/api/pricing";
}

export function normalizeApiTiers(rows: PricingApiResponse["tiers"]): CampaignTier[] {
  return rows.map((r) => ({
    min: r.min,
    max: r.max == null ? Number.POSITIVE_INFINITY : r.max,
    rates: r.rates,
  }));
}

export async function fetchCampaignPricing(signal?: AbortSignal): Promise<PricingApiResponse> {
  const res = await fetch(pricingUrl(), { signal });
  if (!res.ok) throw new Error(`pricing ${res.status}`);
  return (await res.json()) as PricingApiResponse;
}
