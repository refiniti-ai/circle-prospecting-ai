import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import type { Request } from "express";
import { getFirestoreDb } from "./firebaseAdmin.js";

export type SearchCatchKind = "email" | "phone" | "mls" | "address" | "agent";

export type SearchCatchRecord = {
  id: string;
  createdAt: string;
  kind: SearchCatchKind;
  query: string;
  page: string;
  /** facebook | instagram | google | email | website */
  source: string;
  resultCount: number;
  matchedName: string | null;
  matchedEmail: string | null;
  matchedPhone: string | null;
  matchedMls: string | null;
  /** Site path they searched from, e.g. /99promo/listed/mls/TB8497543 */
  pagePath: string | null;
  found: boolean;
};

const COLLECTION = process.env.FIREBASE_SEARCH_CATCHER_COLLECTION?.trim() || "search_catcher";
const MAX_QUERY = 240;
const LIST_LIMIT = 400;
const DEDUPE_MS = 2 * 60_000;
const recentCatchAt = new Map<string, number>();

const __dir = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dir, "data", "search-catcher.json");

type FileDb = { rows: SearchCatchRecord[] };

function ensureFile() {
  const dir = path.dirname(DATA);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DATA)) {
    fs.writeFileSync(DATA, JSON.stringify({ rows: [] } satisfies FileDb, null, 2), "utf8");
  }
}

function readFileDb(): FileDb {
  ensureFile();
  try {
    const raw = JSON.parse(fs.readFileSync(DATA, "utf8")) as FileDb;
    if (!Array.isArray(raw.rows)) raw.rows = [];
    return raw;
  } catch {
    return { rows: [] };
  }
}

function writeFileDb(db: FileDb) {
  fs.writeFileSync(DATA, JSON.stringify(db, null, 2), "utf8");
}

export function classifySearchQuery(raw: string): SearchCatchKind {
  const t = raw.trim();
  if (t.includes("@")) return "email";
  const digits = t.replace(/\D/g, "");
  if (digits.length >= 10) return "phone";
  const compact = t.replace(/\s+/g, "");
  if (/^[A-Za-z]{1,6}\d{3,}$/.test(compact) || /^\d{5,9}$/.test(compact)) return "mls";
  return "agent";
}

export function searchCatchPageFromRequest(req: Request): string {
  const raw = String(req.get("referer") || "");
  try {
    const p = new URL(raw).pathname || "/";
    if (p.startsWith("/99promo") || p.startsWith("/first-time-customer")) return "99promo";
    if (p.startsWith("/search/agent")) return "search-agent";
    if (
      p.startsWith("/buy-leads") ||
      p.startsWith("/listed") ||
      p.startsWith("/seller") ||
      p.startsWith("/buyer") ||
      p.startsWith("/mls")
    ) {
      return "buy-leads";
    }
    return p.slice(0, 80) || "unknown";
  } catch {
    return "unknown";
  }
}

function normalizeTrafficSource(raw: string): string {
  const s = raw.trim().toLowerCase();
  if (s === "fb") return "facebook";
  if (s === "ig" || s === "insta") return "instagram";
  if (s === "facebook" || s === "instagram" || s === "google" || s === "email" || s === "website") return s;
  return "";
}

function sourceFromSearchParams(params: URLSearchParams): string {
  const source = (params.get("utm_source") || "").trim().toLowerCase();
  const medium = (params.get("utm_medium") || "").trim().toLowerCase();
  const mapped = normalizeTrafficSource(source);
  if (mapped) return mapped;
  if (medium === "email") return "email";
  return "";
}

/** facebook | instagram | google | email | website — header first (SPA may drop UTMs after navigate). */
export function searchCatchSourceFromRequest(req: Request): string {
  const fromHeader = normalizeTrafficSource(String(req.get("x-cp-traffic-source") || ""));
  if (fromHeader) return fromHeader;
  const raw = String(req.get("referer") || "");
  try {
    const fromReferer = sourceFromSearchParams(new URL(raw).searchParams);
    if (fromReferer) return fromReferer;
  } catch {
    /* ignore */
  }
  return "website";
}

export function searchCatchPagePathFromRequest(req: Request): string | null {
  const header = String(req.get("x-cp-page-path") || "").trim();
  if (header.startsWith("/")) return clip(header, 200);
  const raw = String(req.get("referer") || "");
  try {
    const p = new URL(raw).pathname || "";
    return p.startsWith("/") ? clip(p, 200) : null;
  } catch {
    return null;
  }
}

export function searchCatchListingPath(page: string, pagePath: string | null, mls: string | null): string | null {
  if (pagePath && /\/mls\//i.test(pagePath)) return clip(pagePath, 200);
  const id = (mls || "").trim();
  if (!id) return pagePath;
  const intro = page === "99promo" || page === "first-time-customer" || (pagePath || "").startsWith("/99promo");
  const path = intro ? `/99promo/listed/mls/${encodeURIComponent(id)}` : `/listed/mls/${encodeURIComponent(id)}`;
  return clip(path, 200);
}

function clip(s: string | null | undefined, max = 160): string | null {
  const t = (s ?? "").trim();
  if (!t) return null;
  return t.length > max ? t.slice(0, max) : t;
}

function catchDedupeKey(input: {
  kind: string;
  query: string;
  page: string;
  source: string;
  pagePath?: string | null;
}): string {
  return [input.kind, input.query.toLowerCase(), input.page, input.source, input.pagePath || ""]
    .join("|")
    .slice(0, 300);
}

function wasRecentlyRecorded(key: string): boolean {
  const now = Date.now();
  for (const [k, at] of recentCatchAt) {
    if (now - at > DEDUPE_MS) recentCatchAt.delete(k);
  }
  const prev = recentCatchAt.get(key);
  if (prev && now - prev < DEDUPE_MS) return true;
  const fileHit = readFileDb().rows.find((r) => {
    const same =
      catchDedupeKey({
        kind: r.kind,
        query: r.query,
        page: r.page,
        source: r.source,
        pagePath: r.pagePath,
      }) === key;
    if (!same) return false;
    const at = Date.parse(r.createdAt);
    return Number.isFinite(at) && now - at < DEDUPE_MS;
  });
  if (fileHit) return true;
  recentCatchAt.set(key, now);
  return false;
}

function catchDocId(key: string): string {
  const bucket = Math.floor(Date.now() / DEDUPE_MS);
  const h = crypto.createHash("sha1").update(`${key}|${bucket}`).digest("hex").slice(0, 20);
  return `sc_${h}`;
}

export async function recordSearchCatch(input: {
  kind: SearchCatchKind;
  query: string;
  page: string;
  source?: string;
  resultCount?: number;
  matchedName?: string | null;
  matchedEmail?: string | null;
  matchedPhone?: string | null;
  matchedMls?: string | null;
  pagePath?: string | null;
}): Promise<void> {
  const query = clip(input.query, MAX_QUERY);
  if (!query) return;
  const resultCount = Number.isFinite(input.resultCount) ? Math.max(0, Number(input.resultCount)) : 0;
  const page = clip(input.page, 80) || "unknown";
  const source = clip(input.source, 40) || "website";
  const pagePath = clip(input.pagePath, 200);
  if (
    wasRecentlyRecorded(
      catchDedupeKey({ kind: input.kind, query, page, source, pagePath })
    )
  ) {
    return;
  }
  const rec: SearchCatchRecord = {
    id: catchDocId(catchDedupeKey({ kind: input.kind, query, page, source, pagePath })),
    createdAt: new Date().toISOString(),
    kind: input.kind,
    query,
    page,
    source,
    resultCount,
    matchedName: clip(input.matchedName),
    matchedEmail: clip(input.matchedEmail),
    matchedPhone: clip(input.matchedPhone),
    pagePath,
    found: resultCount > 0,
  };

  const fileDb = readFileDb();
  fileDb.rows.unshift(rec);
  fileDb.rows = fileDb.rows.slice(0, 2000);
  writeFileDb(fileDb);

  const db = getFirestoreDb();
  if (!db) return;
  await db.collection(COLLECTION).doc(rec.id).set(rec);
}

export function safeRecordSearchCatch(input: Parameters<typeof recordSearchCatch>[0]): void {
  void recordSearchCatch(input).catch((err) => {
    console.error("[searchCatcher] record failed", err);
  });
}

export async function listSearchCatches(limit = LIST_LIMIT): Promise<SearchCatchRecord[]> {
  const cap = Math.min(Math.max(1, limit), 800);
  const fileRows = readFileDb().rows;
  const db = getFirestoreDb();
  if (!db) return fileRows.slice(0, cap);

  try {
    const snap = await db.collection(COLLECTION).orderBy("createdAt", "desc").limit(cap).get();
    const fromFs = snap.docs.map((d) => {
      const x = d.data() as Partial<SearchCatchRecord>;
      return {
        id: String(x.id || d.id),
        createdAt: String(x.createdAt || ""),
        kind: (x.kind as SearchCatchKind) || "agent",
        query: String(x.query || ""),
        page: String(x.page || "unknown"),
        source: String(x.source || ""),
        resultCount: Number(x.resultCount || 0),
        matchedName: x.matchedName != null ? String(x.matchedName) : null,
        matchedEmail: x.matchedEmail != null ? String(x.matchedEmail) : null,
        matchedPhone: x.matchedPhone != null ? String(x.matchedPhone) : null,
        matchedMls: x.matchedMls != null ? String(x.matchedMls) : null,
        pagePath: x.pagePath != null ? String(x.pagePath) : null,
        found: Boolean(x.found ?? Number(x.resultCount || 0) > 0),
      } satisfies SearchCatchRecord;
    });
    if (fromFs.length) return fromFs;
  } catch (err) {
    console.error("[searchCatcher] list failed", err);
  }
  return fileRows.slice(0, cap);
}
