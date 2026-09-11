type CacheEntry<T> = { value: T; expiresAt: number };

const store = new Map<string, CacheEntry<unknown>>();

export function getGhlCached<T>(key: string): T | null {
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    store.delete(key);
    return null;
  }
  return hit.value as T;
}

export function setGhlCached<T>(key: string, value: T, ttlMs: number): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export async function withGhlCache<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const cached = getGhlCached<T>(key);
  if (cached != null) return cached;
  const value = await fn();
  setGhlCached(key, value, ttlMs);
  return value;
}

const inflight = new Map<string, Promise<unknown>>();

/** One in-flight GHL call per key — extra clicks share the same request. */
export function coalesceGhlRequest<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;
  const pending = fn().finally(() => {
    if (inflight.get(key) === pending) inflight.delete(key);
  });
  inflight.set(key, pending);
  return pending;
}

/** Fresh hit if within TTL; stale hit if expired but within staleMs (for GHL 429 fallback). */
export function getGhlCachedStale<T>(
  key: string,
  staleMs: number
): { fresh: T | null; stale: T | null } {
  const hit = store.get(key);
  if (!hit) return { fresh: null, stale: null };
  const value = hit.value as T;
  const now = Date.now();
  if (now <= hit.expiresAt) return { fresh: value, stale: value };
  if (now <= hit.expiresAt + staleMs) return { fresh: null, stale: value };
  store.delete(key);
  return { fresh: null, stale: null };
}
