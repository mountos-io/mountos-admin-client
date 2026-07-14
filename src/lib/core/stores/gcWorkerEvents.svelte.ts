import type { GCWorkerEvent, GCWorkerEventListOptions, GCWorkerEventBucket } from '$lib/core/api/types'
import { api } from './client.svelte'
import { TIME_RANGES } from './alerts.svelte'
import { readCached, writeCached } from '$lib/core/utils/cache'

export type { GCWorkerEvent, GCWorkerEventBucket }

const DISPLAY_PAGE_SIZE = 20
export const DEFAULT_SINCE = '3d'

// Target ~70 buckets across the visible window: enough resolution to see
// shape, few enough to stay readable as bars. Clamped to the backend's
// [60s, 1d] range so a very short or very long window doesn't request a
// degenerate bucket width.
const TARGET_BUCKET_COUNT = 70
const MIN_BUCKET_SECONDS = 60
const MAX_BUCKET_SECONDS = 86_400
// 'all' (unbounded) has no fixed window to size buckets against; assume a
// generous 30-day span so buckets stay coarse rather than defaulting to the
// 60s floor and requesting tens of thousands of empty buckets.
const UNBOUNDED_ASSUMED_WINDOW_MS = 30 * 86_400_000

// Goal names are gcserv's own internal job-type constants; new ones ship
// occasionally but not so often that every mount needs a fresh fetch.
const GOALS_CACHE_TTL_MS = 60 * 60 * 1000

function sinceToISO(value: string): string | undefined {
  const range = TIME_RANGES.find(r => r.value === value)
  if (!range || range.ms === 0) return undefined
  return new Date(Date.now() - range.ms).toISOString()
}

function sinceToMs(value: string): number | undefined {
  const range = TIME_RANGES.find(r => r.value === value)
  if (!range || range.ms === 0) return undefined
  return range.ms
}

function bucketSecondsFor(windowMs: number | undefined): number {
  const ms = windowMs ?? UNBOUNDED_ASSUMED_WINDOW_MS
  const raw = Math.round(ms / TARGET_BUCKET_COUNT / 1000)
  return Math.min(MAX_BUCKET_SECONDS, Math.max(MIN_BUCKET_SECONDS, raw))
}

// useGCWorkerEvents mirrors useRegionAlerts' shape (filter state + page-based
// fetch), minus the active-count polling badge region alerts need but this
// feature doesn't. getNodeId scopes the view to a specific gcserv instance
// (fixed context on a per-node detail page); goal and volume (sid) are real
// user-settable filters, matching the per-instance + per-volume filtering
// this feature exists to provide.
export function useGCWorkerEvents(
  getRegionId: () => number,
  getNodeId?: () => string | undefined,
) {
  let events = $state<GCWorkerEvent[]>([])
  let loading = $state(false)
  let error = $state<string | null>(null)
  let totalEvents = $state(0)
  let totalPages = $state(0)
  let fetchCtrl: AbortController | null = null

  let histogram = $state<GCWorkerEventBucket[]>([])
  let histogramLoading = $state(false)
  let histogramBucketSeconds = $state(bucketSecondsFor(undefined))
  let histogramCtrl: AbortController | null = null

  // Real, observed goal values for the filter combobox -- fetched once per
  // node (unscoped by time, so it doesn't need to re-fetch when since/goal/
  // sid change), not folded into fetchAll()/debouncedFetchAll().
  let knownGoals = $state<string[]>([])
  let goalsLoading = $state(false)
  let goalsCtrl: AbortController | null = null

  let goalFilter = $state('')
  let sidFilter = $state<number | undefined>(undefined)
  let sinceFilter = $state(DEFAULT_SINCE)
  let page = $state(1)

  // goal/sid are typed live (per-keystroke via oninput); debounce their fetch
  // the same way sessions.svelte.ts's search box does, so typing doesn't fire
  // a request per character. Hand-rolled (not $lib/utils' debounce) so reset()
  // can cancel a pending call -- a stale timer surviving a node/region switch
  // would otherwise fire against the NEW getRegionId()/getNodeId() later and
  // abort whatever fetch that switch already started.
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  function cancelDebounce() {
    if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null }
  }

  function debouncedFetchAll() {
    cancelDebounce()
    debounceTimer = setTimeout(() => { debounceTimer = null; fetchEvents(); fetchHistogram() }, 250)
  }

  function fetchAll() {
    fetchEvents()
    fetchHistogram()
  }

  async function fetchEvents() {
    const regionId = getRegionId()
    if (!regionId) return
    fetchCtrl?.abort()
    const ctrl = fetchCtrl = new AbortController()
    loading = true
    error = null

    const opts: GCWorkerEventListOptions = {
      nodeId: getNodeId?.(),
      goal: goalFilter || undefined,
      sid: sidFilter,
      since: sinceToISO(sinceFilter),
      page,
      limit: DISPLAY_PAGE_SIZE,
    }

    try {
      const res = await api.gcWorkerEvents.list(regionId, opts, ctrl.signal)
      events = res.items
      totalEvents = res.pagination.total
      totalPages = res.pagination.totalPages
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      error = (e as Error).message || 'Failed to load gc worker events'
    } finally {
      if (fetchCtrl === ctrl) loading = false
    }
  }

  // Buckets counts per goal instead of returning raw rows, so the density
  // chart stays a fixed-cost fetch (bounded by bucket count) regardless of
  // how many raw events fall in the window -- unlike fetchEvents(), which is
  // one page of DISPLAY_PAGE_SIZE and can silently under-represent a busy
  // window/goal.
  async function fetchHistogram() {
    const regionId = getRegionId()
    if (!regionId) return
    histogramCtrl?.abort()
    const ctrl = histogramCtrl = new AbortController()
    histogramLoading = true

    const bucketSeconds = bucketSecondsFor(sinceToMs(sinceFilter))
    try {
      const res = await api.gcWorkerEvents.histogram(
        regionId,
        getNodeId?.(),
        goalFilter || undefined,
        sidFilter,
        undefined,
        sinceToISO(sinceFilter),
        bucketSeconds,
        ctrl.signal,
      )
      histogram = res.buckets
      histogramBucketSeconds = bucketSeconds
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      // Density chart degrades to empty rather than surfacing a second error
      // banner alongside fetchEvents()' -- the raw table/scatter remains the
      // authoritative error signal for this feature.
      histogram = []
    } finally {
      if (histogramCtrl === ctrl) histogramLoading = false
    }
  }

  // Backs the goal-filter combobox with real, observed values instead of a
  // free-text box hoping for an exact match against gcserv's internal goal
  // constants (not reflected anywhere queryable outside the event rows
  // themselves). Cached in localStorage for GOALS_CACHE_TTL_MS: the goal set
  // per node changes rarely enough that refetching it on every mount is
  // wasted chatter, but not never, so it isn't cached indefinitely either.
  async function fetchGoals() {
    const regionId = getRegionId()
    if (!regionId) return
    const nodeId = getNodeId?.()
    const cacheKey = `mountos.gcWorkerEventGoals.${regionId}.${nodeId ?? 'all'}`

    const cached = readCached<string[]>(cacheKey, GOALS_CACHE_TTL_MS)
    if (cached) {
      knownGoals = cached
      return
    }

    goalsCtrl?.abort()
    const ctrl = goalsCtrl = new AbortController()
    goalsLoading = true
    try {
      const res = await api.gcWorkerEvents.goals(regionId, nodeId, ctrl.signal)
      knownGoals = res.goals
      writeCached(cacheKey, res.goals)
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      knownGoals = []
    } finally {
      if (goalsCtrl === ctrl) goalsLoading = false
    }
  }

  function clearFilters() {
    cancelDebounce()
    goalFilter = ''
    sidFilter = undefined
    sinceFilter = DEFAULT_SINCE
    page = 1
    fetchAll()
  }

  function reset() {
    cancelDebounce()
    fetchCtrl?.abort()
    fetchCtrl = null
    histogramCtrl?.abort()
    histogramCtrl = null
    goalsCtrl?.abort()
    goalsCtrl = null
    events = []
    loading = false
    error = null
    totalEvents = 0
    totalPages = 0
    histogram = []
    histogramLoading = false
    knownGoals = []
    goalsLoading = false
    goalFilter = ''
    sidFilter = undefined
    sinceFilter = DEFAULT_SINCE
    page = 1
  }

  return {
    get events() { return events },
    get loading() { return loading },
    get error() { return error },
    get totalEvents() { return totalEvents },
    get totalPages() { return totalPages },
    get page() { return page },

    get histogram() { return histogram },
    get histogramLoading() { return histogramLoading },
    get histogramBucketSeconds() { return histogramBucketSeconds },

    get knownGoals() { return knownGoals },
    get goalsLoading() { return goalsLoading },

    get goalFilter() { return goalFilter },
    get sidFilter() { return sidFilter },
    get sinceFilter() { return sinceFilter },
    get sinceRangeMs() { return sinceToMs(sinceFilter) },

    setGoalFilter(v: string) { goalFilter = v; page = 1; debouncedFetchAll() },
    setSidFilter(v: number | undefined) { sidFilter = v; page = 1; debouncedFetchAll() },
    setSinceFilter(v: string) { sinceFilter = v; page = 1; fetchAll() },
    setPage(p: number) { page = p; fetchEvents() },

    fetchEvents: fetchAll,
    fetchGoals,
    clearFilters,
    reset,
  }
}
