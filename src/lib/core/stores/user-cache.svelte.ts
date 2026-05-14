import { api } from '$lib/core/stores/client.svelte'
import { ApiError } from '$lib/core/api/errors'

// Minimum record kept per id — enough to render a badge without exposing
// email / accountId. Persisted across page navigations in localStorage;
// user names are stable so a 24h TTL is generous and a "missing" marker
// (`v: null`) shaves the request rate for ids the admin DB doesn't
// recognise (deleted users, system actions).
type Lite = { id: number; username: string; name: string }
type CachedEntry = { v: Lite | null; t: number }

const STORAGE_KEY = 'mountos.userCache'
const TTL_MS = 24 * 60 * 60 * 1000
const REQUEST_DEBOUNCE_MS = 80
const MAX_BATCH = 256

function readCache(): Map<number, CachedEntry> {
  if (typeof localStorage === 'undefined') return new Map()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Map()
    const parsed = JSON.parse(raw) as Record<string, CachedEntry>
    const now = Date.now()
    const map = new Map<number, CachedEntry>()
    for (const [k, e] of Object.entries(parsed)) {
      if (e && typeof e.t === 'number' && now - e.t < TTL_MS) map.set(Number(k), e)
    }
    return map
  } catch {
    return new Map()
  }
}

function writeCache(map: Map<number, CachedEntry>) {
  if (typeof localStorage === 'undefined') return
  const obj: Record<string, CachedEntry> = {}
  for (const [k, v] of map) obj[String(k)] = v
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(obj)) } catch { /* quota */ }
}

const cache = readCache()
const cacheState = $state({ rev: 0 })
let pending = new Set<number>()
let pendingTimer: ReturnType<typeof setTimeout> | null = null
let inFlight: Promise<void> | null = null

async function flushPending() {
  if (pending.size === 0) return
  // Snapshot + clear pending so concurrent enqueues during the await
  // accumulate the next batch instead of being dropped.
  const batch = Array.from(pending).slice(0, MAX_BATCH)
  pending = new Set(Array.from(pending).slice(MAX_BATCH))
  try {
    const resp = await api.users.bulk({ ids: batch })
    const now = Date.now()
    const got = new Set<number>()
    for (const u of resp.users ?? []) {
      got.add(u.id)
      cache.set(u.id, { v: { id: u.id, username: u.username, name: u.name }, t: now })
    }
    // Ids the server didn't return are treated as "unresolvable" — cache
    // a null sentinel so we don't re-request them every render.
    for (const id of batch) if (!got.has(id)) cache.set(id, { v: null, t: now })
    writeCache(cache)
    cacheState.rev++
  } catch (e) {
    // Swallow — a transient failure shouldn't poison the cache. Leave the
    // ids out so the next render schedules another attempt.
    if (!(e instanceof ApiError)) console.warn('[users.bulk] failed:', e)
  } finally {
    inFlight = null
    if (pending.size > 0) scheduleFlush()
  }
}

function scheduleFlush() {
  if (pendingTimer) clearTimeout(pendingTimer)
  pendingTimer = setTimeout(() => {
    pendingTimer = null
    if (inFlight) return
    inFlight = flushPending()
  }, REQUEST_DEBOUNCE_MS)
}

export const userCache = {
  // Reactive read — touch this in $derived/$effect to re-render when
  // resolved names arrive.
  get rev() { return cacheState.rev },

  // Get the cached Lite (or null if unresolvable). Doesn't enqueue.
  peek(id: number): Lite | null | undefined {
    if (!id || id <= 0) return null
    const e = cache.get(id)
    return e ? e.v : undefined
  },

  // Enqueue ids for bulk resolution. Already-cached and unresolvable ids
  // are skipped. Schedules a debounced flush.
  ensure(ids: Iterable<number>) {
    let added = 0
    for (const id of ids) {
      if (!id || id <= 0) continue
      if (cache.has(id)) continue
      if (pending.has(id)) continue
      pending.add(id)
      added++
    }
    if (added > 0) scheduleFlush()
  },

  // UI helper — returns a display string for a user id. Schedules a fetch
  // for unknown ids and returns "user#<id>" until one resolves; returns
  // "—" for empty/zero ids and "user#<id> (gone)" for unresolvable ones.
  display(id: number): string {
    if (!id || id <= 0) return '—'
    const e = cache.get(id)
    if (e === undefined) {
      this.ensure([id])
      return `user#${id}`
    }
    if (e.v === null) return `user#${id} (gone)`
    return e.v.name || e.v.username || `user#${id}`
  },

  clear() {
    cache.clear()
    pending.clear()
    if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY)
    cacheState.rev++
  },
}
