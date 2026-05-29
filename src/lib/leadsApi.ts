import { apiBase } from "./apiBase";
import { isProductionSiteHost } from "./siteUrl";
import { type LeadServiceLine, type LeadTierId } from "./leadPricing";

function isLiveFirebaseHost(): boolean {
  if (typeof window === "undefined") return false;
  return isProductionSiteHost(window.location.hostname);
}

function assertJsonResponse(r: Response, context: string): void {
  const ct = r.headers.get("content-type") || "";
  if (ct.includes("text/html")) {
    const live =
      import.meta.env.PROD && isLiveFirebaseHost()
        ? " On production this usually means the API on Cloud Run is not updated (redeploy with the latest server) or /api is not reaching Cloud Run."
        : "";
    throw new Error(
      `${context}: received a web page instead of JSON.${live} For local dev, run the API and use VITE_API_BASE_URL or npm run dev (see .env.example).`
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
  /** Buyer vs seller agent placing this order (dual-agent listings). */
  agentRole?: "buyer" | "seller";
  /** Beta promo code — server validates and applies $0.50/home when valid. */
  promoCode?: string;
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
    body: JSON.stringify({
      serviceLine,
      leadTier,
      email,
      phone,
      city: context?.city,
      county: context?.county,
      zip: context?.zip,
      radiusMiles: context?.radiusMiles,
      requestedLeads: context?.requestedLeads,
      campaignType: context?.campaignType,
      agentRole: context?.agentRole,
      promoCode: context?.promoCode,
    }),
  });
  assertJsonResponse(r, "Checkout");
  if (r.status === 503) {
    const j = (await r.json()) as { message?: string };
    throw new Error(j.message || "Stripe is not configured on the server");
  }
  if (!r.ok) {
    let msg = await r.text();
    try {
      const j = JSON.parse(msg) as { message?: string };
      if (typeof j.message === "string" && j.message.trim()) msg = j.message;
    } catch {
      /* use raw body */
    }
    throw new Error(msg.trim() || "Checkout failed");
  }
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

export type ContactFormPayload = {
  name: string;
  email: string;
  phone?: string;
  message: string;
  /** Honeypot — leave empty */
  company?: string;
};

export async function submitContactForm(payload: ContactFormPayload) {
  const r = await fetch(`${apiBase()}/api/public/contact`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });
  assertJsonResponse(r, "Contact");
  if (r.status === 503) {
    let msg = "Email is not configured on the server.";
    try {
      const j = (await r.json()) as { message?: string };
      if (typeof j.message === "string" && j.message.trim()) msg = j.message;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  if (!r.ok) {
    let msg = await r.text();
    try {
      const j = JSON.parse(msg) as { message?: string };
      if (typeof j.message === "string" && j.message.trim()) msg = j.message;
    } catch {
      /* use raw */
    }
    throw new Error(msg.trim() || "Could not send message.");
  }
  return (await r.json()) as { ok: true };
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

/** Ensures Firestore purchase row + fulfillment side effects (idempotent). Call from thank-you when payment is paid. */
export async function syncPaidCheckoutSession(sessionId: string) {
  let r: Response;
  try {
    r = await fetch(`${apiBase()}/api/checkout/sync-paid-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ session_id: sessionId.trim() }),
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
  assertJsonResponse(r, "Sync paid checkout");
  if (!r.ok) {
    let msg = await r.text();
    try {
      const j = JSON.parse(msg) as { message?: string; error?: string; paymentStatus?: string };
      if (j.message) msg = j.message;
      else if (j.error === "not_paid" && j.paymentStatus) msg = `Payment not complete yet (${j.paymentStatus}).`;
      else if (j.error) msg = j.error;
    } catch {
      /* use raw */
    }
    throw new Error(msg || "Could not sync purchase");
  }
  return (await r.json()) as { ok: true; orderNumber: string };
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
  /** Order / fulfillment label: lead packs show Processing until admin marks complete */
  orderStatus?: string;
  leadWorkStatus?: "pending" | "completed" | null;
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
  leadWorkStatus?: "pending" | "completed" | null;
};

export async function fetchAdminPurchases(adminKey: string) {
  const r = await fetch(`${apiBase()}/api/admin/purchases`, {
    headers: { Authorization: `Bearer ${adminKey}`, Accept: "application/json" },
  });
  assertJsonResponse(r, "Admin purchases");
  if (!r.ok) throw new Error("purchases");
  return (await r.json()) as { purchases: AdminPurchaseRow[] };
}

export async function adminSetPurchaseLeadWorkStatus(
  adminKey: string,
  sessionId: string,
  status: "pending" | "completed"
) {
  /** Fixed path + body (sessionId not in URL): same pattern as client-password-reset-link; avoids HTML SPA responses from edges mishandling long paths. */
  const r = await fetch(`${apiBase()}/api/admin/lead-work`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ sessionId, status }),
  });
  assertJsonResponse(r, "Lead work status");
  if (!r.ok) {
    let msg = await r.text();
    try {
      const j = JSON.parse(msg) as { message?: string; error?: string };
      if (j.message) msg = j.message;
      else if (j.error) msg = j.error;
    } catch {
      /* use raw */
    }
    throw new Error(msg || "Could not update status");
  }
  return (await r.json()) as { ok: true; sessionId: string; status: "pending" | "completed" };
}

/** When email is not configured, admins copy this URL and send it to the client manually. */
export async function adminCreateClientPasswordResetLink(adminKey: string, email: string) {
  const r = await fetch(`${apiBase()}/api/admin/client-password-reset-link`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ email: email.trim() }),
  });
  assertJsonResponse(r, "Client password reset link");
  if (!r.ok) {
    let msg = await r.text();
    try {
      const j = JSON.parse(msg) as { message?: string; error?: string };
      if (j.message) msg = j.message;
      else if (j.error === "not_found") msg = j.message || "No account for that email.";
      else if (j.error) msg = j.error;
    } catch {
      /* use raw */
    }
    throw new Error(msg || "Could not create link");
  }
  return (await r.json()) as { ok: true; link: string; expiresInMinutes: number };
}

/** Authenticated admin: verify current password, persist new hash (Firestore/file). */
export async function changeAdminPassword(adminKey: string, currentPassword: string, newPassword: string) {
  const r = await fetch(`${apiBase()}/api/admin/change-password`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  assertJsonResponse(r, "Admin change password");
  if (!r.ok) {
    let msg = await r.text();
    try {
      const j = JSON.parse(msg) as { message?: string; error?: string };
      if (j.message) msg = j.message;
      else if (j.error === "invalid_current_password") msg = j.message || "Current password is incorrect.";
      else if (j.error) msg = j.error;
    } catch {
      /* use raw */
    }
    throw new Error(msg || "Could not change password");
  }
  return (await r.json()) as { ok: true };
}

export async function fetchAdminClientAccounts(adminKey: string) {
  const r = await fetch(`${apiBase()}/api/admin/client-accounts`, {
    headers: { Authorization: `Bearer ${adminKey}` },
  });
  if (!r.ok) throw new Error("client-accounts");
  return (await r.json()) as { count: number; emails: string[] };
}

export type AdminSystemInfo = {
  status: "ok";
  time: string;
  firestore: boolean;
  inventory: { total: number; available: number; sold: number; updatedAt: string };
  nodeEnv: string | null;
  stripe: boolean;
  webhookSecret: boolean;
  mail: boolean;
  mailTransport: string;
  mailSetupHint?: string;
  adminEmail: boolean;
  appPublicUrl: boolean;
};

export async function fetchAdminSystem(adminKey: string) {
  const r = await fetch(`${apiBase()}/api/admin/system`, {
    headers: { Authorization: `Bearer ${adminKey}` },
  });
  if (!r.ok) throw new Error("system");
  return (await r.json()) as AdminSystemInfo;
}
