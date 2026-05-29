import { isProductionSiteHost } from "./siteUrl";

function isFirebaseHostingHost(hostname: string): boolean {
  return isProductionSiteHost(hostname);
}

function isSafeProductionApiOverride(raw: string): boolean {
  const u = raw.trim().replace(/\/$/, "");
  if (!u) return false;
  if (u.includes("localhost") || u.includes("127.0.0.1")) return false;
  return u.startsWith("https://");
}

/**
 * API origin for `fetch`.
 * On Firebase Hosting: default is same-origin `/api/*` (firebase.json → Cloud Run).
 * If `VITE_API_BASE_URL` is set to an **https** non-localhost URL at build time, use it instead — fixes broken Hosting→Run
 * rewrites (wrong serviceId) without rebuilding when only Cloud Run URL is known.
 */
export function apiBase(): string {
  const b = String(import.meta.env.VITE_API_BASE_URL ?? "").trim();
  if (import.meta.env.PROD && typeof window !== "undefined" && isFirebaseHostingHost(window.location.hostname)) {
    if (isSafeProductionApiOverride(b)) return b.replace(/\/$/, "");
    return "";
  }
  if (b) return b.replace(/\/$/, "");
  return "";
}

/** Whether the SPA can reach an API (same-origin rewrite or explicit base). */
export function isApiBaseConfigured(): boolean {
  const b = String(import.meta.env.VITE_API_BASE_URL ?? "").trim();
  if (import.meta.env.PROD && typeof window !== "undefined" && isFirebaseHostingHost(window.location.hostname)) {
    return true;
  }
  if (b) return true;
  return false;
}
