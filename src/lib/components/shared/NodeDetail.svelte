<script lang="ts">
  import { goto } from '$app/navigation'
  import { onDestroy, untrack } from 'svelte'
  import { useNodes } from '$lib/core/stores/nodes.svelte'
  import { useClusters } from '$lib/core/stores/clusters.svelte'
  import { useStorages } from '$lib/core/stores/storages.svelte'
  import { useAccounts } from '$lib/core/stores/accounts.svelte'
  import { useRegionAlerts } from '$lib/core/stores/regionAlerts.svelte'
  import { useRegionAuditLogs } from '$lib/core/stores/regionAudit.svelte'
  import { useGCWorkerEvents, DEFAULT_SINCE } from '$lib/core/stores/gcWorkerEvents.svelte'
  import WorkerEventsHistogram from '$lib/components/shared/WorkerEventsHistogram.svelte'
  import Combobox from '$lib/components/shared/Combobox.svelte'
  import { TIME_RANGES, SEVERITY_LABELS } from '$lib/core/stores/alerts.svelte'
  import { severityBadgeVariant, severityIcon } from '$lib/core/utils/alert'
  import { useAuth } from '$lib/core/stores/auth.svelte'
  import { Badge } from '$lib/components/ui/badge'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import FilterPanel from '$lib/components/shared/FilterPanel.svelte'
  import FilterSelect from '$lib/components/shared/FilterSelect.svelte'
  import InfoTip from '$lib/components/shared/InfoTip.svelte'
  import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card'
  import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '$lib/components/ui/table'
  import DetailSkeleton from '$lib/components/shared/DetailSkeleton.svelte'
  import TableSkeleton from '$lib/components/shared/TableSkeleton.svelte'
  import ActivityFeed from '$lib/components/shared/ActivityFeed.svelte'
  import Pagination from '$lib/components/shared/Pagination.svelte'
  import ServiceMetricsView from '$lib/components/shared/ServiceMetricsView.svelte'
  import NodeStatsHistoryChart from '$lib/components/shared/NodeStatsHistoryChart.svelte'
  import InstanceInfoPanel from '$lib/components/shared/InstanceInfoPanel.svelte'
  import { parseMetrics, fmtScalar } from '$lib/core/utils/metrics'
  import { showErrorToast } from '$lib/core/utils/toast'
  import { copyText } from '$lib/core/utils/clipboard'
  import { formatRelative, nodeStatusVariant, formatDate, formatBinaryVersion } from '$lib/core/utils/format'
  import type { ServiceNode, BlockVolume } from '$lib/core/api/types'
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
  const workerEventStore = useGCWorkerEvents(() => regionId, () => nodeId, () => node?.binaryVersion)
  // "All goals" first so clearing the combobox is a normal selection, not a
  // separate affordance.
  const goalOptions = $derived([
    { value: '', label: 'All goals' },
    ...workerEventStore.knownGoals.map(g => ({ value: g, label: g })),
  ])
  // sid-filter box is validated locally before it commits to the store: a
  // rejected keystroke (0, negative, decimal, non-integer, unsafe-large)
  // must not leave the box silently showing a value that was never applied.
  let sidFilterInput = $state('')
  let sidFilterInvalid = $state(false)
  const auth = useAuth()
  const canReadAlerts = $derived(auth.can('alerts', 'read'))
  const canReadAuditLogs = $derived(auth.can('auditLogs', 'read'))

  const node = $derived<ServiceNode | undefined>(nodeStore.nodes.find(n => n.nodeId === nodeId))
  // Worker events are gcserv-specific (per-goal cycle summaries); other
  // service types have nothing to show here.
  const isGCServ = $derived(node?.serviceType === 'gcserv')
  const clusterLabel = $derived.by(() => {
    if (!node?.metadataClusterId) return null
    const c = clusterStore.clustersFor(regionId).find(x => x.id === node.metadataClusterId)
    return c?.name ?? `#${node.metadataClusterId}`
  })

  let pollValue = $state('')

  const serviceTypeLabel = $derived.by(() => {
    const t = node?.serviceType
    if (t === 'hub') return 'Hub (appserv)'
    if (t === 'mfuse') return 'Client (mountos)'
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

  // fetchEvents() reads goalFilter/sidFilter/sinceFilter/page synchronously
  // (before its first await), so calling it untracked keeps this effect's
  // dependencies limited to isGCServ/regionId/nodeId; otherwise every
  // filter change (typed or selected) would itself be read as a dependency,
  // re-running this effect's cleanup (which resets those same filters) right
  // after the store's own setter just applied them. Same class of bug as
  // RegionTopology's fetchNodes/clearFilters loop.
  $effect(() => {
    const store = workerEventStore
    if (isGCServ && regionId && nodeId) {
      untrack(() => { store.fetchEvents(); store.fetchGoals() })
    }
    return () => untrack(() => {
      store.reset()
      // sidFilterInput/sidFilterInvalid mirror the store's sidFilter locally
      // (for invalid-keystroke feedback) and aren't covered by store.reset().
      // This component is reused, not remounted, across a node/region
      // switch (no {#key}), so without this the box would keep showing a
      // filter value that no longer applies to the new node.
      sidFilterInput = ''
      sidFilterInvalid = false
    })
  })

  $effect(() => {
    if (canReadAuditLogs && regionId && nodeId) {
      auditStore.fetchLogs(regionId, { node: nodeId, reset: true })
    }
    return () => auditStore.reset()
  })

  // Cluster list is needed to translate node.metadataClusterId → name.
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

  // The service's live "# Config" block (service, build time, go version, internal RPC port, ...)
  // folds into Node Info instead of its own card. "version" is dropped here since
  // node.binaryVersion already surfaces as "Version" above; "go_version" carries no
  // operator-actionable information and is dropped too.
  const configEntries = $derived.by<{ key: string; label: string; text: string }[]>(() => {
    if (!nodeStore.statsRaw) return []
    const configSection = parseMetrics(nodeStore.statsRaw).find(s => s.name === 'Config' && s.kind === 'scalar')
    if (!configSection) return []
    return configSection.scalars
      .filter(e => e.name !== 'version' && e.name !== 'go_version')
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
      // processId/commitHash/metrics_port/metrics_path surface elsewhere on this card;
      // storage_id folds into the linked "Storage" field below instead of a bare ID here.
      .filter((k) => k !== 'processId' && k !== 'commitHash' && k !== 'metrics_port' && k !== 'metrics_path' && k !== 'storage_id')
      .sort((a, b) => {
        const ia = META_ORDER.indexOf(a)
        const ib = META_ORDER.indexOf(b)
        if (ia !== -1 || ib !== -1) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
        return a.localeCompare(b)
      })
      .map((k) => toMetaEntry(k, meta[k]))
  })

  // A blockserv node's metadata carries the storage UUID and its own block-volume id;
  // resolve both to the storage's numeric route id (for the "Storage" link) and to this
  // member's own copyset pairing (for the "Copyset" link), not the whole storage's pool.
  const nodeStorageId = $derived(node?.metadata?.['storage_id'] ? String(node.metadata['storage_id']) : '')
  const nodeBlockVolumeId = $derived(node?.metadata?.['block_volume_id'] ? String(node.metadata['block_volume_id']) : '')

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

  // Copyset lookup needs the storage's numeric id first, so it only fires once storageRef
  // resolves. Pool members (not just this one) come back, but only this node's own
  // block_volume_id entry is used, never the whole pool.
  let blockVolumesById = $state<Map<string, BlockVolume>>(new Map())
  $effect(() => {
    const sid = storageRef?.id
    if (sid) {
      storageStore.listBlockVolumes(sid).then((volumes) => {
        blockVolumesById = new Map(volumes.map((v) => [v.id, v]))
      }).catch(() => { /* link just stays absent */ })
    }
  })
  const copysetId = $derived<string | null>(
    nodeBlockVolumeId ? blockVolumesById.get(nodeBlockVolumeId)?.copysetId ?? null : null,
  )

  let copiedKey = $state('')
  let copyTimer: ReturnType<typeof setTimeout>
  async function copyMeta(key: string, text: string) {
    if (await copyText(text)) {
      copiedKey = key
      clearTimeout(copyTimer)
      copyTimer = setTimeout(() => { copiedKey = '' }, 1500)
    }
  }

  // This component is reused (not remounted) across a node/region switch, so
  // a "just copied" indicator from the previous node must not survive onto
  // the new one, e.g. a metadata key with the same name on the new node
  // would otherwise show a stale "copied" checkmark it never earned.
  $effect(() => {
    void nodeId
    return () => {
      copiedKey = ''
      clearTimeout(copyTimer)
    }
  })

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
    <div class="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.15em] text-muted-foreground">
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
                  href={`/regions/${regionId}?cluster=${node.metadataClusterId}`}
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
          {#if node.metricsEndpoint}
            <div class="col-span-full">
              <dt class="text-muted-foreground text-sm">Metrics Endpoint</dt>
              <dd class="mt-0.5">
                <div class="flex items-center gap-1.5">
                  <code class="font-mono text-sm break-all">{node.metricsEndpoint}</code>
                  <Button
                    variant="ghost" size="icon" class="h-6 w-6 min-h-[44px] min-w-[44px] sm:min-h-6 sm:min-w-6 shrink-0"
                    aria-label={copiedKey === 'metricsEndpoint' ? 'Metrics Endpoint copied' : 'Copy Metrics Endpoint'}
                    onclick={() => copyMeta('metricsEndpoint', node.metricsEndpoint ?? '')}
                  >
                    {#if copiedKey === 'metricsEndpoint'}
                      <Check class="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                    {:else}
                      <Copy class="h-3.5 w-3.5" aria-hidden="true" />
                    {/if}
                  </Button>
                </div>
              </dd>
            </div>
          {/if}
          <div>
            <dt class="text-muted-foreground text-sm">Last Heartbeat</dt>
            <dd class="text-sm mt-0.5">{node.lastHeartbeat ? formatRelative(node.lastHeartbeat) : '·'}</dd>
          </div>
          <div>
            <dt class="text-muted-foreground text-sm">Active</dt>
            <dd class="mt-0.5">
              <Badge variant={node.isActive ? 'success' : 'primary'}>{node.isActive ? 'Yes' : 'No'}</Badge>
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
          {#if nodeStorageId}
            <div>
              <dt class="text-muted-foreground text-sm">Storage</dt>
              <dd class="mt-0.5">
                {#if storageRef}
                  <a
                    href={`/storages/${storageRef.id}`}
                    aria-label="View storage {storageRef.name} details"
                    class="inline-flex items-center font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                  >{storageRef.name}</a>
                {:else}
                  <span class="font-mono text-sm">{nodeStorageId}</span>
                {/if}
              </dd>
            </div>
          {/if}
          {#if nodeBlockVolumeId}
            <div>
              <dt class="text-muted-foreground text-sm">Copyset</dt>
              <dd class="mt-0.5">
                {#if storageRef && copysetId}
                  <a
                    href={`/storages/${storageRef.id}/copysets/${copysetId}`}
                    aria-label="View copyset {copysetId} details"
                    class="inline-flex items-center font-mono text-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                  >{copysetId}</a>
                {:else}
                  <span class="text-sm text-muted-foreground">Not paired</span>
                {/if}
              </dd>
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
      workerEventsTab={isGCServ ? workerEventsTabSnippet : undefined}
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

    {#snippet workerEventsTabSnippet()}
      <Card>
        <CardHeader>
          <CardTitle class="text-base">Worker Events</CardTitle>
        </CardHeader>
        <CardContent class="pt-0 space-y-4">
          <FilterPanel>
            <Combobox
              options={goalOptions}
              bind:value={() => workerEventStore.goalFilter, (v) => workerEventStore.setGoalFilter(v)}
              placeholder="Filter by goal"
              emptyText="No goals recorded for this node"
              aria-label="Filter by goal"
              class="h-8 w-80 text-sm"
            />
            <div class="flex flex-col gap-1">
              <div class="flex items-center gap-1">
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={sidFilterInput}
                  oninput={(e: Event) => {
                    const v = (e.currentTarget as HTMLInputElement).value
                    sidFilterInput = v
                    if (v === '') {
                      sidFilterInvalid = false
                      workerEventStore.setSidFilter(undefined)
                      return
                    }
                    const n = Number(v)
                    if (Number.isSafeInteger(n) && n > 0) {
                      sidFilterInvalid = false
                      workerEventStore.setSidFilter(n)
                    } else {
                      // Reject silently-stale state: an invalid keystroke must
                      // not leave the box showing a value that was never
                      // applied to the filter, so surface it instead.
                      sidFilterInvalid = true
                    }
                  }}
                  placeholder="Filter by volume ID"
                  aria-label="Filter by volume ID"
                  aria-invalid={sidFilterInvalid}
                  class="h-8 w-52 text-sm"
                />
                <InfoTip text="This is the volume's numeric ID. The breadcrumb (Dashboard > Volumes > #4) and the URL show it as **#4**." />
              </div>
              {#if sidFilterInvalid}
                <span class="text-xs text-destructive">Enter a whole number ≥ 1</span>
              {/if}
            </div>
            <FilterSelect
              options={TIME_RANGES}
              value={workerEventStore.sinceFilter}
              onchange={(v) => workerEventStore.setSinceFilter(v)}
              placeholder="Time range"
              label="Time range"
            />
            {#if workerEventStore.goalFilter || workerEventStore.sidFilter !== undefined || workerEventStore.sinceFilter !== DEFAULT_SINCE}
              <Button
                variant="ghost"
                size="sm"
                onclick={() => {
                  sidFilterInput = ''
                  sidFilterInvalid = false
                  workerEventStore.clearFilters()
                }}
              >
                Clear filters
              </Button>
            {/if}
          </FilterPanel>

          {#if workerEventStore.loading && workerEventStore.events.length === 0}
            <TableSkeleton
              header={workerEventsHeader}
              caption="Loading worker events"
              rows={3}
              cells={[
                { width: 'w-32' },
                { width: 'w-24', class: 'hidden sm:table-cell' },
                { width: 'w-24' },
                { width: 'w-64' },
                { width: 'w-16', class: 'hidden md:table-cell' },
              ]}
            />
          {:else if workerEventStore.error}
            <p class="text-sm text-destructive">{workerEventStore.error}</p>
          {:else if workerEventStore.events.length === 0}
            <p class="text-sm text-muted-foreground">No worker events recorded for this node in the selected range.</p>
          {:else}
            <WorkerEventsHistogram
              buckets={workerEventStore.histogram}
              bucketSeconds={workerEventStore.histogramBucketSeconds}
              rangeMs={workerEventStore.sinceRangeMs}
            />

            <Table>
              <caption class="sr-only">Worker events for this node</caption>
              <TableHeader>
                {@render workerEventsHeader()}
              </TableHeader>
              <TableBody>
                {#each workerEventStore.events as event (event.id)}
                  <TableRow>
                    <TableCell class="font-medium">{event.goal}</TableCell>
                    <TableCell class="hidden sm:table-cell">
                      {#if event.sid}
                        <span class="font-mono">{event.subject ?? `#${event.sid}`}</span>
                      {:else}
                        <span class="text-muted-foreground">&mdash;</span>
                      {/if}
                    </TableCell>
                    <TableCell class="text-muted-foreground whitespace-nowrap">{formatRelative(event.eventTime)}</TableCell>
                    <TableCell>
                      <span class="text-xs font-mono text-muted-foreground">
                        {Object.entries(event.ops).map(([k, v]) => `${k}=${v}`).join(', ')}
                      </span>
                    </TableCell>
                    <TableCell class="hidden md:table-cell text-muted-foreground whitespace-nowrap">{event.durationMs}ms</TableCell>
                  </TableRow>
                {/each}
              </TableBody>
            </Table>

            {#if workerEventStore.totalPages > 1}
              <Pagination
                currentPage={workerEventStore.page}
                totalPages={workerEventStore.totalPages}
                onPageChange={(p) => workerEventStore.setPage(p)}
              />
            {/if}
          {/if}
        </CardContent>
      </Card>
    {/snippet}

    {#snippet workerEventsHeader()}
      <TableRow>
        <TableHead>Goal</TableHead>
        <TableHead class="hidden sm:table-cell">Volume</TableHead>
        <TableHead>Time</TableHead>
        <TableHead>Ops</TableHead>
        <TableHead class="hidden md:table-cell">Duration</TableHead>
      </TableRow>
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
