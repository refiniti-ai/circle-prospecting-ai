import type Stripe from "stripe";

type CheckoutSession = Stripe.Checkout.Session;

/** Digits only for comparison. */
export function normalizePhoneDigits(input: string): string {
  return input.replace(/\D/g, "");
}

export function phonesMatch(stored: string, provided: string): boolean {
  const a = normalizePhoneDigits(stored);
  const b = normalizePhoneDigits(provided);
  if (a.length < 10 || b.length < 10) return false;
  const ta = a.length >= 10 ? a.slice(-10) : a;
  const tb = b.length >= 10 ? b.slice(-10) : b;
  return ta === tb;
}

export function sessionEmails(s: CheckoutSession): string[] {
  const out: string[] = [];
  const a = s.customer_details?.email?.trim().toLowerCase();
  const b = s.customer_email?.trim().toLowerCase();
  const c = s.metadata?.customerEmail?.trim().toLowerCase();
  if (a) out.push(a);
  if (b) out.push(b);
  if (c) out.push(c);
  return [...new Set(out)];
}

export function emailMatchesSession(s: CheckoutSession, email: string): boolean {
  const want = email.trim().toLowerCase();
  if (!want.includes("@")) return false;
  return sessionEmails(s).some((e) => e === want);
}

/** Best email for account linking (Stripe checkout). */
export function canonicalCheckoutEmail(s: CheckoutSession): string | null {
  const fromMeta = s.metadata?.customerEmail?.trim().toLowerCase();
  if (fromMeta?.includes("@")) return fromMeta;
  const ce = s.customer_email?.trim().toLowerCase();
  if (ce?.includes("@")) return ce;
  const cd = s.customer_details?.email?.trim().toLowerCase();
  if (cd?.includes("@")) return cd;
  return null;
}
