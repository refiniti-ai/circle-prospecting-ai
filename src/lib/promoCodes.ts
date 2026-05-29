import { LEAD_SERVICE_LINES, type LeadServiceLine } from "./leadPricing";

/** Per-home rate when a valid beta promo code is applied (all products). */
export const BETA_PROMO_PRICE_USD = 0.5;

const BETA_CHECKOUT_ONLY_SERVICE: LeadServiceLine = "live_callers";

export function getBetaPromoCode(): string {
  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_BETA_PROMO_CODE?.trim()) {
    return import.meta.env.VITE_BETA_PROMO_CODE.trim();
  }
  if (typeof process !== "undefined" && process.env?.BETA_PROMO_CODE?.trim()) {
    return process.env.BETA_PROMO_CODE.trim();
  }
  return "BetaCPAI";
}

/** When true, checkout is Live Callers only (AI, Hybrid, Data hidden). Set env to `false` to restore all products. */
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

export function isServiceLineHiddenDuringBeta(id: LeadServiceLine): boolean {
  return isBetaHideAiHybrid() && id !== BETA_CHECKOUT_ONLY_SERVICE;
}

export function checkoutServiceLines() {
  if (isBetaHideAiHybrid()) {
    return LEAD_SERVICE_LINES.filter((line) => line.id === BETA_CHECKOUT_ONLY_SERVICE);
  }
  return LEAD_SERVICE_LINES;
}

export function defaultCheckoutServiceLine(): LeadServiceLine {
  const lines = checkoutServiceLines();
  return lines.find((l) => l.id === "live_callers")?.id ?? lines[0]?.id ?? "live_callers";
}

export function assertCheckoutServiceLineAllowed(serviceLine: LeadServiceLine): string | null {
  if (isServiceLineHiddenDuringBeta(serviceLine)) {
    return "Only Live Callers is available during beta.";
  }
  return null;
}
