import { getCampaignTiers, type PlanId } from "./pricingGrid.js";

export type { PlanId } from "./pricingGrid.js";

export function getUnitPrice(homeCount: number, plan: PlanId): number {
  const tiers = getCampaignTiers();
  const n = Math.max(0, Math.floor(homeCount));
  for (const t of tiers) {
    if (n >= t.min && n <= t.max) return t.rates[plan];
  }
  return tiers[0].rates[plan];
}

export function dollarsToCents(amount: number): number {
  return Math.round(amount * 100);
}
