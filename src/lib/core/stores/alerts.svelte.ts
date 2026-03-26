import type { ServiceAlert, AlertListOptions } from '$lib/core/api/types'
import { api } from './client.svelte'
import { showWarningToast } from '$lib/core/utils/toast'
import { playNotificationBeep } from '$lib/core/utils/sound'
import { usePreferences } from '$lib/stores/preferences.svelte'

const POLL_INTERVAL = 60_000
const DISPLAY_PAGE_SIZE = 20

export const TIME_RANGES = [
  { value: '30m', label: '30 min', ms: 30 * 60_000 },
  { value: '1h', label: '1 hour', ms: 60 * 60_000 },
  { value: '3h', label: '3 hours', ms: 3 * 60 * 60_000 },
  { value: '6h', label: '6 hours', ms: 6 * 60 * 60_000 },
  { value: '12h', label: '12 hours', ms: 12 * 60 * 60_000 },
  { value: '1d', label: '1 day', ms: 24 * 60 * 60_000 },
  { value: '3d', label: '3 days', ms: 3 * 24 * 60 * 60_000 },
  { value: '1w', label: '1 week', ms: 7 * 24 * 60 * 60_000 },
  { value: '2w', label: '2 weeks', ms: 14 * 24 * 60 * 60_000 },
  { value: 'all', label: 'All', ms: 0 },
] as const

export const SEVERITY_LABELS: Record<number, string> = { 0: 'Info', 1: 'Warning', 2: 'Critical' }
export const SEVERITY_COLORS: Record<number, string> = { 0: 'blue', 1: 'amber', 2: 'red' }
export const CATEGORIES = ['vault', 'db', 'license', 'config', 'quota'] as const

let activeCount = $state(0)
let recentCount = $state(0)
let infoCount = $state(0)
let warningCount = $state(0)
let criticalCount = $state(0)

let alerts = $state<ServiceAlert[]>([])
let loading = $state(false)
let error = $state<string | null>(null)
let totalAlerts = $state(0)
let totalPages = $state(0)
let hasNewAlert = $state(false)
let lastKnownRecentCount = 0
let pollTimer: ReturnType<typeof setInterval> | null = null
let pollCtrl: AbortController | null = null
let fetchCtrl: AbortController | null = null

let severityFilter = $state<number | undefined>(undefined)
let categoryFilter = $state('')
let sinceFilter = $state('30m')
let activeFilter = $state(true)
let page = $state(1)

function sinceToISO(value: string): string | undefined {
  const range = TIME_RANGES.find(r => r.value === value)
  if (!range || range.ms === 0) return undefined
  return new Date(Date.now() - range.ms).toISOString()
}

async function fetchCount(signal?: AbortSignal) {
  try {
    const res = await api.alerts.count(signal)
    activeCount = res.active
    infoCount = res.infoCount
    warningCount = res.warningCount
    criticalCount = res.criticalCount

    if (res.recent > lastKnownRecentCount && lastKnownRecentCount > 0) {
      hasNewAlert = true
      const diff = res.recent - lastKnownRecentCount
      showWarningToast(`${diff} new alert${diff > 1 ? 's' : ''} detected`)
      const prefs = usePreferences()
      if (prefs.alertSound) playNotificationBeep()
    }
    recentCount = res.recent
    lastKnownRecentCount = res.recent
  } catch (e) {
    if ((e as Error).name === 'AbortError') return
  }
}

function startPolling() {
  if (pollTimer) return
  pollCtrl = new AbortController()
  fetchCount(pollCtrl.signal)
  pollTimer = setInterval(() => fetchCount(pollCtrl!.signal), POLL_INTERVAL)
}

function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
  pollCtrl?.abort()
  pollCtrl = null
  fetchCtrl?.abort()
  fetchCtrl = null
}

async function fetchAlerts() {
  fetchCtrl?.abort()
  const ctrl = fetchCtrl = new AbortController()
  loading = true
  error = null

  const opts: AlertListOptions = {
    active: activeFilter,
    severity: severityFilter,
    category: categoryFilter || undefined,
    since: sinceToISO(sinceFilter),
    page,
    limit: DISPLAY_PAGE_SIZE,
  }

  try {
    const res = await api.alerts.list(opts, ctrl.signal)
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
  await api.alerts.resolve(alertId)
  await fetchAlerts()
  fetchCount()
}

function markSeen() {
  hasNewAlert = false
}

function resetFilters() {
  severityFilter = undefined
  categoryFilter = ''
  sinceFilter = '30m'
  activeFilter = true
  page = 1
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
  hasNewAlert = false
  lastKnownRecentCount = 0
  resetFilters()
}

export function useAlerts() {
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
    get hasNewAlert() { return hasNewAlert },
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
    markSeen,
    clearFilters: resetFilters,
    reset,
  }
}
