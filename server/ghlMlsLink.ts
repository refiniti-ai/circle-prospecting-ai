import { z } from "zod";
import { parseAgentRoleInput, type ListingAgentRole } from "../src/lib/listingAgents.js";
import {
  resolveCampaignPath,
  type MlsCampaignPathSegment,
} from "../src/lib/mlsCampaignPath.js";
import {
  fetchGhlContact,
  searchGhlContactsByMls,
  updateGhlContactFields,
} from "./ghlContactFetch.js";
import {
  fetchGhlOpportunity,
  findGhlOpportunityByContactAndMls,
  listGhlOpportunitiesForContact,
  opportunityAgentType,
  opportunityListingType,
  opportunityMatchesMls,
  opportunityMls,
  readOpportunityField,
  resolveOpportunityListingMls,
  searchGhlOpportunitiesByMls,
  updateGhlOpportunityFields,
  extractMlsFromOpportunityName,
  type GhlOpportunityView,
  type OpportunityLookupDebug,
} from "./ghlOpportunityFetch.js";
import { opsLog } from "./opsLog.js";
import { buildTrackedPayLinkUrl, buildMlsCheckoutUrl } from "./payLinkTrack.js";
import { productionSiteBase } from "../src/lib/siteUrl.js";

export { buildMlsCheckoutUrl } from "./payLinkTrack.js";

/** GHL webhook body: contact id + optional MLS / buyer|seller role override */
export const ghlContactMlsLinkBody = z.preprocess(
  (raw) => {
    if (typeof raw !== "object" || raw === null) return raw;
    const o = raw as Record<string, unknown>;
    const q = (v: unknown) => (typeof v === "string" ? v.trim() : v);
    return {
      contactId:
        q(o.contactId) ||
        q(o.contactid) ||
        q(o.contact_id) ||
        q(o.ContactId) ||
        q(o.id) ||
        q((o as { contact?: { id?: unknown } }).contact?.id) ||
        "",
      mls: q(o.mls) || q(o.MLS) || q(o.mls_number) || q(o.mlsNumber) || "",
      agentRole:
        q(o.agentRole) ||
        q(o.agent_role) ||
        q(o.agent) ||
        q(o.agentType) ||
        q(o.agent_type) ||
        q(o["Agent Type"]) ||
        q(o.role) ||
        q(o.borS) ||
        q(o.bors) ||
        "",
      opportunityId:
        q(o.opportunityId) ||
        q(o.opportunityid) ||
        q(o.opportunity_id) ||
        q(o.OpportunityId) ||
        q(o.opp_id) ||
        q(o.oppId) ||
        q((o as { opportunity?: { id?: unknown } }).opportunity?.id) ||
        "",
    };
  },
  z.object({
    contactId: z.string().trim().min(1).max(120),
    opportunityId: z.string().trim().max(120).optional(),
    mls: z.string().trim().max(40).optional(),
    agentRole: z.string().trim().max(20).optional(),
  })
);

export type GhlContactMlsLinkBody = z.infer<typeof ghlContactMlsLinkBody>;

/** Read MLS from body or GHL contact custom field `mls`. */
export async function resolveMlsForGhlContact(contactId: string, mlsFromBody?: string): Promise<string> {
  let mls = mlsFromBody?.trim() || "";
  if (mls.length >= 3) return mls;
  const c = await fetchGhlContact(contactId);
  return (c.fields.mls || "").trim();
}

/** MLS for pay-link: body → opportunity (when id given) → contact (legacy only). */
export async function resolveMlsForPayLink(args: {
  contactId: string;
  opportunityId?: string;
  mlsFromBody?: string;
}): Promise<string> {
  const fromBody = args.mlsFromBody?.trim() || "";
  if (fromBody.length >= 3) return fromBody;

  const oppId = args.opportunityId?.trim();
  if (oppId) {
    const opp = await fetchGhlOpportunity(oppId);
    const fromOpp = opportunityMls(opp);
    if (fromOpp.length >= 3) return fromOpp;
    return "";
  }

  return resolveMlsForGhlContact(args.contactId);
}

const AGENT_ROLE_FIELD_FALLBACKS = [
  "agent_type",
  "agent_role",
  "listing_agent_role",
  "agent type",
  "bor_s",
];

function normFieldKey(k: string): string {
  return k.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function readContactField(
  contact: Awaited<ReturnType<typeof fetchGhlContact>>,
  key: string
): string | null {
  const k = normFieldKey(key);
  const fromTyped = (contact.fields as Record<string, string | null>)[k];
  if (fromTyped?.trim()) return fromTyped;
  if (contact.raw[k]?.trim()) return contact.raw[k];
  if (contact.raw[key]?.trim()) return contact.raw[key];
  return null;
}

/** buyer | seller from workflow body or GHL custom field (e.g. Agent Type → agent_type). */
export async function resolveAgentRoleForGhlContact(
  contactId: string,
  roleFromBody?: string
): Promise<ListingAgentRole | undefined> {
  const fromBody = parseAgentRoleInput(roleFromBody);
  if (fromBody) return fromBody;

  const c = await fetchGhlContact(contactId);
  const keys = [
    process.env.GHL_AGENT_ROLE_FIELD_KEY?.trim(),
    ...AGENT_ROLE_FIELD_FALLBACKS,
  ].filter(Boolean) as string[];

  for (const key of keys) {
    const role = parseAgentRoleInput(readContactField(c, key));
    if (role) return role;
  }

  for (const [rawKey, value] of Object.entries(c.raw)) {
    const nk = normFieldKey(rawKey);
    if (nk === "agent_type" || nk === "agent_role" || nk.endsWith("_agent_type")) {
      const role = parseAgentRoleInput(value);
      if (role) return role;
    }
  }

  return undefined;
}

/** Agent role for pay-link: body → opportunity (when id given) → contact (legacy). */
export async function resolveAgentRoleForPayLink(args: {
  contactId: string;
  opportunityId?: string;
  roleFromBody?: string;
}): Promise<ListingAgentRole | undefined> {
  const fromBody = parseAgentRoleInput(args.roleFromBody);
  if (fromBody) return fromBody;

  const oppId = args.opportunityId?.trim();
  if (oppId) {
    const opp = await fetchGhlOpportunity(oppId);
    const role = parseAgentRoleInput(opportunityAgentType(opp));
    if (role) return role;
  }

  return resolveAgentRoleForGhlContact(args.contactId, args.roleFromBody);
}

/** /listed|sold|buyer/mls/… from opportunity listing type + agent type. */
export async function resolveCampaignPathForPayLink(args: {
  contactId: string;
  opportunityId?: string;
  roleFromBody?: string;
}): Promise<MlsCampaignPathSegment> {
  const oppId = args.opportunityId?.trim();
  if (oppId) {
    try {
      const opp = await fetchGhlOpportunity(oppId);
      return resolveCampaignPath({
        listingType: opportunityListingType(opp),
        agentType: opportunityAgentType(opp) ?? undefined,
        agentRole: parseAgentRoleInput(args.roleFromBody) ?? undefined,
      });
    } catch {
      /* fall through */
    }
  }

  const role = await resolveAgentRoleForPayLink(args);
  return resolveCampaignPath({
    agentRole: role,
    agentType: args.roleFromBody,
  });
}

/** When GHL creates a duplicate contact, workflow may still send a deleted/stale contact id — recover via MLS search. */
export async function recoverPayLinkContactId(args: {
  contactId: string;
  mls: string;
  agentRole?: ListingAgentRole;
}): Promise<{ contactId: string; recovered: boolean }> {
  const requested = args.contactId.trim();
  try {
    await fetchGhlContact(requested);
    return { contactId: requested, recovered: false };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    const missing =
      msg === "contact_not_found" ||
      /contact not found/i.test(msg) ||
      /ghl_error_40[04]/i.test(msg);
    if (!missing) throw e;
  }

  const mls = args.mls.trim();
  if (mls.length < 3) throw new Error(`contact_not_found:${requested}`);

  const hits = await searchGhlContactsByMls(mls, 8);
  if (!hits.length) throw new Error(`contact_not_found:${requested}`);

  const roleNorm = args.agentRole;
  let pick = hits.find((h) => h.id === requested);
  if (!pick && roleNorm) {
    const want = roleNorm === "buyer" ? "buyer" : "listing";
    pick =
      hits.find((h) => {
        const t = (h.agentType || "").toLowerCase();
        return want === "buyer" ? t.includes("buyer") : t.includes("listing") || t.includes("seller");
      }) ?? hits[0];
  }
  if (!pick) pick = hits[0];

  opsLog("pay_link_contact_recovered", {
    requestedId: requested,
    recoveredId: pick.id,
    mls,
    agentRole: args.agentRole ?? "",
  });
  return { contactId: pick.id, recovered: true };
}

export type PayLinkOpportunityLookup =
  | "explicit"
  | "explicit_corrected"
  | "contact_mls"
  | "global_mls"
  | "none";

function payLinkMlsNorm(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

function payLinkLookupDelayMs(): number {
  const n = Number.parseInt(process.env.GHL_PAY_LINK_LOOKUP_RETRY_MS?.trim() || "2500", 10);
  return Number.isFinite(n) && n >= 0 ? Math.min(n, 10_000) : 2500;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** True when this opportunity is the right target for a pay-link write. */
function opportunityIsPayLinkTarget(
  opp: GhlOpportunityView,
  contactId: string,
  mlsNorm: string
): boolean {
  const cid = contactId.trim();
  if (opp.contactId?.trim() && opp.contactId.trim() !== cid) return false;
  if (opportunityMatchesMls(opp, mlsNorm)) return true;
  const listingMls = payLinkMlsNorm(resolveOpportunityListingMls(opp));
  if (listingMls.length >= 3) return listingMls === mlsNorm;
  return true;
}

/** Another listing is already on this opportunity — do not overwrite with a different MLS pay link. */
function opportunityHasConflictingListing(opp: GhlOpportunityView, mlsNorm: string): boolean {
  const listingMls = payLinkMlsNorm(resolveOpportunityListingMls(opp));
  if (listingMls.length >= 3 && listingMls !== mlsNorm) return true;
  return false;
}

/** Resolve where pay links should be saved — validates {{opportunity.id}} from GHL; auto-corrects wrong id. */
export async function resolvePayLinkOpportunityId(args: {
  contactId: string;
  mls: string;
  opportunityId?: string;
}): Promise<{
  opportunityId: string | null;
  lookup: PayLinkOpportunityLookup;
  lookupDebug?: OpportunityLookupDebug;
  requestedOpportunityId?: string;
  opportunityCorrected?: boolean;
}> {
  const mlsNorm = payLinkMlsNorm(args.mls);
  const explicit = args.opportunityId?.trim();

  if (explicit) {
    try {
      const opp = await fetchGhlOpportunity(explicit);
      if (opportunityIsPayLinkTarget(opp, args.contactId, mlsNorm)) {
        opsLog("pay_link_opp_resolve", {
          contactId: args.contactId,
          mls: args.mls,
          lookup: "explicit",
          opportunityId: explicit,
        });
        return { opportunityId: explicit, lookup: "explicit", requestedOpportunityId: explicit };
      }

      opsLog("pay_link_opp_explicit_rejected", {
        contactId: args.contactId,
        mls: args.mls,
        opportunityId: explicit,
        oppMls: opportunityMls(opp),
        oppName: opp.name ?? "",
        reason: "opportunity_mls_mismatch",
      });
    } catch {
      opsLog("pay_link_opp_explicit_rejected", {
        contactId: args.contactId,
        mls: args.mls,
        opportunityId: explicit,
        reason: "opportunity_not_found",
      });
    }

    const { opportunityId: corrected, debug } = await findGhlOpportunityByContactAndMls(
      args.contactId,
      args.mls
    );
    if (corrected) {
      opsLog("pay_link_opp_resolve", {
        contactId: args.contactId,
        mls: args.mls,
        lookup: "explicit_corrected",
        requestedOpportunityId: explicit,
        correctedOpportunityId: corrected,
      });
      return {
        opportunityId: corrected,
        lookup: "explicit_corrected",
        lookupDebug: debug,
        requestedOpportunityId: explicit,
        opportunityCorrected: true,
      };
    }

    return {
      opportunityId: null,
      lookup: "none",
      lookupDebug: debug,
      requestedOpportunityId: explicit,
    };
  }

  if (args.mls.trim().length >= 3) {
    const attemptLookup = () => findGhlOpportunityByContactAndMls(args.contactId, args.mls);

    let { opportunityId, debug } = await attemptLookup();
    if (!opportunityId && payLinkLookupDelayMs() > 0) {
      opsLog("pay_link_opp_retry_wait", {
        contactId: args.contactId,
        mls: args.mls,
        reason: debug.reason,
        delayMs: payLinkLookupDelayMs(),
      });
      await sleep(payLinkLookupDelayMs());
      ({ opportunityId, debug } = await attemptLookup());
    }

    if (opportunityId) {
      const lookup: PayLinkOpportunityLookup =
        debug.reason === "matched_global_mls_search" ? "global_mls" : "contact_mls";
      return { opportunityId, lookup, lookupDebug: debug };
    }
    opsLog("pay_link_opp_resolve", {
      contactId: args.contactId,
      mls: args.mls,
      lookup: "none",
      reason: debug.reason,
      listCount: debug.listCount,
      opportunities: debug.opportunities,
    });
    return { opportunityId: null, lookup: "none", lookupDebug: debug };
  }

  opsLog("pay_link_opp_resolve", {
    contactId: args.contactId,
    mls: args.mls,
    lookup: "none",
    reason: "mls_too_short_for_lookup",
  });
  return { opportunityId: null, lookup: "none" };
}

/** GHL fields that store the tracked /go link (e.g. final_link_url). Set to "none" to disable. */
export function payLinkDestinationFieldKeys(): string[] {
  const raw = process.env.GHL_PAY_LINK_DESTINATION_FIELD_KEY?.trim();
  if (raw?.toLowerCase() === "none" || raw?.toLowerCase() === "false") return [];
  if (raw) return [...new Set(raw.split(",").map((k) => k.trim()).filter(Boolean))];
  return ["final_link_url"];
}

/** Cal.com, website, and other static URLs welcome emails expect on contact/opportunity fields. */
export function welcomeEmailAuxiliaryFields(): Record<string, string> {
  const out: Record<string, string> = {};
  const websiteKey = process.env.GHL_WEBSITE_URL_FIELD_KEY?.trim() || "website_url";
  const bookKey = process.env.GHL_BOOK_CALL_URL_FIELD_KEY?.trim() || "book_call_url";
  const website =
    process.env.GHL_WEBSITE_URL?.trim() ||
    process.env.APP_PUBLIC_URL?.trim()?.replace(/\/$/, "") ||
    productionSiteBase();
  const bookCall =
    process.env.GHL_BOOK_CALL_URL?.trim() ||
    process.env.VITE_BOOK_CALL_URL?.trim() ||
    "https://cal.com/circleprospectingai-greg/15min";
  out[websiteKey] = website;
  out[bookKey] = bookCall;
  return out;
}

function shouldMirrorPayLinksToContact(): boolean {
  const raw = process.env.GHL_MIRROR_PAY_LINK_TO_CONTACT?.trim().toLowerCase();
  return raw !== "false" && raw !== "0" && raw !== "no";
}

export async function writeGhlMlsCheckoutLink(args: {
  contactId: string;
  mls: string;
  agentRole?: ListingAgentRole;
  campaignPath?: MlsCampaignPathSegment;
  listingType?: string | null;
  /** When set, pay links are written to this opportunity only — contact pay_link_url is not touched. */
  opportunityId?: string;
  /** GHL field(s) for direct checkout page — e.g. pay_link_url → /listed|sold|buyer/mls/… */
  fieldKeys: string[];
  /** GHL field(s) for tracked /go URL — defaults to final_link_url (emails + click logging) */
  destinationFieldKeys?: string[];
  /** When false, all fields get the direct checkout URL only. */
  useTrackedUrl?: boolean;
}): Promise<{
  url: string;
  trackedUrl: string;
  checkoutUrl: string;
  trackedFieldKeys: string[];
  destinationFieldKeys: string[];
  agentRole?: ListingAgentRole;
  writeTarget: "opportunity" | "contact";
  opportunityId?: string;
  ghl: { ok: boolean; status: number; message?: string };
  contactMirror?: { ok: boolean; status: number; message?: string; skipped?: boolean };
}> {
  const campaignPath =
    args.campaignPath ??
    resolveCampaignPath({
      agentRole: args.agentRole,
      listingType: args.listingType,
    });
  const checkoutUrl = buildMlsCheckoutUrl(args.mls, { campaignPath, agentRole: args.agentRole });
  const useTracked = args.useTrackedUrl !== false;
  const trackedUrl = buildTrackedPayLinkUrl(args.contactId, args.mls, {
    campaignPath,
    agentRole: args.agentRole,
  });
  const url = useTracked ? trackedUrl : checkoutUrl;

  const trackedFieldKeys = [...new Set(args.fieldKeys.map((k) => k.trim()).filter(Boolean))];
  const destinationFieldKeys = [
    ...new Set((args.destinationFieldKeys ?? payLinkDestinationFieldKeys()).map((k) => k.trim()).filter(Boolean)),
  ].filter((k) => !trackedFieldKeys.includes(k));

  const payload: Record<string, string> = {};
  for (const key of trackedFieldKeys) {
    payload[key] = checkoutUrl;
  }
  for (const key of destinationFieldKeys) {
    payload[key] = useTracked ? trackedUrl : checkoutUrl;
  }
  Object.assign(payload, welcomeEmailAuxiliaryFields());

  const oppId = args.opportunityId?.trim();
  const writeTarget: "opportunity" | "contact" = oppId ? "opportunity" : "contact";

  let ghl: { ok: boolean; status: number; message?: string } = { ok: false, status: 0, message: "ghl_not_configured" };
  let contactMirror: { ok: boolean; status: number; message?: string; skipped?: boolean } | undefined;
  try {
    if (oppId) {
      ghl = await updateGhlOpportunityFields(oppId, payload);
      if (shouldMirrorPayLinksToContact()) {
        try {
          contactMirror = await updateGhlContactFields(args.contactId, payload);
          opsLog("pay_link_contact_mirror", {
            contactId: args.contactId,
            opportunityId: oppId,
            mls: args.mls,
            ok: contactMirror.ok,
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "contact_mirror_failed";
          contactMirror = { ok: false, status: 0, message: msg };
          console.warn("[pay_link] contact mirror failed", args.contactId, msg);
        }
      } else {
        contactMirror = { ok: true, status: 204, skipped: true };
      }
    } else {
      ghl = await updateGhlContactFields(args.contactId, payload);
    }
  } catch (e) {
    ghl = { ok: false, status: 0, message: e instanceof Error ? e.message : "ghl_update_failed" };
  }

  return {
    url,
    trackedUrl,
    checkoutUrl,
    trackedFieldKeys,
    destinationFieldKeys,
    agentRole: args.agentRole,
    writeTarget,
    opportunityId: oppId || undefined,
    ghl,
    contactMirror,
  };
}

function opportunityPayLinkMatchesMls(opp: GhlOpportunityView, mls: string): boolean {
  const norm = payLinkMlsNorm(mls);
  if (norm.length < 3) return false;
  for (const key of ["pay_link_url", "final_link_url", "buy_leads_url"]) {
    const url = (readOpportunityField(opp, key) || "").toUpperCase();
    if (!url) continue;
    if (url.includes(norm) || url.includes(`/MLS/${norm}`)) return true;
  }
  return false;
}

/** All opportunities for a contact — paginated list plus global MLS search for opps missing from the list. */
async function collectAllContactOpportunities(contactId: string): Promise<GhlOpportunityView[]> {
  const cid = contactId.trim();
  const { opportunities: listed } = await listGhlOpportunitiesForContact(cid, 100);
  const byId = new Map<string, GhlOpportunityView>();

  const mlsCandidates = new Set<string>();
  for (const opp of listed) {
    let full = opp;
    try {
      full = await fetchGhlOpportunity(opp.id);
    } catch {
      /* use list row */
    }
    byId.set(full.id, full);
    const mls = resolveOpportunityListingMls(full);
    if (mls.length >= 3) mlsCandidates.add(payLinkMlsNorm(mls));
  }

  try {
    const contactMls = await resolveMlsForGhlContact(cid);
    if (contactMls.length >= 3) mlsCandidates.add(payLinkMlsNorm(contactMls));
  } catch {
    /* contact MLS optional */
  }

  for (const mlsNorm of mlsCandidates) {
    try {
      const global = await searchGhlOpportunitiesByMls(mlsNorm, 12);
      for (const hit of global) {
        if (!hit.id || byId.has(hit.id)) continue;
        try {
          const full = await fetchGhlOpportunity(hit.id);
          if ((full.contactId || "").trim() === cid) {
            byId.set(full.id, full);
            const mls = resolveOpportunityListingMls(full);
            if (mls.length >= 3) mlsCandidates.add(payLinkMlsNorm(mls));
          }
        } catch {
          /* skip */
        }
      }
    } catch {
      /* skip MLS */
    }
  }

  return [...byId.values()];
}

type PayLinkRefreshRow = {
  opportunityId: string;
  mls: string;
  trackedUrl: string;
  checkoutUrl: string;
  writeTarget: "opportunity" | "contact";
  ghl: { ok: boolean; status: number; message?: string };
  contactMirror?: { ok: boolean; status: number; message?: string; skipped?: boolean };
};

async function writePayLinksForContactOpportunities(
  contactId: string,
  options?: { onlyMissing?: boolean }
): Promise<{ contactId: string; refreshed: PayLinkRefreshRow[]; skipped: number }> {
  const payField = process.env.GHL_PAY_LINK_FIELD_KEY?.trim() || "pay_link_url";
  const onlyMissing = options?.onlyMissing === true;
  const opportunities = await collectAllContactOpportunities(contactId);
  const refreshed: PayLinkRefreshRow[] = [];
  let skipped = 0;

  for (const opp of opportunities) {
    let full = opp;
    try {
      full = await fetchGhlOpportunity(opp.id);
    } catch {
      /* use collected row */
    }
    const mls = resolveOpportunityListingMls(full);
    if (mls.length < 3) continue;
    if (onlyMissing && opportunityPayLinkMatchesMls(full, mls)) {
      skipped += 1;
      continue;
    }
    const listingType = opportunityListingType(full);
    const agentRole = parseAgentRoleInput(opportunityAgentType(full) ?? undefined);
    const campaignPath = resolveCampaignPath({
      listingType,
      agentType: opportunityAgentType(full) ?? undefined,
      agentRole,
    });
    const r = await writeGhlMlsCheckoutLink({
      contactId,
      opportunityId: full.id,
      mls,
      agentRole,
      campaignPath,
      listingType,
      fieldKeys: [payField],
    });
    refreshed.push({
      opportunityId: full.id,
      mls,
      trackedUrl: r.trackedUrl,
      checkoutUrl: r.checkoutUrl,
      writeTarget: r.writeTarget,
      ghl: r.ghl,
      contactMirror: r.contactMirror,
    });
  }

  if (!refreshed.length && !onlyMissing) {
    const mls = await resolveMlsForGhlContact(contactId);
    if (mls.length >= 3) {
      const agentRole = await resolveAgentRoleForGhlContact(contactId);
      const r = await writeGhlMlsCheckoutLink({
        contactId,
        mls,
        agentRole,
        fieldKeys: [payField],
      });
      refreshed.push({
        opportunityId: "",
        mls,
        trackedUrl: r.trackedUrl,
        checkoutUrl: r.checkoutUrl,
        writeTarget: r.writeTarget,
        ghl: r.ghl,
        contactMirror: r.contactMirror,
      });
    }
  }

  return { contactId, refreshed, skipped };
}

/** After each pay-link webhook — repair any sibling opportunities still missing or wrong URLs (no manual MLS list). */
export async function repairMissingPayLinksForContact(contactId: string): Promise<{
  contactId: string;
  refreshed: PayLinkRefreshRow[];
  skipped: number;
}> {
  const result = await writePayLinksForContactOpportunities(contactId, { onlyMissing: true });
  if (result.refreshed.length > 0) {
    opsLog("pay_link_auto_repair", {
      contactId,
      repaired: result.refreshed.length,
      skipped: result.skipped,
      opportunityIds: result.refreshed.map((r) => r.opportunityId).filter(Boolean),
    });
  }
  return result;
}

/** Re-run pay-link + welcome URL fields for every opportunity on a contact (fixes broken welcome emails). */
export async function refreshWelcomeLinksForContact(contactId: string): Promise<{
  contactId: string;
  refreshed: PayLinkRefreshRow[];
}> {
  const result = await writePayLinksForContactOpportunities(contactId, { onlyMissing: false });
  opsLog("welcome_links_refreshed", { contactId, count: result.refreshed.length });
  return { contactId, refreshed: result.refreshed };
}

/** Keep opportunity MLS in sync with the webhook body whenever pay links are written. */
export async function syncOpportunityMlsFromPayLink(args: {
  opportunityId: string;
  mls: string;
  lookupReason?: string;
}): Promise<{ attempted: boolean; skipped?: boolean; ok: boolean; status: number; message?: string }> {
  const oppId = args.opportunityId.trim();
  const mls = args.mls.trim();
  if (!oppId || mls.length < 3) {
    return { attempted: false, ok: true, status: 204 };
  }

  const next = mls.trim().toUpperCase().replace(/\s+/g, "");

  try {
    const opp = await fetchGhlOpportunity(oppId);
    const current = (opportunityMls(opp) || "").trim().toUpperCase().replace(/\s+/g, "");
    if (current === next) {
      return {
        attempted: false,
        skipped: true,
        ok: true,
        status: 204,
        message: "mls_already_set",
      };
    }
    if (current.length >= 3 && current !== next) {
      opsLog("pay_link_opp_mls_sync_skipped", {
        opportunityId: oppId,
        current,
        requested: next,
        reason: "protect_existing_listing_mls",
      });
      return {
        attempted: false,
        skipped: true,
        ok: true,
        status: 204,
        message: "protect_existing_listing_mls",
      };
    }
    const fromName = (extractMlsFromOpportunityName(opp.name) || "").trim().toUpperCase().replace(/\s+/g, "");
    if (fromName.length >= 3 && fromName !== next) {
      opsLog("pay_link_opp_mls_sync_skipped", {
        opportunityId: oppId,
        fromName,
        requested: next,
        reason: "protect_existing_listing_name",
      });
      return {
        attempted: false,
        skipped: true,
        ok: true,
        status: 204,
        message: "protect_existing_listing_name",
      };
    }
  } catch {
    /* Still attempt write only when field empty — below */
  }

  const ghl = await updateGhlOpportunityFields(oppId, { mls });
  opsLog("pay_link_opp_mls_sync", {
    opportunityId: oppId,
    mls,
    ok: ghl.ok,
    reason: args.lookupReason ?? "",
  });
  return { attempted: true, ...ghl };
}

/** @deprecated Use syncOpportunityMlsFromPayLink */
export async function backfillOpportunityMlsFromPayLink(args: {
  opportunityId: string;
  mls: string;
  lookupReason?: string;
}): Promise<{ attempted: boolean; ok: boolean; status: number; message?: string }> {
  return syncOpportunityMlsFromPayLink(args);
}
