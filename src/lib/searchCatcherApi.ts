import { apiBase } from "./apiBase";

export type AdminSearchCatchRow = {
  id: string;
  createdAt: string;
  kind: "email" | "phone" | "mls" | "address" | "agent";
  query: string;
  page: string;
  source?: string;
  resultCount: number;
  matchedName: string | null;
  matchedEmail: string | null;
  matchedPhone: string | null;
  matchedMls: string | null;
  pagePath?: string | null;
  found: boolean;
};

export async function fetchAdminSearchCatches(adminKey: string) {
  const r = await fetch(`${apiBase()}/api/admin/search-logs`, {
    headers: { Authorization: `Bearer ${adminKey}`, Accept: "application/json" },
  });
  if (!r.ok) throw new Error("Could not load search log.");
  return (await r.json()) as { searches: AdminSearchCatchRow[] };
}
