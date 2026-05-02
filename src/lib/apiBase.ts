export function apiBase(): string {
  const b = import.meta.env.VITE_API_BASE_URL;
  if (b) return b.replace(/\/$/, "");
  return "";
}
