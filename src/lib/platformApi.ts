import { apiBase } from "./apiBase";

export type PlatformActorHeaders = {
  tenantId: string;
  userId: string;
  role: "viewer" | "agent" | "admin" | "owner";
};

function actorHeaders(actor: PlatformActorHeaders) {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-Tenant-Id": actor.tenantId,
    "X-User-Id": actor.userId,
    "X-User-Role": actor.role,
  };
}

export async function fetchWorkflowSummary(actor: PlatformActorHeaders) {
  const r = await fetch(`${apiBase()}/api/platform/workflow/summary`, {
    headers: actorHeaders(actor),
  });
  if (!r.ok) throw new Error("workflow summary");
  return r.json();
}

export async function requestDemoCall(
  actor: PlatformActorHeaders,
  payload: { name: string; phone: string; email?: string; listingId?: string; preferredTime?: string }
) {
  const r = await fetch(`${apiBase()}/api/platform/calls/request`, {
    method: "POST",
    headers: actorHeaders(actor),
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function uploadCallTranscript(
  actor: PlatformActorHeaders,
  payload: { callRequestId: string; scriptTemplate: string; transcript: string }
) {
  const r = await fetch(`${apiBase()}/api/platform/calls/transcript`, {
    method: "POST",
    headers: actorHeaders(actor),
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function requestBooking(
  actor: PlatformActorHeaders,
  payload: {
    leadName: string;
    leadPhone: string;
    leadEmail?: string;
    provider: "google" | "outlook";
    requestedSlotIso: string;
  }
) {
  const r = await fetch(`${apiBase()}/api/platform/booking/request`, {
    method: "POST",
    headers: actorHeaders(actor),
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
