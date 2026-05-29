export type PlanId = "ai" | "live" | "pro";

export type CampaignTier = { min: number; max: number; rates: Record<PlanId, number> };

/** Bundled fallback when API is offline — align with operator tier grid (`server/data/pricing-grid.csv`). */
export const DEFAULT_CAMPAIGN_TIERS: CampaignTier[] = [
  { min: 0, max: 250, rates: { ai: 0.5, live: 0.5, pro: 0.5 } },
  { min: 251, max: 500, rates: { ai: 0.5, live: 0.5, pro: 0.5 } },
  { min: 501, max: 1000, rates: { ai: 0.5, live: 0.5, pro: 0.5 } },
  { min: 1001, max: 2500, rates: { ai: 0.5, live: 0.5, pro: 0.5 } },
  { min: 2501, max: Number.POSITIVE_INFINITY, rates: { ai: 0.5, live: 0.5, pro: 0.5 } },
];

export function getUnitPriceWithTiers(tiers: CampaignTier[], homeCount: number, plan: PlanId): number {
  const n = Math.max(0, Math.floor(homeCount));
  for (const t of tiers) {
    if (n >= t.min && n <= t.max) return t.rates[plan];
  }
  return tiers[0].rates[plan];
}

export function getTierLabelWithTiers(tiers: CampaignTier[], homeCount: number): string {
  const n = Math.max(0, Math.floor(homeCount));
  for (const t of tiers) {
    if (n >= t.min && n <= t.max) {
      if (t.max === Number.POSITIVE_INFINITY) {
        const start = t.min.toLocaleString();
        return `${start}+`;
      }
      return `${t.min.toLocaleString()}–${t.max.toLocaleString()}`;
    }
  }
  const t0 = tiers[0];
  if (t0.max === Number.POSITIVE_INFINITY) return `${t0.min.toLocaleString()}+`;
  return `${t0.min.toLocaleString()}–${t0.max.toLocaleString()}`;
}

/** Lowest published per-home rate across all tiers and plans (for hero-style “from …” display). */
export function lowestPerHomeRate(tiers: CampaignTier[]): number {
  let m = Number.POSITIVE_INFINITY;
  for (const t of tiers) {
    m = Math.min(m, t.rates.ai, t.rates.live, t.rates.pro);
  }
  return Number.isFinite(m) ? m : tiers[0].rates.ai;
}

export function tiersToTableRows(tiers: CampaignTier[]): [string, string, string, string][] {
  return tiers.map((t) => {
    const band =
      t.max === Number.POSITIVE_INFINITY ? `${t.min.toLocaleString()}+` : `${t.min.toLocaleString()} – ${t.max.toLocaleString()}`;
    const fmt = (x: number) =>
      x.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return [band, fmt(t.rates.live), fmt(t.rates.ai), fmt(t.rates.pro)];
  });
}

/** Static fallback for modules that do not have API context. */
export function getUnitPrice(homeCount: number, plan: PlanId): number {
  return getUnitPriceWithTiers(DEFAULT_CAMPAIGN_TIERS, homeCount, plan);
}

export function getTierLabel(homeCount: number): string {
  return getTierLabelWithTiers(DEFAULT_CAMPAIGN_TIERS, homeCount);
}

export function planLabel(plan: PlanId): string {
  switch (plan) {
    case "ai":
      return "AI";
    case "live":
      return "Live";
    case "pro":
      return "Pro";
  }
}

export function planDescription(plan: PlanId): string {
  switch (plan) {
    case "ai":
      return "AI-powered multi-touch outreach to your selected radius.";
    case "live":
      return "Live follow-up and calling workflows layered on your campaign.";
    case "pro":
      return "AI + live calling for maximum response and lead quality.";
  }
}

export function formatCurrency(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}
