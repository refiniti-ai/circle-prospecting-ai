import { apiBase } from "./apiBase";
import { type LeadServiceLine, type LeadTierId } from "./leadPricing";

function assertJsonResponse(r: Response, context: string): void {
  const ct = r.headers.get("content-type") || "";
  if (ct.includes("text/html")) {
    throw new Error(
      `${context}: the server returned a web page instead of API data. If you use Firebase Hosting (e.g. port 5000) without a reverse proxy, set VITE_API_BASE_URL to your running API (see .env.example) and rebuild—or run \`npm run dev\` so Vite proxies /api to the API.`
    );
  }
}

export type LeadCountRequest = {
  city?: string;
  county?: string;
  zip?: string;
  radiusMiles?: number;
  includeContact?: "phones" | "phones_email";
  occupancy?: "absentee" | "owner";
  propertyTypes?: string[];
  flags?: string[];
};

export type CampaignPropertyType = "just_listed" | "just_sold";

export type LeadCheckoutContext = {
  city?: string;
  county?: string;
  zip?: string;
  radiusMiles?: number;
  requestedLeads?: number;
  /** Just listed vs just sold — neighborhood campaign framing (Stripe metadata). */
  campaignType?: CampaignPropertyType;
};

export async function startLeadCheckout(
  serviceLine: LeadServiceLine,
  leadTier: LeadTierId,
  email: string,
  phone: string,
  context?: LeadCheckoutContext,
  signal?: AbortSignal
) {
  const r = await fetch(`${apiBase()}/api/checkout/leads`, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ serviceLine, leadTier, email, phone, ...context }),
  });
  assertJsonResponse(r, "Checkout");
  if (r.status === 503) {
    const j = (await r.json()) as { message?: string };
    throw new Error(j.message || "Stripe is not configured on the server");
  }
  if (!r.ok) throw new Error(await r.text());
  return (await r.json()) as { url: string; sessionId: string; unitAmountCents: number };
}

export async function fetchLeadCount(request: LeadCountRequest, signal?: AbortSignal) {
  const r = await fetch(`${apiBase()}/api/public/lead-count`, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(request),
  });
  assertJsonResponse(r, "Lead count");
  if (!r.ok) throw new Error("count");
  return (await r.json()) as {
    available: number;
    baseAvailableInInventory: number;
    inventoryUpdatedAt: string;
  };
}

export async function claimLeadSession(sessionId: string, email: string, phone: string) {
  const r = await fetch(`${apiBase()}/api/auth/claim-leads`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ sessionId, email: email.trim(), phone: phone.trim() }),
  });
  if (!r.ok) {
    let msg = await r.text();
    try {
      const j = JSON.parse(msg) as { message?: string };
      if (j.message) msg = j.message;
    } catch {
      /* use raw */
    }
    throw new Error(msg || "Could not sign in");
  }
  return (await r.json()) as { token: string; email: string };
}

export type PurchasedLead = {
  id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  mls: string;
  listPrice: string;
  propertyType: string;
  phone: string;
  email: string;
  soldAt?: string;
};

export async function fetchMyLeads(token: string) {
  const r = await fetch(`${apiBase()}/api/my/leads`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error("Could not load leads");
  return (await r.json()) as { email: string; leads: PurchasedLead[] };
}

/** Orders recorded for the signed-in email (Stripe webhook and/or claim). Same list when auth is Google later. */
export type MyPurchaseRow = {
  sessionId: string;
  orderNumber: string;
  notifiedAt: string;
  checkoutType: string;
  customerEmail: string | null;
  amountTotalCents: number | null;
  currency: string | null;
  lineItems: string[];
  leadServiceLine?: string | null;
  leadTier?: string | null;
  requestedLeads?: number | null;
  targetingSummary?: string | null;
};

export async function fetchMyPurchases(token: string) {
  const r = await fetch(`${apiBase()}/api/my/purchases`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error("Could not load purchases");
  return (await r.json()) as { email: string; purchases: MyPurchaseRow[] };
}

export async function downloadMyLeadsCsv(token: string) {
  const r = await fetch(`${apiBase()}/api/my/leads/export`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error("Export failed");
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "my-purchased-leads.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export async function uploadLeadsCsv(file: File, adminKey: string) {
  const fd = new FormData();
  fd.append("file", file);
  const r = await fetch(`${apiBase()}/api/admin/leads/csv`, {
    method: "POST",
    headers: { Authorization: `Bearer ${adminKey}` },
    body: fd,
  });
  if (!r.ok) throw new Error(await r.text());
  return (await r.json()) as { ok: boolean; rows: number; summary: { total: number; available: number; sold: number } };
}

export async function fetchAdminSummary(adminKey: string) {
  const r = await fetch(`${apiBase()}/api/admin/summary`, {
    headers: { Authorization: `Bearer ${adminKey}` },
  });
  if (!r.ok) throw new Error("summary");
  return (await r.json()) as { inventory: { total: number; available: number; sold: number; updatedAt: string } };
}

export type AdminPurchaseRow = {
  sessionId: string;
  orderNumber: string;
  notifiedAt: string;
  checkoutType: string;
  customerEmail: string | null;
  amountTotalCents: number | null;
  currency: string | null;
  lineItems: string[];
  leadServiceLine?: string | null;
  leadTier?: string | null;
  requestedLeads?: number | null;
  targetingSummary?: string | null;
};

export async function fetchAdminPurchases(adminKey: string) {
  const r = await fetch(`${apiBase()}/api/admin/purchases`, {
    headers: { Authorization: `Bearer ${adminKey}` },
  });
  if (!r.ok) throw new Error("purchases");
  return (await r.json()) as { purchases: AdminPurchaseRow[] };
}
