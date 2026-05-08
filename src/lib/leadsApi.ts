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

export async function clientLogin(email: string, password: string) {
  let r: Response;
  try {
    r = await fetch(`${apiBase()}/api/auth/client-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ email: email.trim(), password }),
    });
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    if (!raw || raw === "Failed to fetch" || raw.includes("NetworkError") || raw.includes("Load failed")) {
      throw new Error(
        "Could not reach the API (network or CORS). Redeploy Cloud Run after CORS updates, or confirm /api/health on your API returns JSON."
      );
    }
    throw e;
  }
  assertJsonResponse(r, "Client login");
  if (!r.ok) {
    let msg = await r.text();
    try {
      const j = JSON.parse(msg) as { message?: string; error?: string };
      if (j.message) msg = j.message;
      else if (j.error === "invalid_credentials") msg = "Invalid email or password.";
      else if (j.error) msg = j.error;
    } catch {
      /* use raw */
    }
    throw new Error(msg || "Could not sign in");
  }
  return (await r.json()) as { token: string; email: string };
}

export async function requestClientPasswordReset(email: string) {
  let r: Response;
  try {
    r = await fetch(`${apiBase()}/api/auth/client-password-reset-request`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ email: email.trim() }),
    });
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    if (!raw || raw === "Failed to fetch" || raw.includes("NetworkError") || raw.includes("Load failed")) {
      throw new Error("Could not reach the API.");
    }
    throw e;
  }
  assertJsonResponse(r, "Client password reset request");
  if (!r.ok) {
    let msg = await r.text();
    try {
      const j = JSON.parse(msg) as { message?: string; error?: string };
      if (j.message) msg = j.message;
      else if (j.error === "email_not_configured") msg = j.message || "Email is not configured on the server.";
      else if (j.error) msg = j.error;
    } catch {
      /* use raw */
    }
    throw new Error(msg || "Could not send reset email");
  }
}

export async function completeClientPasswordReset(token: string, password: string) {
  let r: Response;
  try {
    r = await fetch(`${apiBase()}/api/auth/client-password-reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ token: token.trim(), password }),
    });
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    if (!raw || raw === "Failed to fetch" || raw.includes("NetworkError") || raw.includes("Load failed")) {
      throw new Error("Could not reach the API.");
    }
    throw e;
  }
  assertJsonResponse(r, "Client password reset");
  if (!r.ok) {
    let msg = await r.text();
    try {
      const j = JSON.parse(msg) as { message?: string; error?: string };
      if (j.message) msg = j.message;
      else if (j.error) msg = j.error;
    } catch {
      /* use raw */
    }
    throw new Error(msg || "Could not reset password");
  }
}

export async function requestAdminPasswordReset(email: string) {
  let r: Response;
  try {
    r = await fetch(`${apiBase()}/api/auth/admin-password-reset-request`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ email: email.trim() }),
    });
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    if (!raw || raw === "Failed to fetch" || raw.includes("NetworkError") || raw.includes("Load failed")) {
      throw new Error("Could not reach the API.");
    }
    throw e;
  }
  assertJsonResponse(r, "Admin password reset request");
  if (!r.ok) {
    let msg = await r.text();
    try {
      const j = JSON.parse(msg) as { message?: string; error?: string };
      if (j.message) msg = j.message;
      else if (j.error === "admin_email_not_configured") msg = j.message || "ADMIN_EMAIL is not set on the server.";
      else if (j.error === "email_not_configured") msg = j.message || "Email is not configured on the server.";
      else if (j.error) msg = j.error;
    } catch {
      /* use raw */
    }
    throw new Error(msg || "Could not send reset email");
  }
}

export async function completeAdminPasswordReset(token: string, password: string) {
  let r: Response;
  try {
    r = await fetch(`${apiBase()}/api/auth/admin-password-reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ token: token.trim(), password }),
    });
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    if (!raw || raw === "Failed to fetch" || raw.includes("NetworkError") || raw.includes("Load failed")) {
      throw new Error("Could not reach the API.");
    }
    throw e;
  }
  assertJsonResponse(r, "Admin password reset");
  if (!r.ok) {
    let msg = await r.text();
    try {
      const j = JSON.parse(msg) as { message?: string; error?: string };
      if (j.message) msg = j.message;
      else if (j.error) msg = j.error;
    } catch {
      /* use raw */
    }
    throw new Error(msg || "Could not reset password");
  }
}

export async function setClientPasswordFromSession(sessionId: string, password: string) {
  let r: Response;
  try {
    r = await fetch(`${apiBase()}/api/auth/set-client-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ sessionId: sessionId.trim(), password }),
    });
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    if (!raw || raw === "Failed to fetch" || raw.includes("NetworkError") || raw.includes("Load failed")) {
      throw new Error(
        "Could not reach the API (network or CORS). Redeploy Cloud Run after CORS updates, or confirm /api/health on your API returns JSON."
      );
    }
    throw e;
  }
  assertJsonResponse(r, "Set client password");
  if (!r.ok) {
    let msg = await r.text();
    try {
      const j = JSON.parse(msg) as { message?: string; error?: string };
      if (j.message) msg = j.message;
      else if (j.error === "stripe not configured") msg = "Payment system is not configured on the server.";
      else if (j.error) msg = j.error;
    } catch {
      /* use raw */
    }
    throw new Error(msg || "Could not save password");
  }
  return (await r.json()) as { token: string; email: string };
}

export type LeadClaimError = Error & { code?: string };

/** True when the server had no stored purchase matching email + phone (try session-id claim if available). */
export function isLeadClaimNoMatchError(err: unknown): err is LeadClaimError {
  return err instanceof Error && (err as LeadClaimError).code === "no_match";
}

/** Dashboard sign-in using only email + phone (purchase must already be in server storage, usually via webhook). */
export async function claimLeadPackByEmailPhone(email: string, phone: string) {
  let r: Response;
  try {
    r = await fetch(`${apiBase()}/api/auth/claim-leads-identity`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ email: email.trim(), phone: phone.trim() }),
    });
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    if (
      !raw ||
      raw === "Failed to fetch" ||
      raw.includes("NetworkError") ||
      raw.includes("Load failed")
    ) {
      throw new Error(
        "Could not reach the API (network or CORS). Redeploy Cloud Run after CORS updates, or confirm /api/health on your API returns JSON."
      );
    }
    throw e;
  }
  assertJsonResponse(r, "Claim by identity");
  if (!r.ok) {
    const raw = await r.text();
    let msg = raw;
    let errField: string | undefined;
    try {
      const j = JSON.parse(raw) as { message?: string; error?: string };
      errField = j.error;
      if (j.message) msg = j.message;
      else if (j.error === "stripe not configured") msg = "Payment system is not configured on the server.";
      else if (j.error === "invalid_phone") msg = j.message || "Phone must include at least 10 digits.";
      else if (j.error) msg = j.error;
    } catch {
      /* use raw */
    }
    if (r.status === 404 && errField === "no_match") {
      const e = new Error(msg || "No matching order found") as LeadClaimError;
      e.code = "no_match";
      throw e;
    }
    throw new Error(msg || "Could not sign in");
  }
  return (await r.json()) as { token: string; email: string };
}

export async function claimLeadSession(sessionId: string, email: string, phone: string) {
  let r: Response;
  try {
    r = await fetch(`${apiBase()}/api/auth/claim-leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ sessionId, email: email.trim(), phone: phone.trim() }),
    });
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    if (
      !raw ||
      raw === "Failed to fetch" ||
      raw.includes("NetworkError") ||
      raw.includes("Load failed")
    ) {
      throw new Error(
        "Could not reach the API (network or CORS). Redeploy Cloud Run after CORS updates, or confirm /api/health on your API returns JSON."
      );
    }
    throw e;
  }
  if (!r.ok) {
    let msg = await r.text();
    try {
      const j = JSON.parse(msg) as { message?: string; error?: string };
      if (j.message) msg = j.message;
      else if (j.error === "stripe not configured") msg = "Payment system is not configured on the server.";
      else if (j.error) msg = j.error;
    } catch {
      /* use raw */
    }
    throw new Error(msg || "Could not sign in");
  }
  return (await r.json()) as { token: string; email: string };
}

export async function loginAdmin(username: string, password: string): Promise<string> {
  let r: Response;
  try {
    r = await fetch(`${apiBase()}/api/auth/admin-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ username: username.trim(), password }),
    });
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    if (!raw || raw === "Failed to fetch" || raw.includes("NetworkError") || raw.includes("Load failed")) {
      throw new Error("Could not reach the API. Check your connection and try again.");
    }
    throw e;
  }
  const ct = r.headers.get("content-type") || "";
  if (ct.includes("text/html")) {
    throw new Error(
      "Admin API returned a web page instead of JSON—usually the app is not reaching Cloud Run (redeploy the API with /api/auth/admin-login, or open /api/health on this site to verify). On Firebase Hosting, API calls must use same-origin /api (do not set VITE_API_BASE_URL for production builds to this host)."
    );
  }
  if (!r.ok) {
    let msg = await r.text();
    try {
      const j = JSON.parse(msg) as { message?: string; error?: string };
      if (j.message) msg = j.message;
      else if (j.error === "invalid_credentials") msg = "Invalid username or password.";
      else if (j.error === "admin_login_not_configured") msg = j.message || "Set ADMIN_PASSWORD on the server.";
      else if (j.error === "admin_token_unavailable") msg = j.message || "Server could not create an admin session.";
      else if (j.error) msg = j.message || j.error;
    } catch {
      /* use raw */
    }
    throw new Error(msg || "Admin sign-in failed");
  }
  const j = (await r.json()) as { token?: string; apiKey?: string };
  const cred = j.token ?? j.apiKey;
  if (!cred) throw new Error("Invalid server response");
  return cred;
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
  /** Server-computed label for completed checkouts in this app */
  paymentStatus?: string;
  orderStatus?: string;
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
