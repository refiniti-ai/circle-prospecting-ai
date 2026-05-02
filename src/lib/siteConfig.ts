export function contactEmail(): string {
  return import.meta.env.VITE_CONTACT_EMAIL || "hello@circleprospecting.ai";
}
