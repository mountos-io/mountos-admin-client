import type { ServiceNode, NodeStatsSample } from '$lib/core/api/types'
import { parsePrometheusText, type PrometheusMetric } from '$lib/core/utils/format'
import { createActivePoll, type ActivePoll } from '$lib/core/utils/activePoll'
import { isNodeUnreachableError } from '$lib/core/api/errors'
import { api } from './client.svelte'

let nodes = $state<ServiceNode[]>([])
let loading = $state(false)
let selectedRegionId = $state<number | null>(null)
// Account context for the cross-region (all-nodes) view; retained so refetch()
// and polling re-issue the account-scoped request.
let allNodesAccountId = $state<number | null>(null)
let serviceType = $state('')
let statusFilter = $state('')
let inactiveHoursFilter = $state<number | undefined>(undefined)
let metadataClusterFilter = $state<number | undefined>(undefined)
let fetchCtrl: AbortController | null = null

let stats = $state<Map<string, PrometheusMetric[]>>(new Map())
let statsRaw = $state('')
let statsLoading = $state(false)
let statsError = $state('')
// True when statsError came from the proxy failing to reach the node process (dial
// failure or a deregistered node row), not a genuine backend/auth error - the node not
// running, not a bug to alarm the operator about.
let statsNodeUnreachable = $state(false)
let statsLastUpdated = $state<Date | null>(null)
let pollInterval = $state(0)
let poll: ActivePoll | null = null
let statsFetchCtrl: AbortController | null = null

let statsHistory = $state<NodeStatsSample[]>([])
let statsHistoryIntervalMs = $state(0)
let statsHistoryLoading = $state(false)
let statsHistoryError = $state('')
let statsHistoryFetchCtrl: AbortController | null = null

const nodesByType = $derived.by(() => {
  const map = new Map<string, ServiceNode[]>()
  for (const n of nodes) {
    const list = map.get(n.serviceType) ?? []
    list.push(n)
    map.set(n.serviceType, list)
  }
  return map
})

async function fetchNodes(regionId: number, opts: { metadataClusterId?: number } = {}) {
  fetchCtrl?.abort()
  const ctrl = fetchCtrl = new AbortController()
  selectedRegionId = regionId
  // Sync state so refetch() and getters reflect the active filter.
  if (opts.metadataClusterId !== undefined) metadataClusterFilter = opts.metadataClusterId
  loading = true
  try {
    nodes = await api.serviceNodes.list(
      regionId,
      serviceType || undefined,
      statusFilter || undefined,
      inactiveHoursFilter,
      metadataClusterFilter,
      ctrl.signal,
    )
  } catch (e) {
    if ((e as Error).name === 'AbortError') return
    throw e
  } finally {
    if (fetchCtrl === ctrl) loading = false
  }
}

async function fetchAllNodes(accountId: number) {
  fetchCtrl?.abort()
  const ctrl = fetchCtrl = new AbortController()
  selectedRegionId = null
  allNodesAccountId = accountId
  loading = true
  try {
    nodes = await api.nodes.list(
      accountId,
      serviceType || undefined,
      statusFilter || undefined,
      inactiveHoursFilter,
      ctrl.signal,
    )
  } catch (e) {
    if ((e as Error).name === 'AbortError') return
    console.error('[nodes] fetchAllNodes failed:', e)
    throw e
  } finally {
    if (fetchCtrl === ctrl) loading = false
  }
}

async function fetchStats(regionId: number, nodeId: string) {
  statsFetchCtrl?.abort()
  const ctrl = statsFetchCtrl = new AbortController()
  statsLoading = true
  statsError = ''
  statsNodeUnreachable = false
  try {
    const text = await api.serviceNodes.stats(regionId, nodeId, ctrl.signal)
    statsRaw = text
    stats = parsePrometheusText(text)
    statsLastUpdated = new Date()
  } catch (e) {
    if ((e as Error).name === 'AbortError') return
    statsError = (e as Error).message || 'Failed to fetch stats'
    statsNodeUnreachable = isNodeUnreachableError(e)
    stats = new Map()
    statsRaw = ''
  } finally {
    if (statsFetchCtrl === ctrl) statsLoading = false
  }
}

async function fetchStatsHistory(regionId: number, nodeId: string) {
  statsHistoryFetchCtrl?.abort()
  const ctrl = statsHistoryFetchCtrl = new AbortController()
  statsHistoryLoading = true
  statsHistoryError = ''
  try {
    const resp = await api.serviceNodes.statsHistory(regionId, nodeId, ctrl.signal)
    statsHistory = resp.samples
    statsHistoryIntervalMs = resp.intervalMs
  } catch (e) {
    if ((e as Error).name === 'AbortError') return
    statsHistoryError = (e as Error).message || 'Failed to fetch stats history'
    statsHistory = []
    statsHistoryIntervalMs = 0
  } finally {
    if (statsHistoryFetchCtrl === ctrl) statsHistoryLoading = false
  }
}

function startPolling({ regionId, nodeId, interval }: { regionId: number; nodeId: string; interval: number }) {
  stopPolling()
  pollInterval = interval
  if (interval <= 0) return
  poll = createActivePoll(() => {
    fetchStats(regionId, nodeId)
    fetchStatsHistory(regionId, nodeId)
  }, interval * 1000)
  poll.start()
}

function stopPolling() {
  poll?.stop()
  poll = null
  statsFetchCtrl?.abort()
  statsHistoryFetchCtrl?.abort()
  pollInterval = 0
}

function resetStats() {
  stopPolling()
  stats = new Map()
  statsRaw = ''
  statsError = ''
  statsNodeUnreachable = false
  statsLastUpdated = null
  statsHistory = []
  statsHistoryIntervalMs = 0
  statsHistoryError = ''
}

function refetch() {
  if (selectedRegionId) fetchNodes(selectedRegionId)
  else if (allNodesAccountId != null) fetchAllNodes(allNodesAccountId)
}

function setServiceType(type: string) {
  serviceType = type
  refetch()
}

function setStatus(s: string) {
  statusFilter = s
  refetch()
}

function setInactiveHours(hours: number | undefined) {
  inactiveHoursFilter = hours
  refetch()
}

function setMetadataCluster(id: number | undefined) {
  metadataClusterFilter = id
  refetch()
}

function clearFilters() {
  serviceType = ''
  statusFilter = ''
  inactiveHoursFilter = undefined
  metadataClusterFilter = undefined
}

function resetFilters() {
  clearFilters()
  refetch()
}

export function useNodes() {
  return {
    get nodes() { return nodes },
    get loading() { return loading },
    get selectedRegionId() { return selectedRegionId },
    get serviceType() { return serviceType },
    get status() { return statusFilter },
    get inactiveHours() { return inactiveHoursFilter },
    get metadataCluster() { return metadataClusterFilter },
    get nodesByType() { return nodesByType },
    get stats() { return stats },
    get statsRaw() { return statsRaw },
    get statsLoading() { return statsLoading },
    get statsError() { return statsError },
    get statsNodeUnreachable() { return statsNodeUnreachable },
    get statsLastUpdated() { return statsLastUpdated },
    get pollInterval() { return pollInterval },
    get statsHistory() { return statsHistory },
    get statsHistoryIntervalMs() { return statsHistoryIntervalMs },
    get statsHistoryLoading() { return statsHistoryLoading },
    get statsHistoryError() { return statsHistoryError },
    refetch,
    fetchNodes,
    fetchAllNodes,
    fetchStats,
    fetchStatsHistory,
    startPolling,
    stopPolling,
    resetStats,
    setServiceType,
    setStatus,
    setInactiveHours,
    setMetadataCluster,
    clearFilters,
    resetFilters,
  }
}
