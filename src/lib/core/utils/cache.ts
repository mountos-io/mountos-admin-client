// Small TTL-over-localStorage helper for API-fetched data that's wasteful to
// refetch on every mount but does occasionally change server-side, so it
// can't be cached forever either. Generalizes the read/write shape
// user-cache.svelte.ts hand-rolls for its own id -> record cache.
interface CachedEntry<T> {
  v: T
  t: number
}

export function readCached<T>(key: string, ttlMs: number): T | undefined {
  if (typeof localStorage === 'undefined') return undefined
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return undefined
    const entry = JSON.parse(raw) as CachedEntry<T>
    if (Date.now() - entry.t >= ttlMs) return undefined
    return entry.v
  } catch {
    return undefined
  }
}

export function writeCached<T>(key: string, value: T): void {
  if (typeof localStorage === 'undefined') return
  try {
    const entry: CachedEntry<T> = { v: value, t: Date.now() }
    localStorage.setItem(key, JSON.stringify(entry))
  } catch {
    // Quota exceeded or storage disabled -- caching is a pure optimization,
    // not required for correctness, so fail silently.
  }
}
