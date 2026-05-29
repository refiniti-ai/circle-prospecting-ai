import { LEAD_SERVICE_LINES, type LeadServiceLine } from "./leadPricing";

/** Per-home rate when a valid beta promo code is applied (all products). */
export const BETA_PROMO_PRICE_USD = 0.5;

const BETA_HIDDEN_SERVICE_LINES: LeadServiceLine[] = ["ai_outreach", "hybrid"];

export function getBetaPromoCode(): string {
  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_BETA_PROMO_CODE?.trim()) {
    return import.meta.env.VITE_BETA_PROMO_CODE.trim();
  }
  if (typeof process !== "undefined" && process.env?.BETA_PROMO_CODE?.trim()) {
    return process.env.BETA_PROMO_CODE.trim();
  }
  return "BetaCPAI";
}

/** When true, AI Outreach and Hybrid are hidden and blocked at checkout. Set env to `false` to restore. */
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
  return isBetaHideAiHybrid() && BETA_HIDDEN_SERVICE_LINES.includes(id);
}

export function checkoutServiceLines() {
  return LEAD_SERVICE_LINES.filter((line) => !isServiceLineHiddenDuringBeta(line.id));
}

export function defaultCheckoutServiceLine(): LeadServiceLine {
  const lines = checkoutServiceLines();
  return lines.find((l) => l.id === "live_callers")?.id ?? lines[0]?.id ?? "live_callers";
}

export function assertCheckoutServiceLineAllowed(serviceLine: LeadServiceLine): string | null {
  if (isServiceLineHiddenDuringBeta(serviceLine)) {
    return "AI Outreach and Hybrid are not available during beta. Choose Live Callers or Data Only.";
  }
  return null;
}
