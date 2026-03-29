import type { AlertCountResponse, RegionAlert, RegionAlertListOptions } from '$lib/core/api/types'
import { api } from './client.svelte'
import { TIME_RANGES } from './alerts.svelte'

export type { AlertCountResponse, RegionAlert }

const POLL_INTERVAL = 60_000
const DISPLAY_PAGE_SIZE = 20
const DEFAULT_SINCE = '3d'

function sinceToISO(value: string): string | undefined {
  const range = TIME_RANGES.find(r => r.value === value)
  if (!range || range.ms === 0) return undefined
  return new Date(Date.now() - range.ms).toISOString()
}

let activeCount = $state(0)
let recentCount = $state(0)
let infoCount = $state(0)
let warningCount = $state(0)
let criticalCount = $state(0)

let alerts = $state<RegionAlert[]>([])
let loading = $state(false)
let error = $state<string | null>(null)
let totalAlerts = $state(0)
let totalPages = $state(0)
let pollTimer: ReturnType<typeof setInterval> | null = null
let pollCtrl: AbortController | null = null
let fetchCtrl: AbortController | null = null

let boundRegionId = $state(0)
let boundNodeId = $state<string | undefined>(undefined)

let severityFilter = $state<number | undefined>(undefined)
let categoryFilter = $state('')
let sinceFilter = $state(DEFAULT_SINCE)
let activeFilter = $state(false)
let page = $state(1)

async function fetchCount(signal?: AbortSignal) {
  if (!boundRegionId) return
  try {
    const res = await api.regionAlerts.count(boundRegionId, signal)
    if (activeCount !== res.active) activeCount = res.active
    if (recentCount !== res.recent) recentCount = res.recent
    if (infoCount !== res.infoCount) infoCount = res.infoCount
    if (warningCount !== res.warningCount) warningCount = res.warningCount
    if (criticalCount !== res.criticalCount) criticalCount = res.criticalCount
  } catch (e) {
    if ((e as Error).name === 'AbortError') return
  }
}

function onVisibilityChange() {
  if (document.hidden) {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
  } else if (pollCtrl && !pollTimer) {
    fetchCount(pollCtrl.signal)
    pollTimer = setInterval(() => fetchCount(pollCtrl!.signal), POLL_INTERVAL)
  }
}

function startPolling() {
  if (pollTimer) return
  pollCtrl?.abort()
  pollCtrl = new AbortController()
  fetchCount(pollCtrl.signal)
  pollTimer = setInterval(() => fetchCount(pollCtrl!.signal), POLL_INTERVAL)
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibilityChange)
  }
}

function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
  pollCtrl?.abort()
  pollCtrl = null
  fetchCtrl?.abort()
  fetchCtrl = null
  if (typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', onVisibilityChange)
  }
}

async function fetchAlerts() {
  if (!boundRegionId) return
  fetchCtrl?.abort()
  const ctrl = fetchCtrl = new AbortController()
  loading = true
  error = null

  const opts: RegionAlertListOptions = {
    active: activeFilter,
    severity: severityFilter,
    category: categoryFilter || undefined,
    nodeId: boundNodeId,
    since: sinceToISO(sinceFilter),
    page,
    limit: DISPLAY_PAGE_SIZE,
  }

  try {
    const res = await api.regionAlerts.list(boundRegionId, opts, ctrl.signal)
    alerts = res.items
    totalAlerts = res.pagination.total
    totalPages = res.pagination.totalPages
  } catch (e) {
    if ((e as Error).name === 'AbortError') return
    error = (e as Error).message || 'Failed to load alerts'
  } finally {
    if (fetchCtrl === ctrl) loading = false
  }
}

async function resolveAlert(alertId: string) {
  if (!boundRegionId) return
  await api.regionAlerts.resolve(boundRegionId, alertId)
  await Promise.all([fetchAlerts(), fetchCount(pollCtrl?.signal)])
}

function clearFilters() {
  severityFilter = undefined
  categoryFilter = ''
  sinceFilter = DEFAULT_SINCE
  activeFilter = false
  page = 1
  fetchAlerts()
}

function resetPage() { page = 1 }

function reset() {
  stopPolling()
  alerts = []
  activeCount = 0
  recentCount = 0
  infoCount = 0
  warningCount = 0
  criticalCount = 0
  loading = false
  error = null
  totalAlerts = 0
  totalPages = 0
  severityFilter = undefined
  categoryFilter = ''
  sinceFilter = DEFAULT_SINCE
  activeFilter = false
  page = 1
  boundRegionId = 0
  boundNodeId = undefined
}

export function useRegionAlerts(regionId: number, nodeId?: string) {
  boundRegionId = regionId
  boundNodeId = nodeId
  return {
    get activeCount() { return activeCount },
    get recentCount() { return recentCount },
    get infoCount() { return infoCount },
    get warningCount() { return warningCount },
    get criticalCount() { return criticalCount },
    get alerts() { return alerts },
    get loading() { return loading },
    get error() { return error },
    get totalAlerts() { return totalAlerts },
    get totalPages() { return totalPages },
    get page() { return page },

    get severityFilter() { return severityFilter },
    get categoryFilter() { return categoryFilter },
    get sinceFilter() { return sinceFilter },
    get activeFilter() { return activeFilter },

    setSeverityFilter(v: number | undefined) { severityFilter = v; resetPage(); fetchAlerts() },
    setCategoryFilter(v: string) { categoryFilter = v; resetPage(); fetchAlerts() },
    setSinceFilter(v: string) { sinceFilter = v; resetPage(); fetchAlerts() },
    setActiveFilter(v: boolean) { activeFilter = v; resetPage(); fetchAlerts() },
    setPage(p: number) { page = p; fetchAlerts() },

    startPolling,
    stopPolling,
    fetchAlerts,
    fetchCount,
    resolveAlert,
    clearFilters,
    reset,
  }
}
