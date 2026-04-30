import type { ClientSession, ClientSessionListOptions, SessionSummary } from '$lib/core/api/types'
import { api } from './client.svelte'

const PAGE_SIZE = 20

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

// getPlatform reads the authoritative platform id that mfuse emits into
// metadata.platform. No client-type fallback; sessions without this field
// are treated as unknown so the UI stays aligned with the server-side filter.
export function getPlatform(s: ClientSession): string {
  const md = s.metadata as { platform?: string } | undefined
  return md?.platform ?? ''
}

// Page state (server-paginated + server-filtered)
let pageSessions = $state<ClientSession[]>([])
let totalCount = $state(0)
let totalPages = $state(0)
let loading = $state(false)
let error = $state<string | null>(null)
let fetchCtrl: AbortController | null = null
let fetchedAccountId: number | null = null

// Filter state (sent to server each fetch)
let statusFilter = $state('')
let platformFilter = $state('')
let regionFilter = $state<number | undefined>(undefined)
let osFilter = $state('')
let volumeIdFilter = $state<number | undefined>(undefined)
let searchQuery = $state('')
let showInactive = $state(true)
let displayPage = $state(1)
let expanded = $state<Set<number>>(new Set())

// Stable option lists (static; previously derived from full dataset client-side).
// Keeping these static avoids an unfiltered round-trip just to populate dropdowns.
const statusOptions = [
  { value: '', label: 'All Status' },
  { value: 'active', label: 'active' },
  { value: 'idle', label: 'idle' },
  { value: 'disconnected', label: 'disconnected' },
  { value: 'error', label: 'error' },
]
const platformOptions = [
  { value: '', label: 'All Platforms' },
  { value: 'fuse', label: 'fuse' },
  { value: 'fuse+iouring', label: 'fuse+iouring' },
  { value: 'fskit', label: 'fskit' },
  { value: 'macfuse', label: 'macfuse' },
  { value: 'smb', label: 'smb' },
  { value: 'nfs', label: 'nfs' },
  { value: 'winfsp', label: 'winfsp' },
  { value: 'mountosio', label: 'mountosio' },
  { value: 'cloudfilter', label: 'cloudfilter' },
  // Embedded gateway in mfuse: gateway-only sessions advertise the
  // protocol(s) here; mount+gateway sessions still report a FUSE platform
  // and the gateway shows up via metrics.gateway instead.
  { value: 's3', label: 's3' },
  { value: 'hdfs', label: 'hdfs' },
  { value: 's3+hdfs', label: 's3+hdfs' },
]
const osOptions = [
  { value: '', label: 'All OS' },
  { value: 'linux', label: 'linux' },
  { value: 'darwin', label: 'darwin' },
  { value: 'windows', label: 'windows' },
]

// Region options come from the current page. The selected region is kept in
// the list even if the current page contains no rows for it, so the dropdown
// always reflects the active filter.
let selectedRegionLabel = $state<string>('')
const regionOptions = $derived.by(() => {
  const map = new Map<number, { value: string; label: string }>()
  for (const s of pageSessions) {
    map.set(s.region.id, { value: String(s.region.id), label: s.region.name })
  }
  if (regionFilter !== undefined && !map.has(regionFilter)) {
    map.set(regionFilter, {
      value: String(regionFilter),
      label: selectedRegionLabel || `Region #${regionFilter}`,
    })
  }
  return [{ value: '', label: 'All Regions' }, ...map.values()]
})

// Global summary; populated from a separate /summary round-trip so counts
// reflect the entire dataset, not just the current page.
let globalSummary = $state<SessionSummary | null>(null)

const summary: SessionSummaryData = $derived.by(() => {
  const byStatus: Record<string, number> = {}
  let activeCount = 0
  for (const r of globalSummary?.byStatus ?? []) {
    byStatus[r.status] = (byStatus[r.status] ?? 0) + Number(r.count)
    if (r.status === 'active') activeCount += Number(r.count)
  }
  const byPlatform: [string, number][] = (globalSummary?.byPlatform ?? [])
    .map(f => [f.label, Number(f.count)])
  const byOs: [string, number][] = (globalSummary?.byOsName ?? [])
    .map(f => [f.label, Number(f.count)])
  // region/volume/host distinct counts are per-page only; the server summary
  // endpoint doesn't expose them yet and they're cosmetic in the strip.
  const regions = new Set<number>()
  const volumes = new Set<number>()
  const hosts = new Set<string>()
  for (const s of pageSessions) {
    regions.add(s.region.id)
    volumes.add(s.volume.id)
    if (s.hostname) hosts.add(s.hostname)
  }
  return {
    byStatus: Object.entries(byStatus).sort((a, b) => b[1] - a[1]),
    byPlatform,
    byOs,
    activeCount,
    regionCount: regions.size,
    volumeCount: volumes.size,
    hostCount: hosts.size,
    total: totalCount,
  }
})

function buildListOptions(accountId: number): ClientSessionListOptions {
  const opts: ClientSessionListOptions = {
    accountId,
    isActive: showInactive ? 'all' : 'true',
    page: displayPage,
    limit: PAGE_SIZE,
  }
  if (statusFilter) opts.status = statusFilter
  if (platformFilter) opts.platform = platformFilter
  if (osFilter) opts.osName = osFilter
  if (regionFilter !== undefined) opts.regionId = regionFilter
  if (volumeIdFilter !== undefined) opts.volumeId = volumeIdFilter
  if (searchQuery.trim()) opts.search = searchQuery.trim()
  return opts
}

let searchDebounce: ReturnType<typeof setTimeout> | null = null

function cancelSearchDebounce() {
  if (searchDebounce) { clearTimeout(searchDebounce); searchDebounce = null }
}

async function fetchSummary(accountId: number) {
  try {
    globalSummary = await api.clientSessions.summary(accountId, volumeIdFilter as number)
  } catch {
    // Summary is best-effort; leave previous value in place on failure.
  }
}

async function fetchPage(accountId: number) {
  fetchedAccountId = accountId
  fetchCtrl?.abort()
  const ctrl = fetchCtrl = new AbortController()
  loading = true
  error = null
  try {
    const res = await api.clientSessions.list(buildListOptions(accountId), ctrl.signal)
    pageSessions = res.items
    totalCount = res.pagination?.total ?? res.items.length
    totalPages = res.pagination?.totalPages ?? 1
  } catch (e) {
    if ((e as Error).name === 'AbortError') return
    error = (e as Error).message || 'Failed to load sessions'
    pageSessions = []
    totalCount = 0
    totalPages = 0
  } finally {
    if (fetchCtrl === ctrl) loading = false
  }
}

function refetch() {
  if (fetchedAccountId == null) return
  fetchPage(fetchedAccountId)
  fetchSummary(fetchedAccountId)
}

function resetPage() {
  displayPage = 1
  expanded = new Set()
  refetch()
}

function scheduleSearch() {
  cancelSearchDebounce()
  searchDebounce = setTimeout(() => { searchDebounce = null; resetPage() }, 250)
}

// Entry point used by the page: matches the previous signature so the caller
// keeps working unchanged. Triggers a fresh fetch when the account changes.
async function fetchAllSessions(accountId: number) {
  if (fetchedAccountId !== accountId) displayPage = 1
  await Promise.all([fetchPage(accountId), fetchSummary(accountId)])
}

function reset() {
  cancelSearchDebounce()
  pageSessions = []
  globalSummary = null
  totalCount = 0
  totalPages = 0
  loading = false
  error = null
  fetchCtrl?.abort()
  fetchCtrl = null
  fetchedAccountId = null
  statusFilter = ''
  platformFilter = ''
  regionFilter = undefined
  selectedRegionLabel = ''
  osFilter = ''
  volumeIdFilter = undefined
  searchQuery = ''
  showInactive = true
  displayPage = 1
  expanded = new Set()
}

function clearFilters() {
  cancelSearchDebounce()
  statusFilter = ''
  platformFilter = ''
  regionFilter = undefined
  selectedRegionLabel = ''
  osFilter = ''
  volumeIdFilter = undefined
  searchQuery = ''
  resetPage()
}

async function getSession(id: number): Promise<ClientSession> {
  return api.clientSessions.get(id)
}

export function useSessions() {
  return {
    // `allSessions` used to be the full dataset; it now exposes the current
    // server page so existing call sites (summary, filter, loading checks)
    // keep working without a deeper refactor of the page component.
    get allSessions() { return pageSessions },
    get displaySessions() { return pageSessions },
    get filtered() { return pageSessions },
    get summary() { return summary },
    get loading() { return loading },
    get error() { return error },
    // Old "capped" banner is obsolete with server pagination.
    get capped() { return false },
    get cappedTotal() { return 0 },
    get displayPage() { return displayPage },
    get totalDisplayPages() { return totalPages },

    get statusFilter() { return statusFilter },
    get platformFilter() { return platformFilter },
    get regionFilter() { return regionFilter !== undefined ? String(regionFilter) : '' },
    get osFilter() { return osFilter },
    get volumeIdFilter() { return volumeIdFilter },
    get searchQuery() { return searchQuery },
    get showInactive() { return showInactive },
    get expanded() { return expanded },

    get statusOptions() { return statusOptions },
    get platformOptions() { return platformOptions },
    get regionOptions() { return regionOptions },
    get osOptions() { return osOptions },

    setDisplayPage(p: number) { if (p === displayPage) return; displayPage = p; refetch() },
    setStatusFilter(v: string) { if (v === statusFilter) return; statusFilter = v; resetPage() },
    setPlatformFilter(v: string) { if (v === platformFilter) return; platformFilter = v; resetPage() },
    setRegionFilter(v: string, label?: string) {
      const next = v ? Number(v) : undefined
      if (next === regionFilter) return
      regionFilter = next
      selectedRegionLabel = label ?? ''
      resetPage()
    },
    setOsFilter(v: string) { if (v === osFilter) return; osFilter = v; resetPage() },
    setVolumeIdFilter(v: number | undefined) { if (v === volumeIdFilter) return; volumeIdFilter = v; resetPage() },
    setSearchQuery(v: string) { if (v === searchQuery) return; searchQuery = v; scheduleSearch() },
    setShowInactive(v: boolean) { if (v === showInactive) return; showInactive = v; resetPage() },
    toggleExpanded(id: number) {
      const next = new Set(expanded)
      next.has(id) ? next.delete(id) : next.add(id)
      expanded = next
    },
    clearFilters,
    getPlatform,

    fetchAllSessions,
    refetch,
    getSession,
    reset,
  }
}
