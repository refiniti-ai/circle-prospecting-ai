/** Last-resort when VITE_API_BASE_URL was missing at build time but user is on Firebase Hosting. */
const FIREBASE_HOSTING_API_FALLBACK = "https://circle-prospecting-ai-git-724527267367.us-central1.run.app";

export function apiBase(): string {
  const b = import.meta.env.VITE_API_BASE_URL;
  if (b) return b.replace(/\/$/, "");
  if (import.meta.env.PROD && typeof window !== "undefined") {
    const h = window.location.hostname;
    if (
      h === "circle-prospecting-ai.web.app" ||
      h === "circle-prospecting-ai.firebaseapp.com"
    ) {
      return FIREBASE_HOSTING_API_FALLBACK;
    }
  }
  return "";
}

/** True when build includes a dedicated API origin (required on Firebase Hosting and other static hosts). */
export function isApiBaseConfigured(): boolean {
  if (String(import.meta.env.VITE_API_BASE_URL ?? "").trim()) return true;
  if (import.meta.env.PROD && typeof window !== "undefined") {
    const h = window.location.hostname;
    if (h === "circle-prospecting-ai.web.app" || h === "circle-prospecting-ai.firebaseapp.com")
      return true;
  }
  return false;
}
