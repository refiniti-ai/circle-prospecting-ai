import { normalizeAgentPhoneParam } from "./introAgentPhone";
import type { MlsCampaignPathSegment } from "./mlsCampaignPath";

export type FirstTimeCustomerSegment =
  | { kind: "mls"; mls: string }
  | { kind: "phone"; phone: string };

/** Normalize MLS for shareable intro URLs (TB8523180, O6264382, 7776569, …). */
export function normalizeIntroMlsId(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

/** Letter + digit MLS ids (e.g. TB8523180, O6264382, U8145678). */
function isAlphanumericMlsId(normalized: string): boolean {
  return /^[A-Z0-9]{3,40}$/.test(normalized) && /[A-Z]/.test(normalized);
}

/** Numeric-only MLS ids (e.g. 7776569) — 5–9 digits so 10-digit phones stay distinct. */
function isNumericMlsId(digitsOnly: string): boolean {
  return /^[0-9]{5,9}$/.test(digitsOnly);
}

/** $99 intro MLS URL — same listed/cs/seller/buyer convention as regular, under /99promo. */
export function introPromoMlsPath(mls: string, campaign: MlsCampaignPathSegment = "listed"): string {
  const hasLetters = /[A-Za-z]/.test(mls);
  const q = hasLetters ? normalizeIntroMlsId(mls) : mls.trim().replace(/\D/g, "");
  return q ? `/99promo/${campaign}/mls/${encodeURIComponent(q)}` : "/99promo";
}

/** Intro MLS href with optional GHL contact id (`?c=`) merged into an existing query string. */
export function introPromoMlsHref(
  mls: string,
  campaign: MlsCampaignPathSegment = "listed",
  opts?: { contactId?: string | null; search?: string }
): string {
  const path = introPromoMlsPath(mls, campaign);
  const sp = new URLSearchParams(opts?.search || "");
  const contactId = opts?.contactId?.trim();
  if (contactId) sp.set("c", contactId);
  const q = sp.toString();
  return q ? `${path}?${q}` : path;
}

/** @deprecated use introPromoMlsPath — defaults to listed. */
export function firstTimeCustomerMlsPath(mls: string, campaign: MlsCampaignPathSegment = "listed"): string {
  return introPromoMlsPath(mls, campaign);
}

/**
 * Legacy `/first-time-customer/:segment`
 * - MLS: TB8523180 / O6264382 (letters+digits) OR 7776569 (digits only, 5–9 chars)
 * - Phone: 10-digit agent deep link — redirects to `/99promo/search/agent/{phone}`
 */
export function parseFirstTimeCustomerSegment(raw: string): FirstTimeCustomerSegment | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let decoded = trimmed;
  try {
    decoded = decodeURIComponent(trimmed);
  } catch {
    decoded = trimmed;
  }

  const normalized = normalizeIntroMlsId(decoded);

  if (isAlphanumericMlsId(normalized)) {
    return { kind: "mls", mls: normalized };
  }

  const digitsOnly = decoded.replace(/\D/g, "");
  if (digitsOnly.length >= 10) {
    const phone = normalizeAgentPhoneParam(decoded);
    return phone.length >= 10 ? { kind: "phone", phone } : null;
  }

  if (isNumericMlsId(digitsOnly)) {
    return { kind: "mls", mls: digitsOnly };
  }

  return null;
}
