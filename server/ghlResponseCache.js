const store = new Map();
export function getGhlCached(key) {
    const hit = store.get(key);
    if (!hit)
        return null;
    if (Date.now() > hit.expiresAt) {
        store.delete(key);
        return null;
    }
    return hit.value;
}
export function setGhlCached(key, value, ttlMs) {
    store.set(key, { value, expiresAt: Date.now() + ttlMs });
}
export async function withGhlCache(key, ttlMs, fn) {
    const cached = getGhlCached(key);
    if (cached != null)
        return cached;
    const value = await fn();
    setGhlCached(key, value, ttlMs);
    return value;
}
/** Fresh hit if within TTL; stale hit if expired but within staleMs (for GHL 429 fallback). */
export function getGhlCachedStale(key, staleMs) {
    const hit = store.get(key);
    if (!hit)
        return { fresh: null, stale: null };
    const value = hit.value;
    const now = Date.now();
    if (now <= hit.expiresAt)
        return { fresh: value, stale: value };
    if (now <= hit.expiresAt + staleMs)
        return { fresh: null, stale: value };
    store.delete(key);
    return { fresh: null, stale: null };
}
