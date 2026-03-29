import type { ClientSession, ClientSessionListOptions } from '$lib/core/api/types'
import { api } from './client.svelte'

const BACKEND_PAGE_SIZE = 1000
const MAX_ROUNDS = 10
const DISPLAY_PAGE_SIZE = 20

export interface SessionSummaryData {
  byStatus: [string, number][]
  byPlatform: [string, number][]
  byOs: [string, number][]
  activeCount: number
  regionCount: number
  volumeCount: number
  hostCount: number
  total: number
}

export function getPlatform(s: ClientSession): string {
  const md = s.metadata as { platform?: string } | undefined
  return md?.platform ?? s.clientType
}

// State
let allSessions = $state<ClientSession[]>([])
let loading = $state(false)
let error = $state<string | null>(null)
let capped = $state(false)
let cappedTotal = $state(0)
let fetchedForAccountId = $state<number | null>(null)
let fetchedIsActive = $state<'true' | 'false' | 'all'>('all')
let fetchCtrl: AbortController | null = null

// Filter state
let statusFilter = $state('')
let platformFilter = $state('')
let regionFilter = $state('')
let osFilter = $state('')
let volumeIdFilter = $state<number | undefined>(undefined)
let searchQuery = $state('')
let showInactive = $state(true)
let displayPage = $state(1)
let expanded = $state<Set<number>>(new Set())

// Summary (derived from allSessions)
const summary: SessionSummaryData = $derived.by(() => {
  const byStatus: Record<string, number> = {}
  const byPlatform: Record<string, number> = {}
  const byOs: Record<string, number> = {}
  const regions = new Set<number>()
  const volumes = new Set<number>()
  const hosts = new Set<string>()
  let activeCount = 0
  for (const s of allSessions) {
    byStatus[s.status] = (byStatus[s.status] ?? 0) + 1
    const p = getPlatform(s)
    byPlatform[p] = (byPlatform[p] ?? 0) + 1
    byOs[s.osName] = (byOs[s.osName] ?? 0) + 1
    regions.add(s.region.id)
    volumes.add(s.volume.id)
    if (s.hostname) hosts.add(s.hostname)
    if (s.status === 'active') activeCount++
  }
  const sortDesc = (obj: Record<string, number>) =>
    Object.entries(obj).sort((a, b) => b[1] - a[1])
  return {
    byStatus: sortDesc(byStatus),
    byPlatform: sortDesc(byPlatform),
    byOs: sortDesc(byOs),
    activeCount,
    regionCount: regions.size,
    volumeCount: volumes.size,
    hostCount: hosts.size,
    total: allSessions.length,
  }
})

// Filter options (derived from allSessions)
const statusOptions = $derived([
  { value: '', label: 'All Status' },
  ...[...new Set(allSessions.map(s => s.status))].map(v => ({ value: v, label: v })),
])
const platformOptions = $derived([
  { value: '', label: 'All Platforms' },
  ...[...new Set(allSessions.map(getPlatform))].map(v => ({ value: v, label: v })),
])
const regionOptions = $derived([
  { value: '', label: 'All Regions' },
  ...[...new Map(allSessions.map(s => [s.region.name, s.region])).values()].map(r => ({ value: r.name, label: r.name })),
])
const osOptions = $derived([
  { value: '', label: 'All OS' },
  ...[...new Set(allSessions.map(s => s.osName))].map(v => ({ value: v, label: v })),
])

// Filtered list
const filtered = $derived(allSessions.filter(s => {
  if (statusFilter && s.status !== statusFilter) return false
  if (platformFilter && getPlatform(s) !== platformFilter) return false
  if (regionFilter && s.region.name !== regionFilter) return false
  if (osFilter && s.osName !== osFilter) return false
  if (volumeIdFilter && s.volume.id !== volumeIdFilter) return false
  if (searchQuery) {
    const q = searchQuery.toLowerCase()
    return (s.hostname?.toLowerCase().includes(q))
      || (s.volume.name?.toLowerCase().includes(q))
      || (s.mountPath?.toLowerCase().includes(q))
      || s.account.name.toLowerCase().includes(q)
      || s.ipAddr.includes(q)
  }
  return true
}))

const totalDisplayPages = $derived(Math.ceil(filtered.length / DISPLAY_PAGE_SIZE))
const displaySessions = $derived(filtered.slice((displayPage - 1) * DISPLAY_PAGE_SIZE, displayPage * DISPLAY_PAGE_SIZE))

function resetFilters() {
  statusFilter = ''; platformFilter = ''; regionFilter = ''; osFilter = ''
  volumeIdFilter = undefined; searchQuery = ''; displayPage = 1
}

function resetPage() { displayPage = 1 }

async function fetchAllSessions(accountId: number) {
  const isActiveParam = showInactive ? 'all' : 'true'
  if (fetchedForAccountId === accountId && fetchedIsActive === isActiveParam) return
  fetchedForAccountId = accountId
  fetchedIsActive = isActiveParam
  fetchCtrl?.abort()
  const ctrl = fetchCtrl = new AbortController()
  loading = true
  error = null
  capped = false
  cappedTotal = 0
  allSessions = []

  try {
    for (let page = 1; page <= MAX_ROUNDS; page++) {
      const res = await api.clientSessions.list({ accountId, isActive: isActiveParam, page, limit: BACKEND_PAGE_SIZE }, ctrl.signal)
      allSessions = page === 1 ? res.items : [...allSessions, ...res.items]
      if (page >= (res.pagination?.totalPages ?? 1)) break
      if (page === MAX_ROUNDS && (res.pagination?.total ?? 0) > MAX_ROUNDS * BACKEND_PAGE_SIZE) {
        capped = true
        cappedTotal = res.pagination?.total ?? 0
      }
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') return
    error = (e as Error).message || 'Failed to load sessions'
  } finally {
    if (fetchCtrl === ctrl) loading = false
  }
}

function refetch() {
  const acct = fetchedForAccountId
  fetchedForAccountId = null
  if (acct) fetchAllSessions(acct)
}

function reset() {
  allSessions = []
  loading = false
  error = null
  capped = false
  cappedTotal = 0
  fetchedForAccountId = null
  fetchedIsActive = 'all'
  fetchCtrl?.abort()
  fetchCtrl = null
  resetFilters()
  showInactive = true
  expanded = new Set()
}

async function getSession(id: number): Promise<ClientSession> {
  return api.clientSessions.get(id)
}

export function useSessions() {
  return {
    get allSessions() { return allSessions },
    get displaySessions() { return displaySessions },
    get filtered() { return filtered },
    get summary() { return summary },
    get loading() { return loading },
    get error() { return error },
    get capped() { return capped },
    get cappedTotal() { return cappedTotal },
    get displayPage() { return displayPage },
    get totalDisplayPages() { return totalDisplayPages },

    get statusFilter() { return statusFilter },
    get platformFilter() { return platformFilter },
    get regionFilter() { return regionFilter },
    get osFilter() { return osFilter },
    get volumeIdFilter() { return volumeIdFilter },
    get searchQuery() { return searchQuery },
    get showInactive() { return showInactive },
    get expanded() { return expanded },

    get statusOptions() { return statusOptions },
    get platformOptions() { return platformOptions },
    get regionOptions() { return regionOptions },
    get osOptions() { return osOptions },

    setDisplayPage(p: number) { displayPage = p },
    setStatusFilter(v: string) { statusFilter = v; resetPage() },
    setPlatformFilter(v: string) { platformFilter = v; resetPage() },
    setRegionFilter(v: string) { regionFilter = v; resetPage() },
    setOsFilter(v: string) { osFilter = v; resetPage() },
    setVolumeIdFilter(v: number | undefined) { volumeIdFilter = v; resetPage() },
    setSearchQuery(v: string) { searchQuery = v; resetPage() },
    setShowInactive(v: boolean) { showInactive = v; refetch() },
    toggleExpanded(id: number) {
      const next = new Set(expanded)
      next.has(id) ? next.delete(id) : next.add(id)
      expanded = next
    },
    clearFilters: resetFilters,
    getPlatform,

    fetchAllSessions,
    refetch,
    getSession,
    reset,
  }
}
