export function apiBase(): string {
  const b = import.meta.env.VITE_API_BASE_URL;
  if (b) return b.replace(/\/$/, "");
  return "";
}

/** True when build includes a dedicated API origin (required on Firebase Hosting and other static hosts). */
export function isApiBaseConfigured(): boolean {
  return Boolean(String(import.meta.env.VITE_API_BASE_URL ?? "").trim());
}
