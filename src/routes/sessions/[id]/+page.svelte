<script lang="ts">
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { onDestroy } from 'svelte'
  import { untrack } from 'svelte'
  import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card'
  import { Badge } from '$lib/components/ui/badge'
  import { Button } from '$lib/components/ui/button'
  import { useAuth } from '$lib/core/stores/auth.svelte'
  import { api } from '$lib/core/stores/client.svelte'
  import FilterSelect from '$lib/components/shared/FilterSelect.svelte'
  import LoadingSpinner from '$lib/components/shared/LoadingSpinner.svelte'
  import { formatRelative, formatUptime, formatBytes, formatNum, formatLatency, formatPlatform, formatOs, formatSessionStatus } from '$lib/core/utils/format'
  import { POLL_OPTIONS } from '$lib/core/utils/options'
  import { showErrorToast } from '$lib/core/utils/toast'
  import type { ClientSession } from '$lib/core/api/types'
  import ArrowLeft from '@lucide/svelte/icons/arrow-left'
  import RefreshCw from '@lucide/svelte/icons/refresh-cw'

  const auth = useAuth()
  const id = $derived(Number($page.params.id))

  let session = $state<ClientSession | null>(null)
  let loading = $state(true)
  let error = $state<string | null>(null)
  let fetchCtrl: AbortController | null = null
  let redirected = false

  let pollValue = $state('')
  let pollTimer: ReturnType<typeof setInterval> | null = null

  async function fetchSession() {
    fetchCtrl?.abort()
    const ctrl = fetchCtrl = new AbortController()
    const sessionId = untrack(() => id)
    if (isNaN(sessionId)) { error = 'Invalid session ID'; loading = false; return }
    if (!session) loading = true
    error = null
    try {
      session = await api.clientSessions.get(sessionId, ctrl.signal)
      if (!session.isActive && pollTimer) setPoll('')
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      error = (e as Error).message || 'Failed to load session'
    } finally {
      if (fetchCtrl === ctrl) loading = false
    }
  }

  function setPoll(v: string) {
    pollValue = v
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
    const secs = Number(v)
    if (secs > 0) pollTimer = setInterval(() => fetchSession(), secs * 1000)
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
    if (pollTimer) clearInterval(pollTimer)
  })

  function statusVariant(s: string) { return formatSessionStatus(s).variant }
  function getMetrics(s: ClientSession) { return (s.metrics ?? {}) as Record<string, any> }
  function getPlatform(s: ClientSession): string {
    const md = s.metadata as { platform?: string } | undefined
    return md?.platform ?? s.clientType
  }

  interface RpcMethodLatency { count: number; avgUs: number; minUs: number; maxUs: number }
  function getRpcLatency(m: Record<string, any>): [string, RpcMethodLatency][] {
    const rl = m.rpcLatency as Record<string, RpcMethodLatency> | undefined
    if (!rl) return []
    return Object.entries(rl).sort((a, b) => b[1].count - a[1].count)
  }
</script>

<svelte:head><title>Session #{isNaN(id) ? 'Invalid' : id} — mountOS Admin</title></svelte:head>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex items-center gap-3 flex-wrap">
    <a href="/sessions" class="p-2 rounded-sm hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors focus-visible:ring-2 focus-visible:ring-ring" aria-label="Back to sessions">
      <ArrowLeft class="h-5 w-5" />
    </a>
    <h1 class="text-2xl font-bold tracking-tight">Session #{isNaN(id) ? 'Invalid' : id}</h1>
    {#if session}
      <Badge variant={statusVariant(session.status)}>{session.status}</Badge>
      {#if !session.isActive}
        <span class="text-sm text-muted-foreground" role="status">Inactive — polling stopped</span>
      {/if}
    {/if}
    <div class="flex items-center gap-2 ml-auto">
      <Button variant="ghost" size="sm" onclick={() => fetchSession()} aria-label="Refresh" title="Refresh">
        <RefreshCw class="h-4 w-4" />
      </Button>
      <FilterSelect options={POLL_OPTIONS} value={pollValue} placeholder="Poll Off" onchange={setPoll} />
    </div>
  </div>

  {#if loading && !session}
    <div class="flex justify-center py-12" role="status" aria-label="Loading session"><LoadingSpinner /></div>
  {:else if error && !session}
    <Card><CardContent class="py-8"><p class="text-center text-destructive" role="alert">{error}</p></CardContent></Card>
  {:else if session}
    {@const m = getMetrics(session)}

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
          <div><p class="detail-label">Mount Path</p><p class="text-sm font-mono truncate" title={session.mountPath ?? ''}>{session.mountPath ?? '—'}</p></div>
          <div><p class="detail-label">OS / Arch</p><p class="text-sm font-mono">{session.osVersion ?? session.osName}</p></div>
          {#if session.forkName}
            <div><p class="detail-label">Fork</p><span class="inline-flex items-center gap-1.5"><Badge variant="outline">{session.forkName}</Badge>{#if session.isTemporaryFork}<Badge variant="warning">Temporary</Badge>{/if}</span></div>
          {/if}
          <div><p class="detail-label">Uptime</p><p class="text-sm">{formatUptime(m.uptimeSeconds ?? 0)}</p></div>
          <div><p class="detail-label">Connected</p><p class="text-sm">{session.connectedAt ? formatRelative(session.connectedAt) : '—'}</p></div>
          <div><p class="detail-label">Last Heartbeat</p><p class="text-sm">{session.lastHeartbeat ? formatRelative(session.lastHeartbeat) : '—'}</p></div>
          {#if session.disconnectedAt}
            <div><p class="detail-label">Disconnected</p><p class="text-sm">{formatRelative(session.disconnectedAt)}</p></div>
          {/if}
        </div>

        <div class="border-t border-border/40"></div>

        <!-- IDs -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3">
          <div class="min-w-0"><p class="detail-label">Volume</p><a href="/volumes/{session.volume.id}" class="detail-link text-sm font-mono truncate">{session.volume.name || `#${session.volume.id}`}</a></div>
          <div class="min-w-0"><p class="detail-label">User</p>{#if session.user}<a href="/users/{session.user.id}" class="detail-link text-sm font-mono truncate" title={session.user.name}>{session.user.name || `#${session.user.id}`}</a>{:else}<p class="text-sm font-mono">—</p>{/if}</div>
          {#if session.appVersion}
            <div><p class="detail-label">App Version</p><p class="text-sm font-mono">{session.appVersion}</p></div>
          {/if}
          <div><p class="detail-label">Session ID</p><p class="text-sm font-mono">#{session.id}</p></div>
        </div>
      </div>
    </div>

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
            <div class="metric-group">
              <p class="detail-label">S3</p>
              <div class="metric-row"><span>GET Count</span><span>{formatNum(m.s3GetCount ?? 0)}</span></div>
              <div class="metric-row"><span>GET Bytes</span><span>{formatBytes(m.s3GetBytes ?? 0)}</span></div>
              <div class="metric-row"><span>PUT Count</span><span>{formatNum(m.s3PutCount ?? 0)}</span></div>
              <div class="metric-row"><span>PUT Bytes</span><span>{formatBytes(m.s3PutBytes ?? 0)}</span></div>
              <div class="metric-row {(m.s3Errors ?? 0) ? 'text-destructive' : ''}"><span>Errors</span><span>{formatNum(m.s3Errors ?? 0)}</span></div>
            </div>
            <div class="metric-group">
              <p class="detail-label">Network</p>
              <div class="metric-row"><span>Ping RTT</span><span>{m.pingRttMs ? `${m.pingRttMs} ms` : '—'}</span></div>
              <div class="metric-row {(m.connFailures ?? 0) ? 'text-destructive' : ''}"><span>Conn Failures</span><span>{formatNum(m.connFailures ?? 0)}</span></div>
              <div class="metric-row {(m.connDropped ?? 0) ? 'text-destructive' : ''}"><span>Conn Dropped</span><span>{formatNum(m.connDropped ?? 0)}</span></div>
              <div class="metric-row"><span>TCP Conns</span><span>{formatNum(m.tcpActiveConns ?? 0)}</span></div>
              <div class="metric-row"><span>TCP Recv</span><span>{formatBytes(m.tcpBytesRecv ?? 0)}</span></div>
              <div class="metric-row"><span>TCP Sent</span><span>{formatBytes(m.tcpBytesSent ?? 0)}</span></div>
              <div class="metric-row"><span>Events Recv</span><span>{formatNum(m.tcpEventsRecv ?? 0)}</span></div>
              <div class="metric-row"><span>Events Sent</span><span>{formatNum(m.tcpEventsSent ?? 0)}</span></div>
            </div>
            <div class="metric-group">
              <p class="detail-label">Runtime</p>
              <div class="metric-row"><span>Goroutines</span><span>{formatNum(m.goroutines ?? 0)}</span></div>
              <div class="metric-row"><span>Mem Alloc</span><span>{formatBytes(m.memAlloc ?? 0)}</span></div>
              <div class="metric-row"><span>RPC Count</span><span>{formatNum(m.rpcCount ?? 0)}</span></div>
              <div class="metric-row {(m.rpcErrors ?? 0) ? 'text-destructive' : ''}"><span>RPC Errors</span><span>{formatNum(m.rpcErrors ?? 0)}</span></div>
            </div>
          </div>
        </div>
      </div>

      <!-- RPC Latency Breakdown -->
      {@const rpcEntries = getRpcLatency(m)}
      {#if rpcEntries.length > 0}
        <div class="corner-brackets relative border border-border/30 rounded-sm">
          <div class="tech-grid absolute inset-0 pointer-events-none opacity-20"></div>
          <div class="relative p-5">
            <h2 class="text-lg font-semibold mb-4">RPC Latency</h2>
            <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
            <div class="overflow-x-auto" tabindex="0" role="region" aria-label="RPC latency data">
              <table class="rpc-table">
                <caption class="sr-only">RPC method latency breakdown</caption>
                <thead>
                  <tr>
                    <th scope="col" class="text-left">Method</th>
                    <th scope="col" class="text-right">Count</th>
                    <th scope="col" class="text-right">Avg</th>
                    <th scope="col" class="text-right">Min</th>
                    <th scope="col" class="text-right">Max</th>
                  </tr>
                </thead>
                <tbody>
                  {#each rpcEntries as [method, lat], i}
                    <tr class:rpc-zebra={i % 2 === 1}>
                      <td class="font-mono text-sm">{method}</td>
                      <td class="text-right font-mono text-sm tabular-nums">{formatNum(lat.count)}</td>
                      <td class="text-right font-mono text-sm tabular-nums">{formatLatency(lat.avgUs)}</td>
                      <td class="text-right font-mono text-sm tabular-nums">{formatLatency(lat.minUs)}</td>
                      <td class="text-right font-mono text-sm tabular-nums">{formatLatency(lat.maxUs)}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      {/if}
    {/if}
  {/if}
</div>

<style>
  .rpc-table { width: 100%; border-collapse: collapse; }
  .rpc-table th { font-size: 0.8125rem; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600; color: var(--muted-foreground); padding: 0.5rem 0.75rem; border-bottom: 2px solid var(--primary); }
  .rpc-table td { padding: 0.375rem 0.75rem; }
  .rpc-zebra { background: color-mix(in oklch, var(--muted) 30%, transparent); }
</style>
