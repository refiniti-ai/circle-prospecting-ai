import { apiBase } from "./apiBase";

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
  serviceLineId: string;
  planBand: string;
  leadTier: string;
  perHomeUsd: number;
  totalUsd: number;
  totalCents: number;
  tierBandOk: boolean;
  summaryLines: { label: string; value: string }[];
  customFields: { label: string; value: string }[];
  checkoutUrl: string | null;
  buyLeadsUrl: string | null;
};

export async function fetchQuoteDocument(search: string, signal?: AbortSignal): Promise<CampaignDocument> {
  const q = search.startsWith("?") ? search : `?${search}`;
  const r = await fetch(`${apiBase()}/api/documents/quote${q}`, {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!r.ok) {
    const j = (await r.json().catch(() => ({}))) as { message?: string };
    throw new Error(j.message || "Could not build quote from these fields.");
  }
  return (await r.json()) as CampaignDocument;
}

export async function fetchInvoiceDocument(sessionId: string, signal?: AbortSignal): Promise<CampaignDocument> {
  const r = await fetch(
    `${apiBase()}/api/documents/invoice?session_id=${encodeURIComponent(sessionId)}`,
    { signal, headers: { Accept: "application/json" } }
  );
  if (!r.ok) throw new Error("Could not load invoice for this payment.");
  return (await r.json()) as CampaignDocument;
}
