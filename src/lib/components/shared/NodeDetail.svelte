<script lang="ts">
  import { goto } from '$app/navigation'
  import { onDestroy } from 'svelte'
  import { useNodes } from '$lib/core/stores/nodes.svelte'
  import { useRegionAlerts } from '$lib/core/stores/regionAlerts.svelte'
  import { useRegionAuditLogs } from '$lib/core/stores/regionAudit.svelte'
  import { SEVERITY_LABELS } from '$lib/core/stores/alerts.svelte'
  import { severityBadgeVariant, severityIcon } from '$lib/core/utils/alert'
  import { useAuth } from '$lib/core/stores/auth.svelte'
  import { Badge } from '$lib/components/ui/badge'
  import { Button } from '$lib/components/ui/button'
  import FilterSelect from '$lib/components/shared/FilterSelect.svelte'
  import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card'
  import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '$lib/components/ui/table'
  import LoadingSpinner from '$lib/components/shared/LoadingSpinner.svelte'
  import ActivityFeed from '$lib/components/shared/ActivityFeed.svelte'
  import ServiceMetricsView from '$lib/components/shared/ServiceMetricsView.svelte'
  import { showErrorToast } from '$lib/core/utils/toast'
  import { formatRelative, nodeStatusVariant, formatDate } from '$lib/core/utils/format'
  import type { ServiceNode } from '$lib/core/api/types'
  import ArrowLeft from '@lucide/svelte/icons/arrow-left'
  import { POLL_OPTIONS } from '$lib/core/utils/options'

  let { regionId, nodeId, basePath }: { regionId: number; nodeId: string; basePath: string } = $props()

  const nodeStore = useNodes()
  const alertStore = useRegionAlerts(() => regionId, () => nodeId)
  const auditStore = useRegionAuditLogs()
  const auth = useAuth()
  const canReadAlerts = $derived(auth.can('alerts', 'read'))
  const canReadAuditLogs = $derived(auth.can('auditLogs', 'read'))

  const node = $derived<ServiceNode | undefined>(nodeStore.nodes.find(n => n.nodeId === nodeId))

  let pollValue = $state('')

  const serviceTypeLabel = $derived.by(() => {
    const t = node?.serviceType
    if (t === 'hub') return 'Hub (appserv)'
    if (t === 'mfuse' || t === 'fuseserv') return 'FUSE (fuseserv)'
    return t ?? nodeId
  })

  $effect(() => {
    if (!auth.loading && !auth.can('serviceNodes', 'read')) {
      showErrorToast('Access denied')
      goto('/', { replaceState: true })
    }
  })

  $effect(() => {
    if (!regionId || !nodeId) return
    if (!nodeStore.nodes.length) {
      nodeStore.fetchNodes(regionId)
      return
    }
    if (!node || node.status !== 'healthy' || !node.isActive) {
      nodeStore.stopPolling()
      return
    }
    const interval = Number(pollValue)
    if (interval > 0) {
      nodeStore.startPolling(regionId, nodeId, interval)
    } else {
      nodeStore.stopPolling()
      nodeStore.fetchStats(regionId, nodeId)
    }
  })

  $effect(() => {
    const store = alertStore
    if (canReadAlerts && regionId && nodeId) {
      store.fetchAlerts()
    }
    return () => store.reset()
  })

  $effect(() => {
    if (canReadAuditLogs && regionId && nodeId) {
      auditStore.fetchLogs(regionId, { node: nodeId, reset: true })
    }
    return () => auditStore.reset()
  })

  onDestroy(() => nodeStore.resetStats())

  const nodeProcessId = $derived(node?.metadata?.['processId'] ?? null)
  const nodeFilteredMeta = $derived.by(() => {
    if (!node?.metadata) return null
    const entries = Object.entries(node.metadata).filter(([k]) => k !== 'processId')
    return entries.length > 0 ? Object.fromEntries(entries) : null
  })
</script>

<div class="space-y-5">
  <div class="flex items-start justify-between gap-4">
    <div class="flex items-center gap-3">
      <Button variant="ghost" size="sm" onclick={() => goto(`${basePath}/${regionId}`)} aria-label="Back to region nodes">
        <ArrowLeft class="h-4 w-4" />
      </Button>
      <div>
        <div class="flex items-center gap-3">
          <h1 class="text-xl font-bold tracking-tight font-mono">{nodeId}</h1>
          {#if node}
            <Badge variant={nodeStatusVariant(node.status)}>{node.status}</Badge>
            <Badge variant="outline" style="border-color: var(--pastel-node); color: var(--pastel-node-text)">Node</Badge>
            <Badge variant="outline">{serviceTypeLabel}</Badge>
          {/if}
        </div>
        {#if node}
          <div class="mt-1 text-sm text-muted-foreground font-mono">{node.advertiseAddr}</div>
        {/if}
      </div>
    </div>
    <FilterSelect
      options={POLL_OPTIONS}
      value={pollValue}
      placeholder="Poll Off"
      onchange={(v) => pollValue = v}
    />
  </div>

  {#if nodeStore.statsLastUpdated}
    <div class="flex items-center gap-2 font-mono text-[0.65rem] uppercase tracking-[0.15em] text-muted-foreground">
      <span class="inline-block h-1 w-1 rounded-full bg-primary/50 shrink-0"></span>
      Last updated: {formatDate(nodeStore.statsLastUpdated)}
      {#if nodeStore.statsLoading}
        <span class="inline-block h-1.5 w-1.5 rounded-full bg-primary animate-pulse"></span>
      {/if}
    </div>
  {/if}

  {#if node}
    <Card>
      <CardHeader><CardTitle class="text-base">Node Info</CardTitle></CardHeader>
      <CardContent class="pt-0">
        <dl class="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          <div>
            <dt class="text-muted-foreground text-sm">Node ID</dt>
            <dd class="font-mono text-sm mt-0.5">{node.nodeId}</dd>
          </div>
          <div>
            <dt class="text-muted-foreground text-sm">Service Type</dt>
            <dd class="mt-0.5">{node.serviceType}</dd>
          </div>
          <div>
            <dt class="text-muted-foreground text-sm">Status</dt>
            <dd class="mt-0.5"><Badge variant={nodeStatusVariant(node.status)}>{node.status}</Badge></dd>
          </div>
          <div>
            <dt class="text-muted-foreground text-sm">Address</dt>
            <dd class="font-mono text-sm mt-0.5">{node.advertiseAddr}</dd>
          </div>
          <div>
            <dt class="text-muted-foreground text-sm">Last Heartbeat</dt>
            <dd class="text-sm mt-0.5">{node.lastHeartbeat ? formatRelative(node.lastHeartbeat) : '·'}</dd>
          </div>
          <div>
            <dt class="text-muted-foreground text-sm">Active</dt>
            <dd class="mt-0.5">
              <Badge variant={node.isActive ? 'success' : 'secondary'}>{node.isActive ? 'Yes' : 'No'}</Badge>
            </dd>
          </div>
          {#if nodeProcessId != null}
            <div>
              <dt class="text-muted-foreground text-sm">Process ID</dt>
              <dd class="font-mono text-sm mt-0.5">{Number(nodeProcessId) || '·'}</dd>
            </div>
          {/if}
          {#if nodeFilteredMeta}
            <div class="col-span-full">
              <dt class="text-muted-foreground text-sm">Metadata</dt>
              <dd class="font-mono text-sm mt-0.5 whitespace-pre-wrap">{JSON.stringify(nodeFilteredMeta, null, 2)}</dd>
            </div>
          {/if}
        </dl>
      </CardContent>
    </Card>
  {/if}

  {#if node && (node.status !== 'healthy' || !node.isActive)}
    <Card>
      <CardHeader><CardTitle class="text-base">Metrics</CardTitle></CardHeader>
      <CardContent class="pt-0">
        <p class="text-sm text-muted-foreground">Metrics unavailable; node is {node.status}{!node.isActive ? ' (inactive)' : ''}.</p>
      </CardContent>
    </Card>
  {:else if nodeStore.statsLoading && !nodeStore.statsLastUpdated}
    <LoadingSpinner />
  {:else if nodeStore.statsError}
    <Card>
      <CardContent>
        <p class="text-sm text-destructive">{nodeStore.statsError}</p>
      </CardContent>
    </Card>
  {:else if nodeStore.statsRaw}
    <ServiceMetricsView raw={nodeStore.statsRaw}
      alertsCount={canReadAlerts ? (alertStore.activeCount || alertStore.alerts.length) : 0}
      alertsTab={canReadAlerts ? alertsTabSnippet : undefined}
      activityTab={canReadAuditLogs ? activityTabSnippet : undefined}
    />

    {#snippet alertsTabSnippet()}
      <Card>
        <CardHeader>
          <div class="flex items-center justify-between">
            <CardTitle class="text-base">Alerts</CardTitle>
            {#if alertStore.activeCount > 0}
              <Badge variant="destructive">{alertStore.activeCount} active</Badge>
            {/if}
          </div>
        </CardHeader>
        <CardContent class="pt-0">
          {#if alertStore.loading && alertStore.alerts.length === 0}
            <div class="flex items-center justify-center py-8" aria-busy="true">
              <LoadingSpinner />
            </div>
          {:else if alertStore.error}
            <p class="text-sm text-destructive">{alertStore.error}</p>
          {:else if alertStore.alerts.length === 0}
            <p class="text-sm text-muted-foreground">No alerts for this node.</p>
          {:else}
            <Table>
              <caption class="sr-only">Node alerts</caption>
              <TableHeader>
                <TableRow>
                  <TableHead class="w-28">Severity</TableHead>
                  <TableHead class="hidden sm:table-cell w-24">Category</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead class="hidden md:table-cell w-32">Time</TableHead>
                  <TableHead class="w-20">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {#each alertStore.alerts as alert (alert.alertId)}
                  {@const SevIcon = severityIcon(alert.severity)}
                  <TableRow>
                    <TableCell>
                      <Badge variant={severityBadgeVariant(alert.severity)} class="gap-1">
                        <SevIcon class="h-3 w-3" />
                        {SEVERITY_LABELS[alert.severity] ?? 'Unknown'}
                      </Badge>
                    </TableCell>
                    <TableCell class="hidden sm:table-cell">
                      <span class="capitalize">{alert.category}</span>
                    </TableCell>
                    <TableCell>
                      <p class="font-medium truncate" title={alert.title}>{alert.title}</p>
                    </TableCell>
                    <TableCell class="hidden md:table-cell">
                      <span class="text-muted-foreground whitespace-nowrap">{formatRelative(alert.eventTime)}</span>
                    </TableCell>
                    <TableCell>
                      {#if alert.resolvedAt}
                        <Badge variant="outline">Resolved</Badge>
                      {:else}
                        <Badge variant="destructive">Active</Badge>
                      {/if}
                    </TableCell>
                  </TableRow>
                {/each}
              </TableBody>
            </Table>
            {#if alertStore.totalAlerts > alertStore.alerts.length}
              <div class="flex justify-end pt-3">
                <Button variant="ghost" size="sm" onclick={() => goto(`/regions/${regionId}?tab=alerts`)}>
                  View all {alertStore.totalAlerts} region alerts
                </Button>
              </div>
            {/if}
          {/if}
        </CardContent>
      </Card>
    {/snippet}

    {#snippet activityTabSnippet()}
      <Card>
        <CardHeader><CardTitle class="text-base">Activity Log</CardTitle></CardHeader>
        <CardContent class="pt-0 max-h-[500px] overflow-y-auto">
          <ActivityFeed
            logs={auditStore.logs}
            loading={auditStore.loading}
            hasMore={auditStore.hasMore}
            onLoadMore={() => auditStore.fetchLogs(regionId, { node: nodeId })}
          />
        </CardContent>
      </Card>
    {/snippet}
  {:else if node}
    <Card>
      <CardHeader><CardTitle class="text-base">Metrics</CardTitle></CardHeader>
      <CardContent class="pt-0">
        <p class="text-sm text-muted-foreground">Detailed metrics coming soon. Stats endpoint not yet available for {serviceTypeLabel}.</p>
      </CardContent>
    </Card>
  {/if}
</div>
