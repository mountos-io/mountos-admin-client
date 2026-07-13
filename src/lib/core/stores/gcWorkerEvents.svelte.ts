import type { GCWorkerEvent, GCWorkerEventListOptions } from '$lib/core/api/types'
import { api } from './client.svelte'
import { TIME_RANGES } from './alerts.svelte'

export type { GCWorkerEvent }

const DISPLAY_PAGE_SIZE = 20
export const DEFAULT_SINCE = '3d'

function sinceToISO(value: string): string | undefined {
  const range = TIME_RANGES.find(r => r.value === value)
  if (!range || range.ms === 0) return undefined
  return new Date(Date.now() - range.ms).toISOString()
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

  function debouncedFetchEvents() {
    cancelDebounce()
    debounceTimer = setTimeout(() => { debounceTimer = null; fetchEvents() }, 250)
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

  function clearFilters() {
    cancelDebounce()
    goalFilter = ''
    sidFilter = undefined
    sinceFilter = DEFAULT_SINCE
    page = 1
    fetchEvents()
  }

  function reset() {
    cancelDebounce()
    fetchCtrl?.abort()
    fetchCtrl = null
    events = []
    loading = false
    error = null
    totalEvents = 0
    totalPages = 0
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

    get goalFilter() { return goalFilter },
    get sidFilter() { return sidFilter },
    get sinceFilter() { return sinceFilter },

    setGoalFilter(v: string) { goalFilter = v; page = 1; debouncedFetchEvents() },
    setSidFilter(v: number | undefined) { sidFilter = v; page = 1; debouncedFetchEvents() },
    setSinceFilter(v: string) { sinceFilter = v; page = 1; fetchEvents() },
    setPage(p: number) { page = p; fetchEvents() },

    fetchEvents,
    clearFilters,
    reset,
  }
}
