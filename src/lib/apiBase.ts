function isFirebaseHostingHost(hostname: string): boolean {
  return (
    hostname === "circle-prospecting-ai.web.app" ||
    hostname === "circle-prospecting-ai.firebaseapp.com"
  );
}

/**
 * API origin for `fetch`.
 * On live Firebase Hosting we always use same-origin `/api/*` (firebase.json → Cloud Run).
 * That ignores any mistaken `VITE_API_BASE_URL` baked from a local `.env` so admin login and checkout always hit the rewrite.
 */
export function apiBase(): string {
  if (import.meta.env.PROD && typeof window !== "undefined" && isFirebaseHostingHost(window.location.hostname)) {
    return "";
  }
  const b = String(import.meta.env.VITE_API_BASE_URL ?? "").trim();
  if (b) return b.replace(/\/$/, "");
  return "";
}

/** Whether the SPA can reach an API (same-origin rewrite or explicit base). */
export function isApiBaseConfigured(): boolean {
  if (import.meta.env.PROD && typeof window !== "undefined" && isFirebaseHostingHost(window.location.hostname)) return true;
  if (String(import.meta.env.VITE_API_BASE_URL ?? "").trim()) return true;
  return false;
}
