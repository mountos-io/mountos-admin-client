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
  import { formatRelative, formatUptime, formatDuration, formatBytes, formatNum, formatPlatform, formatOs, formatSessionStatus } from '$lib/core/utils/format'
  import { formatUs, formatOpsPerSec, formatTotalTime, latencyColor, pingRttColor, memAllocColor, cvVariant, bucketBarColor, estimateCV, fmtPercentile, type HistBucket } from '$lib/core/utils/metrics'
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
      session = await api.clientSessions.get(sessionId, ctrl.signal)
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
  // for sessions swept-unhealthy without ever sending disconnect).
  function sessionDuration(s: ClientSession): string {
    if (!s.connectedAt) return '·'
    const end = s.disconnectedAt ?? (s.isActive ? undefined : s.lastHeartbeat)
    return formatDuration(s.connectedAt, end)
  }

  function getMetaProp(s: ClientSession, key: string): unknown {
    const m = s.metadata
    return m != null && typeof m === 'object' ? (m as Record<string, unknown>)[key] : undefined
  }

  interface RpcMethodLatency { count: number; avgUs: number; minUs: number; maxUs: number; durationNs?: number; buckets?: number[] }
  function getRpcLatency(m: Record<string, any>): [string, RpcMethodLatency][] {
    const rl = m.rpcLatency as Record<string, RpcMethodLatency> | undefined
    if (!rl) return []
    return Object.entries(rl).sort((a, b) => b[1].count - a[1].count)
  }
  // FUSE syscall handler latency (mfuse only). Same wire shape as
  // rpcLatency so the breakdown snippet renders both. Diagnostically
  // complementary: rpcLatency is network round-trip to dataserv; FUSE
  // latency adds cache hits and kernel-boundary time on top.
  function getFuseLatency(m: Record<string, any>): [string, RpcMethodLatency][] {
    const fl = m.fuseLatency as Record<string, RpcMethodLatency> | undefined
    if (!fl) return []
    return Object.entries(fl).sort((a, b) => b[1].count - a[1].count)
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

  function toBuckets(raw?: number[]): HistBucket[] {
    if (!raw || raw.length !== HISTOGRAM_BOUNDS.length) return []
    return raw.map((count, i) => ({ le: formatUs(HISTOGRAM_BOUNDS[i]), leUs: HISTOGRAM_BOUNDS[i], count }))
  }

  let rpcExpanded = $state<Set<string>>(new Set())
  let rpcMetricMode = $state<'minMax' | 'percentiles'>('percentiles')
  let fuseExpanded = $state<Set<string>>(new Set())
  let fuseMetricMode = $state<'minMax' | 'percentiles'>('percentiles')

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

  // TCP connection-drop breakdown. mfuse splits drops into benign pool
  // cycling (parked timeouts, overflow shrink) and concerning failures
  // (remote close, transport error, healthcheck-marked unhealthy). The
  // breakdown is only sent when nonzero; we fall back to the aggregate
  // count with no split for older clients or non-mfuse sessions.
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
  interface LatencyBands { sub1ms: number; sub10ms: number; sub100ms: number; over100ms: number }
  function latencyBands(entries: [string, RpcMethodLatency][]): LatencyBands {
    return entries.reduce<LatencyBands>((b, [, l]) => {
      if (l.avgUs < 1000) b.sub1ms++
      else if (l.avgUs < 10000) b.sub10ms++
      else if (l.avgUs < 100000) b.sub100ms++
      else b.over100ms++
      return b
    }, { sub1ms: 0, sub10ms: 0, sub100ms: 0, over100ms: 0 })
  }
</script>

<svelte:head><title>Session #{isNaN(id) ? 'Invalid' : id} · mountOS Admin</title></svelte:head>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex items-center gap-3 flex-wrap">
    <a href="/sessions" class="p-2 rounded-sm hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors focus-visible:ring-2 focus-visible:ring-ring" aria-label="Back to sessions">
      <ArrowLeft class="h-5 w-5" />
    </a>
    <h1 class="text-2xl font-bold tracking-tight">Session #{isNaN(id) ? 'Invalid' : id}</h1>
    {#if session}
      <Badge variant={statusVariant(session.status)}>{session.status}</Badge>
      {#if session.regionCluster}
        <a
          href="/regions/{session.region.id}?cluster={session.regionCluster.id}"
          class="session-cluster-chip"
          aria-label="View region {session.region.name} scoped to cluster {session.regionCluster.name}"
          title="Cluster {session.regionCluster.name} in region {session.region.name}"
        >
          <Layers class="h-3.5 w-3.5" aria-hidden="true" />
          <span class="font-mono">{session.regionCluster.name}</span>
        </a>
      {/if}
    {/if}
    {#if !session || session.isActive}
      <div class="flex items-center gap-2 ml-auto">
        <Button variant="ghost" size="icon" onclick={() => fetchSession()} aria-label="Refresh" title="Refresh">
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

    {#if error}
      <div class="rounded-sm border border-destructive/30 bg-destructive/5 px-4 py-2 text-sm text-destructive" role="alert">Refresh failed: {error}</div>
    {/if}

    <!-- Info -->
    <div class="corner-brackets relative border border-border/30 rounded-sm">
      <div class="tech-grid absolute inset-0 pointer-events-none opacity-20"></div>
      <div class="relative p-5 space-y-5">
        <!-- Host + badges -->
        <div class="flex flex-wrap items-center gap-4">
          <div class="min-w-0 flex-1">
            <p class="text-xl font-bold truncate" title={session.hostname || session.ipAddr}>{session.hostname || session.ipAddr}</p>
            <p class="text-sm text-muted-foreground font-mono">{session.ipAddr}</p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <Badge variant="primary" class="text-sm px-3 py-1">{formatPlatform(getPlatform(session))}</Badge>
            <Badge variant="secondary" class="text-sm px-3 py-1">{formatOs(session.osName)}</Badge>
            <Badge class="text-sm px-3 py-1">{session.region.name}</Badge>
            {#if session.mountMode}<Badge variant={session.mountMode === 'readonly' ? 'warning' : 'success'} class="text-sm px-3 py-1">{session.mountMode}</Badge>{/if}
            {#if session.forkName}<Badge variant="outline" class="text-sm px-3 py-1">{session.forkName}</Badge>{#if session.isTemporaryFork}<Badge variant="warning" class="text-sm px-3 py-1">Temporary</Badge>{/if}{/if}
            <Badge variant="secondary" class="text-sm px-3 py-1">{session.clientType}</Badge>
          </div>
        </div>

        <div class="border-t border-border/40"></div>

        <!-- Detail grid -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4">
          <div><p class="detail-label">Account</p><a href="/accounts/{session.account.id}" class="detail-link text-sm">{session.account.name}</a></div>
          <div><p class="detail-label">Volume</p><a href="/volumes/{session.volume.id}" class="detail-link text-sm">{session.volume.name || `#${session.volume.id}`}</a></div>
          <div><p class="detail-label">Mount Path</p><p class="text-sm font-mono truncate" title={session.mountPath ?? ''}>{session.mountPath ?? '·'}</p></div>
          <div><p class="detail-label">OS / Arch</p><p class="text-sm font-mono">{session.osVersion ?? session.osName}</p></div>
          {#if session.forkName}
            <div><p class="detail-label">Fork</p><span class="inline-flex items-center gap-1.5"><Badge variant="outline">{session.forkName}</Badge>{#if session.isTemporaryFork}<Badge variant="warning">Temporary</Badge>{/if}</span></div>
          {/if}
          <div>
            <div class="detail-label flex items-center gap-0.5">
              Process Uptime
              <InfoTip text={"**Process Uptime:** client-reported, how long this mount's process has been running.\n**Session Age:** server-tracked, how long the session row has been alive.\n\n**Drift signals:**\n• Uptime < Age → process restarted, session reused\n• Uptime > Age → late mount, warm process\n• Age frozen, Uptime advancing → heartbeats lost"} />
            </div>
            <p class="text-sm">{m.uptimeSeconds != null ? formatUptime(m.uptimeSeconds) : '·'}</p>
          </div>
          <div><p class="detail-label">Session Age</p><p class="text-sm tabular-nums">{sessionDuration(session)}</p></div>
          <div><p class="detail-label">Connected</p><p class="text-sm">{session.connectedAt ? formatRelative(session.connectedAt) : '·'}</p></div>
          <div><p class="detail-label">Last Heartbeat</p><p class="text-sm">{session.lastHeartbeat ? formatRelative(session.lastHeartbeat) : '·'}</p></div>
          {#if session.disconnectedAt}
            <div><p class="detail-label">Disconnected</p><p class="text-sm">{formatRelative(session.disconnectedAt)}</p></div>
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

    {@const cacheCfg = getMetaProp(session, 'cache') as Record<string, unknown> | undefined}
    {#if cacheCfg}
      <!-- Cache configuration (operator-facing knobs at mount time) -->
      <div class="corner-brackets relative border border-border/30 rounded-sm">
        <div class="tech-grid absolute inset-0 pointer-events-none opacity-20"></div>
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

    <!-- Metrics -->
    {#if m.reads !== undefined}
      <div class="corner-brackets relative border border-border/30 rounded-sm">
        <div class="tech-grid absolute inset-0 pointer-events-none opacity-20"></div>
        <div class="relative p-5">
          <h2 class="text-lg font-semibold mb-4">Metrics</h2>
          <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-x-8 gap-y-5">
            <div class="metric-group">
              <p class="detail-label">I/O</p>
              <div class="metric-row"><span>Reads</span><span>{formatNum(m.reads ?? 0)}</span></div>
              <div class="metric-row"><span>Writes</span><span>{formatNum(m.writes ?? 0)}</span></div>
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
            </div>
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
              {@const pressureColor = blocked > 0 || peakPct >= 95 ? 'text-destructive' : peakPct >= 80 ? 'text-amber-500' : ''}
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
            <div class="metric-group">
              <p class="detail-label">Object Store</p>
              <div class="metric-row"><span>GET Count</span><span>{formatNum(m.objectGetCount ?? 0)}</span></div>
              <div class="metric-row"><span>GET Bytes</span><span>{formatBytes(m.objectGetBytes ?? 0)}</span></div>
              <div class="metric-row"><span>PUT Count</span><span>{formatNum(m.objectPutCount ?? 0)}</span></div>
              <div class="metric-row"><span>PUT Bytes</span><span>{formatBytes(m.objectPutBytes ?? 0)}</span></div>
              <div class="metric-row {(m.objectErrors ?? 0) ? 'text-destructive' : ''}"><span>Errors</span><span>{formatNum(m.objectErrors ?? 0)}</span></div>
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
              <div class="metric-row"><span>TCP Recv</span><span>{formatBytes(m.tcpBytesRecv ?? 0)}</span></div>
              <div class="metric-row"><span>TCP Sent</span><span>{formatBytes(m.tcpBytesSent ?? 0)}</span></div>
              <div class="metric-row"><span>Events Recv</span><span>{formatNum(m.tcpEventsRecv ?? 0)}</span></div>
              <div class="metric-row"><span>Events Sent</span><span>{formatNum(m.tcpEventsSent ?? 0)}</span></div>
            </div>
            <div class="metric-group">
              <p class="detail-label">Runtime</p>
              <div class="metric-row"><span>Goroutines</span><span>{formatNum(m.goroutines ?? 0)}</span></div>
              <div class="metric-row"><span>Mem Alloc</span><span style="color: {memAllocColor(m.memAlloc ?? 0)}">{formatBytes(m.memAlloc ?? 0)}</span></div>
              <div class="metric-row"><span>RPC Count</span><span>{formatNum(m.rpcCount ?? 0)}</span></div>
              <div class="metric-row {(m.rpcErrors ?? 0) ? 'text-destructive' : ''}"><span>RPC Errors</span><span>{formatNum(m.rpcErrors ?? 0)}</span></div>
            </div>
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
    {@const gw = getGatewayMetrics(m)}
      {#if gw}
        <div class="corner-brackets relative border border-border/30 rounded-sm">
          <div class="tech-grid absolute inset-0 pointer-events-none opacity-20"></div>
          <div class="relative p-5">
            <div class="flex flex-wrap items-center gap-3 mb-4">
              <h2 class="text-lg font-semibold">Gateway Activity</h2>
              <span class="text-sm text-muted-foreground font-mono">embedded per-volume</span>
            </div>
            <div class="grid gap-4 sm:grid-cols-2">
              {#each gatewayProtocols(gw) as { proto, snap }}
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

      {#snippet latencyBreakdown(title: string, ariaLabel: string, entries: [string, RpcMethodLatency][], expanded: Set<string>, toggleExpand: (m: string) => void, metricMode: 'minMax' | 'percentiles', setMode: (m: 'minMax' | 'percentiles') => void)}
        {@const totalHits = entries.reduce((s, [, l]) => s + l.count, 0)}
        {@const totalTimeSec = entries.reduce((s, [, l]) => s + (l.durationNs != null ? l.durationNs / 1e9 : (l.count * l.avgUs) / 1e6), 0)}
        {@const bands = latencyBands(entries)}
        {@const hasBuckets = entries.some(([, l]) => l.buckets?.some(c => c > 0))}
        <div class="corner-brackets relative border border-border/30 rounded-sm">
          <div class="tech-grid absolute inset-0 pointer-events-none opacity-20"></div>
          <div class="relative p-5">
            <div class="flex flex-wrap items-center gap-3 mb-4">
              <h2 class="text-lg font-semibold">{title}</h2>
              <span class="text-sm text-muted-foreground font-mono">{entries.length} methods</span>
              <span class="text-sm text-muted-foreground font-mono">{formatNum(totalHits)} hits</span>
              <span class="text-sm text-muted-foreground font-mono">{formatTotalTime(totalTimeSec)} total</span>
              <div class="flex items-center gap-1.5 ml-auto">
                {#if bands.sub1ms}<Badge variant="success" class="font-mono text-xs">&lt;1ms: {bands.sub1ms}</Badge>{/if}
                {#if bands.sub10ms}<Badge variant="outline" class="font-mono text-xs">1-10ms: {bands.sub10ms}</Badge>{/if}
                {#if bands.sub100ms}<Badge variant="warning" class="font-mono text-xs">10-100ms: {bands.sub100ms}</Badge>{/if}
                {#if bands.over100ms}<Badge variant="destructive" class="font-mono text-xs">&gt;100ms: {bands.over100ms}</Badge>{/if}
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
                    <th scope="col" class="text-left">Method</th>
                    <th scope="col" class="text-right">Count</th>
                    <th scope="col" class="text-right">Ops/s</th>
                    <th scope="col" class="text-right">Total</th>
                    <th scope="col" class="text-right">Avg</th>
                    {#if hasBuckets}<th scope="col" class="text-right">σ/μ</th>{/if}
                    {#if metricMode === 'minMax'}
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
                    <tr class="cursor-pointer hover:bg-muted/50 transition-colors {isOpen ? 'bg-muted/30' : ''}" class:rpc-zebra={!isOpen && i % 2 === 1} onclick={() => bkts.length > 0 && toggleExpand(method)} onkeydown={(e: KeyboardEvent) => { if ((e.key === 'Enter' || e.key === ' ') && bkts.length > 0) { e.preventDefault(); toggleExpand(method) } }} tabindex={bkts.length > 0 ? 0 : undefined} role={bkts.length > 0 ? 'button' : undefined} aria-expanded={bkts.length > 0 ? isOpen : undefined}>
                      {#if hasBuckets}
                        <td class="w-6">
                          {#if bkts.length > 0}
                            <ChevronRight class="h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 {isOpen ? 'rotate-90' : ''}" />
                          {/if}
                        </td>
                      {/if}
                      <td class="font-mono text-sm">{method}</td>
                      <td class="text-right font-mono text-sm tabular-nums">{formatNum(lat.count)}</td>
                      <td class="text-right font-mono text-sm tabular-nums text-muted-foreground">{formatOpsPerSec(lat.avgUs)}</td>
                      <td class="text-right font-mono text-sm tabular-nums text-muted-foreground">{formatTotalTime(lat.durationNs != null ? lat.durationNs / 1e9 : (lat.count * lat.avgUs) / 1e6)}</td>
                      <td class="text-right font-mono text-sm tabular-nums" style="color: {latencyColor(lat.avgUs)}">{formatUs(lat.avgUs)}</td>
                      {#if hasBuckets}
                        <td class="text-right">
                          {#if cv >= 0}<Badge variant={cvVariant(cv)} class="font-mono text-xs px-1 py-0">{cv.toFixed(2)}</Badge>{/if}
                        </td>
                      {/if}
                      {#if metricMode === 'minMax'}
                        <td class="text-right font-mono text-sm tabular-nums" style="color: {latencyColor(lat.minUs)}">{formatUs(lat.minUs)}</td>
                        <td class="text-right font-mono text-sm tabular-nums" style="color: {latencyColor(lat.maxUs)}">{formatUs(lat.maxUs)}</td>
                      {:else}
                        <td class="text-right font-mono text-sm tabular-nums" style="color: {latencyColor(lat.avgUs)}">{fmtPercentile(bkts, 50)}</td>
                        <td class="text-right font-mono text-sm tabular-nums" style="color: {latencyColor(lat.avgUs)}">{fmtPercentile(bkts, 95)}</td>
                        <td class="text-right font-mono text-sm tabular-nums" style="color: {latencyColor(lat.avgUs)}">{fmtPercentile(bkts, 99)}</td>
                      {/if}
                    </tr>
                    {#if isOpen && bkts.length > 0}
                      {@const totalCount = bkts.reduce((s, b) => s + b.count, 0)}
                      {@const bktColspan = metricMode === 'minMax' ? (hasBuckets ? 9 : 7) : (hasBuckets ? 10 : 8)}
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
        {@render latencyBreakdown('RPC Latency', 'RPC latency data', rpcEntries, rpcExpanded, toggleRpcExpand, rpcMetricMode, (v) => rpcMetricMode = v)}
      {/if}

      {@const fuseEntries = getFuseLatency(m)}
      {#if fuseEntries.length > 0}
        {@render latencyBreakdown('FUSE Latency', 'FUSE syscall latency data', fuseEntries, fuseExpanded, toggleFuseExpand, fuseMetricMode, (v) => fuseMetricMode = v)}
      {/if}
  {/if}
</div>

<style>
  .rpc-table { width: 100%; border-collapse: collapse; }
  .rpc-table th { font-size: 0.8125rem; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600; color: var(--muted-foreground); padding: 0.5rem 0.75rem; border-bottom: 2px solid var(--primary); }
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
    font-size: 0.7rem;
    padding: 0.25rem 0.625rem;
    cursor: pointer;
    background: transparent;
    border: none;
    color: var(--muted-foreground);
    transition: color 0.15s, background 0.15s;
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
    font-size: 0.8125rem;
    color: var(--muted-foreground);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    text-decoration: none;
    transition: color 120ms cubic-bezier(0.16, 1, 0.3, 1), border-color 120ms cubic-bezier(0.16, 1, 0.3, 1);
  }
  .session-cluster-chip:hover { color: var(--foreground); border-color: color-mix(in oklch, var(--foreground) 40%, var(--border)); }
  .session-cluster-chip:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }
</style>
