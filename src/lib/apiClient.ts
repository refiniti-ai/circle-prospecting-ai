import type { ListingPayload, RadiusId } from "./listingData";
import type { PlanId } from "./pricing";
import { apiBase } from "./apiBase";

export async function fetchOrderById(id: string, signal?: AbortSignal): Promise<ListingPayload> {
  const r = await fetch(`${apiBase()}/api/orders/${encodeURIComponent(id)}`, {
    method: "GET",
    signal,
    headers: { Accept: "application/json" },
  });
  if (r.status === 404) throw new Error("not_found");
  if (!r.ok) throw new Error("fetch_failed");
  return (await r.json()) as ListingPayload;
}

export type CheckoutResult =
  | { ok: true; url: string; sessionId: string; amountCents: number }
  | { ok: false; unconfigured: true; message: string; amountCents: number; orderId: string; plan: string; radius: string };

export async function startCheckout(
  p: { orderId: string; plan: PlanId; radius: RadiusId },
  signal?: AbortSignal
): Promise<CheckoutResult> {
  const clientIdempotency = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `idem-${Date.now()}`;
  const r = await fetch(`${apiBase()}/api/checkout`, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ ...p, clientIdempotency }),
  });
  if (r.status === 503) {
    const j = (await r.json()) as { mode?: string; message?: string; amountCents: number; orderId: string; plan: string; radius: string };
    if (j?.mode === "unconfigured") {
      return { ok: false, unconfigured: true, message: j.message || "Stripe not configured", amountCents: j.amountCents, orderId: j.orderId, plan: j.plan, radius: j.radius };
    }
  }
  if (!r.ok) {
    const t = await r.text();
    throw new Error(t || "checkout failed");
  }
  const j = (await r.json()) as { url: string; sessionId: string; amountCents: number };
  return { ok: true, url: j.url, sessionId: j.sessionId, amountCents: j.amountCents };
}

export async function fetchHealth(): Promise<{ status: string }> {
  const r = await fetch(`${apiBase()}/api/health`);
  if (!r.ok) throw new Error("health");
  return (await r.json()) as { status: string };
}
