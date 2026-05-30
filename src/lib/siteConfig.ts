export const DEFAULT_BOOK_CALL_URL = "https://cal.com/circleprospectingai-greg/15min";

export function bookCallUrl(): string {
  return import.meta.env.VITE_BOOK_CALL_URL?.trim() || DEFAULT_BOOK_CALL_URL;
}

export function contactEmail(): string {
  return import.meta.env.VITE_CONTACT_EMAIL || "hello@circleprospecting.ai";
}

/** Primary inbox (contact form + public-facing). */
export function contactInboxEmail(): string {
  return import.meta.env.VITE_CONTACT_INBOX_EMAIL?.trim() || "info@circleprospecting.ai";
}

/** Pipe-separated lines, e.g. `Suite 100|Austin, TX 78701` */
export function contactAddressLines(): string[] {
  const raw = import.meta.env.VITE_CONTACT_ADDRESS?.trim();
  if (raw) return raw.split("|").map((s: string) => s.trim()).filter(Boolean);
  return ["US-based operations", "Serving real estate teams nationwide"];
}

export function contactPhoneDisplay(): string | null {
  const p = import.meta.env.VITE_CONTACT_PHONE?.trim();
  return p || null;
}

export type ContactSocialLink = { label: string; href: string; icon: "linkedin" | "x" | "facebook" | "instagram" };

export function contactSocialLinks(): ContactSocialLink[] {
  const out: ContactSocialLink[] = [];
  const li = import.meta.env.VITE_SOCIAL_LINKEDIN?.trim();
  if (li) out.push({ label: "LinkedIn", href: li, icon: "linkedin" });
  const x = import.meta.env.VITE_SOCIAL_X?.trim();
  if (x) out.push({ label: "X", href: x, icon: "x" });
  const fb = import.meta.env.VITE_SOCIAL_FACEBOOK?.trim();
  if (fb) out.push({ label: "Facebook", href: fb, icon: "facebook" });
  const ig = import.meta.env.VITE_SOCIAL_INSTAGRAM?.trim();
  if (ig) out.push({ label: "Instagram", href: ig, icon: "instagram" });
  return out;
}
