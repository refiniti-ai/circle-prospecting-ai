import { LEAD_SERVICE_LINES, type LeadServiceLine } from "./leadPricing";

/** Per-home rate when a valid beta promo code is applied to Live Callers. */
export const BETA_PROMO_PRICE_USD = 0.5;

/** Checkout lanes shown during beta (AI + Hybrid hidden). */
const BETA_CHECKOUT_SERVICES: readonly LeadServiceLine[] = ["live_callers", "data_only", "mailers"];

export function getBetaPromoCode(): string {
  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_BETA_PROMO_CODE?.trim()) {
    return import.meta.env.VITE_BETA_PROMO_CODE.trim();
  }
  if (typeof process !== "undefined" && process.env?.BETA_PROMO_CODE?.trim()) {
    return process.env.BETA_PROMO_CODE.trim();
  }
  return "BetaCPAI";
}

/** When true, checkout is Live Callers + Data Only (AI and Hybrid hidden). Set env to `false` to restore all products. */
export function isBetaHideAiHybrid(): boolean {
  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_BETA_HIDE_AI_HYBRID === "false") {
    return false;
  }
  if (typeof process !== "undefined" && process.env?.BETA_HIDE_AI_HYBRID === "false") {
    return false;
  }
  return true;
}

export function normalizePromoCode(raw: string | undefined | null): string {
  return (raw ?? "").trim();
}

export function isValidBetaPromoCode(code: string | undefined | null): boolean {
  const n = normalizePromoCode(code);
  if (!n) return false;
  return n.toLowerCase() === getBetaPromoCode().toLowerCase();
}

function isBetaCheckoutService(id: LeadServiceLine): boolean {
  return (BETA_CHECKOUT_SERVICES as readonly string[]).includes(id);
}

export function isServiceLineHiddenDuringBeta(id: LeadServiceLine): boolean {
  return isBetaHideAiHybrid() && !isBetaCheckoutService(id);
}

export function checkoutServiceLines() {
  if (isBetaHideAiHybrid()) {
    return LEAD_SERVICE_LINES.filter((line) => isBetaCheckoutService(line.id));
  }
  return LEAD_SERVICE_LINES;
}

export function defaultCheckoutServiceLine(): LeadServiceLine {
  const lines = checkoutServiceLines();
  return lines.find((l) => l.id === "live_callers")?.id ?? lines[0]?.id ?? "live_callers";
}

export function assertCheckoutServiceLineAllowed(serviceLine: LeadServiceLine): string | null {
  if (isServiceLineHiddenDuringBeta(serviceLine)) {
    return "Only Live Callers, Data Only, and Postcard are available during beta.";
  }
  return null;
}
