import type { ListingPayload } from "./listingData";
import { buildListingFromGhlPrefill } from "./listingDraft";
import {
  fetchGhlContactPrefill,
  ghlSearchUserMessage,
  resolveListingByGhlContactId,
  searchGhlContactsByMls,
} from "./buyLeadsSearchApi";
import { readIntroCampaignDraft } from "./introCampaign";
import { fetchIntroListingSnapshot, persistIntroListingSnapshot } from "./introListingSnapshotApi";
import { buildListingCacheKey, readListingCache, writeListingCache } from "./listingCache";
import { normalizeIntroMlsId } from "./introDeepLink";

const SNAP_PREFIX = "cpai_intro_listing_snap_v1:";
const SNAP_TTL_MS = 6 * 60 * 60_000;
const INTRO_ATTEMPTS = 4;
const ATTEMPT_TIMEOUT_MS = 30_000;

/** Numeric (7776569) or alphanumeric (TB8523180) — intro URLs only. */
export function normalizeIntroMlsLookup(raw: string): string {
  const t = raw.trim();
  if (/^\d{5,9}$/.test(t)) return t;
  return normalizeIntroMlsId(t);
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const t = window.setTimeout(resolve, ms);
    const onAbort = () => {
      window.clearTimeout(t);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function isAbort(err: unknown): boolean {
  return (err instanceof DOMException && err.name === "AbortError") || (err instanceof Error && err.name === "AbortError");
}

function isNoListing(err: unknown): boolean {
  return err instanceof Error && /no listing found/i.test(err.message);
}

function isContactMissing(err: unknown): boolean {
  const msg = err instanceof Error ? err.message.toLowerCase() : "";
  return msg.includes("not found") || msg.includes("could not load contact");
}

function isRetryable(err: unknown): boolean {
  if (isAbort(err) || isNoListing(err)) return false;
  const msg = err instanceof Error ? err.message : String(err);
  return /429|too many|timeout|timed out|failed|network|load contact|ghl_/i.test(msg);
}

async function withAttemptTimeout<T>(
  run: (signal: AbortSignal) => Promise<T>,
  parent?: AbortSignal,
  ms = ATTEMPT_TIMEOUT_MS
): Promise<T> {
  const c = new AbortController();
  const t = window.setTimeout(() => c.abort(), ms);
  const onParent = () => {
    window.clearTimeout(t);
    c.abort();
  };
  parent?.addEventListener("abort", onParent);
  try {
    return await run(c.signal);
  } catch (e) {
    if (parent?.aborted) throw e;
    if (c.signal.aborted) throw new Error("Request timed out");
    throw e;
  } finally {
    window.clearTimeout(t);
    parent?.removeEventListener("abort", onParent);
  }
}

function saveIntroListingSnapshot(mls: string, listing: ListingPayload, persistServer = false): void {
  const mlsQ = normalizeIntroMlsLookup(mls);
  try {
    sessionStorage.setItem(SNAP_PREFIX + mlsQ, JSON.stringify({ at: Date.now(), listing }));
  } catch {
    /* quota */
  }
  writeListingCache(buildListingCacheKey({ mls: mlsQ }), listing);
  if (persistServer) persistIntroListingSnapshot(listing);
}

function listingFromIntroDraft(mls: string): ListingPayload | null {
  const mlsQ = normalizeIntroMlsLookup(mls);
  const draft = readIntroCampaignDraft();
  const draftMls = normalizeIntroMlsLookup(draft?.listing?.mls || "");
  if (draft?.listing && draftMls && draftMls === mlsQ) return draft.listing;
  return null;
}

function readIntroListingSnapshot(mls: string): ListingPayload | null {
  const mlsQ = normalizeIntroMlsLookup(mls);
  const fromCache = readListingCache(buildListingCacheKey({ mls: mlsQ }));
  if (fromCache) return fromCache;
  const fromDraft = listingFromIntroDraft(mlsQ);
  if (fromDraft) return fromDraft;
  try {
    const raw = sessionStorage.getItem(SNAP_PREFIX + mlsQ);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at?: number; listing?: ListingPayload };
    if (!parsed?.listing?.mls || Date.now() - Number(parsed.at || 0) > SNAP_TTL_MS) {
      sessionStorage.removeItem(SNAP_PREFIX + mlsQ);
      return null;
    }
    return parsed.listing;
  } catch {
    return null;
  }
}

async function listingFromMlsHits(
  mlsQ: string,
  signal?: AbortSignal,
  skipCache?: boolean
): Promise<ListingPayload> {
  const hits = await searchGhlContactsByMls(mlsQ, signal, skipCache ? { skipCache: true } : undefined);
  if (!hits.length) {
    throw new Error(`No listing found for MLS ${mlsQ}.`);
  }
  const pick = hits[0]!;
  const full = await fetchGhlContactPrefill(pick.id, signal, mlsQ);
  const listing = buildListingFromGhlPrefill(full);
  return { ...listing, mls: mlsQ, id: mlsQ.toLowerCase() };
}

/**
 * Load listing for $99 intro MLS deep links.
 * Saved snapshot first (pick / prior open), then HighLevel.
 */
async function listingFromSavedSnapshot(mlsQ: string, signal?: AbortSignal): Promise<ListingPayload | null> {
  const local = readIntroListingSnapshot(mlsQ);
  if (local) return local;
  const fromServer = await fetchIntroListingSnapshot(mlsQ, signal);
  if (fromServer) {
    saveIntroListingSnapshot(mlsQ, fromServer);
    return fromServer;
  }
  return null;
}

export async function resolveIntroListingByMls(
  mls: string,
  opts?: { signal?: AbortSignal; contactId?: string | null }
): Promise<ListingPayload> {
  const mlsQ = normalizeIntroMlsLookup(mls);
  const signal = opts?.signal;
  const contactId = opts?.contactId?.trim() || "";

  const saved = await listingFromSavedSnapshot(mlsQ, signal);
  if (saved) return saved;

  if (contactId) {
    for (let attempt = 0; attempt < INTRO_ATTEMPTS; attempt++) {
      try {
        const listing = await withAttemptTimeout(
          (sig) => resolveListingByGhlContactId(contactId, mlsQ, sig),
          signal
        );
        const withMls = { ...listing, mls: mlsQ || listing.mls, id: (mlsQ || listing.mls).toLowerCase() };
        saveIntroListingSnapshot(mlsQ || withMls.mls, withMls, true);
        return withMls;
      } catch (e) {
        if (signal?.aborted) throw e;
        if (isContactMissing(e) && !isRetryable(e)) break;
        const more = attempt < INTRO_ATTEMPTS - 1;
        if (more && isRetryable(e)) {
          await sleep(4000 * (attempt + 1), signal);
          continue;
        }
        break;
      }
    }
  }

  let lastErr: unknown;
  let noListingRetries = 0;
  for (let attempt = 0; attempt < INTRO_ATTEMPTS; attempt++) {
    try {
      const listing = await withAttemptTimeout(
        (sig) => listingFromMlsHits(mlsQ, sig, attempt > 0),
        signal
      );
      saveIntroListingSnapshot(mlsQ, listing, true);
      return listing;
    } catch (e) {
      if (signal?.aborted) throw e;
      if (isAbort(e) && signal?.aborted) throw e;
      lastErr = e;
      const more = attempt < INTRO_ATTEMPTS - 1;
      if (isNoListing(e)) {
        if (noListingRetries < 1 && more) {
          noListingRetries += 1;
          await sleep(800, signal);
          continue;
        }
        break;
      }
      if (more && isRetryable(e)) {
        await sleep(4000 * (attempt + 1), signal);
        continue;
      }
      break;
    }
  }

  const stale = readIntroListingSnapshot(mlsQ);
  if (stale) return stale;

  if (lastErr instanceof Error) throw lastErr;
  throw new Error(ghlSearchUserMessage(lastErr));
}

export function introListingLoadErrorMessage(err: unknown, mls: string): string {
  if (isNoListing(err)) {
    return err instanceof Error ? err.message : `No listing found for MLS ${mls}.`;
  }
  const ghl = ghlSearchUserMessage(err);
  if (/too many/i.test(ghl)) return ghl;
  return `Could not load MLS ${mls} right now. Try again in a moment.`;
}
