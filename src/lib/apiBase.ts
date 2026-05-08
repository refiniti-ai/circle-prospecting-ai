function isFirebaseHostingHost(hostname: string): boolean {
  return (
    hostname === "circle-prospecting-ai.web.app" ||
    hostname === "circle-prospecting-ai.firebaseapp.com"
  );
}

/**
 * API origin for `fetch`.
 * - Prefer `VITE_API_BASE_URL` when set (e.g. direct Cloud Run URL for tests).
 * - On Firebase Hosting, use same-origin `""` so requests go to `/api/*` and Hosting proxies to Cloud Run (no cross-origin CORS).
 */
export function apiBase(): string {
  const b = String(import.meta.env.VITE_API_BASE_URL ?? "").trim();
  if (b) return b.replace(/\/$/, "");
  if (import.meta.env.PROD && typeof window !== "undefined" && isFirebaseHostingHost(window.location.hostname)) {
    return "";
  }
  return "";
}

/** Whether the SPA can reach an API (same-origin rewrite or explicit base). */
export function isApiBaseConfigured(): boolean {
  if (String(import.meta.env.VITE_API_BASE_URL ?? "").trim()) return true;
  if (import.meta.env.PROD && typeof window !== "undefined" && isFirebaseHostingHost(window.location.hostname))
    return true;
  return false;
}
