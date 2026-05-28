import Stripe from "stripe";
import {
  formatMoneyUsd,
  leadCountFitsTier,
  pricePerLeadUsd,
  serviceLineLabel,
  tierFromLeadCount,
  tierRowMeta,
  totalCentsForSelection,
  type LeadServiceLine,
  type LeadTierId,
} from "../src/lib/leadPricing.js";
import { canonicalCheckoutEmail } from "./checkoutIdentity.js";
import { parseDocumentQuery, type ParsedDocumentFields } from "./customFieldMap.js";
import { fetchOrderById, type ListingPayload, type RadiusId } from "./orderStore.js";
import { orderNumberFromSessionId } from "./purchaseConfirmStore.js";

export type DocumentLine = { label: string; value: string };

export type CampaignDocument = {
  kind: "quote" | "invoice";
  documentNumber: string;
  issuedAt: string;
  statusLabel: string;
  paymentStatus?: string;
  billTo: { name: string; email: string; phone: string; brokerage: string };
  listing: {
    mls: string;
    address: string;
    cityStateZip: string;
    county: string;
    listPrice: string;
  } | null;
  campaignType: string;
  targetRing: string;
  homes: number;
  serviceLine: string;
  serviceLineId: LeadServiceLine;
  planBand: string;
  leadTier: LeadTierId;
  perHomeUsd: number;
  totalUsd: number;
  totalCents: number;
  tierBandOk: boolean;
  summaryLines: DocumentLine[];
  customFields: DocumentLine[];
  checkoutUrl: string | null;
  buyLeadsUrl: string | null;
};

function publicSiteBase(): string {
  return (process.env.APP_PUBLIC_URL || "https://circle-prospecting-ai.web.app").replace(/\/$/, "");
}

function campaignLabel(t?: "just_listed" | "just_sold"): string {
  if (t === "just_sold") return "Just sold";
  if (t === "just_listed") return "Just listed";
  return "Circle prospecting";
}

function resolveSelections(
  listing: ListingPayload | null,
  fields: ParsedDocumentFields
): {
  radiusId: RadiusId;
  homes: number;
  serviceLine: LeadServiceLine;
  leadTier: LeadTierId;
  campaignType: "just_listed" | "just_sold" | undefined;
} {
  const radiusId = fields.radiusId ?? "h1";
  const ringCount = listing?.radii[radiusId]?.count;
  const homes = fields.homes ?? ringCount ?? 500;
  const serviceLine = fields.serviceLine ?? "ai_outreach";
  const leadTier = fields.leadTier ?? tierFromLeadCount(homes);
  return { radiusId, homes, serviceLine, leadTier, campaignType: fields.campaignType };
}

function listingFromFields(fields: ParsedDocumentFields, base: ListingPayload | null): ListingPayload | null {
  if (base) return base;
  if (!fields.mls && !fields.address && !fields.agentName) return null;
  const zip = fields.zip || "00000";
  const cityStateZip =
    fields.city && fields.state
      ? `${fields.city}, ${fields.state} ${zip}`.trim()
      : fields.city || fields.address || `—`;
  return {
    id: fields.orderId || "quote",
    internalId: Number.parseInt(fields.orderId || "0", 10) || 0,
    mls: fields.mls || "—",
    address: fields.address || "—",
    cityStateZip,
    county: fields.county || "—",
    listPrice: fields.listPrice || "—",
    agentName: fields.agentName || "—",
    email: fields.email || "",
    phone: fields.phone || "",
    brokerage: fields.brokerage || "",
    lat: 28,
    lng: -82.7,
    zip,
    radii: {
      subdivision: { label: "Subdivision", count: fields.homes ?? 0 },
      q1: { label: "¼ Mile", count: fields.homes ?? 0 },
      h1: { label: "½ Mile", count: fields.homes ?? 0 },
      m1: { label: "1 Mile", count: fields.homes ?? 0 },
      zip: { label: `ZIP (${zip})`, count: fields.homes ?? 0 },
    },
  };
}

export async function buildQuoteDocument(query: Record<string, unknown>): Promise<CampaignDocument | null> {
  const fields = parseDocumentQuery(query);
  const orderId = fields.orderId;
  let listing: ListingPayload | null = null;
  if (orderId) {
    try {
      listing = await fetchOrderById(orderId);
    } catch {
      listing = null;
    }
  }
  listing = listingFromFields(fields, listing);
  if (!listing && !fields.homes && !fields.serviceLine) {
    return null;
  }

  const { radiusId, homes, serviceLine, leadTier, campaignType } = resolveSelections(listing, fields);
  const ringLabel = listing?.radii[radiusId]?.label ?? radiusId;
  const perHome = pricePerLeadUsd(serviceLine, leadTier);
  const totalCents = totalCentsForSelection(serviceLine, leadTier, homes);
  const tierOk = leadCountFitsTier(homes, leadTier);
  const base = publicSiteBase();
  const orderRef = listing?.id || orderId || fields.mls || "draft";
  const qs = new URLSearchParams();
  if (listing?.mls) qs.set("mls", listing.mls);
  else if (orderRef) qs.set("order", orderRef);
  if (campaignType) qs.set("campaign", campaignType);
  qs.set("radius", radiusId);
  qs.set("homes", String(homes));
  qs.set("serviceLine", serviceLine);
  qs.set("leadTier", leadTier);

  const summaryLines: DocumentLine[] = [
    { label: "Campaign", value: campaignLabel(campaignType) },
    { label: "Target ring", value: ringLabel },
    { label: "Homeowners in order", value: homes.toLocaleString() },
    { label: "Service", value: serviceLineLabel(serviceLine) },
    { label: "Plan band", value: `${tierRowMeta(leadTier).packageLabel} (${tierRowMeta(leadTier).homesLabel} homes)` },
    { label: "Rate per home", value: formatMoneyUsd(perHome) },
  ];

  const customFields: DocumentLine[] = fields.extras.map((e) => ({ label: e.label, value: e.value }));

  return {
    kind: "quote",
    documentNumber: `Q-${orderRef}`,
    issuedAt: new Date().toISOString(),
    statusLabel: tierOk ? "Quote — ready for checkout" : "Quote — review plan band",
    billTo: {
      name: listing?.agentName || fields.agentName || "—",
      email: listing?.email || fields.email || "",
      phone: listing?.phone || fields.phone || "",
      brokerage: listing?.brokerage || fields.brokerage || "",
    },
    listing: listing
      ? {
          mls: listing.mls,
          address: listing.address,
          cityStateZip: listing.cityStateZip,
          county: listing.county,
          listPrice: listing.listPrice,
        }
      : null,
    campaignType: campaignLabel(campaignType),
    targetRing: ringLabel,
    homes,
    serviceLine: serviceLineLabel(serviceLine),
    serviceLineId: serviceLine,
    planBand: tierRowMeta(leadTier).packageLabel,
    leadTier,
    perHomeUsd: perHome,
    totalUsd: totalCents / 100,
    totalCents,
    tierBandOk: tierOk,
    summaryLines,
    customFields,
    checkoutUrl: listing ? `${base}/buy-leads?${qs.toString()}` : `${base}/buy-leads?${qs.toString()}`,
    buyLeadsUrl: `${base}/buy-leads?${qs.toString()}`,
  };
}

export async function buildInvoiceDocument(sessionId: string): Promise<CampaignDocument | null> {
  const sk = process.env.STRIPE_SECRET_KEY;
  if (!sk) return null;
  const stripe = new Stripe(sk);
  const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["line_items"] });
  const meta = session.metadata || {};
  const query: Record<string, string> = { ...meta };
  if (meta.packSize) query.homes = meta.packSize;
  if (meta.requestedLeads) query.homes = meta.requestedLeads;
  const fields = parseDocumentQuery(query);
  fields.orderId = fields.orderId || meta.orderId || undefined;

  let listing: ListingPayload | null = null;
  if (fields.orderId) {
    try {
      listing = await fetchOrderById(fields.orderId);
    } catch {
      listing = null;
    }
  }

  const parsedHomes = Number.parseInt(String(meta.requestedLeads || meta.packSize || "0"), 10);
  const homes =
    fields.homes ??
    (Number.isFinite(parsedHomes) && parsedHomes > 0 ? parsedHomes : listing ? listing.radii.h1.count : 0);
  const serviceLine = (fields.serviceLine || (meta.serviceLine as LeadServiceLine) || "ai_outreach") as LeadServiceLine;
  const leadTier = (fields.leadTier || (meta.leadTier as LeadTierId) || tierFromLeadCount(homes)) as LeadTierId;
  const campaignType =
    fields.campaignType ||
    (meta.campaignType === "just_sold" ? "just_sold" : meta.campaignType === "just_listed" ? "just_listed" : undefined);
  const radiusId = fields.radiusId ?? "h1";
  const perHome = pricePerLeadUsd(serviceLine, leadTier);
  const totalCents = session.amount_total ?? totalCentsForSelection(serviceLine, leadTier, homes);
  const ringLabel = listing?.radii[radiusId]?.label ?? (meta.radiusMiles ? `${meta.radiusMiles} mi` : "—");
  const email = canonicalCheckoutEmail(session) || fields.email || listing?.email || "";
  const orderNumber = orderNumberFromSessionId(session.id);

  const targeting = [meta.city, meta.county, meta.zip].filter(Boolean).join(", ");
  const summaryLines: DocumentLine[] = [
    { label: "Campaign", value: campaignLabel(campaignType) },
    { label: "Target area", value: targeting || ringLabel },
    { label: "Homeowners in order", value: homes.toLocaleString() },
    { label: "Service", value: serviceLineLabel(serviceLine) },
    { label: "Plan band", value: tierRowMeta(leadTier).packageLabel },
    { label: "Rate per home", value: formatMoneyUsd(perHome) },
    { label: "Payment status", value: session.payment_status || "—" },
  ];

  const skipMeta = new Set([
    "checkoutType",
    "customerEmail",
    "customerPhone",
    "packSize",
    "requestedLeads",
    "serviceLine",
    "leadTier",
    "campaignType",
    "city",
    "county",
    "zip",
    "radiusMiles",
  ]);
  const customFields: DocumentLine[] = [
    ...fields.extras.map((e) => ({ label: e.label, value: e.value })),
    ...Object.entries(meta)
      .filter(([k, v]) => v && !skipMeta.has(k))
      .map(([k, v]) => ({
        label: k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()),
        value: String(v),
      })),
  ];

  return {
    kind: "invoice",
    documentNumber: orderNumber,
    issuedAt: new Date().toISOString(),
    statusLabel: session.payment_status === "paid" ? "Paid in full" : "Invoice",
    paymentStatus: session.payment_status || undefined,
    billTo: {
      name: listing?.agentName || fields.agentName || email || "Customer",
      email,
      phone: listing?.phone || fields.phone || String(meta.customerPhone || ""),
      brokerage: listing?.brokerage || fields.brokerage || "",
    },
    listing: listing
      ? {
          mls: listing.mls,
          address: listing.address,
          cityStateZip: listing.cityStateZip,
          county: listing.county,
          listPrice: listing.listPrice,
        }
      : null,
    campaignType: campaignLabel(campaignType),
    targetRing: ringLabel,
    homes,
    serviceLine: serviceLineLabel(serviceLine),
    serviceLineId: serviceLine,
    planBand: tierRowMeta(leadTier).packageLabel,
    leadTier,
    perHomeUsd: perHome,
    totalUsd: (totalCents ?? 0) / 100,
    totalCents: totalCents ?? 0,
    tierBandOk: leadCountFitsTier(homes, leadTier),
    summaryLines,
    customFields,
    checkoutUrl: null,
    buyLeadsUrl: null,
  };
}
