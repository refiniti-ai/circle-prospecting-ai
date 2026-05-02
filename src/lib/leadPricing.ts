/**
 * Lead pack pricing matrix (per homeowner USD) — kept in sync with checkout on the server.
 */

export type LeadServiceLine = "ai_outreach" | "live_callers" | "hybrid" | "data_only";
export type LeadTierId = "dabble" | "starter" | "growth" | "scale";

export const LEAD_TIERS: readonly {
  id: LeadTierId;
  packageLabel: string;
  homesLabel: string;
  minLeads: number;
  maxLeads: number | null;
}[] = [
  { id: "dabble", packageLabel: "Dabble", homesLabel: "<249", minLeads: 1, maxLeads: 249 },
  { id: "starter", packageLabel: "Starter", homesLabel: "250+", minLeads: 250, maxLeads: 499 },
  { id: "growth", packageLabel: "Growth", homesLabel: "500+", minLeads: 500, maxLeads: 999 },
  { id: "scale", packageLabel: "Scale", homesLabel: "1000+", minLeads: 1000, maxLeads: null },
] as const;

export const LEAD_SERVICE_LINES: readonly {
  id: LeadServiceLine;
  label: string;
  headerBg: string;
  headerText: string;
  rowAlt: string;
}[] = [
  { id: "ai_outreach", label: "AI Outreach", headerBg: "#14b8a6", headerText: "#0f172a", rowAlt: "#ecfeff" },
  { id: "live_callers", label: "Live Callers", headerBg: "#2563eb", headerText: "#ffffff", rowAlt: "#eff6ff" },
  { id: "hybrid", label: "Hybrid (AI + Live)", headerBg: "#22c55e", headerText: "#ffffff", rowAlt: "#f0fdf4" },
  { id: "data_only", label: "Data Only", headerBg: "#166534", headerText: "#ffffff", rowAlt: "#f0fdf4" },
] as const;

/** Tier index 0..3 = dabble..scale — per homeowner (USD) */
export const LEAD_PRICE_MATRIX: Record<LeadServiceLine, readonly [number, number, number, number]> = {
  ai_outreach: [0.25, 0.22, 0.21, 0.2],
  live_callers: [0.75, 0.7, 0.66, 0.6],
  hybrid: [0.8, 0.75, 0.7, 0.65],
  data_only: [0.1, 0.09, 0.08, 0.07],
};

const TIER_ORDER: LeadTierId[] = ["dabble", "starter", "growth", "scale"];

export function tierIndex(tier: LeadTierId): number {
  return TIER_ORDER.indexOf(tier);
}

export function tierFromLeadCount(n: number): LeadTierId {
  if (!Number.isFinite(n) || n < 1) return "dabble";
  if (n < 250) return "dabble";
  if (n < 500) return "starter";
  if (n < 1000) return "growth";
  return "scale";
}

export function tierRowMeta(tier: LeadTierId) {
  return LEAD_TIERS.find((t) => t.id === tier)!;
}

export function pricePerLeadUsd(service: LeadServiceLine, tier: LeadTierId): number {
  const idx = tierIndex(tier);
  return LEAD_PRICE_MATRIX[service][idx]!;
}

/** Checkout total from explicitly chosen service line + plan tier + lead count. */
export function totalCentsForSelection(service: LeadServiceLine, tier: LeadTierId, leadCount: number): number {
  const unit = pricePerLeadUsd(service, tier);
  return Math.round(leadCount * unit * 100);
}

/** True when lead count falls in the plan’s volume band (e.g. Starter = 250–499). */
export function leadCountFitsTier(count: number, tier: LeadTierId): boolean {
  const t = tierRowMeta(tier);
  if (t.maxLeads == null) return count >= t.minLeads;
  return count >= t.minLeads && count <= t.maxLeads;
}

/** Stripe card payments commonly require a minimum charge (e.g. $0.50 USD). */
export function minLeadsForStripeForTier(service: LeadServiceLine, tier: LeadTierId): number {
  const centsPerLead = Math.round(pricePerLeadUsd(service, tier) * 100);
  if (centsPerLead < 1) return 1;
  return Math.max(1, Math.ceil(50 / centsPerLead));
}

export function serviceLineLabel(id: LeadServiceLine): string {
  return LEAD_SERVICE_LINES.find((s) => s.id === id)?.label ?? id;
}

export function formatMoneyUsd(amount: number): string {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function publicPricingSnapshot() {
  return {
    schema: "matrix_v1" as const,
    serviceLines: LEAD_SERVICE_LINES,
    tiers: LEAD_TIERS,
    matrix: LEAD_PRICE_MATRIX,
  };
}
