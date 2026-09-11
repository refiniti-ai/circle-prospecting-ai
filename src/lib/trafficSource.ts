const STORAGE_KEY = "cpai_traffic_source";
const PAGE_PATH_KEY = "cpai_search_page_path";

export type TrafficSource = "facebook" | "instagram" | "google" | "email" | "website";

function mapUtm(source: string | null, medium: string | null): TrafficSource | null {
  const s = (source || "").trim().toLowerCase();
  const m = (medium || "").trim().toLowerCase();
  if (s === "facebook" || s === "fb") return "facebook";
  if (s === "instagram" || s === "ig" || s === "insta") return "instagram";
  if (s === "google") return "google";
  if (s === "email" || m === "email") return "email";
  return null;
}

/** Keep the first tagged source for this tab (ad/email click). Later untagged pages do not clear it. */
export function captureTrafficSourceFromSearch(search: string): void {
  if (typeof window === "undefined") return;
  try {
    const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
    const mapped = mapUtm(params.get("utm_source"), params.get("utm_medium"));
    if (!mapped) return;
    sessionStorage.setItem(STORAGE_KEY, mapped);
  } catch {
    /* ignore */
  }
}

export function readTrafficSource(): TrafficSource | "" {
  if (typeof window === "undefined") return "";
  try {
    captureTrafficSourceFromSearch(window.location.search);
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored === "facebook" || stored === "instagram" || stored === "google" || stored === "email") {
      return stored;
    }
  } catch {
    /* ignore */
  }
  return "";
}

function isListingOrAgentPath(pathname: string): boolean {
  return /\/(listed|seller|buyer)\/mls\//i.test(pathname) || /\/search\/agent\//i.test(pathname);
}

/** Current page, or last listing/agent URL in this tab (checkout may drop the MLS path). */
export function readSearchPagePath(): string {
  if (typeof window === "undefined") return "";
  try {
    const path = window.location.pathname || "";
    if (isListingOrAgentPath(path)) {
      sessionStorage.setItem(PAGE_PATH_KEY, path);
      return path;
    }
    return sessionStorage.getItem(PAGE_PATH_KEY) || path;
  } catch {
    return "";
  }
}

export function trafficSourceHeaders(base?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json", ...base };
  const src = readTrafficSource();
  if (src) headers["X-CP-Traffic-Source"] = src;
  const pagePath = readSearchPagePath();
  if (pagePath.startsWith("/")) headers["X-CP-Page-Path"] = pagePath;
  return headers;
}
