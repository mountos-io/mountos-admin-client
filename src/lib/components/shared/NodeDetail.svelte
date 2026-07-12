<script lang="ts">
  import { goto } from '$app/navigation'
  import { onDestroy } from 'svelte'
  import { useNodes } from '$lib/core/stores/nodes.svelte'
  import { useClusters } from '$lib/core/stores/clusters.svelte'
  import { useStorages } from '$lib/core/stores/storages.svelte'
  import { useAccounts } from '$lib/core/stores/accounts.svelte'
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
  import DetailSkeleton from '$lib/components/shared/DetailSkeleton.svelte'
  import TableSkeleton from '$lib/components/shared/TableSkeleton.svelte'
  import ActivityFeed from '$lib/components/shared/ActivityFeed.svelte'
  import ServiceMetricsView from '$lib/components/shared/ServiceMetricsView.svelte'
  import NodeStatsHistoryChart from '$lib/components/shared/NodeStatsHistoryChart.svelte'
  import InstanceInfoPanel from '$lib/components/shared/InstanceInfoPanel.svelte'
  import { parseMetrics, fmtScalar } from '$lib/core/utils/metrics'
  import { showErrorToast } from '$lib/core/utils/toast'
  import { copyText } from '$lib/core/utils/clipboard'
  import { formatRelative, nodeStatusVariant, formatDate, formatBinaryVersion } from '$lib/core/utils/format'
  import type { ServiceNode } from '$lib/core/api/types'
  import ArrowLeft from '@lucide/svelte/icons/arrow-left'
  import Copy from '@lucide/svelte/icons/copy'
  import Check from '@lucide/svelte/icons/check'
  import { POLL_OPTIONS } from '$lib/core/utils/options'

  let { regionId, nodeId, basePath }: { regionId: number; nodeId: string; basePath: string } = $props()

  const nodeStore = useNodes()
  const clusterStore = useClusters()
  const storageStore = useStorages()
  const accountStore = useAccounts()
  const alertStore = useRegionAlerts(() => regionId, () => nodeId)
  const auditStore = useRegionAuditLogs()
  const auth = useAuth()
  const canReadAlerts = $derived(auth.can('alerts', 'read'))
  const canReadAuditLogs = $derived(auth.can('auditLogs', 'read'))

  const node = $derived<ServiceNode | undefined>(nodeStore.nodes.find(n => n.nodeId === nodeId))
  const clusterLabel = $derived.by(() => {
    if (!node?.regionClusterId) return null
    const c = clusterStore.clustersFor(regionId).find(x => x.id === node.regionClusterId)
    return c?.name ?? `#${node.regionClusterId}`
  })

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
      nodeStore.startPolling({ regionId, nodeId, interval })
    } else {
      nodeStore.stopPolling()
      nodeStore.fetchStats(regionId, nodeId)
      nodeStore.fetchStatsHistory(regionId, nodeId)
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

  // Cluster list is needed to translate node.regionClusterId → name.
  // Hub regions don't carry clusters; this is a no-op for them.
  $effect(() => {
    if (regionId && node && node.serviceType !== 'hub') {
      clusterStore.fetchClusters(regionId).catch(() => { /* non-fatal; falls back to numeric id */ })
    }
  })

  const nodeProcessId = $derived(node?.metadata?.['processId'] ?? null)
  const nodeBinaryVersion = $derived(node?.binaryVersion != null ? formatBinaryVersion(node.binaryVersion) : null)
  const nodeCommitHash = $derived(node?.metadata?.['commitHash'] ? String(node.metadata['commitHash']) : null)
  const instanceInfo = $derived(node?.instanceInfo ?? null)

  // The service's live "# Config" block (service, build time, go version, srpc port, ...)
  // folds into Node Info instead of its own card. "version" is dropped here since
  // node.binaryVersion already surfaces as "Version" above.
  const configEntries = $derived.by<{ key: string; label: string; text: string }[]>(() => {
    if (!nodeStore.statsRaw) return []
    const configSection = parseMetrics(nodeStore.statsRaw).find(s => s.name === 'Config' && s.kind === 'scalar')
    if (!configSection) return []
    return configSection.scalars
      .filter(e => e.name !== 'version')
      .map(e => ({ key: e.name, label: humanizeKey(e.name), text: fmtScalar(e.name, e.value) }))
  })

  // Node metadata is service-specific; render it as labeled fields (not raw JSON).
  // Known keys (mostly blockserv) get friendly labels, ordering and typed rendering;
  // unknown keys fall back to a humanized label so any service stays readable.
  type MetaKind = 'badge' | 'mono' | 'text'
  type BadgeVariant = 'success' | 'warning' | 'secondary'
  type MetaEntry = {
    key: string; label: string; kind: MetaKind; text: string
    variant?: BadgeVariant; copy?: boolean; wide?: boolean
  }

  const META_LABELS: Record<string, string> = {
    name: 'Block Volume',
    block_volume_id: 'Block Volume ID',
    storage_id: 'Storage ID',
    block_data_port: 'Data Port',
    block_peer_port: 'Peer Port',
    ha_synced: 'HA Sync',
    ready: 'Ready',
  }
  // Most operationally relevant first; everything else trails alphabetically.
  const META_ORDER = ['name', 'ready', 'ha_synced', 'block_data_port', 'block_peer_port', 'block_volume_id', 'storage_id']

  function humanizeKey(key: string): string {
    return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  }

  function toMetaEntry(key: string, value: unknown): MetaEntry {
    const label = META_LABELS[key] ?? humanizeKey(key)
    if (typeof value === 'boolean') {
      if (key === 'ha_synced') return { key, label, kind: 'badge', text: value ? 'Synced' : 'Pending', variant: value ? 'success' : 'warning' }
      if (key === 'ready') return { key, label, kind: 'badge', text: value ? 'Yes' : 'No', variant: value ? 'success' : 'warning' }
      return { key, label, kind: 'badge', text: value ? 'Yes' : 'No', variant: value ? 'success' : 'secondary' }
    }
    const text = String(value)
    if (key.endsWith('_id')) return { key, label, kind: 'mono', text, copy: true, wide: true }
    if (key.endsWith('_port')) return { key, label, kind: 'mono', text }
    return { key, label, kind: 'text', text }
  }

  const nodeMetaEntries = $derived.by<MetaEntry[]>(() => {
    if (!node?.metadata) return []
    const meta = node.metadata
    return Object.keys(meta)
      .filter((k) => k !== 'processId' && k !== 'commitHash')
      .sort((a, b) => {
        const ia = META_ORDER.indexOf(a)
        const ib = META_ORDER.indexOf(b)
        if (ia !== -1 || ib !== -1) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
        return a.localeCompare(b)
      })
      .map((k) => toMetaEntry(k, meta[k]))
  })

  // Volume group: the HA members serving the same block storage. blockserv nodes carry a
  // storage_id in metadata; siblings are the other region nodes sharing it. Built from the
  // already-fetched region nodes, so no extra request.
  const nodeStorageId = $derived(node?.metadata?.['storage_id'] ? String(node.metadata['storage_id']) : '')

  // Resolve the blockserv node's storage (its metadata carries the storage UUID, not the
  // numeric route id) so we can link back to the storage detail page.
  $effect(() => {
    const acct = accountStore.selectedAccountId
    if (nodeStorageId && acct) {
      storageStore.fetchStorages({ accountId: acct, page: 1, limit: 100, filters: { regionId } }).catch(() => { /* link just stays absent */ })
    }
  })
  const storageRef = $derived.by<{ id: number; name: string } | null>(() => {
    if (!nodeStorageId) return null
    const s = storageStore.storages.find((x) => x.uuid === nodeStorageId)
    return s ? { id: s.id, name: s.name } : null
  })
  function metaStr(n: ServiceNode, k: string): string { return String(n.metadata?.[k] ?? '') }
  function metaBool(n: ServiceNode, k: string): boolean { return n.metadata?.[k] === true }
  function memberClusterName(n: ServiceNode): string | null {
    if (!n.regionClusterId) return null
    const c = clusterStore.clustersFor(regionId).find((x) => x.id === n.regionClusterId)
    return c?.name ?? `#${n.regionClusterId}`
  }
  const volumeGroup = $derived.by<ServiceNode[]>(() => {
    if (!nodeStorageId) return []
    return nodeStore.nodes
      .filter((n) => metaStr(n, 'storage_id') === nodeStorageId)
      .sort((a, b) => {
        if (a.nodeId === nodeId) return -1
        if (b.nodeId === nodeId) return 1
        return metaStr(a, 'name').localeCompare(metaStr(b, 'name')) || a.nodeId.localeCompare(b.nodeId)
      })
  })

  let copiedKey = $state('')
  let copyTimer: ReturnType<typeof setTimeout>
  async function copyMeta(key: string, text: string) {
    if (await copyText(text)) {
      copiedKey = key
      clearTimeout(copyTimer)
      copyTimer = setTimeout(() => { copiedKey = '' }, 1500)
    }
  }

  onDestroy(() => {
    nodeStore.resetStats()
    clearTimeout(copyTimer)
  })
</script>

{#snippet nodeAlertsHeader()}
  <TableRow>
    <TableHead class="w-28">Severity</TableHead>
    <TableHead class="hidden sm:table-cell w-24">Category</TableHead>
    <TableHead>Title</TableHead>
    <TableHead class="hidden md:table-cell w-32">Time</TableHead>
    <TableHead class="w-20">Status</TableHead>
  </TableRow>
{/snippet}

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
          {#if clusterLabel}
            <div>
              <dt class="text-muted-foreground text-sm">Cluster</dt>
              <dd class="mt-0.5">
                <a
                  href={`/regions/${regionId}?cluster=${node.regionClusterId}`}
                  aria-label="View region filtered by cluster {clusterLabel}"
                  class="inline-flex items-center font-mono text-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                >{clusterLabel}</a>
              </dd>
            </div>
          {/if}
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
          {#if nodeBinaryVersion}
            <div>
              <dt class="text-muted-foreground text-sm">Version</dt>
              <dd class="font-mono text-sm mt-0.5">{nodeBinaryVersion}</dd>
            </div>
          {/if}
          {#if nodeCommitHash}
            <div>
              <dt class="text-muted-foreground text-sm">Commit</dt>
              <dd class="font-mono text-sm mt-0.5">{nodeCommitHash}</dd>
            </div>
          {/if}
          {#each configEntries as c (c.key)}
            <div>
              <dt class="text-muted-foreground text-sm">{c.label}</dt>
              <dd class="font-mono text-sm mt-0.5">{c.text}</dd>
            </div>
          {/each}
          {#each nodeMetaEntries as m (m.key)}
            <div class={m.wide ? 'col-span-full' : ''}>
              <dt class="text-muted-foreground text-sm">{m.label}</dt>
              <dd class="mt-0.5">
                {#if m.kind === 'badge'}
                  <Badge variant={m.variant}>{m.text}</Badge>
                {:else if m.copy}
                  <div class="flex items-center gap-1.5">
                    <code class="font-mono text-sm break-all">{m.text}</code>
                    <Button
                      variant="ghost" size="icon" class="h-6 w-6 min-h-[44px] min-w-[44px] sm:min-h-6 sm:min-w-6 shrink-0"
                      aria-label={copiedKey === m.key ? `${m.label} copied` : `Copy ${m.label}`}
                      onclick={() => copyMeta(m.key, m.text)}
                    >
                      {#if copiedKey === m.key}
                        <Check class="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                      {:else}
                        <Copy class="h-3.5 w-3.5" aria-hidden="true" />
                      {/if}
                    </Button>
                  </div>
                {:else if m.kind === 'mono'}
                  <span class="font-mono text-sm">{m.text}</span>
                {:else}
                  <span class="text-sm">{m.text}</span>
                {/if}
              </dd>
            </div>
          {/each}
          {#if storageRef}
            <div>
              <dt class="text-muted-foreground text-sm">Storage</dt>
              <dd class="mt-0.5">
                <a
                  href={`/storages/${storageRef.id}`}
                  aria-label="View storage {storageRef.name} details"
                  class="inline-flex items-center font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                >{storageRef.name}</a>
              </dd>
            </div>
          {/if}
        </dl>
      </CardContent>
    </Card>

    {#if nodeStorageId && volumeGroup.length > 0}
      <Card>
        <CardHeader>
          <div class="flex items-center justify-between gap-2">
            <CardTitle class="text-base">Volume Group</CardTitle>
            <Badge variant={volumeGroup.length > 1 ? 'outline' : 'secondary'}>
              {volumeGroup.length} member{volumeGroup.length > 1 ? 's' : ''}
            </Badge>
          </div>
        </CardHeader>
        <CardContent class="pt-0">
          <p class="text-sm text-muted-foreground mb-3">
            HA members serving the same block storage{volumeGroup.length === 1 ? ' (single-node, no replica)' : ''}.
          </p>
          <Table>
            <caption class="sr-only">Block volume group members</caption>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead class="hidden sm:table-cell w-32">Cluster</TableHead>
                <TableHead class="w-40">Replication</TableHead>
                <TableHead class="hidden md:table-cell w-20">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {#each volumeGroup as m (m.nodeId)}
                {@const isCurrent = m.nodeId === nodeId}
                {@const memberName = metaStr(m, 'name') || m.nodeId}
                {@const cluster = memberClusterName(m)}
                <TableRow class={isCurrent ? 'bg-muted/40' : ''}>
                  <TableCell>
                    <div class="flex items-center gap-2">
                      {#if isCurrent}
                        <span class="font-medium">{memberName}</span>
                        <Badge variant="outline" class="text-[0.65rem]">this node</Badge>
                      {:else}
                        <a href={`${basePath}/${regionId}/${m.nodeId}`}
                          class="font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                        >{memberName}</a>
                      {/if}
                    </div>
                    {#if metaStr(m, 'block_volume_id')}
                      <div class="font-mono text-xs text-muted-foreground truncate">{metaStr(m, 'block_volume_id')}</div>
                    {/if}
                  </TableCell>
                  <TableCell class="hidden sm:table-cell">
                    {#if cluster && m.regionClusterId}
                      <a
                        href={`/regions/${regionId}?cluster=${m.regionClusterId}`}
                        aria-label="View region filtered by cluster {cluster}"
                        class="font-mono text-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                      >{cluster}</a>
                    {:else}
                      <span class="font-mono text-sm text-muted-foreground">·</span>
                    {/if}
                  </TableCell>
                  <TableCell>
                    <div class="flex flex-wrap gap-1">
                      <Badge variant={metaBool(m, 'ready') ? 'success' : 'warning'}>
                        {metaBool(m, 'ready') ? 'Ready' : 'Not ready'}
                      </Badge>
                      <Badge variant={metaBool(m, 'ha_synced') ? 'success' : 'secondary'}>
                        {metaBool(m, 'ha_synced') ? 'Synced' : 'Unsynced'}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell class="hidden md:table-cell">
                    <Badge variant={nodeStatusVariant(m.status)}>{m.status}</Badge>
                  </TableCell>
                </TableRow>
              {/each}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    {/if}
  {/if}

  {#if node && (node.status !== 'healthy' || !node.isActive)}
    <Card>
      <CardHeader><CardTitle class="text-base">Metrics</CardTitle></CardHeader>
      <CardContent class="pt-0">
        <p class="text-sm text-muted-foreground">Metrics unavailable; node is {node.status}{!node.isActive ? ' (inactive)' : ''}.</p>
      </CardContent>
    </Card>
    {#if instanceInfo}
      <InstanceInfoPanel info={instanceInfo} />
    {/if}
  {:else if nodeStore.statsLoading && !nodeStore.statsLastUpdated}
    <DetailSkeleton cards={[{ rows: 4, cols: 3, title: true }]} />
  {:else if nodeStore.statsError}
    <Card>
      <CardContent>
        <p class="text-sm text-destructive">{nodeStore.statsError}</p>
      </CardContent>
    </Card>
  {:else if nodeStore.statsRaw}
    <ServiceMetricsView raw={nodeStore.statsRaw}
      alertsCount={canReadAlerts ? (alertStore.activeCount || alertStore.alerts.length) : 0}
      systemTab={systemTabSnippet}
      instanceTab={instanceInfo ? instanceTabSnippet : undefined}
      alertsTab={canReadAlerts ? alertsTabSnippet : undefined}
      activityTab={canReadAuditLogs ? activityTabSnippet : undefined}
    />

    {#snippet systemTabSnippet(cpuCores: number)}
      <NodeStatsHistoryChart samples={nodeStore.statsHistory} intervalMs={nodeStore.statsHistoryIntervalMs}
        {cpuCores} loading={nodeStore.statsHistoryLoading} error={nodeStore.statsHistoryError} />
    {/snippet}

    {#snippet instanceTabSnippet()}
      {#if instanceInfo}
        <InstanceInfoPanel info={instanceInfo} />
      {/if}
    {/snippet}

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
            <TableSkeleton
              header={nodeAlertsHeader}
              caption="Loading node alerts"
              rows={3}
              cells={[
                { width: 'w-16', height: 'h-5' },
                { width: 'w-14', class: 'hidden sm:table-cell' },
                { width: 'w-48' },
                { width: 'w-20', class: 'hidden md:table-cell' },
                { width: 'w-16', height: 'h-5' },
              ]}
            />
          {:else if alertStore.error}
            <p class="text-sm text-destructive">{alertStore.error}</p>
          {:else if alertStore.alerts.length === 0}
            <p class="text-sm text-muted-foreground">No alerts for this node.</p>
          {:else}
            <Table>
              <caption class="sr-only">Node alerts</caption>
              <TableHeader>
                {@render nodeAlertsHeader()}
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
