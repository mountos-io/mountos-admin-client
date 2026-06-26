import type { ServiceNode } from '$lib/core/api/types'
import { parsePrometheusText, type PrometheusMetric } from '$lib/core/utils/format'
import { createActivePoll, type ActivePoll } from '$lib/core/utils/activePoll'
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
let regionClusterFilter = $state<number | undefined>(undefined)
let fetchCtrl: AbortController | null = null

let stats = $state<Map<string, PrometheusMetric[]>>(new Map())
let statsRaw = $state('')
let statsLoading = $state(false)
let statsError = $state('')
let statsLastUpdated = $state<Date | null>(null)
let pollInterval = $state(0)
let poll: ActivePoll | null = null
let statsFetchCtrl: AbortController | null = null

const nodesByType = $derived.by(() => {
  const map = new Map<string, ServiceNode[]>()
  for (const n of nodes) {
    const key = n.serviceType === 'mfuse' ? 'fuseserv' : n.serviceType
    const list = map.get(key) ?? []
    list.push(n)
    map.set(key, list)
  }
  return map
})

async function fetchNodes(regionId: number, opts: { regionClusterId?: number } = {}) {
  fetchCtrl?.abort()
  const ctrl = fetchCtrl = new AbortController()
  selectedRegionId = regionId
  // Sync state so refetch() and getters reflect the active filter.
  if (opts.regionClusterId !== undefined) regionClusterFilter = opts.regionClusterId
  loading = true
  try {
    nodes = await api.serviceNodes.list(
      regionId,
      serviceType || undefined,
      statusFilter || undefined,
      inactiveHoursFilter,
      regionClusterFilter,
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
    nodes = await api.nodes.listAll(
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
  try {
    const text = await api.serviceNodes.stats(regionId, nodeId, ctrl.signal)
    statsRaw = text
    stats = parsePrometheusText(text)
    statsLastUpdated = new Date()
  } catch (e) {
    if ((e as Error).name === 'AbortError') return
    statsError = (e as Error).message || 'Failed to fetch stats'
    stats = new Map()
    statsRaw = ''
  } finally {
    if (statsFetchCtrl === ctrl) statsLoading = false
  }
}

function startPolling({ regionId, nodeId, interval }: { regionId: number; nodeId: string; interval: number }) {
  stopPolling()
  pollInterval = interval
  if (interval <= 0) return
  poll = createActivePoll(() => fetchStats(regionId, nodeId), interval * 1000)
  poll.start()
}

function stopPolling() {
  poll?.stop()
  poll = null
  statsFetchCtrl?.abort()
  pollInterval = 0
}

function resetStats() {
  stopPolling()
  stats = new Map()
  statsRaw = ''
  statsError = ''
  statsLastUpdated = null
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

function setRegionCluster(id: number | undefined) {
  regionClusterFilter = id
  refetch()
}

function clearFilters() {
  serviceType = ''
  statusFilter = ''
  inactiveHoursFilter = undefined
  regionClusterFilter = undefined
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
    get regionCluster() { return regionClusterFilter },
    get nodesByType() { return nodesByType },
    get stats() { return stats },
    get statsRaw() { return statsRaw },
    get statsLoading() { return statsLoading },
    get statsError() { return statsError },
    get statsLastUpdated() { return statsLastUpdated },
    get pollInterval() { return pollInterval },
    refetch,
    fetchNodes,
    fetchAllNodes,
    fetchStats,
    startPolling,
    stopPolling,
    resetStats,
    setServiceType,
    setStatus,
    setInactiveHours,
    setRegionCluster,
    clearFilters,
    resetFilters,
  }
}
