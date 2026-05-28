import { inboundNewListingSchema } from "./workflowTypes.js";
import { upsertOrder, type ListingPayload } from "./orderStore.js";
import { upsertGhlContactAndOpportunity } from "./ghlClient.js";
import { buildMarketingEmail, sendMarketingEmail } from "./mailer.js";

function parseCityStateZip(v: string | undefined, zip: string | undefined) {
  if (v && v.trim()) return v.trim();
  return `Unknown, FL ${zip || ""}`.trim();
}

export async function processInboundNewListing(raw: unknown) {
  const parsed = inboundNewListingSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, status: 400, error: parsed.error.flatten() };
  }
  const p = parsed.data;
  const l = p.listing;
  const a = p.agent;

  const internalId = l?.internalId ?? l?.id ?? p.internalId ?? 0;
  const id = String(internalId || 948);
  const cityStateZip = parseCityStateZip(l?.cityStateZip ?? p.cityStateZip, l?.zip ?? p.zip);
  const zip = l?.zip ?? p.zip ?? "00000";
  const counts = p.radiusCounts || {
    subdivision: p.subdivision ?? 0,
    q1: p.q1 ?? 0,
    h1: p.h1 ?? 0,
    m1: p.m1 ?? 0,
    zip: p.zipCount ?? 0,
  };

  const listing: ListingPayload = {
    id,
    internalId: Number.parseInt(id, 10) || 948,
    mls: l?.mls || p.mls || "UNKNOWN-MLS",
    address: l?.address || p.address || "Unknown Address",
    cityStateZip,
    county: l?.county || p.county || "Unknown",
    listPrice: l?.listPrice || p.listPrice || "$0",
    agentName: a?.name || p.agentName || "Agent",
    email: a?.email || p.email || "unknown@example.com",
    phone: a?.phone || p.phone || "",
    brokerage: a?.brokerage || p.brokerage || "",
    lat: l?.lat ?? p.lat ?? 28.0,
    lng: l?.lng ?? p.lng ?? -82.7,
    zip,
    createdAt: l?.createdAt || p.createdAt || new Date().toISOString(),
    radii: {
      subdivision: { label: "Subdivision", count: counts.subdivision },
      q1: { label: "¼ Mile", count: counts.q1 },
      h1: { label: "½ Mile", count: counts.h1 },
      m1: { label: "1 Mile", count: counts.m1 },
      zip: { label: `ZIP (${zip})`, count: counts.zip },
    },
  };

  upsertOrder(listing);
  const orderLink = `${(process.env.APP_PUBLIC_URL || "http://localhost:5173").replace(/\/$/, "")}/order/${listing.id}`;

  const ghl = await upsertGhlContactAndOpportunity({
    orderId: listing.id,
    mls: listing.mls,
    address: listing.address,
    cityStateZip: listing.cityStateZip,
    agentName: listing.agentName,
    email: listing.email,
    phone: listing.phone,
    brokerage: listing.brokerage,
    pipelineName: "Circle Prospecting Orders",
    stageName: "New Listing Received",
  });

  const emailMsg = buildMarketingEmail({
    agentName: listing.agentName,
    address: listing.address,
    cityStateZip: listing.cityStateZip,
    counts,
    orderLink,
  });
  const mail = await sendMarketingEmail(listing.email, emailMsg.subject, emailMsg.body);

  return {
    ok: true as const,
    status: 200,
    orderId: listing.id,
    orderLink,
    workflow: {
      listingStored: true,
      ghlContactOpportunity: ghl.mode,
      emailSent: mail.mode,
    },
  };
}
