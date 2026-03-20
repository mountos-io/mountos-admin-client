<script lang="ts">
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import { onDestroy } from 'svelte'
  import { useNodes } from '$lib/core/stores/nodes.svelte'
  import { useAuth } from '$lib/core/stores/auth.svelte'
  import { Badge } from '$lib/components/ui/badge'
  import { Button } from '$lib/components/ui/button'
  import FilterSelect from '$lib/components/shared/FilterSelect.svelte'
  import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card'
  import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '$lib/components/ui/table'
  import LoadingSpinner from '$lib/components/shared/LoadingSpinner.svelte'
  import ServiceMetricsView from '$lib/components/shared/ServiceMetricsView.svelte'
  import { showErrorToast } from '$lib/core/utils/toast'
  import { formatRelative, nodeStatusVariant, formatDate } from '$lib/core/utils/format'
  import type { ServiceNode } from '$lib/core/api/types'
  import ArrowLeft from '@lucide/svelte/icons/arrow-left'

  const nodeStore = useNodes()
  const auth = useAuth()

  const regionId = $derived(Number($page.params.regionId))
  const nodeId = $derived($page.params.nodeId)

  const node = $derived<ServiceNode | undefined>(nodeStore.nodes.find(n => n.nodeId === nodeId))
  import { POLL_OPTIONS } from '$lib/core/utils/options'

  let pollValue = $state('')

  const serviceTypeLabel = $derived.by(() => {
    const t = node?.serviceType
    if (t === 'hub' || t === 'appserv') return 'Hub (appserv)'
    if (t === 'mfuse' || t === 'fuseserv') return 'FUSE (fuseserv)'
    return t ?? nodeId
  })

  const isFuseserv = $derived(
    node?.serviceType === 'fuseserv' || node?.serviceType === 'mfuse'
  )

  const isHub = $derived(
    node?.serviceType === 'hub' || node?.serviceType === 'appserv'
  )

  // Group stats by section for fuseserv
  const statSections = $derived.by(() => {
    const sections: { name: string; metrics: { name: string; labels: string; value: number }[] }[] = []
    for (const [section, metrics] of nodeStore.stats) {
      sections.push({
        name: section,
        metrics: metrics.map(m => ({
          name: m.name,
          labels: Object.entries(m.labels).map(([k, v]) => `${k}="${v}"`).join(', '),
          value: m.value,
        })),
      })
    }
    return sections
  })

  function formatMetricValue(v: number): string {
    if (!Number.isFinite(v)) return String(v)
    if (v >= 1e9) return `${(v / 1e9).toFixed(2)}G`
    if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`
    if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`
    if (Number.isInteger(v)) return String(v)
    return v.toFixed(3)
  }

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

  onDestroy(() => nodeStore.resetStats())
</script>

<div class="space-y-5">
  <!-- Header -->
  <div class="flex items-start justify-between gap-4">
    <div class="flex items-center gap-3">
      <Button variant="ghost" size="sm" onclick={() => goto(`/nodes/${regionId}`)}>
        <ArrowLeft class="h-4 w-4" />
      </Button>
      <div>
        <div class="flex items-center gap-3">
          <h1 class="text-xl font-bold tracking-tight font-mono">{nodeId}</h1>
          {#if node}
            <Badge variant={nodeStatusVariant(node.status)}>{node.status}</Badge>
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

  <!-- Last updated -->
  {#if nodeStore.statsLastUpdated}
    <div class="flex items-center gap-2 font-mono text-[0.65rem] uppercase tracking-[0.15em] text-muted-foreground">
      <span class="inline-block w-4 h-px bg-primary/40"></span>
      Last updated: {formatDate(nodeStore.statsLastUpdated)}
      {#if nodeStore.statsLoading}
        <span class="inline-block h-1.5 w-1.5 rounded-full bg-primary animate-pulse"></span>
      {/if}
    </div>
  {/if}

  <!-- Node info card -->
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
            <dd class="text-sm mt-0.5">{node.lastHeartbeat ? formatRelative(node.lastHeartbeat) : '—'}</dd>
          </div>
          <div>
            <dt class="text-muted-foreground text-sm">Active</dt>
            <dd class="mt-0.5">
              <Badge variant={node.isActive ? 'success' : 'secondary'}>{node.isActive ? 'Yes' : 'No'}</Badge>
            </dd>
          </div>
          {#if node.metadata && Object.keys(node.metadata).length > 0}
            <div class="col-span-full">
              <dt class="text-muted-foreground text-sm">Metadata</dt>
              <dd class="font-mono text-sm mt-0.5 whitespace-pre-wrap">{JSON.stringify(node.metadata, null, 2)}</dd>
            </div>
          {/if}
        </dl>
      </CardContent>
    </Card>
  {/if}

  <!-- Stats section -->
  {#if node && (node.status !== 'healthy' || !node.isActive)}
    <Card>
      <CardHeader><CardTitle class="text-base">Metrics</CardTitle></CardHeader>
      <CardContent class="pt-0">
        <p class="text-sm text-muted-foreground">Metrics unavailable — node is {node.status}{!node.isActive ? ' (inactive)' : ''}.</p>
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
  {:else if isHub && nodeStore.statsRaw}
    <ServiceMetricsView raw={nodeStore.statsRaw} />
  {:else if statSections.length > 0}
    {#each statSections as section}
      <Card>
        <CardHeader>
          <CardTitle class="text-base font-mono">{section.name}</CardTitle>
        </CardHeader>
        <CardContent class="pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead class="th-cyber">Metric</TableHead>
                <TableHead class="th-cyber">Labels</TableHead>
                <TableHead class="th-cyber text-right">Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {#each section.metrics as m}
                <TableRow>
                  <TableCell class="font-mono text-sm">{m.name}</TableCell>
                  <TableCell class="font-mono text-sm text-muted-foreground">{m.labels || '—'}</TableCell>
                  <TableCell class="text-right font-mono text-sm tabular-nums">{formatMetricValue(m.value)}</TableCell>
                </TableRow>
              {/each}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    {/each}
  {:else if node}
    <Card>
      <CardHeader><CardTitle class="text-base">Metrics</CardTitle></CardHeader>
      <CardContent class="pt-0">
        <p class="text-sm text-muted-foreground">Detailed metrics coming soon. Stats endpoint not yet available for {serviceTypeLabel}.</p>
      </CardContent>
    </Card>
  {/if}
</div>
