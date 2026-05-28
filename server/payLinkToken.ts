import crypto from "node:crypto";

/**
 * HMAC-signed tokens for /pay/:contactId links so URLs can't be guessed.
 * Token = base64url(HMAC-SHA256(secret, contactId)) truncated to 32 chars.
 *
 * Secret resolution:
 *   PAY_LINK_SECRET (preferred) → DASHBOARD_JWT_SECRET (fallback) →
 *   "circle-prospecting-default" (dev only — set a real secret in production)
 */
function getSecret(): string {
  return (
    process.env.PAY_LINK_SECRET?.trim() ||
    process.env.DASHBOARD_JWT_SECRET?.trim() ||
    "circle-prospecting-default"
  );
}

export function signPayLinkToken(contactId: string): string {
  const h = crypto.createHmac("sha256", getSecret());
  h.update(contactId, "utf8");
  return h.digest("base64url").slice(0, 32);
}

export function verifyPayLinkToken(contactId: string, token: string | undefined | null): boolean {
  if (!token || typeof token !== "string") return false;
  const expected = signPayLinkToken(contactId);
  if (expected.length !== token.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token));
  } catch {
    return false;
  }
}
