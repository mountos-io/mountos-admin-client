<script lang="ts">
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { onDestroy } from 'svelte'
  import { untrack } from 'svelte'
  import { Card, CardContent } from '$lib/components/ui/card'
  import { Badge } from '$lib/components/ui/badge'
  import { Button } from '$lib/components/ui/button'
  import { useAuth } from '$lib/core/stores/auth.svelte'
  import { api } from '$lib/core/stores/client.svelte'
  import FilterSelect from '$lib/components/shared/FilterSelect.svelte'
  import DetailSkeleton from '$lib/components/shared/DetailSkeleton.svelte'
  import { formatRelative, formatDate, formatUptime, formatDuration, formatBytes, formatBitrate, formatNum, formatIPv4, formatPlatform, formatOs, formatSessionStatus, isReadOnlyMountMode, sinkStateVariant } from '$lib/core/utils/format'
  import { formatUs, formatOpsPerSec, formatTotalTime, latencyColor, objectLatencyColor, pingRttColor, memAllocColor, cvClass, bucketBarColor, estimateCV, interpolatePercentile, CV_TOOLTIP_TEXT, type HistBucket } from '$lib/core/utils/metrics'
  import ChevronRight from '@lucide/svelte/icons/chevron-right'
  import { POLL_OPTIONS } from '$lib/core/utils/options'
  import { createActivePoll, type ActivePoll } from '$lib/core/utils/activePoll'
  import { showErrorToast } from '$lib/core/utils/toast'
  import { HISTOGRAM_BOUNDS } from '$lib/core/constants'
  import type { ClientSession } from '$lib/core/api/types'
  import { getPlatform } from '$lib/core/stores/sessions.svelte'
  import ArrowLeft from '@lucide/svelte/icons/arrow-left'
  import RefreshCw from '@lucide/svelte/icons/refresh-cw'
  import Layers from '@lucide/svelte/icons/layers'
  import TriangleAlert from '@lucide/svelte/icons/triangle-alert'
  import InfoTip from '$lib/components/shared/InfoTip.svelte'

  const auth = useAuth()
  const id = $derived(Number($page.params.id))

  let session = $state<ClientSession | null>(null)
  let loading = $state(true)
  let error = $state<string | null>(null)
  let fetchCtrl: AbortController | null = null
  let redirected = false

  let pollValue = $state('')
  let poll: ActivePoll | null = null

  async function fetchSession() {
    fetchCtrl?.abort()
    const ctrl = fetchCtrl = new AbortController()
    const sessionId = untrack(() => id)
    if (isNaN(sessionId)) { error = 'Invalid session ID'; loading = false; return }
    if (!session) loading = true
    error = null
    try {
      const s = await api.clientSessions.get(sessionId, ctrl.signal)
      if (auth.isUserRole && s.user?.id !== auth.userMountosUserId) {
        showErrorToast('Access denied')
        goto('/sessions', { replaceState: true })
        return
      }
      session = s
      if (!session.isActive && poll) setPoll('')
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      error = (e as Error).message || 'Failed to load session'
    } finally {
      if (fetchCtrl === ctrl) loading = false
    }
  }

  function setPoll(v: string) {
    pollValue = v
    poll?.stop()
    poll = null
    const secs = Number(v)
    if (secs > 0) {
      poll = createActivePoll(() => fetchSession(), secs * 1000)
      poll.start()
    }
  }

  $effect(() => {
    if (auth.loading) return
    if (!auth.can('clientSessions', 'read')) {
      if (!redirected) { redirected = true; showErrorToast('Access denied'); goto('/', { replaceState: true }) }
      return
    }
    untrack(() => fetchSession())
  })

  onDestroy(() => {
    fetchCtrl?.abort()
    poll?.stop()
  })

  function statusVariant(s: string) { return formatSessionStatus(s).variant }
  function getMetrics(s: ClientSession): Record<string, any> {
    const m = s.metrics
    return m && typeof m === 'object' ? m as Record<string, any> : {}
  }

  // Wall-clock lifetime, mirroring the list view: still-active rows tick from
  // connectedAt to now; closed rows freeze at disconnectedAt (or last heartbeat
  // for sessions swept-degraded without ever sending disconnect).
  function sessionDuration(s: ClientSession): string {
    if (!s.connectedAt) return '·'
    const end = s.disconnectedAt ?? (s.isActive ? undefined : s.lastHeartbeat)
    return formatDuration(s.connectedAt, end)
  }

  function getMetaProp(s: ClientSession, key: string): unknown {
    const m = s.metadata
    return m != null && typeof m === 'object' ? (m as Record<string, unknown>)[key] : undefined
  }

  // Every client session carries a memorable "adjective-noun-xxxx" label
  // under metadata.friendlyName, generated once per process and stable
  // across an upload/download job's resumes. Preferred over the raw
  // hostname for the header title.
  function getFriendlyName(s: ClientSession): string | undefined {
    const name = getMetaProp(s, 'friendlyName')
    return typeof name === 'string' && name !== '' ? name : undefined
  }

  // Session kind reported by the client under metadata.role. A gateway process
  // has no FUSE mount (mount path "."); a utility is a one-shot tool; an
  // upload/download is a bulk-copy job (also no FUSE mount, metadata.upload
  // or metadata.download carries its job id/paths/progress instead); a sink
  // is an HLS-to-mountOS ingest process (also no FUSE mount, metadata.sink
  // carries its job identity and live lag/rate progress). Absent or unknown
  // reads as a regular mount.
  function getSessionRole(s: ClientSession): 'mount' | 'gateway' | 'utility' | 'upload' | 'download' | 'sink' {
    const r = getMetaProp(s, 'role')
    return r === 'gateway' || r === 'utility' || r === 'upload' || r === 'download' || r === 'sink' ? r : 'mount'
  }

  interface GatewayInfo { endpoints: Record<string, string> }
  // Gateway endpoints reported under metadata.gateway.endpoints (protocol -> URL).
  function getGatewayInfo(s: ClientSession): GatewayInfo | null {
    const g = getMetaProp(s, 'gateway')
    if (g == null || typeof g !== 'object') return null
    const eps = (g as Record<string, unknown>).endpoints
    if (eps == null || typeof eps !== 'object' || Object.keys(eps as object).length === 0) return null
    return { endpoints: eps as Record<string, string> }
  }

  interface UploadInfo {
    jobId?: string
    sourcePath?: string
    destPath?: string
    counts?: Record<string, number>
    // A live aggregate as of the client's last scan pass, not a fixed total.
    // A daemon-mode job keeps discovering more on every rescan, so this
    // is only final once the session itself reports a settled state.
    totalFiles?: number
    totalBytes?: number
    // Live log file path on the client machine while the job is running.
    logPath?: string
    // Present only when SOURCE was an external object store (S3-compatible,
    // Azure Blob, GCS) rather than a local folder/profile manifest.
    // sourcePath above already renders as the scheme://bucket/prefix form
    // in that case; these are the individually-typed identifiers behind it.
    // Never the secret: mountOS never persists or reports that anywhere.
    sourceProvider?: string
    sourceBucket?: string
    sourcePrefix?: string
    sourceEndpoint?: string
    sourceRegion?: string
    sourceAccount?: string
  }
  // Upload job identity/progress reported under metadata.upload.
  function getUploadInfo(s: ClientSession): UploadInfo | null {
    const up = getMetaProp(s, 'upload')
    return up != null && typeof up === 'object' ? (up as UploadInfo) : null
  }

  interface DownloadInfo {
    jobId?: string
    sourcePath?: string
    destPath?: string
    // Status vocabulary differs from upload's: "downloading" (not
    // "uploading"), plus a synthetic "retrying" bucket, pending rows
    // cycling through backoff after a transient error, self-clearing and
    // distinct from "failed" (won't clear on its own).
    counts?: Record<string, number>
    // A live aggregate as of the client's last scan pass, not a fixed total.
    // A daemon-mode job keeps discovering more on every rescan, so this
    // is only final once the session itself reports a settled state.
    totalFiles?: number
    totalBytes?: number
    // Live log file path on the client machine while the job is running.
    logPath?: string
  }
  // Download job identity/progress reported under metadata.download.
  function getDownloadInfo(s: ClientSession): DownloadInfo | null {
    const dp = getMetaProp(s, 'download')
    return dp != null && typeof dp === 'object' ? (dp as DownloadInfo) : null
  }

  // Sink job identity + live progress reported under metadata.sink. A sink
  // has no bounded work list to count over (unlike upload/download): it
  // ingests an unbounded live HLS stream, so its health is lag and rate,
  // not pending/done/failed counts. `source` arrives already redacted by
  // the server (auth token stripped from the query string) and is never
  // re-derived or linked to here.
  interface SinkInfo {
    jobId?: string
    source?: string
    sinkTemplate?: string
    variant?: string
    fork?: string
    logPath?: string
    // Live progress, merged into metadata.sink on every heartbeat.
    state?: string
    lagSegments?: number
    lagSeconds?: number
    walBytes?: number
    walSegments?: number
    discontinuities?: number
    segmentsFetched?: number
    segmentsCommitted?: number
    bytesCommitted?: number
    fileSize?: number
    sinkCurrent?: string
    bitrateObserved?: number
    fetchErrors?: number
    commitRetries?: number
    lastCommitAt?: number
    lastSegmentAt?: number
  }
  function getSinkInfo(s: ClientSession): SinkInfo | null {
    const sk = getMetaProp(s, 'sink')
    return sk != null && typeof sk === 'object' ? (sk as SinkInfo) : null
  }

  // bytes pairs with durationNs (get/put only; RPC and FUSE entries never set it) so a
  // table can derive average payload size and throughput per op alongside latency.
  interface RpcMethodLatency { count: number; avgUs: number; minUs: number; maxUs: number; durationNs?: number; buckets?: number[]; bytes?: number }
  function getRpcLatency(m: Record<string, any>): [string, RpcMethodLatency][] {
    const rl = m.rpcLatency as Record<string, RpcMethodLatency> | undefined
    if (!rl) return []
    return Object.entries(rl).sort((a, b) => b[1].count - a[1].count)
  }
  // FUSE syscall handler latency (FUSE mounts only). Same wire shape as
  // rpcLatency so the breakdown snippet renders both. Diagnostically
  // complementary: rpcLatency is network round-trip to the metadata
  // service; FUSE latency adds cache hits and kernel-boundary time on top.
  function getFuseLatency(m: Record<string, any>): [string, RpcMethodLatency][] {
    const fl = m.fuseLatency as Record<string, RpcMethodLatency> | undefined
    if (!fl) return []
    return Object.entries(fl).sort((a, b) => b[1].count - a[1].count)
  }

  // Object-store GET/PUT latency (FUSE mounts only). Same wire shape again, so the
  // breakdown snippet renders it too. This is the round trip to the object
  // store, where the mean hides a tail measured in seconds; cache-served
  // reads are excluded by the client so the percentiles cover real requests.
  // Fixed GET/TTFB/PUT order rather than by count: the rows stay stable
  // between refreshes and make the provider wait visible separately from
  // payload transfer.
  // Derives average throughput (bits/sec, for formatBitrate) from the cumulative bytes,
  // avg latency, and op count already carried by collectMetrics' top-level object
  // scalars: avgUs * count reconstructs the total time the ops spent in flight.
  function objectThroughputBps(bytes: number | undefined, avgUs: number | undefined, count: number | undefined): number {
    const b = bytes ?? 0, u = avgUs ?? 0, c = count ?? 0
    if (b <= 0 || u <= 0 || c <= 0) return 0
    return (b * 8) / ((u * c) / 1e6)
  }
  const OBJECT_OP_LABELS: [string, string][] = [['get', 'GET'], ['get_ttfb', 'GET TTFB'], ['put', 'PUT']]
  function getObjectLatency(m: Record<string, any>): [string, RpcMethodLatency][] {
    const ol = m.objectLatency as Record<string, RpcMethodLatency> | undefined
    if (!ol) return []
    return OBJECT_OP_LABELS.flatMap(([key, label]) => ol[key] ? [[label, ol[key]] as [string, RpcMethodLatency]] : [])
  }

  // Embedded gateway counters reported by the client when the per-volume
  // S3 / WebHDFS gateway is running; rendered in the Gateway Activity
  // card below.
  interface ProtoStatsSnapshot { requests: number; errors: number; bytes_in: number; bytes_out: number }
  interface GatewaySnapshot { s3?: ProtoStatsSnapshot; hdfs?: ProtoStatsSnapshot }
  function getGatewayMetrics(m: Record<string, any>): GatewaySnapshot | null {
    const g = m.gateway as GatewaySnapshot | undefined
    if (!g) return null
    if (!g.s3 && !g.hdfs) return null
    return g
  }
  function gatewayProtocols(g: GatewaySnapshot): { proto: string; snap: ProtoStatsSnapshot }[] {
    const out: { proto: string; snap: ProtoStatsSnapshot }[] = []
    if (g.s3) out.push({ proto: 's3', snap: g.s3 })
    if (g.hdfs) out.push({ proto: 'hdfs', snap: g.hdfs })
    return out
  }

  // Client-side watcher state. watchedFolders/trackedFolders is the live
  // participation gauge (folders this mount is a registered watcher of right
  // now); pushes/entries/invalidations are the cumulative push-driven activity.
  // A lone mount on a folder still watches it but is excluded from its own
  // broadcasts, so it shows folders with zero pushes rather than nothing.
  interface WatcherSnapshot {
    watchedFolders?: number
    trackedFolders?: number
    pushesReceived?: number
    pushEntries?: number
    invalidations?: number
  }
  function getWatcherMetrics(m: Record<string, any>): WatcherSnapshot | null {
    const w = m.watcher as WatcherSnapshot | undefined
    if (!w) return null
    if (!w.watchedFolders && !w.trackedFolders && !w.pushesReceived && !w.pushEntries && !w.invalidations) return null
    return w
  }

  // Windows mountosio kernel-driver diagnostics: invariant-violation hits
  // (with per-site breakdown), suppressed IRP double completions, and
  // dev-build fault injections. The server sends this group, all-zero
  // counters included, whenever the driver is queryable: presence alone
  // confirms "Windows client, driver present, no issues". Omission means
  // no driver (non-Windows, not installed, or inaccessible).
  interface DriverSnapshot {
    invariantTotal?: number
    irpDoubleCompletions?: number
    faultInjections?: number
    invariantSites?: Record<string, number>
  }
  function getDriverMetrics(m: Record<string, any>): DriverSnapshot | null {
    return (m.driver as DriverSnapshot | undefined) ?? null
  }

  // TCP connection-pool health per metadata-service node this mount talks to
  // (the same state .network_diagnostics and the .stats "Connection Pool
  // Health" section expose locally). One entry per pool; a single-server
  // mount reports one. reconnectBackoff is the client's own formatted
  // duration string ("5s"), not a raw number.
  interface PoolHealthEntry {
    node?: number
    addr?: number
    totalConnections?: number
    healthy?: number
    authenticated?: number
    pending?: number
    serverDown?: boolean
    congestionActive?: boolean
    serverDownCount?: number
    reconnectBackoff?: string
    lastDownAt?: string
  }
  function getPoolHealth(m: Record<string, any>): PoolHealthEntry[] {
    const p = m.poolHealth
    return Array.isArray(p) ? (p as PoolHealthEntry[]) : []
  }

  // "addr" is a big-endian uint32 IPv4 the server packs the pool's node
  // address into; an older server omits it and the UI falls back to the
  // plain node index.
  function poolNodeLabel(node: PoolHealthEntry, i: number): string {
    return node.addr != null ? formatIPv4(node.addr) : `Node ${node.node ?? i}`
  }

  function toBuckets(raw?: number[]): HistBucket[] {
    if (!raw || raw.length !== HISTOGRAM_BOUNDS.length) return []
    return raw.map((count, i) => ({ le: formatUs(HISTOGRAM_BOUNDS[i]), leUs: HISTOGRAM_BOUNDS[i], count }))
  }

  let rpcExpanded = $state<Set<string>>(new Set())
  let rpcMetricMode = $state<'minMax' | 'percentiles'>('percentiles')
  let fuseExpanded = $state<Set<string>>(new Set())
  let fuseMetricMode = $state<'minMax' | 'percentiles'>('percentiles')
  let objectExpanded = $state<Set<string>>(new Set())
  let objectMetricMode = $state<'minMax' | 'percentiles'>('percentiles')

  function toggleRpcExpand(method: string) {
    const next = new Set(rpcExpanded)
    next.has(method) ? next.delete(method) : next.add(method)
    rpcExpanded = next
  }
  function toggleFuseExpand(method: string) {
    const next = new Set(fuseExpanded)
    next.has(method) ? next.delete(method) : next.add(method)
    fuseExpanded = next
  }
  function toggleObjectExpand(method: string) {
    const next = new Set(objectExpanded)
    next.has(method) ? next.delete(method) : next.add(method)
    objectExpanded = next
  }

  // TCP connection-drop breakdown. The client splits drops into benign pool
  // cycling (parked timeouts, overflow shrink) and concerning failures
  // (remote close, transport error, healthcheck-marked unhealthy). The
  // breakdown is only sent when nonzero; we fall back to the aggregate
  // count with no split for older clients or sessions with no FUSE mount.
  interface ConnDroppedReasons { parked?: number; overflow?: number; unhealthy?: number; remote?: number; transportErr?: number; shutdown?: number; unknown?: number }
  interface ConnDroppedView { total: number; concern: number; benign: number; tooltip: string }
  function getConnDropped(m: Record<string, any>): ConnDroppedView {
    const total = Number(m.connDropped ?? 0)
    const r = m.connDroppedReasons as ConnDroppedReasons | undefined
    if (!r) return { total, concern: total, benign: 0, tooltip: total > 0 ? 'Pool-drop breakdown not reported by this client' : '' }
    const parked = Number(r.parked ?? 0)
    const overflow = Number(r.overflow ?? 0)
    const unhealthy = Number(r.unhealthy ?? 0)
    const remote = Number(r.remote ?? 0)
    const transportErr = Number(r.transportErr ?? 0)
    const shutdown = Number(r.shutdown ?? 0)
    const unknown = Number(r.unknown ?? 0)
    // Shutdown is benign (graceful) per the TUI's classification; unknown
    // is back-compat for older drop sites that never tagged a reason.
    const benign = parked + overflow + shutdown
    const concern = unhealthy + remote + transportErr + unknown
    const parts: string[] = []
    if (parked) parts.push(`${parked} parked`)
    if (overflow) parts.push(`${overflow} overflow`)
    if (shutdown) parts.push(`${shutdown} shutdown`)
    if (unhealthy) parts.push(`${unhealthy} unhealthy`)
    if (remote) parts.push(`${remote} remote-close`)
    if (transportErr) parts.push(`${transportErr} transport-err`)
    if (unknown) parts.push(`${unknown} unknown`)
    const tooltip = parts.length > 0
      ? `Concerning: ${concern}, benign pool cycling: ${benign}\n${parts.join(', ')}`
      : ''
    return { total, concern, benign, tooltip }
  }

  // Group entries into latency bands for the header summary chips.
  // Pure derivation; replaces a forEach-into-mutable-const pattern that
  // Svelte 5 hoisting could legally re-order in the future.
  //
  // The scale is per-table because the subsystems differ by orders of
  // magnitude. RPC and FUSE ops are microseconds to milliseconds; an
  // object-store round trip is tens of milliseconds to seconds, so on the
  // op scale every object row lands in the slowest band and the chips stop
  // discriminating. maxUs is an exclusive upper bound; the last band must
  // be Infinity so every entry finds a home.
  interface LatencyBand { label: string; maxUs: number; variant: 'success' | 'outline' | 'warning' | 'destructive' }
  // Bands and cell colour travel together as one scale, so a table can never
  // chip a row as healthy while colouring its numbers red.
  interface LatencyScale { bands: LatencyBand[]; color: (us: number) => string }
  const OP_SCALE: LatencyScale = {
    color: latencyColor,
    bands: [
      { label: '<1ms', maxUs: 1_000, variant: 'success' },
      { label: '1-10ms', maxUs: 10_000, variant: 'outline' },
      { label: '10-100ms', maxUs: 100_000, variant: 'warning' },
      { label: '>100ms', maxUs: Infinity, variant: 'destructive' },
    ],
  }
  const OBJECT_SCALE: LatencyScale = {
    color: objectLatencyColor,
    bands: [
      { label: '<10ms', maxUs: 10_000, variant: 'success' },
      { label: '10-100ms', maxUs: 100_000, variant: 'outline' },
      { label: '100ms-1s', maxUs: 1_000_000, variant: 'warning' },
      { label: '>1s', maxUs: Infinity, variant: 'destructive' },
    ],
  }
  function latencyBands(entries: [string, RpcMethodLatency][], bands: readonly LatencyBand[]): { band: LatencyBand; count: number }[] {
    const tally = bands.map((band) => ({ band, count: 0 }))
    for (const [, l] of entries) {
      const i = bands.findIndex((b) => l.avgUs < b.maxUs)
      tally[i < 0 ? tally.length - 1 : i].count++
    }
    return tally.filter((t) => t.count > 0)
  }

  // Per-table labels for the breakdown snippet, so a table of GET/PUT is not
  // described as "methods".
  interface LatencyTableLabels { items: string; column: string }
  const OP_LABELS: LatencyTableLabels = { items: 'methods', column: 'Method' }
  const OBJECT_LABELS: LatencyTableLabels = { items: 'operations', column: 'Operation' }
</script>

<svelte:head><title>Session #{isNaN(id) ? 'Invalid' : id} · mountOS Admin</title></svelte:head>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex items-center gap-3 flex-wrap">
    <a href="/sessions" class="inline-flex items-center justify-center min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 p-2 rounded-sm hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors focus-visible:ring-2 focus-visible:ring-ring" aria-label="Back to sessions">
      <ArrowLeft class="h-5 w-5" />
    </a>
    <h1 class="text-2xl font-bold tracking-tight">Session #{isNaN(id) ? 'Invalid' : id}</h1>
    {#if session}
      <Badge variant={statusVariant(session.status)}>{session.status}</Badge>
      {#if session.metadataCluster}
        <a
          href="/regions/{session.region.id}?cluster={session.metadataCluster.id}"
          class="session-cluster-chip"
          aria-label="View region {session.region.name} scoped to cluster {session.metadataCluster.name}"
          title="Cluster {session.metadataCluster.name} in region {session.region.name}"
        >
          <Layers class="h-3.5 w-3.5" aria-hidden="true" />
          <span class="font-mono">{session.metadataCluster.name}</span>
        </a>
      {/if}
    {/if}
    {#if !session || session.isActive}
      <div class="flex items-center gap-2 ml-auto">
        <Button variant="ghost" size="icon" class="min-h-[44px] min-w-[44px] sm:min-h-9 sm:min-w-9" onclick={() => fetchSession()} aria-label="Refresh" title="Refresh">
          <RefreshCw class="h-4 w-4" />
        </Button>
        <FilterSelect options={POLL_OPTIONS} value={pollValue} placeholder="Poll Off" onchange={setPoll} />
      </div>
    {/if}
  </div>

  {#if loading && !session}
    <DetailSkeleton cards={[{ rows: 4, cols: 2 }]} />
  {:else if error && !session}
    <Card><CardContent class="py-8"><p class="text-center text-destructive" role="alert">{error}</p></CardContent></Card>
  {:else if session}
    {@const m = getMetrics(session)}
    {@const pid = getMetaProp(session, 'processId')}
    {@const cd = getConnDropped(m)}
    {@const role = getSessionRole(session)}
    {@const gw = getGatewayInfo(session)}
    {@const up = getUploadInfo(session)}
    {@const dl = getDownloadInfo(session)}
    {@const sk = getSinkInfo(session)}

    {#if error}
      <div class="rounded-sm border border-destructive/30 bg-destructive/5 px-4 py-2 text-sm text-destructive" role="alert">Refresh failed: {error}</div>
    {/if}

    <!-- Info -->
    <div class="corner-brackets relative border border-border/30 rounded-sm">
      <div class="tech-grid absolute inset-0 pointer-events-none"></div>
      <div class="relative p-5 space-y-5">
        <!-- Host + badges -->
        <div class="flex flex-wrap items-center gap-4">
          <div class="min-w-0 flex-1">
            <p class="text-xl font-bold truncate" title={getFriendlyName(session) || session.hostname || session.ipAddr}>{getFriendlyName(session) || session.hostname || session.ipAddr}</p>
            <p class="text-sm text-muted-foreground font-mono">{#if getFriendlyName(session) && session.hostname}{session.hostname} &middot; {/if}{session.ipAddr}</p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            {#if getPlatform(session)}<Badge variant="primary" class="text-sm px-3 py-1">{formatPlatform(getPlatform(session))}</Badge>{/if}
            <Badge variant="secondary" class="text-sm px-3 py-1">{formatOs(session.osName)}</Badge>
            <Badge class="text-sm px-3 py-1">{session.region.name}</Badge>
            {#if session.volume.type}<Badge variant={session.volume.type === 'iceberg' ? 'primary' : 'secondary'} class="text-sm px-3 py-1 capitalize">{session.volume.type}</Badge>{/if}
            {#if session.mountMode && role !== 'upload' && role !== 'download' && role !== 'sink'}<Badge variant={isReadOnlyMountMode(session.mountMode) ? 'outline' : 'default'} title={isReadOnlyMountMode(session.mountMode) ? 'Read-only mount' : 'Read-write mount'} class="text-sm px-3 py-1">{session.mountMode}</Badge>{/if}
            {#if session.forkName}<Badge variant="outline" class="text-sm px-3 py-1">{session.forkName}</Badge>{#if session.isTemporaryFork}<Badge variant="warning" class="text-sm px-3 py-1">Temporary</Badge>{/if}{/if}
            {#if role === 'gateway'}<Badge variant="primary" class="text-sm px-3 py-1" title="S3/HDFS gateway process, no FUSE mount">Gateway</Badge>{:else if role === 'utility'}<Badge variant="outline" class="text-sm px-3 py-1" title="One-shot utility session, not a mount">Utility</Badge>{:else if role === 'upload'}<Badge variant="secondary" class="text-sm px-3 py-1" title="Bulk upload job, no FUSE mount">Upload</Badge>{:else if role === 'download'}<Badge variant="secondary" class="text-sm px-3 py-1" title="Bulk download job, no FUSE mount">Download</Badge>{:else if role === 'sink'}<Badge variant="secondary" class="text-sm px-3 py-1" title="HLS-to-mountOS ingest sink, no FUSE mount">Sink</Badge>{/if}
            <Badge variant="secondary" class="text-sm px-3 py-1">{session.clientType}</Badge>
          </div>
        </div>

        <div class="border-t border-border/40"></div>

        <!-- Detail grid -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4">
          <div><p class="detail-label">Account</p><a href="/accounts/{session.account.id}" class="detail-link text-sm">{session.account.name}</a></div>
          <div><p class="detail-label">Volume</p><a href="/volumes/{session.volume.id}" class="detail-link text-sm">{session.volume.name || `#${session.volume.id}`}</a></div>
          {#if role !== 'upload' && role !== 'download' && role !== 'sink'}
            <div><p class="detail-label">Mount Path</p>{#if role === 'gateway'}<p class="text-sm text-muted-foreground" title="Gateway process, no FUSE mount (path {session.mountPath ?? '·'})">N/A</p>{:else}<p class="text-sm font-mono truncate" title={session.mountPath ?? ''}>{session.mountPath ?? '·'}</p>{/if}</div>
          {/if}
          <div><p class="detail-label">OS / Arch</p><p class="text-sm font-mono">{session.osVersion ?? session.osName}</p></div>
          {#if session.forkName}
            <div><p class="detail-label">Fork</p><span class="inline-flex items-center gap-1.5"><Badge variant="outline">{session.forkName}</Badge>{#if session.isTemporaryFork}<Badge variant="warning">Temporary</Badge>{/if}</span></div>
          {/if}
          <div>
            <div class="detail-label flex items-center gap-0.5">
              Process Uptime
              <InfoTip text={"**Process Uptime:** how long the client process has run.\n**Session Age:** how long the server has tracked this session.\n\nDrift signals:\n\n• Uptime < Age → process restarted, session reused\n• Uptime > Age → late mount, warm process\n• Age frozen, Uptime advancing → heartbeats lost\n\nCheck Hot Upgrades before you assume a crash. A hot upgrade also resets Process Uptime."} />
            </div>
            <p class="text-sm">{m.uptimeSeconds != null ? formatUptime(m.uptimeSeconds) : '·'}</p>
          </div>
          <div><p class="detail-label">Session Age</p><p class="text-sm tabular-nums">{sessionDuration(session)}</p></div>
          {#if m.upgradeCount != null}
            <div>
              <p class="detail-label">Hot Upgrades</p>
              <p class="text-sm">{formatNum(m.upgradeCount)}{#if m.lastUpgradeSeconds != null}<span class="text-muted-foreground"> (last {formatUptime(m.lastUpgradeSeconds)} ago)</span>{/if}</p>
            </div>
          {/if}
          <div><p class="detail-label">Connected</p><p class="text-sm flex items-center gap-0.5">{session.connectedAt ? formatRelative(session.connectedAt) : '·'}{#if session.connectedAt}<InfoTip text={formatDate(session.connectedAt)} />{/if}</p></div>
          <div><p class="detail-label">Last Heartbeat</p><p class="text-sm flex items-center gap-0.5">{session.lastHeartbeat ? formatRelative(session.lastHeartbeat) : '·'}{#if session.lastHeartbeat}<InfoTip text={formatDate(session.lastHeartbeat)} />{/if}</p></div>
          {#if session.disconnectedAt}
            <div><p class="detail-label">Disconnected</p><p class="text-sm flex items-center gap-0.5">{formatRelative(session.disconnectedAt)}<InfoTip text={formatDate(session.disconnectedAt)} /></p></div>
          {/if}
        </div>

        <!-- IDs -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3">
          <div class="min-w-0"><p class="detail-label">User</p>{#if session.user}<a href="/users/{session.user.id}" class="detail-link text-sm font-mono truncate" title={session.user.name}>{session.user.name || `#${session.user.id}`}</a>{:else}<p class="text-sm font-mono">·</p>{/if}</div>
          {#if session.appVersion}
            <div><p class="detail-label">App Version</p><p class="text-sm font-mono">{session.appVersion}</p></div>
          {/if}
          <div><p class="detail-label">Session ID</p><p class="text-sm font-mono">#{session.id}</p></div>
          {#if pid != null}
            <div><p class="detail-label">Process ID</p><p class="text-sm font-mono">{Number(pid) || '·'}</p></div>
          {/if}
        </div>
      </div>
    </div>

    {#if gw}
      <!-- Gateway endpoints (embedded S3/HDFS gateway; no FUSE mount) -->
      <div class="corner-brackets relative border border-border/30 rounded-sm">
        <div class="tech-grid absolute inset-0 pointer-events-none"></div>
        <div class="relative p-5">
          <h2 class="text-lg font-semibold mb-4">Gateway Endpoints</h2>
          <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
            {#each Object.entries(gw.endpoints) as [proto, url] (proto)}
              <div class="min-w-0">
                <dt class="detail-label uppercase">{proto}</dt>
                <dd class="text-sm font-mono truncate" title={url}>{url}</dd>
              </div>
            {/each}
          </dl>
        </div>
      </div>
    {/if}

    {#if role === 'upload' && up}
      <!-- Upload job (bulk-copy job identity + live progress; no FUSE mount) -->
      <div class="corner-brackets relative border border-border/30 rounded-sm">
        <div class="tech-grid absolute inset-0 pointer-events-none"></div>
        <div class="relative p-5 space-y-5">
          <h2 class="text-lg font-semibold">Upload Job</h2>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-4">
            {#if up.jobId}<div class="min-w-0"><p class="detail-label">Job ID</p><p class="text-sm font-mono truncate" title={up.jobId}>{up.jobId}</p></div>{/if}
            <div class="min-w-0">
              <p class="detail-label">Source</p>
              <p class="text-sm font-mono truncate" title={up.sourcePath}>
                {up.sourcePath ?? '·'}
                {#if up.sourceProvider}<Badge variant="outline" class="ml-1 align-middle">{up.sourceProvider}</Badge>{/if}
              </p>
            </div>
            {#if up.destPath}<div class="min-w-0"><p class="detail-label">Destination</p><p class="text-sm font-mono truncate" title={up.destPath}>{up.destPath}</p></div>{/if}
            {#if up.sourceEndpoint}<div class="min-w-0"><p class="detail-label">Source Endpoint</p><p class="text-sm font-mono truncate" title={up.sourceEndpoint}>{up.sourceEndpoint}</p></div>{/if}
            {#if up.sourceRegion}<div class="min-w-0"><p class="detail-label">Source Region</p><p class="text-sm font-mono truncate">{up.sourceRegion}</p></div>{/if}
            {#if up.sourceAccount}<div class="min-w-0"><p class="detail-label">Source Account</p><p class="text-sm font-mono truncate">{up.sourceAccount}</p></div>{/if}
            {#if up.logPath}<div class="min-w-0"><p class="detail-label">Log</p><p class="text-sm font-mono truncate" title={up.logPath}>{up.logPath}</p></div>{/if}
            {#if up.totalFiles}
              <div class="min-w-0">
                <p class="detail-label">Total</p>
                <p class="text-sm font-mono">
                  {formatNum(up.totalFiles)} file{up.totalFiles === 1 ? '' : 's'}, {formatBytes(up.totalBytes ?? 0)}
                  <span class="text-muted-foreground" title="A live aggregate as of the client's last scan pass. A daemon-mode job keeps discovering more on every rescan, so this isn't final until the job settles.">(as of last scan)</span>
                </p>
              </div>
            {/if}
          </div>
          {#if up.counts}
            <div class="border-t border-border/40 pt-4">
              <div class="metric-group">
                <p class="detail-label">Progress</p>
                <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-6 gap-y-2">
                  <div class="metric-row"><span>Pending</span><span>{formatNum(up.counts.pending ?? 0)}</span></div>
                  <div class="metric-row"><span>Uploading</span><span>{formatNum(up.counts.uploading ?? 0)}</span></div>
                  <div class="metric-row"><span>Done</span><span>{formatNum(up.counts.done ?? 0)}</span></div>
                  <div class="metric-row {(up.counts.failed ?? 0) ? 'text-destructive' : ''}"><span>Failed</span><span>{formatNum(up.counts.failed ?? 0)}</span></div>
                  <div class="metric-row"><span>Skipped</span><span>{formatNum(up.counts.skipped ?? 0)}</span></div>
                  <div class="metric-row"><span>Missing</span><span>{formatNum(up.counts.missing ?? 0)}</span></div>
                </div>
              </div>
            </div>
          {/if}
        </div>
      </div>
    {/if}

    {#if role === 'download' && dl}
      <!-- Download job (bulk-copy job identity + live progress; no FUSE mount) -->
      <div class="corner-brackets relative border border-border/30 rounded-sm">
        <div class="tech-grid absolute inset-0 pointer-events-none"></div>
        <div class="relative p-5 space-y-5">
          <h2 class="text-lg font-semibold">Download Job</h2>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-4">
            {#if dl.jobId}<div class="min-w-0"><p class="detail-label">Job ID</p><p class="text-sm font-mono truncate" title={dl.jobId}>{dl.jobId}</p></div>{/if}
            {#if dl.sourcePath}<div class="min-w-0"><p class="detail-label">Source</p><p class="text-sm font-mono truncate" title={dl.sourcePath}>{dl.sourcePath}</p></div>{/if}
            {#if dl.destPath}<div class="min-w-0"><p class="detail-label">Destination</p><p class="text-sm font-mono truncate" title={dl.destPath}>{dl.destPath}</p></div>{/if}
            {#if dl.logPath}<div class="min-w-0"><p class="detail-label">Log</p><p class="text-sm font-mono truncate" title={dl.logPath}>{dl.logPath}</p></div>{/if}
            {#if dl.totalFiles}
              <div class="min-w-0">
                <p class="detail-label">Total</p>
                <p class="text-sm font-mono">
                  {formatNum(dl.totalFiles)} file{dl.totalFiles === 1 ? '' : 's'}, {formatBytes(dl.totalBytes ?? 0)}
                  <span class="text-muted-foreground" title="A live aggregate as of the client's last scan pass. A daemon-mode job keeps discovering more on every rescan, so this isn't final until the job settles.">(as of last scan)</span>
                </p>
              </div>
            {/if}
          </div>
          {#if dl.counts}
            <div class="border-t border-border/40 pt-4">
              <div class="metric-group">
                <p class="detail-label">Progress</p>
                <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-x-6 gap-y-2">
                  <div class="metric-row"><span>Pending</span><span>{formatNum(dl.counts.pending ?? 0)}</span></div>
                  <div class="metric-row"><span>Downloading</span><span>{formatNum(dl.counts.downloading ?? 0)}</span></div>
                  <div class="metric-row"><span>Done</span><span>{formatNum(dl.counts.done ?? 0)}</span></div>
                  <div class="metric-row {(dl.counts.retrying ?? 0) ? 'text-warning' : ''}">
                    <span class="inline-flex items-center gap-0.5">
                      Retrying
                      <InfoTip text="The job retries this file after a temporary error (quota, volume lock, or read failure). It clears on its own." />
                    </span>
                    <span>{formatNum(dl.counts.retrying ?? 0)}</span>
                  </div>
                  <div class="metric-row {(dl.counts.failed ?? 0) ? 'text-destructive' : ''}">
                    <span class="inline-flex items-center gap-0.5">
                      Failed
                      <InfoTip text="This status does not clear on its own. The job stopped retrying this path. Fix the cause, then use Retry failed, or accept the loss." />
                    </span>
                    <span>{formatNum(dl.counts.failed ?? 0)}</span>
                  </div>
                  <div class="metric-row"><span>Skipped</span><span>{formatNum(dl.counts.skipped ?? 0)}</span></div>
                  <div class="metric-row"><span>Missing</span><span>{formatNum(dl.counts.missing ?? 0)}</span></div>
                </div>
              </div>
            </div>
          {/if}
        </div>
      </div>
    {/if}

    {#if role === 'sink' && sk}
      <!-- Sink job (HLS-to-mountOS ingest identity + live progress; no FUSE mount).
           No bounded work list to count over, unlike upload/download: this ingests
           an unbounded live stream, so health is lag and rate, not pending/done/
           failed counts. Lag behind the live edge and buffered depth are the
           two numbers that matter most; everything else is detail. -->
      <div class="corner-brackets relative border border-border/30 rounded-sm">
        <div class="tech-grid absolute inset-0 pointer-events-none"></div>
        <div class="relative p-5 space-y-5">
          <h2 class="text-lg font-semibold">Sink Job</h2>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-4">
            {#if sk.jobId}<div class="min-w-0"><p class="detail-label">Job ID</p><p class="text-sm font-mono truncate" title={sk.jobId}>{sk.jobId}</p></div>{/if}
            {#if sk.source}<div class="min-w-0"><p class="detail-label">Source</p><p class="text-sm font-mono truncate" title={sk.source}>{sk.source}</p></div>{/if}
            {#if sk.sinkTemplate}<div class="min-w-0"><p class="detail-label">Sink</p><p class="text-sm font-mono truncate" title={sk.sinkTemplate}>{sk.sinkTemplate}</p></div>{/if}
            {#if sk.variant}<div class="min-w-0"><p class="detail-label">Variant</p><p class="text-sm font-mono truncate" title={sk.variant}>{sk.variant}</p></div>{/if}
            {#if sk.fork}<div class="min-w-0"><p class="detail-label">Fork</p><p class="text-sm font-mono truncate" title={sk.fork}>{sk.fork}</p></div>{/if}
            {#if sk.logPath}<div class="min-w-0"><p class="detail-label">Log</p><p class="text-sm font-mono truncate" title={sk.logPath}>{sk.logPath}</p></div>{/if}
          </div>
          <div class="border-t border-border/40 pt-4">
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-5">
              <div class="metric-group">
                <p class="detail-label">Stream Health</p>
                <div class="metric-row"><span>State</span><span>{#if sk.state}<Badge variant={sinkStateVariant(sk.state)} class="font-mono text-xs">{sk.state}</Badge>{:else}·{/if}</span></div>
                <div class="metric-row"><span class="inline-flex items-center gap-0.5">Lag (segments)<InfoTip text="Segments behind the live edge. A rising count means the sink falls behind." /></span><span>{formatNum(sk.lagSegments ?? 0)}</span></div>
                <div class="metric-row"><span class="inline-flex items-center gap-0.5">Lag (time)<InfoTip text="Time behind the live edge, in wall-clock time." /></span><span>{sk.lagSeconds ? formatTotalTime(sk.lagSeconds) : '0s'}</span></div>
                <div class="metric-row"><span class="inline-flex items-center gap-0.5">Buffered Bytes<InfoTip text="Local buffer of segments not yet uploaded. A rising value means uploads fall behind or fail." /></span><span>{formatBytes(sk.walBytes ?? 0)}</span></div>
                <div class="metric-row"><span>Buffered Segments</span><span>{formatNum(sk.walSegments ?? 0)}</span></div>
                <div class="metric-row {(sk.discontinuities ?? 0) ? 'text-destructive' : ''}"><span>Discontinuities</span><span>{formatNum(sk.discontinuities ?? 0)}</span></div>
              </div>
              <div class="metric-group">
                <p class="detail-label">Activity</p>
                <div class="metric-row"><span>Segments Fetched</span><span>{formatNum(sk.segmentsFetched ?? 0)}</span></div>
                <div class="metric-row"><span>Segments Committed</span><span>{formatNum(sk.segmentsCommitted ?? 0)}</span></div>
                <div class="metric-row"><span>Bytes Committed</span><span>{formatBytes(sk.bytesCommitted ?? 0)}</span></div>
                <div class="metric-row"><span>File Size</span><span>{formatBytes(sk.fileSize ?? 0)}</span></div>
                {#if sk.sinkCurrent}<div class="metric-row"><span>Current Segment</span><span class="truncate max-w-[16rem]" title={sk.sinkCurrent}>{sk.sinkCurrent}</span></div>{/if}
                {#if sk.bitrateObserved != null}<div class="metric-row"><span>Bitrate</span><span>{formatBitrate(sk.bitrateObserved)}</span></div>{/if}
                <div class="metric-row {(sk.fetchErrors ?? 0) ? 'text-destructive' : ''}"><span>Fetch Errors</span><span>{formatNum(sk.fetchErrors ?? 0)}</span></div>
                <div class="metric-row {(sk.commitRetries ?? 0) ? 'text-warning' : ''}"><span>Commit Retries</span><span>{formatNum(sk.commitRetries ?? 0)}</span></div>
                {#if sk.lastCommitAt}<div class="metric-row"><span>Last Commit</span><span class="inline-flex items-center gap-0.5">{formatRelative(sk.lastCommitAt)}<InfoTip text={formatDate(sk.lastCommitAt)} /></span></div>{/if}
                {#if sk.lastSegmentAt}<div class="metric-row"><span>Last Segment</span><span class="inline-flex items-center gap-0.5">{formatRelative(sk.lastSegmentAt)}<InfoTip text={formatDate(sk.lastSegmentAt)} /></span></div>{/if}
              </div>
            </div>
          </div>
        </div>
      </div>
    {/if}

    {@const cacheCfg = getMetaProp(session, 'cache') as Record<string, unknown> | undefined}
    {#if cacheCfg}
      <!-- Cache configuration (operator-facing knobs at mount time) -->
      <div class="corner-brackets relative border border-border/30 rounded-sm">
        <div class="tech-grid absolute inset-0 pointer-events-none"></div>
        <div class="relative p-5">
          <h2 class="text-lg font-semibold mb-4">Cache Configuration</h2>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4">
            {#if cacheCfg.bufferSize}
              <div><p class="detail-label">Buffer Size</p><p class="text-sm font-mono">{cacheCfg.bufferSize}</p></div>
            {/if}
            {#if cacheCfg.bufferSlack}
              <div><p class="detail-label">Buffer Slack</p><p class="text-sm font-mono">{cacheCfg.bufferSlack}</p></div>
            {/if}
            {#if cacheCfg.maxDirtyBytes}
              <div><p class="detail-label">Max Dirty Bytes</p><p class="text-sm font-mono">{cacheCfg.maxDirtyBytes}</p></div>
            {/if}
            {#if cacheCfg.evictionPolicy}
              <div><p class="detail-label">Eviction Policy</p><p class="text-sm font-mono">{cacheCfg.evictionPolicy}</p></div>
            {/if}
            {#if cacheCfg.disableCacheDir}
              <div><p class="detail-label">Disk Cache</p><p class="text-sm">disabled</p></div>
            {:else}
              {#if cacheCfg.diskCacheDir}
                <div class="md:col-span-2"><p class="detail-label">Cache Dir</p><p class="text-sm font-mono truncate" title={String(cacheCfg.diskCacheDir)}>{cacheCfg.diskCacheDir}</p></div>
              {/if}
              {#if cacheCfg.diskCacheSize}
                <div><p class="detail-label">Disk Cache Size</p><p class="text-sm font-mono">{cacheCfg.diskCacheSize}</p></div>
              {/if}
            {/if}
            {#if cacheCfg.memArena}
              <div><p class="detail-label">Meta Arena</p><p class="text-sm font-mono">{cacheCfg.memArena}</p></div>
            {/if}
            {#if cacheCfg.memLimit}
              <div><p class="detail-label">Memory Limit</p><p class="text-sm font-mono">{cacheCfg.memLimit}</p></div>
            {/if}
          </div>
        </div>
      </div>
    {/if}

    <!-- Client never sent a metrics payload: either it hasn't heartbeat yet
         (still active) or it died before its first heartbeat (terminal). -->
    {#if Object.keys(m).length === 0}
      <div class="corner-brackets relative border border-border/30 rounded-sm">
        <div class="tech-grid absolute inset-0 pointer-events-none"></div>
        <div class="relative p-5">
          <h2 class="text-lg font-semibold mb-2">Metrics</h2>
          <p class="text-sm text-muted-foreground">
            {session.isActive
              ? 'No metrics available.'
              : 'No metrics were ever reported. The session ended before sending its first heartbeat.'}
          </p>
        </div>
      </div>
    {/if}

    <!-- Metrics -->
    {#if m.reads !== undefined}
      {@const drv = getDriverMetrics(m)}
      {@const driverSites = Object.entries(drv?.invariantSites ?? {}).sort(([a], [b]) => a.localeCompare(b))}
      {@const poolHealth = getPoolHealth(m)}
      <div class="corner-brackets relative border border-border/30 rounded-sm">
        <div class="tech-grid absolute inset-0 pointer-events-none"></div>
        <div class="relative p-5">
          <h2 class="text-lg font-semibold mb-4">Metrics</h2>
          <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-x-8 gap-y-5">
            {#if role !== 'upload' && role !== 'sink'}
              <div class="metric-group">
                <p class="detail-label">I/O</p>
                <div class="metric-row"><span>Reads</span><span>{formatNum(m.reads ?? 0)}</span></div>
                <div class="metric-row"><span>Read Bytes</span><span>{formatBytes(m.readBytes ?? 0)}</span></div>
                <div class="metric-row"><span>Writes</span><span>{formatNum(m.writes ?? 0)}</span></div>
                <div class="metric-row"><span>Write Bytes</span><span>{formatBytes(m.writeBytes ?? 0)}</span></div>
                <div class="metric-row"><span>Open Files</span><span>{formatNum(m.openFiles ?? 0)}</span></div>
                <div class="metric-row"><span>Meta Writes</span><span>{formatNum(m.metaWrites ?? 0)}</span></div>
                <div class="metric-row"><span>Downloaded</span><span>{formatBytes(m.downloaded ?? 0)}</span></div>
                <div class="metric-row"><span>Uploaded</span><span>{formatBytes(m.uploaded ?? 0)}</span></div>
                <div class="metric-row"><span>Created Files</span><span>{formatNum(m.createdFiles ?? 0)}</span></div>
                <div class="metric-row"><span>Deleted Files</span><span>{formatNum(m.deletedFiles ?? 0)}</span></div>
                <div class="metric-row"><span>Created Dirs</span><span>{formatNum(m.createdDir ?? 0)}</span></div>
                <div class="metric-row"><span>Deleted Dirs</span><span>{formatNum(m.deletedDir ?? 0)}</span></div>
              </div>
              <div class="metric-group">
                <p class="detail-label">Cache</p>
                <div class="metric-row"><span>Hits</span><span>{formatNum(m.cacheHits ?? 0)}</span></div>
                <div class="metric-row"><span>Misses</span><span>{formatNum(m.cacheMisses ?? 0)}</span></div>
                <div class="metric-row"><span>Hit Bytes</span><span>{formatBytes(m.cacheHitBytes ?? 0)}</span></div>
                <div class="metric-row"><span>Miss Bytes</span><span>{formatBytes(m.cacheMissBytes ?? 0)}</span></div>
                <div class="metric-row"><span>Size</span><span>{formatBytes(m.cacheSize ?? 0)}</span></div>
                {#if m.prefetchFetchedBlocks != null}
                  {@const pf = Number(m.prefetchFetchedBlocks ?? 0)}
                  {@const pw = Number(m.prefetchWastedBlocks ?? 0)}
                  {@const wastePct = pf > 0 ? (pw / pf) * 100 : 0}
                  <div class="metric-row"><span>Prefetch Used</span><span>{formatNum(m.prefetchUsedBlocks ?? 0)}</span></div>
                  <div class="metric-row {wastePct >= 50 ? 'text-destructive' : wastePct >= 30 ? 'text-warning' : ''}"><span>Prefetch Wasted</span><span>{formatNum(pw)} ({wastePct.toFixed(1)}%)</span></div>
                {/if}
              </div>
            {/if}
            <!-- Block-storage auto-degrade circuit breaker. blockDirectFallbackOps (the
                 direct_access S3-miss fallback) is reported by any block-backed mount;
                 blockAutoDegraded/blockAutoDegradeOps report only when the auto-degrade
                 breaker itself is enabled on this mount. -->
            {#if m.blockDirectFallbackOps != null}
              {@const blockDegraded = m.blockAutoDegraded === true}
              <div class="metric-group">
                <p class="detail-label">Block Storage</p>
                {#if m.blockAutoDegradeOps != null}
                  <div class="metric-row {blockDegraded ? 'text-warning' : ''}">
                    <span>Status</span>
                    <span>
                      {#if blockDegraded}
                        <Badge variant="warning" class="font-mono text-xs" title="This mount is bypassing blockserv, using direct S3 only.">Auto-Degraded</Badge>
                      {:else}
                        <span class="text-muted-foreground">Normal</span>
                      {/if}
                    </span>
                  </div>
                  <div class="metric-row"><span>Ops Served Degraded</span><span class="metric-value-pop">{formatNum(m.blockAutoDegradeOps ?? 0)}</span></div>
                {/if}
                <div class="metric-row"><span>Direct S3 Fallback Ops</span><span class="metric-value-pop">{formatNum(m.blockDirectFallbackOps ?? 0)}</span></div>
              </div>
            {/if}
            {#if m.metaArenaCapacityBytes != null}
              <div class="metric-group">
                <p class="detail-label">Meta Cache</p>
                <div class="metric-row"><span>Capacity</span><span>{formatBytes(m.metaArenaCapacityBytes ?? 0)}</span></div>
                <div class="metric-row"><span>Used</span><span>{formatBytes(m.metaArenaUsedBytes ?? 0)} ({(m.metaArenaUsedPct ?? 0).toFixed(1)}%)</span></div>
                <div class="metric-row"><span>Hits</span><span>{formatNum(m.metaArenaHits ?? 0)}</span></div>
                <div class="metric-row"><span>Misses</span><span>{formatNum(m.metaArenaMisses ?? 0)}</span></div>
                <div class="metric-row"><span>Evictions</span><span>{formatNum(m.metaArenaEvictions ?? 0)}</span></div>
                <div class="metric-row"><span>Delta List</span><span>{formatNum(m.metaDeltaFetches ?? 0)}</span></div>
                <div class="metric-row"><span>Full List</span><span>{formatNum(m.metaFullFetches ?? 0)}</span></div>
              </div>
            {/if}
            {#if m.bufArenaCapacityBytes != null}
              {@const blocked = Number(m.bufArenaBlockedAcquires ?? 0)}
              {@const peakPct = Number(m.bufArenaPeakPct ?? 0)}
              {@const pressureColor = blocked > 0 || peakPct >= 95 ? 'text-destructive' : peakPct >= 80 ? 'text-warning' : ''}
              <div class="metric-group">
                <p class="detail-label">Dirty Buffer Arena</p>
                <div class="metric-row"><span>Capacity</span><span>{formatBytes(m.bufArenaCapacityBytes ?? 0)}</span></div>
                <div class="metric-row"><span>In Use</span><span>{formatBytes(m.bufArenaInUseBytes ?? 0)} ({(m.bufArenaInUsePct ?? 0).toFixed(1)}%)</span></div>
                <div class="metric-row {pressureColor}"><span>Peak</span><span>{formatBytes(m.bufArenaPeakBytes ?? 0)} ({peakPct.toFixed(1)}%)</span></div>
                <div class="metric-row"><span>Acquires</span><span>{formatNum(m.bufArenaAcquires ?? 0)}</span></div>
                <div class="metric-row {blocked > 0 ? 'text-destructive' : ''}"><span>Blocked</span><span>{formatNum(blocked)}</span></div>
                <div class="metric-row"><span>Waiting</span><span>{formatNum(m.bufArenaWaiting ?? 0)}</span></div>
                {#if blocked > 0}
                  <div
                    role="note"
                    class="mt-2 flex items-start gap-2 px-2.5 py-1.5 rounded-sm border text-xs"
                    style="border-color: color-mix(in oklab, var(--color-warning) 35%, transparent); background: color-mix(in oklab, var(--color-warning) 8%, transparent); color: var(--color-warning);"
                  >
                    <TriangleAlert size={13} class="mt-0.5 shrink-0" aria-hidden="true" />
                    <span>Writes throttled; consider raising <code class="font-mono font-medium">--buffer-size</code>.</span>
                  </div>
                {/if}
              </div>
            {/if}
            <!-- Every role reaches object storage, including the jobs: an upload's
                 PUTs and a download's GETs are the work itself, and the retry and
                 throttle rows below are the only place a job's transfer trouble
                 shows up. Progress counts entries settled, not bytes moved. -->
            <div class="metric-group">
              <p class="detail-label">Object Store</p>
              <div class="metric-row"><span>GET Count</span><span>{formatNum(m.objectGetCount ?? 0)}</span></div>
              <div class="metric-row"><span>GET Bytes</span><span>{formatBytes(m.objectGetBytes ?? 0)}</span></div>
              {#if (m.objectGetCount ?? 0) > 0}
                <div class="metric-row"><span>GET Avg Latency</span><span style="color: {objectLatencyColor(m.objectGetAvgUs ?? 0)}">{formatUs(m.objectGetAvgUs ?? 0)}</span></div>
                {#if (m.objectGetTTFBAvgUs ?? 0) > 0}
                  <div class="metric-row"><span>GET Avg TTFB</span><span style="color: {objectLatencyColor(m.objectGetTTFBAvgUs ?? 0)}">{formatUs(m.objectGetTTFBAvgUs ?? 0)}</span></div>
                {/if}
                <div class="metric-row"><span>GET Throughput</span><span>{formatBitrate(objectThroughputBps(m.objectGetBytes, m.objectGetAvgUs, m.objectGetCount))}</span></div>
              {/if}
              <div class="metric-row"><span>PUT Count</span><span>{formatNum(m.objectPutCount ?? 0)}</span></div>
              <div class="metric-row"><span>PUT Bytes</span><span>{formatBytes(m.objectPutBytes ?? 0)}</span></div>
              {#if (m.objectPutCount ?? 0) > 0}
                <div class="metric-row"><span>PUT Avg Latency</span><span style="color: {objectLatencyColor(m.objectPutAvgUs ?? 0)}">{formatUs(m.objectPutAvgUs ?? 0)}</span></div>
                <div class="metric-row"><span>PUT Throughput</span><span>{formatBitrate(objectThroughputBps(m.objectPutBytes, m.objectPutAvgUs, m.objectPutCount))}</span></div>
              {/if}
              <div class="metric-row {(m.objectErrors ?? 0) ? 'text-destructive' : ''}"><span>Errors</span><span>{formatNum(m.objectErrors ?? 0)}</span></div>
              {#if m.s3RetryAttempts != null}
                <div class="metric-row"><span>Retries</span><span>{formatNum(m.s3RetryAttempts ?? 0)}</span></div>
                <div class="metric-row {(m.s3RetryThrottled ?? 0) ? 'text-warning' : ''}"><span>Throttled</span><span>{formatNum(m.s3RetryThrottled ?? 0)}</span></div>
                <div class="metric-row {(m.s3RetryExhausted ?? 0) ? 'text-destructive' : ''}"><span>Exhausted</span><span>{formatNum(m.s3RetryExhausted ?? 0)}</span></div>
              {/if}
            </div>
            <div class="metric-group">
              <p class="detail-label">Network</p>
              <div class="metric-row"><span>Ping RTT</span><span style={m.pingRttMs ? `color: ${pingRttColor(m.pingRttMs)}` : ''}>{m.pingRttMs ? `${m.pingRttMs} ms` : '·'}</span></div>
              <div class="metric-row {(m.connFailures ?? 0) ? 'text-destructive' : ''}"><span>Conn Failures</span><span>{formatNum(m.connFailures ?? 0)}</span></div>
              <div class="metric-row" title={cd.tooltip}>
                <span>Conn Dropped</span>
                <span class="inline-flex items-baseline gap-1">
                  {#if cd.concern > 0}<span class="text-destructive font-mono">{formatNum(cd.concern)}</span>{/if}
                  {#if cd.concern > 0 && cd.benign > 0}<span class="text-muted-foreground" aria-hidden="true">/</span>{/if}
                  {#if cd.benign > 0}<span class="text-muted-foreground font-mono" title="Pool cycling (parked + overflow shrink), not a failure">{formatNum(cd.benign)}</span>{/if}
                  {#if cd.concern === 0 && cd.benign === 0}<span>0</span>{/if}
                </span>
              </div>
              <div class="metric-row"><span>TCP Conns</span><span>{formatNum(m.tcpActiveConns ?? 0)}</span></div>
              <div class="metric-row"><span>TCP Peak</span><span>{formatNum(m.tcpPeakActive ?? 0)}</span></div>
              {#if m.connDroppedRequests != null}
                <div class="metric-row"><span>Dropped Reqs</span><span>{formatNum(m.connDroppedRequests)}</span></div>
                <div class="metric-row"><span>Dropped Avg Latency</span><span>{formatUs(m.connDroppedAvgLatencyUs ?? 0)}</span></div>
              {/if}
              <div class="metric-row"><span>TCP Recv</span><span>{formatBytes(m.tcpBytesRecv ?? 0)}</span></div>
              <div class="metric-row"><span>TCP Sent</span><span>{formatBytes(m.tcpBytesSent ?? 0)}</span></div>
              <div class="metric-row"><span>Events Recv</span><span>{formatNum(m.tcpEventsRecv ?? 0)}</span></div>
              <div class="metric-row"><span>Events Sent</span><span>{formatNum(m.tcpEventsSent ?? 0)}</span></div>
            </div>
            <div class="metric-group">
              <p class="detail-label">Runtime</p>
              <div class="metric-row"><span>Goroutines</span><span>{formatNum(m.goroutines ?? 0)}</span></div>
              <div class="metric-row"><span>Mem Alloc</span><span style="color: {memAllocColor(m.memAlloc ?? 0)}">{formatBytes(m.memAlloc ?? 0)}</span></div>
              <div class="metric-row"><span>Mem Sys</span><span>{formatBytes(m.memSys ?? 0)}</span></div>
              <div class="metric-row"><span>GC Count</span><span>{formatNum(m.gcNum ?? 0)}</span></div>
              <div class="metric-row"><span>CPU Time</span><span>{m.cpuSeconds != null ? formatUptime(m.cpuSeconds) : '·'}</span></div>
              <div class="metric-row"><span>RPC Count</span><span>{formatNum(m.rpcCount ?? 0)}</span></div>
              <div class="metric-row {(m.rpcErrors ?? 0) ? 'text-destructive' : ''}"><span>RPC Errors</span><span>{formatNum(m.rpcErrors ?? 0)}</span></div>
            </div>
            {#if drv}
              <!-- Windows mountosio kernel driver. Shown whenever the driver is present and queryable, all-zero counters included, so presence alone confirms the driver is healthy. -->
              <div class="metric-group">
                <p class="detail-label">Driver</p>
                <div class="metric-row"><span>Invariant Hits</span><span>{formatNum(drv.invariantTotal ?? 0)}</span></div>
                <div class="metric-row"><span>IRP Double Compl.</span><span>{formatNum(drv.irpDoubleCompletions ?? 0)}</span></div>
                <div class="metric-row"><span>Fault Injections</span><span>{formatNum(drv.faultInjections ?? 0)}</span></div>
                {#if driverSites.length > 0}
                  <p class="text-xs text-muted-foreground uppercase tracking-wider mt-1 pt-1 border-t border-border/30">Kernel Diagnostic Error Sites</p>
                  {#each driverSites as [site, count]}
                    <div class="metric-row"><span class="truncate" title={site}>{site}</span><span>{formatNum(count)}</span></div>
                  {/each}
                {/if}
              </div>
            {/if}
            <!-- TCP connection-pool health, same data as Driver above but for the network layer rather than the kernel driver.
                 One card per node, so each node lands in its own grid cell instead of stacking inside a single tall card. -->
            {#each poolHealth as node, i (node.node ?? i)}
              <div class="metric-group">
                <p class="detail-label">Pool Health{poolHealth.length > 1 ? ` · ${poolNodeLabel(node, i)}` : ''}</p>
                <div class="metric-row"><span>Connections</span><span>{formatNum(node.healthy ?? 0)}/{formatNum(node.totalConnections ?? 0)}</span></div>
                <div class="metric-row"><span>Authenticated</span><span>{formatNum(node.authenticated ?? 0)}</span></div>
                <div class="metric-row"><span>Pending</span><span>{formatNum(node.pending ?? 0)}</span></div>
                <div class="metric-row {node.serverDown ? 'text-destructive' : ''}"><span>Server Down</span><span>{node.serverDown ? 'yes' : 'no'}</span></div>
                <div class="metric-row {node.congestionActive ? 'text-warning' : ''}"><span>Congestion</span><span>{node.congestionActive ? 'active' : 'none'}</span></div>
                <div class="metric-row {(node.serverDownCount ?? 0) ? 'text-warning' : ''}"><span>Down Events</span><span>{formatNum(node.serverDownCount ?? 0)}</span></div>
                {#if node.serverDown && node.reconnectBackoff}
                  <div class="metric-row"><span>Reconnect Backoff</span><span>{node.reconnectBackoff}</span></div>
                {/if}
                {#if node.lastDownAt}
                  <div class="metric-row"><span>Last Down</span><span class="inline-flex items-center gap-0.5">{formatRelative(node.lastDownAt)}<InfoTip text={formatDate(node.lastDownAt)} /></span></div>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      </div>
    {/if}

    <!-- Gateway and Latency sections each self-gate on metric presence;
         previously they were nested under the {#if m.reads !== undefined}
         metrics gate, which would hide an RPC/FUSE latency table if a
         heartbeat shipped without the bulk I/O counters. -->
    <!-- Gateway Activity (embedded per-volume S3 / WebHDFS gateway). -->
    <!-- Present only when the client reported gateway counters; mount-only sessions skip. -->
    {@const gwMetrics = getGatewayMetrics(m)}
      {#if gwMetrics}
        <div class="corner-brackets relative border border-border/30 rounded-sm">
          <div class="tech-grid absolute inset-0 pointer-events-none"></div>
          <div class="relative p-5">
            <div class="flex flex-wrap items-center gap-3 mb-4">
              <h2 class="text-lg font-semibold">Gateway Activity</h2>
              <span class="text-sm text-muted-foreground font-mono">embedded per-volume</span>
            </div>
            <div class="grid gap-4 sm:grid-cols-2">
              {#each gatewayProtocols(gwMetrics) as { proto, snap }}
                {@const errPct = snap.requests > 0 ? (snap.errors * 100) / snap.requests : (snap.errors > 0 ? 100 : 0)}
                {@const errBad = errPct > 1}
                <div class="border border-border/30 rounded-sm p-4">
                  <div class="flex items-center justify-between mb-2">
                    <span class="font-mono text-sm uppercase tracking-wider">{proto}</span>
                    <Badge variant={errBad ? 'destructive' : 'outline'} class="font-mono text-xs" aria-label={errBad ? `${proto} error rate ${errPct.toFixed(1)} percent` : `${proto} error rate normal`}>
                      {snap.errors}/{snap.requests} err
                    </Badge>
                  </div>
                  <dl class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm font-mono">
                    <dt class="text-muted-foreground">requests</dt>
                    <dd class="text-right">{formatNum(snap.requests)}</dd>
                    <dt class="text-muted-foreground">errors</dt>
                    <dd class="text-right">{formatNum(snap.errors)}</dd>
                    <dt class="text-muted-foreground">in</dt>
                    <dd class="text-right">{formatBytes(snap.bytes_in)}</dd>
                    <dt class="text-muted-foreground">out</dt>
                    <dd class="text-right">{formatBytes(snap.bytes_out)}</dd>
                  </dl>
                </div>
              {/each}
            </div>
          </div>
        </div>
      {/if}

    <!-- Watcher Activity: folders this mount watches (live gauge) plus push-driven cache invalidation. -->
    <!-- Shown whenever the mount watches any folder; a lone client on a folder still watches it but sees zero pushes (excluded from its own broadcasts). -->
    {@const wt = getWatcherMetrics(m)}
      {#if wt}
        <div class="corner-brackets relative border border-border/30 rounded-sm">
          <div class="tech-grid absolute inset-0 pointer-events-none"></div>
          <div class="relative p-5">
            <div class="flex flex-wrap items-center gap-3 mb-4">
              <h2 class="text-lg font-semibold">Watcher Activity</h2>
            </div>
            <dl class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm font-mono max-w-sm">
              <dt class="text-muted-foreground">folders watched</dt>
              <dd class="text-right">{formatNum(wt.watchedFolders ?? 0)}</dd>
              <dt class="text-muted-foreground">folders tracked</dt>
              <dd class="text-right">{formatNum(wt.trackedFolders ?? 0)}</dd>
              <dt class="text-muted-foreground">pushes received</dt>
              <dd class="text-right">{formatNum(wt.pushesReceived ?? 0)}</dd>
              <dt class="text-muted-foreground">change entries</dt>
              <dd class="text-right">{formatNum(wt.pushEntries ?? 0)}</dd>
              <dt class="text-muted-foreground">invalidations</dt>
              <dd class="text-right">{formatNum(wt.invalidations ?? 0)}</dd>
            </dl>
          </div>
        </div>
      {/if}

      {#snippet latencyBreakdown(title: string, ariaLabel: string, entries: [string, RpcMethodLatency][], expanded: Set<string>, toggleExpand: (m: string) => void, metricMode: 'minMax' | 'percentiles', setMode: (m: 'minMax' | 'percentiles') => void, labels: LatencyTableLabels, scale: LatencyScale)}
        {@const totalHits = entries.reduce((s, [, l]) => s + l.count, 0)}
        {@const totalTimeSec = entries.reduce((s, [, l]) => s + (l.durationNs != null ? l.durationNs / 1e9 : (l.count * l.avgUs) / 1e6), 0)}
        {@const bands = latencyBands(entries, scale.bands)}
        {@const hasBuckets = entries.some(([, l]) => l.buckets?.some(c => c > 0))}
        {@const hasBytes = entries.some(([, l]) => (l.bytes ?? 0) > 0)}
        <!-- Without buckets there are no percentiles to show, and the mode toggle is
             hidden, so honouring a 'percentiles' preference would strand the reader on
             three empty columns while min/max sit unused in the same payload. -->
        {@const mode = hasBuckets ? metricMode : 'minMax'}
        <div class="corner-brackets relative border border-border/30 rounded-sm">
          <div class="tech-grid absolute inset-0 pointer-events-none"></div>
          <div class="relative p-5">
            <div class="flex flex-wrap items-center gap-3 mb-4">
              <h2 class="text-lg font-semibold">{title}</h2>
              <span class="text-sm text-muted-foreground font-mono">{entries.length} {labels.items}</span>
              <span class="text-sm text-muted-foreground font-mono">{formatNum(totalHits)} hits</span>
              <span class="text-sm text-muted-foreground font-mono">{formatTotalTime(totalTimeSec)} total</span>
              <div class="flex items-center gap-1.5 ml-auto">
                {#each bands as { band, count } (band.label)}
                  <Badge variant={band.variant} class="font-mono text-xs">{band.label}: {count}</Badge>
                {/each}
                {#if hasBuckets}
                  <div class="rpc-toggle-group flex items-center font-mono overflow-hidden ml-2" role="group" aria-label="{title} display mode">
                    <button type="button" class="rpc-toggle-btn" class:rpc-toggle-active={metricMode === 'minMax'} aria-pressed={metricMode === 'minMax'} onclick={() => setMode('minMax')}>Min/Max</button>
                    <span class="text-border/40" aria-hidden="true">|</span>
                    <button type="button" class="rpc-toggle-btn" class:rpc-toggle-active={metricMode === 'percentiles'} aria-pressed={metricMode === 'percentiles'} onclick={() => setMode('percentiles')}>Percentiles</button>
                  </div>
                {/if}
              </div>
            </div>
            <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
            <div class="overflow-x-auto rpc-scroll-hint" tabindex="0" role="region" aria-label={ariaLabel}>
              <table class="rpc-table">
                <caption class="sr-only">{title} breakdown</caption>
                <thead>
                  <tr>
                    {#if hasBuckets}<th scope="col" class="w-6"></th>{/if}
                    <th scope="col" class="text-left">{labels.column}</th>
                    <th scope="col" class="text-right">Count</th>
                    <th scope="col" class="text-right">Ops/s</th>
                    <th scope="col" class="text-right">Total</th>
                    <th scope="col" class="text-right">Avg</th>
                    {#if hasBytes}
                      <th scope="col" class="text-right">Avg Bytes/op</th>
                      <th scope="col" class="text-right">Throughput</th>
                    {/if}
                    {#if hasBuckets}<th scope="col" class="text-right"><span class="inline-flex items-center justify-end gap-0.5">σ/μ<InfoTip text={CV_TOOLTIP_TEXT} width={420} /></span></th>{/if}
                    {#if mode === 'minMax'}
                      <th scope="col" class="text-right">Min</th>
                      <th scope="col" class="text-right">Max</th>
                    {:else}
                      <th scope="col" class="text-right">p50</th>
                      <th scope="col" class="text-right">p95</th>
                      <th scope="col" class="text-right">p99</th>
                    {/if}
                  </tr>
                </thead>
                <tbody>
                  {#each entries as [method, lat], i}
                    {@const bkts = toBuckets(lat.buckets)}
                    {@const isOpen = expanded.has(method)}
                    {@const cv = bkts.length > 0 ? estimateCV(bkts, lat.avgUs) : -1}
                    {@const durationSec = lat.durationNs != null ? lat.durationNs / 1e9 : (lat.count * lat.avgUs) / 1e6}
                    {@const throughputBps = lat.bytes && durationSec > 0 ? (lat.bytes * 8) / durationSec : 0}
                    <tr class="{bkts.length > 0 ? 'cursor-pointer' : ''} hover:bg-muted/50 transition-colors {isOpen ? 'bg-muted/30' : ''}" class:rpc-zebra={!isOpen && i % 2 === 1} onclick={() => bkts.length > 0 && toggleExpand(method)}>
                      {#if hasBuckets}
                        <td class="w-6">
                          {#if bkts.length > 0}
                            <button type="button"
                              class="inline-flex items-center justify-center min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0"
                              onclick={(e) => { e.stopPropagation(); toggleExpand(method) }}
                              aria-expanded={isOpen} aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${method} latency buckets`}>
                              <ChevronRight class="h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 {isOpen ? 'rotate-90' : ''}" aria-hidden="true" />
                            </button>
                          {/if}
                        </td>
                      {/if}
                      <td class="font-mono text-sm">{method}</td>
                      <td class="text-right font-mono text-sm tabular-nums">{formatNum(lat.count)}</td>
                      <td class="text-right font-mono text-sm tabular-nums text-muted-foreground">{formatOpsPerSec(lat.avgUs)}</td>
                      <td class="text-right font-mono text-sm tabular-nums text-muted-foreground">{formatTotalTime(lat.durationNs != null ? lat.durationNs / 1e9 : (lat.count * lat.avgUs) / 1e6)}</td>
                      <td class="text-right font-mono text-sm tabular-nums" style="color: {scale.color(lat.avgUs)}">{formatUs(lat.avgUs)}</td>
                      {#if hasBytes}
                        <td class="text-right font-mono text-sm tabular-nums text-muted-foreground">{lat.bytes ? formatBytes(lat.bytes / lat.count) : '-'}</td>
                        <td class="text-right font-mono text-sm tabular-nums text-muted-foreground">{throughputBps > 0 ? formatBitrate(throughputBps) : '-'}</td>
                      {/if}
                      {#if hasBuckets}
                        <td class="text-right">
                          {#if cv >= 0}<Badge variant="outline" class="font-mono text-xs px-1 py-0 {cvClass(cv)}">{cv.toFixed(2)}</Badge>{/if}
                        </td>
                      {/if}
                      {#if mode === 'minMax'}
                        <td class="text-right font-mono text-sm tabular-nums" style="color: {scale.color(lat.minUs)}">{formatUs(lat.minUs)}</td>
                        <td class="text-right font-mono text-sm tabular-nums" style="color: {scale.color(lat.maxUs)}">{formatUs(lat.maxUs)}</td>
                      {:else}
                        <!-- Each percentile is coloured by its own value. Colouring all three
                             by the mean hides the case the percentiles exist to expose: a fast
                             average with a slow tail. Without buckets there is no percentile to
                             colour, so the placeholder stays muted rather than reading as "fast". -->
                        {@const pcts = bkts.length > 0 ? [interpolatePercentile(bkts, 50), interpolatePercentile(bkts, 95), interpolatePercentile(bkts, 99)] : null}
                        <td class="text-right font-mono text-sm tabular-nums" style="color: {pcts ? scale.color(pcts[0]) : 'var(--muted-foreground)'}">{pcts ? formatUs(pcts[0]) : '-'}</td>
                        <td class="text-right font-mono text-sm tabular-nums" style="color: {pcts ? scale.color(pcts[1]) : 'var(--muted-foreground)'}">{pcts ? formatUs(pcts[1]) : '-'}</td>
                        <td class="text-right font-mono text-sm tabular-nums" style="color: {pcts ? scale.color(pcts[2]) : 'var(--muted-foreground)'}">{pcts ? formatUs(pcts[2]) : '-'}</td>
                      {/if}
                    </tr>
                    {#if isOpen && bkts.length > 0}
                      {@const totalCount = bkts.reduce((s, b) => s + b.count, 0)}
                      {@const bktColspan = (mode === 'minMax' ? (hasBuckets ? 9 : 7) : (hasBuckets ? 10 : 8)) + (hasBytes ? 2 : 0)}
                      <tr>
                        <td colspan={bktColspan} class="p-0">
                          <div class="py-2 px-4 space-y-1 ml-6">
                            {#each bkts as bkt, bi}
                              {@const bktPct = totalCount > 0 ? (bkt.count / totalCount) * 100 : 0}
                              {#if bkt.count > 0}
                                <div class="flex items-center gap-2 text-sm font-mono tabular-nums {bi % 2 === 1 ? 'rpc-zebra' : ''}">
                                  <span class="w-16 text-muted-foreground">&le; {bkt.le}</span>
                                  <span class="w-12 text-right">{bkt.count}</span>
                                  <span class="w-14 text-right text-muted-foreground">{bktPct.toFixed(1)}%</span>
                                  <div class="flex-1 h-3 rounded-sm bg-muted overflow-hidden">
                                    <div class="h-full rounded-sm transition-transform origin-left duration-500" style="background: {bucketBarColor(bkt.leUs)}; transform: scaleX({bktPct / 100})"></div>
                                  </div>
                                </div>
                              {/if}
                            {/each}
                          </div>
                        </td>
                      </tr>
                    {/if}
                  {/each}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      {/snippet}

      {@const rpcEntries = getRpcLatency(m)}
      {#if rpcEntries.length > 0}
        {@render latencyBreakdown('RPC Latency', 'RPC latency data', rpcEntries, rpcExpanded, toggleRpcExpand, rpcMetricMode, (v) => rpcMetricMode = v, OP_LABELS, OP_SCALE)}
      {/if}

      {@const fuseEntries = getFuseLatency(m)}
      {#if fuseEntries.length > 0}
        {@render latencyBreakdown('FUSE Latency', 'FUSE syscall latency data', fuseEntries, fuseExpanded, toggleFuseExpand, fuseMetricMode, (v) => fuseMetricMode = v, OP_LABELS, OP_SCALE)}
      {/if}

      {@const objectEntries = getObjectLatency(m)}
      {#if objectEntries.length > 0}
        {@render latencyBreakdown('Object Store Latency', 'Object store GET, GET TTFB, and PUT latency data', objectEntries, objectExpanded, toggleObjectExpand, objectMetricMode, (v) => objectMetricMode = v, OBJECT_LABELS, OBJECT_SCALE)}
      {/if}
  {/if}
</div>

<style>
  .rpc-table { width: 100%; border-collapse: collapse; }
  .rpc-table th { font-size: 1rem; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600; color: var(--muted-foreground); padding: 0.5rem 0.75rem; border-bottom: 2px solid var(--primary); }
  .rpc-table td { padding: 0.375rem 0.75rem; }
  .rpc-zebra { background: color-mix(in oklch, var(--muted) 40%, transparent); }
  .rpc-scroll-hint {
    -webkit-overflow-scrolling: touch;
    mask-image: linear-gradient(to right, black calc(100% - 2rem), transparent);
    -webkit-mask-image: linear-gradient(to right, black calc(100% - 2rem), transparent);
  }
  .rpc-scroll-hint:not(.is-scrolled-end) { mask-image: linear-gradient(to right, black calc(100% - 2rem), transparent); }
  @media (min-width: 640px) { .rpc-scroll-hint { mask-image: none; -webkit-mask-image: none; } }
  .rpc-toggle-group {
    clip-path: polygon(0 3px, 3px 0, 100% 0, 100% calc(100% - 3px), calc(100% - 3px) 100%, 0 100%);
    background: color-mix(in oklch, var(--muted) 60%, transparent);
  }
  .rpc-toggle-btn {
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 1rem;
    padding: 0.25rem 0.625rem;
    min-height: 44px;
    cursor: pointer;
    background: transparent;
    border: none;
    color: var(--muted-foreground);
    transition: color 0.15s, background 0.15s;
  }
  @media (min-width: 640px) {
    .rpc-toggle-btn { min-height: 0; }
  }
  .rpc-toggle-active {
    color: var(--foreground);
    background: color-mix(in oklch, var(--accent) 70%, transparent);
  }
  .rpc-toggle-btn:focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: -1px;
  }
  :global(.dark) .rpc-toggle-group { background: color-mix(in oklch, var(--muted) 80%, transparent); }
  :global(.dark) .rpc-toggle-active { background: color-mix(in oklch, var(--accent) 60%, transparent); }

  /* Cluster chip sits next to the page title (label-first, link-second).
     Quiet by default so it doesn't compete with the status badge; the
     Layers icon carries the semantic, the name carries the identity. */
  .session-cluster-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.125rem 0.5rem 0.125rem 0.375rem;
    font-size: 1rem;
    color: var(--muted-foreground);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    text-decoration: none;
    transition: color 120ms cubic-bezier(0.16, 1, 0.3, 1), border-color 120ms cubic-bezier(0.16, 1, 0.3, 1);
  }
  .session-cluster-chip:hover { color: var(--foreground); border-color: color-mix(in oklch, var(--foreground) 40%, var(--border)); }
  .session-cluster-chip:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }
</style>
