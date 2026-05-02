import crypto from "node:crypto";

/** HMAC-SHA256 hex, timing-safe compare. Header format: "sha256=<hex>" or raw hex. */
export function verifyHmacSha256(rawBody: Buffer, providedSignature: string | undefined, secret: string | undefined) {
  if (!secret) return { ok: false as const, reason: "hmac not configured" };
  if (!providedSignature) return { ok: false as const, reason: "missing signature" };
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const value = providedSignature.startsWith("sha256=") ? providedSignature.slice(7) : providedSignature;
  if (value.length !== expected.length) return { ok: false as const, reason: "length" };
  const a = Buffer.from(value, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return { ok: false as const, reason: "length" };
  if (!crypto.timingSafeEqual(a, b)) return { ok: false as const, reason: "mismatch" };
  return { ok: true as const };
}
