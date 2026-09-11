import type { Request } from "express";
import type { ListingAgentRole } from "../src/lib/listingAgents.js";
import { parseAgentRoleInput } from "../src/lib/listingAgents.js";
import {
  parseMlsCampaignPathSegment,
  resolveCampaignPath,
  type MlsCampaignPathSegment,
} from "../src/lib/mlsCampaignPath.js";
import { buildMlsLeadsPath } from "../src/lib/mlsUrl.js";
import { productionSiteBase } from "../src/lib/siteUrl.js";
import { updateGhlContactFields } from "./ghlContactFetch.js";
import { countClicksForContact, recordPayLinkClick } from "./payLinkClickStore.js";
import { opsLog } from "./opsLog.js";
import { trackEvent } from "./analyticsStore.js";

const CONTACT_ID_RE = /^[A-Za-z0-9._-]{1,120}$/;
const MLS_RE = /^[A-Za-z0-9._-]{3,40}$/;

export function sanitizePayLinkContactId(raw: string): string | null {
  const t = raw.trim();
  return CONTACT_ID_RE.test(t) ? t : null;
}

export function sanitizePayLinkMls(raw: string): string | null {
  const t = raw.trim();
  return MLS_RE.test(t) ? t : null;
}

export function parsePayLinkCampaignPath(req: Request): MlsCampaignPathSegment | undefined {
  const raw =
    req.query.type ??
    req.query.campaignPath ??
    req.query.agent ??
    req.query.role ??
    req.query.borS ??
    req.query.bors ??
    req.query.agentRole;
  const seg = parseMlsCampaignPathSegment(Array.isArray(raw) ? String(raw[0]) : String(raw ?? ""));
  return seg ?? undefined;
}

export function parsePayLinkAgentRole(req: Request): ListingAgentRole | undefined {
  const raw =
    req.query.agent ??
    req.query.role ??
    req.query.borS ??
    req.query.bors ??
    req.query.agentRole;
  const role = parseAgentRoleInput(Array.isArray(raw) ? String(raw[0]) : String(raw ?? ""));
  return role ?? undefined;
}

/** Direct checkout URL — /listed|sold|buyer/mls/{MLS} (?c= when known). */
export function buildMlsCheckoutUrl(
  mls: string,
  opts?: {
    campaignPath?: MlsCampaignPathSegment;
    agentRole?: ListingAgentRole;
    listingType?: string | null;
    contactId?: string | null;
  }
): string {
  const campaignPath =
    opts?.campaignPath ??
    resolveCampaignPath({
      agentRole: opts?.agentRole,
      listingType: opts?.listingType,
    });
  const path = buildMlsLeadsPath(mls, {
    campaignPath,
    contactId: opts?.contactId?.trim() || undefined,
  });
  return `${productionSiteBase()}${path}`;
}

/** Tracked email / SMS link — logs click then redirects to /{listed|sold|buyer}/mls/{MLS}. */
export function buildTrackedPayLinkUrl(
  contactId: string,
  mls: string,
  opts?: {
    campaignPath?: MlsCampaignPathSegment;
    agentRole?: ListingAgentRole;
    listingType?: string | null;
  }
): string {
  const base = productionSiteBase();
  const campaignPath =
    opts?.campaignPath ??
    resolveCampaignPath({
      agentRole: opts?.agentRole,
      listingType: opts?.listingType,
    });
  const params = new URLSearchParams({
    c: contactId.trim(),
    mls: mls.trim(),
    type: campaignPath,
  });
  return `${base}/go?${params.toString()}`;
}

function clientIp(req: Request): string | undefined {
  const forwarded = req.header("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim();
  return req.socket.remoteAddress || undefined;
}

async function syncGhlPayLinkClick(contactId: string, clickedAt: string, clickCount: number): Promise<void> {
  const clickedKey = process.env.GHL_PAY_LINK_CLICKED_AT_FIELD_KEY?.trim();
  const countKey = process.env.GHL_PAY_LINK_CLICK_COUNT_FIELD_KEY?.trim();
  if (!clickedKey && !countKey) return;

  const payload: Record<string, string> = {};
  if (clickedKey) payload[clickedKey] = clickedAt;
  if (countKey) payload[countKey] = String(clickCount);

  try {
    await updateGhlContactFields(contactId, payload);
  } catch (e) {
    console.error("[payLinkTrack] GHL click sync failed", e);
  }
}

export async function handlePayLinkGo(req: Request): Promise<{ redirectUrl: string } | { error: string; status: number }> {
  const contactId = sanitizePayLinkContactId(String(req.query.c || req.query.contactId || ""));
  const mls = sanitizePayLinkMls(String(req.query.mls || req.query.m || ""));
  const campaignPath = parsePayLinkCampaignPath(req);
  const agentRole = parsePayLinkAgentRole(req);

  if (!contactId || !mls) {
    return { error: "invalid_params", status: 400 };
  }

  const redirectUrl = buildMlsCheckoutUrl(mls, { campaignPath, agentRole, contactId });
  const ip = clientIp(req);
  const userAgent = req.header("user-agent") || undefined;
  const referer = req.header("referer") || undefined;

  const click = await recordPayLinkClick({
    contactId,
    mls,
    agentRole: agentRole ?? (campaignPath === "buyer" ? "buyer" : campaignPath ? "seller" : undefined),
    ip,
    userAgent,
    referer,
  });
  const clickCount = await countClicksForContact(contactId);

  opsLog("pay_link_clicked", {
    contactId,
    mls,
    campaignPath: campaignPath ?? "",
    agentRole: agentRole ?? "",
    clickId: click.id,
    clickCount,
  });
  trackEvent({
    event: "pay_link_click",
    tenantId: "ghl",
    metadata: {
      contactId,
      mls,
      campaignPath: campaignPath ?? "",
      agentRole: agentRole ?? "",
      clickCount: String(clickCount),
    },
  });

  void syncGhlPayLinkClick(contactId, click.clickedAt, clickCount);

  return { redirectUrl };
}
