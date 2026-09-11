import axios from "axios";
import type { SearchCatchKind } from "./searchCatcherStore.js";

const PIPELINE_NAME = process.env.GHL_SEARCH_PIPELINE_NAME?.trim() || "Website searches";
const STAGE_NAME = process.env.GHL_SEARCH_PIPELINE_STAGE_NAME?.trim() || "New search";

type PipelineIds = { pipelineId: string; stageId: string };

let cachedIds: PipelineIds | null = null;
let cachedAt = 0;
const CACHE_MS = 10 * 60_000;

function ghlApiBase(): string {
  return (process.env.GHL_API_BASE_URL?.trim() || "https://services.leadconnectorhq.com").replace(/\/$/, "");
}

function ghlApiVersion(): string {
  return process.env.GHL_API_VERSION?.trim() || "2021-07-28";
}

function ghlLocationId(): string | null {
  return process.env.GHL_LOCATION_ID?.trim() || process.env.HIGHLEVEL_LOCATION_ID?.trim() || null;
}

function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Version: ghlApiVersion(),
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length >= 10) return `+${digits}`;
  return raw.trim();
}

async function resolvePipelineIds(token: string, locationId: string): Promise<PipelineIds> {
  const envPipeline = process.env.GHL_SEARCH_PIPELINE_ID?.trim();
  const envStage = process.env.GHL_SEARCH_PIPELINE_STAGE_ID?.trim();
  if (envPipeline && envStage) return { pipelineId: envPipeline, stageId: envStage };

  if (cachedIds && Date.now() - cachedAt < CACHE_MS) return cachedIds;

  const r = await axios.get(`${ghlApiBase()}/opportunities/pipelines`, {
    headers: authHeaders(token),
    params: { locationId },
    timeout: 20_000,
    validateStatus: () => true,
  });
  if (r.status < 200 || r.status >= 300) {
    throw new Error(`ghl_pipelines_${r.status}`);
  }
  const pipelines = Array.isArray(r.data?.pipelines) ? r.data.pipelines : [];
  const pipe = pipelines.find(
    (p: { name?: string }) => String(p.name || "").trim().toLowerCase() === PIPELINE_NAME.toLowerCase()
  ) as { id?: string; stages?: Array<{ id?: string; name?: string }> } | undefined;
  if (!pipe?.id) throw new Error(`ghl_pipeline_not_found:${PIPELINE_NAME}`);
  const stage = (pipe.stages || []).find(
    (s) => String(s.name || "").trim().toLowerCase() === STAGE_NAME.toLowerCase()
  );
  const stageId = stage?.id || pipe.stages?.[0]?.id;
  if (!stageId) throw new Error(`ghl_stage_not_found:${STAGE_NAME}`);

  cachedIds = { pipelineId: String(pipe.id), stageId: String(stageId) };
  cachedAt = Date.now();
  return cachedIds;
}

async function contactAlreadyInPipeline(
  token: string,
  locationId: string,
  contactId: string,
  pipelineId: string
): Promise<boolean> {
  const r = await axios.get(`${ghlApiBase()}/opportunities/search`, {
    headers: authHeaders(token),
    params: {
      location_id: locationId,
      contact_id: contactId,
      pipeline_id: pipelineId,
      limit: "5",
      page: "1",
    },
    timeout: 20_000,
    validateStatus: () => true,
  });
  if (r.status < 200 || r.status >= 300) return false;
  const rows = Array.isArray(r.data?.opportunities) ? r.data.opportunities : [];
  return rows.length > 0;
}

async function upsertContact(args: {
  token: string;
  locationId: string;
  email: string | null;
  phone: string | null;
  name: string | null;
}): Promise<string> {
  const body: Record<string, string> = {
    locationId: args.locationId,
    source: "Website search",
  };
  if (args.email) body.email = args.email;
  if (args.phone) body.phone = args.phone;
  if (args.name) body.name = args.name;

  const r = await axios.post(`${ghlApiBase()}/contacts/upsert`, body, {
    headers: authHeaders(args.token),
    timeout: 20_000,
    validateStatus: () => true,
  });
  if (r.status < 200 || r.status >= 300) {
    throw new Error(`ghl_contact_upsert_${r.status}`);
  }
  const id = String(r.data?.contact?.id || r.data?.id || r.data?.contactId || "").trim();
  if (!id) throw new Error("ghl_contact_upsert_no_id");
  return id;
}

async function createOpportunity(args: {
  token: string;
  locationId: string;
  pipelineId: string;
  stageId: string;
  contactId: string;
  name: string;
}): Promise<void> {
  const r = await axios.post(
    `${ghlApiBase()}/opportunities/`,
    {
      locationId: args.locationId,
      pipelineId: args.pipelineId,
      pipelineStageId: args.stageId,
      contactId: args.contactId,
      name: args.name,
      status: "open",
      source: "Website search",
    },
    {
      headers: authHeaders(args.token),
      timeout: 20_000,
      validateStatus: () => true,
    }
  );
  if (r.status < 200 || r.status >= 300) {
    throw new Error(`ghl_opportunity_create_${r.status}`);
  }
}

export type WebsiteSearchPushInput = {
  kind: SearchCatchKind;
  query: string;
  page: string;
  existingContactId?: string | null;
  existingName?: string | null;
  existingEmail?: string | null;
  existingPhone?: string | null;
};

export async function pushWebsiteSearchToGhl(input: WebsiteSearchPushInput): Promise<void> {
  if (input.kind !== "email" && input.kind !== "phone") return;

  const token = process.env.GHL_BEARER_TOKEN?.trim();
  const locationId = ghlLocationId();
  if (!token || !locationId) return;

  const email =
    input.kind === "email"
      ? input.query.trim().toLowerCase()
      : input.existingEmail?.trim().toLowerCase() || null;
  const phone =
    input.kind === "phone"
      ? normalizePhone(input.query)
      : input.existingPhone
        ? normalizePhone(input.existingPhone)
        : null;
  if (!email && !phone) return;

  const ids = await resolvePipelineIds(token, locationId);
  const contactId =
    input.existingContactId?.trim() ||
    (await upsertContact({
      token,
      locationId,
      email,
      phone,
      name: input.existingName?.trim() || null,
    }));

  if (await contactAlreadyInPipeline(token, locationId, contactId, ids.pipelineId)) return;

  const label = input.kind === "email" ? email : phone;
  const pageBit = input.page && input.page !== "unknown" ? ` · ${input.page}` : "";
  await createOpportunity({
    token,
    locationId,
    pipelineId: ids.pipelineId,
    stageId: ids.stageId,
    contactId,
    name: `Website search · ${input.kind} · ${label}${pageBit}`.slice(0, 120),
  });
}

export function safePushWebsiteSearchToGhl(input: WebsiteSearchPushInput): void {
  void pushWebsiteSearchToGhl(input).catch((err) => {
    console.error("[ghlSearchPipeline] push failed", err instanceof Error ? err.message : err);
  });
}
