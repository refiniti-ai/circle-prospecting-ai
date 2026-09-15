import type { Request, Response } from "express";
import { z } from "zod";
import { parseAgentRoleInput, type ListingAgentRole } from "../src/lib/listingAgents.js";
import {
  parseMlsCampaignPathSegment,
  resolveCampaignPath,
  type MlsCampaignPathSegment,
} from "../src/lib/mlsCampaignPath.js";
import { isCircleAppDbConfigured } from "./circleAppDb.js";
import {
  getCirclePayLink,
  getCirclePayLinkByMlsPath,
  listCirclePayLinksForContact,
  listCirclePayLinksForMls,
  upsertCirclePayLink,
  type CirclePayLinkRecord,
} from "./circleCrmStore.js";
import { opsLog } from "./opsLog.js";
import { buildMlsCheckoutUrl, buildTrackedPayLinkUrl } from "./payLinkTrack.js";
import { getRoofsListingByMls, isRoofsDbConfigured } from "./roofsMlsStore.js";
import type { GhlContactPrefillHit } from "./ghlContactFetch.js";
import type { GhlContactView } from "./ghlContactFetch.js";
import { PAY_LINK_FIELD_KEYS } from "./ghlContactFetch.js";

const awsPayLinkBody = z.preprocess(
  (raw) => {
    if (typeof raw !== "object" || raw === null) return raw;
    const o = raw as Record<string, unknown>;
    const q = (v: unknown) => (typeof v === "string" ? v.trim() : v);
    return {
      contactId: q(o.contactId) || q(o.contact_id) || q(o.id) || "",
      mls: q(o.mls) || q(o.MLS) || q(o.mlsNumber) || "",
      email: q(o.email) || "",
      name: q(o.name) || q(o.agentName) || q(o.agent_name) || "",
      phone: q(o.phone) || "",
      brokerage: q(o.brokerage) || "",
      agentRole: q(o.agentRole) || q(o.agent_role) || q(o.role) || "",
      campaignPath: q(o.campaignPath) || q(o.campaign_path) || q(o.type) || "",
    };
  },
  z.object({
    contactId: z.string().trim().max(120).optional(),
    mls: z.string().trim().min(3).max(40),
    email: z.union([z.string().email(), z.literal("")]).optional(),
    name: z.string().trim().max(120).optional(),
    phone: z.string().trim().max(40).optional(),
    brokerage: z.string().trim().max(120).optional(),
    agentRole: z.string().trim().max(20).optional(),
    campaignPath: z.string().trim().max(20).optional(),
  })
);

function splitName(name: string | null | undefined): { firstName: string | null; lastName: string | null } {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: null, lastName: null };
  return { firstName: parts[0] ?? null, lastName: parts.slice(1).join(" ") || null };
}

async function campaignPathForMls(
  mls: string,
  agentRole?: ListingAgentRole,
  campaignFromBody?: MlsCampaignPathSegment
): Promise<MlsCampaignPathSegment> {
  if (campaignFromBody) return campaignFromBody;
  if (isRoofsDbConfigured()) {
    try {
      const listing = await getRoofsListingByMls(mls);
      if (listing) {
        return resolveCampaignPath({
          listingType: listing.listingType,
          agentRole,
        });
      }
    } catch {
      /* roofs optional for URL shape */
    }
  }
  return resolveCampaignPath({ agentRole });
}

export async function createAwsPayLink(input: {
  mls: string;
  agentRole?: ListingAgentRole;
  campaignPath?: MlsCampaignPathSegment;
}): Promise<{
  payLink: CirclePayLinkRecord;
  checkoutUrl: string;
  trackedUrl: string;
  campaignPath: MlsCampaignPathSegment;
  agentRole?: ListingAgentRole;
}> {
  if (!isCircleAppDbConfigured()) {
    throw new Error("circle_db_unconfigured");
  }
  const mls = input.mls.trim().toUpperCase();
  if (!isRoofsDbConfigured()) {
    throw new Error("roofs_db_unconfigured");
  }
  const listing = await getRoofsListingByMls(mls);
  if (!listing) {
    throw new Error("listing_not_found");
  }
  const agentRole = input.agentRole;
  const campaignPath = await campaignPathForMls(mls, agentRole, input.campaignPath);

  const checkoutUrl = buildMlsCheckoutUrl(mls, { campaignPath, agentRole });
  const trackedUrl = buildTrackedPayLinkUrl("", mls, { campaignPath, agentRole });

  const payLink = await upsertCirclePayLink({
    contactId: "roofs",
    mls,
    campaignPath,
    agentRole: agentRole ?? null,
    payLinkUrl: checkoutUrl,
    trackedUrl,
    payload: { source: "aws", listingAddress: listing.address },
  });

  return { payLink, checkoutUrl, trackedUrl, campaignPath, agentRole };
}

export function awsPayLinkResponse(result: Awaited<ReturnType<typeof createAwsPayLink>>) {
  return {
    ok: true,
    url: result.trackedUrl,
    trackedUrl: result.trackedUrl,
    checkoutUrl: result.checkoutUrl,
    payLinkUrl: result.checkoutUrl,
    destinationUrl: result.checkoutUrl,
    finalLinkUrl: result.trackedUrl,
    mls: result.payLink.mls,
    agentRole: result.agentRole ?? null,
    campaignPath: result.campaignPath,
    writeTarget: "circle" as const,
    ghl: { ok: true, skipped: true, mode: "aws" as const, status: 204 },
  };
}

export async function handleAwsGeneratePayLink(req: Request, res: Response): Promise<void> {
  if (!isCircleAppDbConfigured()) {
    res.status(503).json({
      error: "circle_db_unconfigured",
      message: "AWS CRM needs the circle database on App Runner (CIRCLE_APP_DB_NAME).",
    });
    return;
  }

  const parsed = awsPayLinkBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body", details: parsed.error.flatten() });
    return;
  }

  const { mls, agentRole: roleRaw, campaignPath: pathRaw } = parsed.data;
  const agentRole = parseAgentRoleInput(roleRaw || "") ?? undefined;
  const campaignPath = parseMlsCampaignPathSegment(pathRaw || "") ?? undefined;

  try {
    const result = await createAwsPayLink({
      mls,
      agentRole,
      campaignPath: campaignPath ?? undefined,
    });
    opsLog("pay_link_generated", {
      mls: result.payLink.mls,
      campaignPath: result.campaignPath,
      writeTarget: "circle",
      ghlOk: false,
      aws: true,
    });
    res.json(awsPayLinkResponse(result));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "pay_link_failed";
    if (msg === "listing_not_found") {
      res.status(404).json({ error: "listing_not_found", message: "No listing in roofs for this MLS." });
      return;
    }
    console.error("[circlePayLink] generate failed", e);
    res.status(502).json({ error: "pay_link_failed", message: msg });
  }
}

export async function handleAwsGetPayLink(req: Request, res: Response): Promise<void> {
  if (!isCircleAppDbConfigured()) {
    res.status(503).json({ error: "circle_db_unconfigured" });
    return;
  }
  const mls = String(req.query.mls || "").trim();
  const pathRaw = String(req.query.campaignPath || req.query.type || "").trim();
  const campaignPath = parseMlsCampaignPathSegment(pathRaw);
  if (!mls) {
    res.status(400).json({ error: "mls_required" });
    return;
  }
  try {
    if (campaignPath) {
      const payLink = await getCirclePayLinkByMlsPath(mls, campaignPath);
      if (!payLink) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      res.json({ ok: true, payLink });
      return;
    }
    const payLinks = await listCirclePayLinksForMls(mls);
    res.json({ ok: true, payLinks });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "lookup_failed";
    res.status(502).json({ error: "lookup_failed", message: msg });
  }
}

function prefillFromRoofsListing(
  listing: NonNullable<Awaited<ReturnType<typeof getRoofsListingByMls>>>,
  agentRole?: string | null
): GhlContactPrefillHit {
  const agent =
    agentRole === "buyer" && listing.buyerAgent?.name ? listing.buyerAgent : listing.sellerAgent;
  const tail = (listing.cityStateZip || "").split(",").map((s) => s.trim());
  const stZip = (tail[1] || "").split(/\s+/);
  return {
    id: listing.mls,
    name: agent?.name || listing.agentName || "",
    email: agent?.email || listing.email || null,
    phone: agent?.phone || listing.phone || null,
    mls: listing.mls,
    listingAddress: listing.address || null,
    city: tail[0] || null,
    state: stZip[0] || null,
    zip: listing.zip || stZip[1] || null,
    realtorName: agent?.name || listing.agentName || null,
    brokerageName: agent?.brokerage || listing.brokerage || null,
    agentType: agentRole === "buyer" ? "Buyer" : "Listing",
    listingType: listing.listingType || null,
    listingPhotoUrl: listing.listingPhotoUrl || null,
    subdivisionHomeOwners: String(listing.radii?.subdivision?.count ?? "") || null,
    oneFourthMileHomeOwners: String(listing.radii?.q1?.count ?? "") || null,
    halfMileHomeOwners: String(listing.radii?.h1?.count ?? "") || null,
    oneMileHomeOwners: String(listing.radii?.m1?.count ?? "") || null,
    zipcodeHomeOwners: String(listing.radii?.zip?.count ?? "") || null,
  };
}

export async function circleContactToPrefill(
  contactId: string,
  requestedMls?: string
): Promise<GhlContactPrefillHit | null> {
  const mls = (requestedMls || contactId || "").trim().toUpperCase();
  if (mls.length < 3 || !isRoofsDbConfigured()) return null;
  const listing = await getRoofsListingByMls(mls);
  if (!listing) return null;
  const link = await getCirclePayLink(contactId, mls);
  return prefillFromRoofsListing(listing, link?.agentRole);
}

export async function circleContactToView(contactId: string): Promise<GhlContactView | null> {
  const hit = await circleContactToPrefill(contactId, contactId);
  if (!hit) return null;
  const { firstName, lastName } = splitName(hit.name);
  const fields = Object.fromEntries(PAY_LINK_FIELD_KEYS.map((k) => [k, null])) as GhlContactView["fields"];
  fields.email = hit.email;
  fields.phone = hit.phone;
  fields.first_name = firstName;
  fields.last_name = lastName;
  fields.realtor_name = hit.realtorName;
  fields.brokerage_name = hit.brokerageName;
  fields.mls = hit.mls;
  fields.listing_address = hit.listingAddress;
  return {
    id: hit.id,
    email: hit.email,
    phone: hit.phone,
    firstName,
    lastName,
    fields,
    raw: { email: hit.email, phone: hit.phone, name: hit.name, mls: hit.mls },
  };
}

export async function circleContactsToSearchHits(query: string, _limit = 12): Promise<GhlContactPrefillHit[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const hit = await circleContactToPrefill(q, q);
  return hit ? [hit] : [];
}

export async function circleContactsByMls(mls: string, _limit = 12): Promise<GhlContactPrefillHit[]> {
  const hit = await circleContactToPrefill(mls, mls);
  return hit ? [hit] : [];
}

export async function circleOpportunitiesSummary(contactId: string, limit = 50) {
  const mlsLike = contactId.trim().toUpperCase();
  const links =
    mlsLike.length >= 3
      ? await listCirclePayLinksForMls(mlsLike, limit)
      : await listCirclePayLinksForContact(contactId, limit);
  return links.map((row) => ({
    id: row.id,
    name: `${row.mls} · ${row.campaignPath || "listed"}`,
    mls: row.mls,
    payLinkUrl: row.payLinkUrl,
    finalLinkUrl: row.trackedUrl,
    campaignPath: row.campaignPath,
  }));
}
