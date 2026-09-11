/**
 * Lead pack pricing matrix (per homeowner USD) — kept in sync with checkout on the server.
 */

import { BETA_PROMO_PRICE_USD, isValidBetaPromoCode } from "./promoCodes";

export {
  BETA_PROMO_PRICE_USD,
  checkoutServiceLines,
  defaultCheckoutServiceLine,
  isServiceLineHiddenDuringBeta,
  assertCheckoutServiceLineAllowed,
  isValidBetaPromoCode,
  normalizePromoCode,
  getBetaPromoCode,
} from "./promoCodes";

export type LeadServiceLine = "ai_outreach" | "live_callers" | "hybrid" | "data_only" | "mailers";
export type LeadTierId = "dabble" | "starter" | "growth" | "scale" | "dominate";

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
  { id: "scale", packageLabel: "Scale", homesLabel: "1000+", minLeads: 1000, maxLeads: 2499 },
  { id: "dominate", packageLabel: "Dominate", homesLabel: "2500+", minLeads: 2500, maxLeads: null },
] as const;

export const LEAD_SERVICE_LINES: readonly {
  id: LeadServiceLine;
  label: string;
  headerBg: string;
  headerText: string;
  rowAlt: string;
}[] = [
  { id: "live_callers", label: "Live Callers", headerBg: "#2d76b8", headerText: "#ffffff", rowAlt: "rgba(45, 118, 184, 0.1)" },
  { id: "ai_outreach", label: "AI Outreach", headerBg: "#76b82d", headerText: "#ffffff", rowAlt: "rgba(118, 184, 45, 0.14)" },
  { id: "hybrid", label: "Hybrid (AI + Live)", headerBg: "#7b4397", headerText: "#ffffff", rowAlt: "rgba(123, 67, 151, 0.12)" },
  { id: "data_only", label: "Data Only", headerBg: "#d97e26", headerText: "#ffffff", rowAlt: "rgba(217, 126, 38, 0.12)" },
  { id: "mailers", label: "Postcard", headerBg: "#b83232", headerText: "#ffffff", rowAlt: "rgba(184, 50, 50, 0.12)" },
] as const;

/** Legacy flat beta display fallback (promo checkout still uses BETA_PROMO_PRICE_USD). */
export const FLAT_PER_HOME_USD = 0.5;

/** Agent sales sheet / campaign-pricing (per homeowner USD). */
export const LEAD_PRICE_MATRIX: Record<LeadServiceLine, readonly [number, number, number, number, number]> = {
  live_callers: [0.75, 0.7, 0.66, 0.6, 0.5],
  ai_outreach: [0.25, 0.24, 0.23, 0.22, 0.2],
  hybrid: [0.8, 0.75, 0.7, 0.65, 0.55],
  data_only: [0.1, 0.09, 0.08, 0.07, 0.06],
  mailers: [0.99, 0.99, 0.99, 0.99, 0.99],
};

/** Buy-leads / Stripe checkout — live callers at beta lane rate. */
export const LEAD_PRICE_MATRIX_CHECKOUT: Record<LeadServiceLine, readonly [number, number, number, number, number]> = {
  live_callers: [0.5, 0.5, 0.5, 0.5, 0.5],
  ai_outreach: [...LEAD_PRICE_MATRIX.ai_outreach],
  hybrid: [...LEAD_PRICE_MATRIX.hybrid],
  data_only: [...LEAD_PRICE_MATRIX.data_only],
  mailers: [...LEAD_PRICE_MATRIX.mailers],
};

const TIER_ORDER: LeadTierId[] = ["dabble", "starter", "growth", "scale", "dominate"];

export function tierIndex(tier: LeadTierId): number {
  return TIER_ORDER.indexOf(tier);
}

export function tierFromLeadCount(n: number): LeadTierId {
  if (!Number.isFinite(n) || n < 1) return "dabble";
  if (n < 250) return "dabble";
  if (n < 500) return "starter";
  if (n < 1000) return "growth";
  if (n < 2500) return "scale";
  return "dominate";
}

export function tierRowMeta(tier: LeadTierId) {
  return LEAD_TIERS.find((t) => t.id === tier)!;
}

function betaPromoLiveCallersRate(service: LeadServiceLine, promoCode?: string | null): number | null {
  if (service === "live_callers" && isValidBetaPromoCode(promoCode)) return BETA_PROMO_PRICE_USD;
  return null;
}

/** Catalog / quote display rate (homepage sales sheet). */
export function pricePerLeadUsd(service: LeadServiceLine, tier: LeadTierId, promoCode?: string | null): number {
  const promoRate = betaPromoLiveCallersRate(service, promoCode);
  if (promoRate != null) return promoRate;
  const idx = tierIndex(tier);
  return LEAD_PRICE_MATRIX[service][idx]!;
}

/** Buy-leads checkout rate — Live Callers hard-coded at $0.50/home; promo also locks Live Callers at $0.50. */
export function checkoutPricePerLeadUsd(service: LeadServiceLine, tier: LeadTierId, promoCode?: string | null): number {
  const promoRate = betaPromoLiveCallersRate(service, promoCode);
  if (promoRate != null) return promoRate;
  const idx = tierIndex(tier);
  return LEAD_PRICE_MATRIX_CHECKOUT[service][idx]!;
}

/** Checkout total from explicitly chosen service line + plan tier + lead count. */
export function totalCentsForSelection(
  service: LeadServiceLine,
  tier: LeadTierId,
  leadCount: number,
  promoCode?: string | null
): number {
  const unit = checkoutPricePerLeadUsd(service, tier, promoCode);
  return Math.round(leadCount * unit * 100);
}

/** True when lead count falls in the plan’s volume band (e.g. Starter = 250–499). */
export function leadCountFitsTier(count: number, tier: LeadTierId): boolean {
  const t = tierRowMeta(tier);
  if (t.maxLeads == null) return count >= t.minLeads;
  return count >= t.minLeads && count <= t.maxLeads;
}

/** Stripe card payments commonly require a minimum charge (e.g. $0.50 USD). */
export function minLeadsForStripeForTier(service: LeadServiceLine, tier: LeadTierId, promoCode?: string | null): number {
  const centsPerLead = Math.round(checkoutPricePerLeadUsd(service, tier, promoCode) * 100);
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
