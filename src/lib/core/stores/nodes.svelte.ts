import type { ServiceNode } from '$lib/core/api/types'
import { parsePrometheusText, type PrometheusMetric } from '$lib/core/utils/format'
import { api } from './client.svelte'

let nodes = $state<ServiceNode[]>([])
let loading = $state(false)
let selectedRegionId = $state<number | null>(null)
let serviceType = $state('')
let statusFilter = $state('')
let fetchCtrl: AbortController | null = null

let stats = $state<Map<string, PrometheusMetric[]>>(new Map())
let statsRaw = $state('')
let statsLoading = $state(false)
let statsError = $state('')
let statsLastUpdated = $state<Date | null>(null)
let pollInterval = $state(0)
let pollTimer: ReturnType<typeof setInterval> | null = null
let statsFetchCtrl: AbortController | null = null

const nodesByType = $derived.by(() => {
  const map = new Map<string, ServiceNode[]>()
  for (const n of nodes) {
    const key = n.serviceType === 'hub' ? 'appserv' : n.serviceType === 'mfuse' ? 'fuseserv' : n.serviceType
    const list = map.get(key) ?? []
    list.push(n)
    map.set(key, list)
  }
  return map
})

async function fetchNodes(regionId: number) {
  fetchCtrl?.abort()
  const ctrl = fetchCtrl = new AbortController()
  selectedRegionId = regionId
  loading = true
  try {
    nodes = await api.serviceNodes.list(
      regionId,
      serviceType || undefined,
      statusFilter || undefined,
      ctrl.signal,
    )
  } catch (e) {
    if ((e as Error).name === 'AbortError') return
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

function startPolling(regionId: number, nodeId: string, interval: number) {
  stopPolling()
  pollInterval = interval
  if (interval <= 0) return
  fetchStats(regionId, nodeId)
  pollTimer = setInterval(() => fetchStats(regionId, nodeId), interval * 1000)
}

function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
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

function setServiceType(type: string) {
  serviceType = type
  if (selectedRegionId) fetchNodes(selectedRegionId)
}

function setStatus(s: string) {
  statusFilter = s
  if (selectedRegionId) fetchNodes(selectedRegionId)
}

function resetFilters() {
  serviceType = ''
  statusFilter = ''
  if (selectedRegionId) fetchNodes(selectedRegionId)
}

export function useNodes() {
  return {
    get nodes() { return nodes },
    get loading() { return loading },
    get selectedRegionId() { return selectedRegionId },
    get serviceType() { return serviceType },
    get status() { return statusFilter },
    get nodesByType() { return nodesByType },
    get stats() { return stats },
    get statsRaw() { return statsRaw },
    get statsLoading() { return statsLoading },
    get statsError() { return statsError },
    get statsLastUpdated() { return statsLastUpdated },
    get pollInterval() { return pollInterval },
    fetchNodes,
    fetchStats,
    startPolling,
    stopPolling,
    resetStats,
    setServiceType,
    setStatus,
    resetFilters,
  }
}
