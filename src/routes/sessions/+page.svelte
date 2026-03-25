<script lang="ts">
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { onDestroy } from 'svelte'
  import { untrack } from 'svelte'
  import { useSessions } from '$lib/core/stores/sessions.svelte'
  import { useAccounts } from '$lib/core/stores/accounts.svelte'
  import { useAuth } from '$lib/core/stores/auth.svelte'
  import { Card, CardContent } from '$lib/components/ui/card'
  import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '$lib/components/ui/table'
  import { Badge } from '$lib/components/ui/badge'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import FilterSelect from '$lib/components/shared/FilterSelect.svelte'
  import Pagination from '$lib/components/shared/Pagination.svelte'
  import LoadingSpinner from '$lib/components/shared/LoadingSpinner.svelte'
  import EmptyState from '$lib/components/shared/EmptyState.svelte'
  import SessionSummaryStrip from '$lib/components/shared/SessionSummaryStrip.svelte'
  import { formatRelative, formatUptime, formatBytes, formatNum, formatPlatform, formatOs, formatSessionStatus } from '$lib/core/utils/format'
  import { SESSION_POLL_OPTIONS } from '$lib/core/utils/options'
  import { showErrorToast } from '$lib/core/utils/toast'
  import type { ClientSession } from '$lib/core/api/types'
  import ExternalLink from '@lucide/svelte/icons/external-link'

  const store = useSessions()
  const accountStore = useAccounts()
  const auth = useAuth()
  const account = $derived(accountStore.selectedAccount)
  const accountId = $derived(account?.id ?? null)
  const volumeIdParam = $derived($page.url.searchParams.get('volumeId'))
  let redirected = false

  $effect(() => {
    if (auth.loading) return
    if (!auth.can('clientSessions', 'read')) {
      if (!redirected) { redirected = true; showErrorToast('Access denied'); goto('/', { replaceState: true }) }
      return
    }
    const acctId = accountId
    if (acctId) untrack(() => store.fetchAllSessions(acctId))
  })

  $effect(() => {
    const vid = volumeIdParam ? Number(volumeIdParam) : undefined
    const validVid = vid && Number.isFinite(vid) ? vid : undefined
    untrack(() => store.setVolumeIdFilter(validVid))
    return () => untrack(() => store.setVolumeIdFilter(undefined))
  })

  let pollValue = $state('')
  let pollTimer: ReturnType<typeof setInterval> | null = null

  function setPoll(v: string) {
    pollValue = v
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
    const secs = Number(v)
    if (secs > 0) pollTimer = setInterval(() => store.refetch(), secs * 1000)
  }

  onDestroy(() => { if (pollTimer) clearInterval(pollTimer) })

  function statusVariant(s: string) { return formatSessionStatus(s).variant }
  function mountModeVariant(m: string) { return m === 'readonly' ? 'outline' as const : 'default' as const }
  function getMetrics(s: ClientSession) { return (s.metrics ?? {}) as Record<string, any> }
  function getPlatform(s: ClientSession): string {
    const md = s.metadata as { platform?: string } | undefined
    return md?.platform ?? s.clientType
  }
  function clearVolumeFilter() { goto('/sessions') }

  const hasFilters = $derived(store.statusFilter || store.platformFilter || store.regionFilter || store.osFilter || store.searchQuery)
</script>

<svelte:head><title>Sessions — mountOS Admin</title></svelte:head>

<div class="space-y-6">
  <div class="flex items-center gap-3">
    <h1 class="text-2xl font-bold tracking-tight">Sessions</h1>
    {#if store.volumeIdFilter}
      <Badge variant="outline" class="gap-1">
        Volume #{store.volumeIdFilter}
        <button type="button" class="ml-1 p-1 hover:text-destructive" onclick={clearVolumeFilter} aria-label="Clear volume filter">&times;</button>
      </Badge>
    {/if}
    {#if store.capped}
      <Badge variant="warning" class="text-sm">Showing {formatNum(store.summary.total)} of {formatNum(store.cappedTotal)}</Badge>
    {/if}
  </div>

  {#if !account}
    <EmptyState title="No account selected" description="Select an account to view sessions." />
  {:else}
    <!-- Summary Stats -->
    <div class="flex flex-wrap gap-3 items-center">
      <SessionSummaryStrip summary={store.summary} loading={store.loading} />
      <span class="stat-divider" aria-hidden="true"></span>
      {#each store.summary.byPlatform as [platform, count]}
        <span class="count-tag" style="--tc: var(--primary)"><span class="count-pill" style="background: var(--primary); color: var(--primary-foreground)">{count}</span> {formatPlatform(platform)}</span>
      {/each}
      {#if store.summary.byOs.length > 1}
        <span class="stat-divider" aria-hidden="true"></span>
        {#each store.summary.byOs as [os, count]}
          <span class="count-tag" style="--tc: var(--foreground)"><span class="count-pill" style="background: var(--foreground); color: var(--background)">{count}</span> {formatOs(os)}</span>
        {/each}
      {/if}
    </div>

    <!-- Filters -->
    <div class="corner-brackets relative border border-border/30 rounded-sm p-4">
      <div class="tech-grid absolute inset-0 pointer-events-none opacity-20"></div>
      <div class="relative flex flex-wrap gap-3 items-center">
        <div class="flex-1 min-w-48 max-w-sm">
          <Input value={store.searchQuery} oninput={(e: Event) => store.setSearchQuery((e.target as HTMLInputElement).value)} placeholder="Search host, volume, path, account..." aria-label="Search sessions" />
        </div>
        <FilterSelect options={store.statusOptions} value={store.statusFilter} placeholder="Status" onchange={(v) => store.setStatusFilter(v)} />
        <FilterSelect options={store.platformOptions} value={store.platformFilter} placeholder="Platform" onchange={(v) => store.setPlatformFilter(v)} />
        <FilterSelect options={store.regionOptions} value={store.regionFilter} placeholder="Region" onchange={(v) => store.setRegionFilter(v)} />
        <FilterSelect options={store.osOptions} value={store.osFilter} placeholder="OS" onchange={(v) => store.setOsFilter(v)} />
        {#if hasFilters}
          <Button variant="ghost" size="sm" onclick={() => store.clearFilters()}>Clear</Button>
        {/if}
        <div class="flex items-center gap-2 ml-auto">
          <label class="flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer select-none">
            <input type="checkbox" checked={store.showInactive} onchange={() => store.setShowInactive(!store.showInactive)} class="accent-primary" />
            Inactive
          </label>
          <span class="text-sm text-muted-foreground">{store.filtered.length} result{store.filtered.length !== 1 ? 's' : ''}</span>
          <FilterSelect options={SESSION_POLL_OPTIONS} value={pollValue} placeholder="Poll Off" onchange={setPoll} />
        </div>
      </div>
    </div>

    {#if store.loading && store.allSessions.length === 0}
      <div class="flex justify-center py-12" role="status" aria-label="Loading sessions"><LoadingSpinner /></div>
    {:else if store.error}
      <Card><CardContent class="py-8"><p class="text-center text-destructive" role="alert">{store.error}</p></CardContent></Card>
    {:else if store.filtered.length === 0}
      <EmptyState title="No sessions" description={hasFilters ? 'No sessions match filters.' : 'No client sessions found for this account.'} />
    {:else}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead class="w-8"></TableHead>
            <TableHead class="th-cyber">Host</TableHead>
            <TableHead class="th-cyber">Platform</TableHead>
            <TableHead class="th-cyber">Volume</TableHead>
            <TableHead class="th-cyber">Region</TableHead>
            <TableHead class="th-cyber">Status</TableHead>
            <TableHead class="th-cyber hidden md:table-cell">Mode</TableHead>
            <TableHead class="th-cyber hidden lg:table-cell">Heartbeat</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {#each store.displaySessions as session (session.id)}
            <TableRow class="cursor-pointer hover:bg-muted/50" onclick={() => store.toggleExpanded(session.id)} tabindex={0} onkeydown={(e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); store.toggleExpanded(session.id) } }}>
              <TableCell class="text-muted-foreground">
                <button type="button" class="p-1" aria-expanded={store.expanded.has(session.id)} aria-label="Toggle session details">{store.expanded.has(session.id) ? '▾' : '▸'}</button>
              </TableCell>
              <TableCell>
                <div>
                  <p class="text-sm font-medium truncate max-w-[200px]" title={session.hostname || session.ipAddr}>{session.hostname || session.ipAddr}</p>
                  <p class="text-sm text-muted-foreground font-mono">{session.ipAddr}</p>
                </div>
              </TableCell>
              <TableCell>
                <div class="flex items-center gap-1.5">
                  <span class="session-os">{formatOs(session.osName)}</span>
                  <span class="session-platform">{formatPlatform(getPlatform(session))}</span>
                </div>
              </TableCell>
              <TableCell class="text-sm max-w-[120px] truncate" title={session.volume.name || String(session.volume.id)}>{session.volume.name || `#${session.volume.id}`}</TableCell>
              <TableCell><span class="session-region">{session.region.name}</span></TableCell>
              <TableCell><Badge variant={statusVariant(session.status)}>{session.status}</Badge></TableCell>
              <TableCell class="hidden md:table-cell">
                {#if session.mountMode}<Badge variant={mountModeVariant(session.mountMode)}>{session.mountMode}</Badge>{:else}—{/if}
              </TableCell>
              <TableCell class="text-sm text-muted-foreground hidden lg:table-cell">{session.lastHeartbeat ? formatRelative(session.lastHeartbeat) : '—'}</TableCell>
            </TableRow>
            {#if store.expanded.has(session.id)}
              {@const m = getMetrics(session)}
              <TableRow>
                <TableCell></TableCell>
                <TableCell colspan={7}>
                  <div class="space-y-4 py-3">
                    <a href="/sessions/{session.id}" class="inline-flex items-center gap-2 px-3 py-1.5 rounded-sm border border-primary/30 bg-primary/5 text-primary text-sm font-medium hover:bg-primary/10 transition-colors" onclick={(e: MouseEvent) => e.stopPropagation()}>
                      <ExternalLink class="h-4 w-4" />
                      View Details
                    </a>
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div><p class="detail-label">Account</p><a href="/accounts/{session.account.id}" class="detail-link text-sm" onclick={(e: MouseEvent) => e.stopPropagation()}>{session.account.name}</a></div>
                        <div><p class="detail-label">Mount Path</p><p class="text-sm font-mono truncate" title={session.mountPath ?? ''}>{session.mountPath ?? '—'}</p></div>
                        <div><p class="detail-label">OS / Arch</p><p class="text-sm font-mono">{session.osVersion ?? session.osName}</p></div>
                        <div><p class="detail-label">Uptime</p><p class="text-sm">{formatUptime(m.uptimeSeconds ?? 0)}</p></div>
                        <div class="min-w-0"><p class="detail-label">Volume</p><a href="/volumes/{session.volume.id}" class="detail-link text-sm font-mono truncate" title={session.volume.name} onclick={(e: MouseEvent) => e.stopPropagation()}>{session.volume.name || `#${session.volume.id}`}</a></div>
                        <div class="min-w-0"><p class="detail-label">User</p>{#if session.user}<a href="/users/{session.user.id}" class="detail-link text-sm font-mono truncate" title={session.user.name} onclick={(e: MouseEvent) => e.stopPropagation()}>{session.user.name || `#${session.user.id}`}</a>{:else}<p class="text-sm font-mono">—</p>{/if}</div>
                        <div><p class="detail-label">Client Type</p><Badge variant="outline">{session.clientType}</Badge></div>
                        {#if session.forkName}
                          <div><p class="detail-label">Fork</p><span class="inline-flex items-center gap-1.5"><Badge variant="outline">{session.forkName}</Badge>{#if session.isTemporaryFork}<Badge variant="warning">Temporary</Badge>{/if}</span></div>
                        {/if}
                        <div><p class="detail-label">Session ID</p><p class="text-sm font-mono">#{session.id}</p></div>
                    </div>
                    {#if m.reads !== undefined}
                      <div class="border-t border-border pt-3">
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2">
                          <div class="metric-group">
                            <p class="detail-label">I/O</p>
                            <div class="metric-row"><span>Reads</span><span>{formatNum(m.reads ?? 0)}</span></div>
                            <div class="metric-row"><span>Writes</span><span>{formatNum(m.writes ?? 0)}</span></div>
                            <div class="metric-row"><span>Open Files</span><span>{formatNum(m.openFiles ?? 0)}</span></div>
                            <div class="metric-row"><span>Downloaded</span><span>{formatBytes(m.downloaded ?? 0)}</span></div>
                            <div class="metric-row"><span>Uploaded</span><span>{formatBytes(m.uploaded ?? 0)}</span></div>
                          </div>
                          <div class="metric-group">
                            <p class="detail-label">Cache</p>
                            <div class="metric-row"><span>Hits</span><span>{formatNum(m.cacheHits ?? 0)}</span></div>
                            <div class="metric-row"><span>Misses</span><span>{formatNum(m.cacheMisses ?? 0)}</span></div>
                            <div class="metric-row"><span>Hit Bytes</span><span>{formatBytes(m.cacheHitBytes ?? 0)}</span></div>
                            <div class="metric-row"><span>Size</span><span>{formatBytes(m.cacheSize ?? 0)}</span></div>
                          </div>
                          <div class="metric-group">
                            <p class="detail-label">S3</p>
                            <div class="metric-row"><span>GET</span><span>{formatNum(m.s3GetCount ?? 0)} / {formatBytes(m.s3GetBytes ?? 0)}</span></div>
                            <div class="metric-row"><span>PUT</span><span>{formatNum(m.s3PutCount ?? 0)} / {formatBytes(m.s3PutBytes ?? 0)}</span></div>
                            <div class="metric-row {(m.s3Errors ?? 0) ? 'text-destructive' : ''}"><span>Errors</span><span>{formatNum(m.s3Errors ?? 0)}</span></div>
                          </div>
                          <div class="metric-group">
                            <p class="detail-label">Network</p>
                            <div class="metric-row"><span>Ping RTT</span><span>{m.pingRttMs ? `${m.pingRttMs} ms` : '—'}</span></div>
                            <div class="metric-row {(m.connFailures ?? 0) ? 'text-destructive' : ''}"><span>Conn Failures</span><span>{formatNum(m.connFailures ?? 0)}</span></div>
                            <div class="metric-row"><span>TCP Conns</span><span>{formatNum(m.tcpActiveConns ?? 0)}</span></div>
                            <div class="metric-row"><span>RPC</span><span>{formatNum(m.rpcCount ?? 0)}</span></div>
                            <div class="metric-row {(m.rpcErrors ?? 0) ? 'text-destructive' : ''}"><span>RPC Errors</span><span>{formatNum(m.rpcErrors ?? 0)}</span></div>
                          </div>
                        </div>
                      </div>
                    {/if}
                  </div>
                </TableCell>
              </TableRow>
            {/if}
          {/each}
        </TableBody>
      </Table>
      <Pagination currentPage={store.displayPage} totalPages={store.totalDisplayPages} onPageChange={(p) => store.setDisplayPage(p)} />
    {/if}
  {/if}
</div>

<style>
  .session-platform, .session-os, .session-region {
    display: inline-block;
    font-family: var(--font-mono);
    font-size: 0.875rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 0.25rem 0.5rem;
    border-radius: 2px;
  }
  .session-platform { border: 1px solid var(--primary); color: color-mix(in oklch, var(--primary) 80%, var(--foreground)); background: color-mix(in oklch, var(--primary) 15%, transparent); }
  :global(.dark) .session-platform { color: var(--primary); background: color-mix(in oklch, var(--primary) 10%, transparent); }
  .session-os { border: 1px solid var(--foreground); color: var(--foreground); opacity: 0.6; }
  .session-region { border: 1px solid var(--border); color: var(--muted-foreground); }

  .count-tag {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    font-family: var(--font-mono);
    font-size: 0.875rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 0.25rem 0.5rem 0.25rem 0.25rem;
    border: 1px solid var(--tc);
    border-radius: 1px;
    color: color-mix(in oklch, var(--tc) 80%, var(--foreground));
  }
  :global(.dark) .count-tag { color: var(--tc); }

  .count-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.5rem;
    height: 1.5rem;
    padding: 0 0.25rem;
    border-radius: 9999px;
    font-size: 0.8125rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }

  .stat-divider {
    width: 1px;
    height: 2rem;
    background: var(--border);
    flex-shrink: 0;
  }
</style>
