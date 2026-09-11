/** Strip to 10-digit US local number when possible (handles +1 / 11-digit). */
export function digitsOnlyPhone(raw: string | null | undefined): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return digits;
}

/** Decode a URL path segment like `7274107482` or `%2B17274107482`. */
export function normalizeAgentPhoneParam(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  try {
    return digitsOnlyPhone(decodeURIComponent(trimmed));
  } catch {
    return digitsOnlyPhone(trimmed);
  }
}

export function phonesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const da = digitsOnlyPhone(a);
  const db = digitsOnlyPhone(b);
  if (!da || !db) return false;
  if (da === db) return true;
  if (da.length >= 10 && db.length >= 10) return da.slice(-10) === db.slice(-10);
  return false;
}

/** Canonical digits-only segment for shareable agent links. */
export function agentPhonePathSegment(phone: string): string {
  return digitsOnlyPhone(phone);
}

export function firstTimeCustomerAgentPath(phone: string): string {
  const seg = agentPhonePathSegment(phone);
  return seg ? `/99promo/search/agent/${seg}` : "/99promo";
}

/** Shareable regular-pricing agent link — listing / sold / buyer picker. */
export function searchAgentPath(phone: string): string {
  const seg = agentPhonePathSegment(phone);
  return seg ? `/search/agent/${seg}` : "/buy-leads";
}

/** @deprecated use searchAgentPath */
export function agentListingsPath(phone: string): string {
  return searchAgentPath(phone);
}
