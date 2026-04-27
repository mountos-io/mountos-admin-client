<script lang="ts">
  import { onDestroy } from 'svelte'
  import { goto } from '$app/navigation'
  import { useRegions } from '$lib/core/stores/regions.svelte'
  import { useNodes } from '$lib/core/stores/nodes.svelte'
  import { useAuth } from '$lib/core/stores/auth.svelte'
  import { usePreferences } from '$lib/stores/preferences.svelte'
  import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '$lib/components/ui/table'
  import { Badge } from '$lib/components/ui/badge'
  import { Button } from '$lib/components/ui/button'
  import FilterSelect from '$lib/components/shared/FilterSelect.svelte'
  import Pagination from '$lib/components/shared/Pagination.svelte'
  import EmptyState from '$lib/components/shared/EmptyState.svelte'
  import TableSkeleton from '$lib/components/shared/TableSkeleton.svelte'
  import { showErrorToast } from '$lib/core/utils/toast'
  import { formatRelative, nodeStatusVariant } from '$lib/core/utils/format'
  import { poolUtilColor } from '$lib/core/utils/metrics'
  import { POLL_OPTIONS } from '$lib/core/utils/options'
  import { createActivePoll, type ActivePoll } from '$lib/core/utils/activePoll'
  import FilterPanel from '$lib/components/shared/FilterPanel.svelte'
  import Network from '@lucide/svelte/icons/network'

  const SERVICE_COLORS: Record<string, string> = {
    hub:           'var(--pastel-region)',
    dataserv:      'var(--pastel-user)',
    gcserv:        'var(--pastel-role)',
    fuseserv:      'var(--pastel-mount)',
    mfuse:         'var(--pastel-mount)',
    blockserv:     'var(--pastel-storage)',
    s3gatewayserv: 'var(--pastel-license)',
    csiserv:       'var(--pastel-session)',
  }

  function loadColor(v: number): string {
    if (v > 125) return 'var(--destructive)'
    if (v > 100) return 'var(--warning)'
    return 'var(--success)'
  }

  const regionStore = useRegions()
  const nodeStore = useNodes()
  const auth = useAuth()
  const prefs = usePreferences()

  let selectedRegionId = $state('')
  let currentPage = $state(1)
  let initialized = $state(false)

  const regionOptions = $derived([
    { value: '', label: 'All Regions' },
    ...regionStore.regions.map(r => ({ value: String(r.id), label: r.name })),
  ])

  const regionNameMap = $derived(
    new Map(regionStore.regions.map(r => [r.id, r.name]))
  )

  const SERVICE_TYPE_OPTIONS = [
    { value: '', label: 'All Types' },
    { value: 'hub', label: 'appserv' },
    { value: 'dataserv', label: 'dataserv' },
    { value: 'gcserv', label: 'gcserv' },
    { value: 'fuseserv', label: 'fuseserv' },
    { value: 'blockserv', label: 'blockserv' },
    { value: 's3gatewayserv', label: 's3gatewayserv' },
    { value: 'csiserv', label: 'csiserv' },
    { value: 'mfuse', label: 'mfuse' },
  ] as const

  const STATUS_OPTIONS = [
    { value: '', label: 'All Statuses' },
    { value: 'healthy', label: 'Healthy' },
    { value: 'registered', label: 'Registered' },
    { value: 'unhealthy', label: 'Unhealthy' },
    { value: 'draining', label: 'Draining' },
  ] as const

  const ACTIVITY_OPTIONS = [
    { value: '', label: 'All Activity' },
    { value: '6', label: 'Inactive ≤ 6h' },
    { value: '12', label: 'Inactive ≤ 12h' },
    { value: '24', label: 'Inactive ≤ 1d' },
    { value: '72', label: 'Inactive ≤ 3d' },
    { value: '168', label: 'Inactive ≤ 7d' },
    { value: '360', label: 'Inactive ≤ 15d' },
  ] as const

  let pollValue = $state('')
  let poll: ActivePoll | null = null

  function setPoll(v: string) {
    pollValue = v
    poll?.stop()
    poll = null
    const secs = Number(v)
    if (secs > 0) {
      poll = createActivePoll(() => nodeStore.refetch(), secs * 1000)
      poll.start()
    }
  }

  onDestroy(() => poll?.stop())

  const activityValue = $derived(nodeStore.inactiveHours != null ? String(nodeStore.inactiveHours) : '')

  const totalPages = $derived(Math.max(1, Math.ceil(nodeStore.nodes.length / prefs.pageSize)))
  const pagedNodes = $derived(nodeStore.nodes.slice((currentPage - 1) * prefs.pageSize, currentPage * prefs.pageSize))

  $effect(() => {
    if (!auth.loading && !auth.can('serviceNodes', 'read')) {
      showErrorToast('Access denied')
      goto('/', { replaceState: true })
      return
    }
    regionStore.fetchRegions()
  })

  $effect(() => {
    if (initialized || !regionStore.regions.length) return
    initialized = true
    nodeStore.clearFilters()
    nodeStore.fetchAllNodes()
  })

  function onRegionChange(v: string) {
    if (poll) { poll.stop(); poll = null; pollValue = '' }
    selectedRegionId = v
    currentPage = 1
    nodeStore.clearFilters()
    if (v) nodeStore.fetchNodes(Number(v))
    else nodeStore.fetchAllNodes()
  }

  function onTypeChange(v: string) {
    if (poll) { poll.stop(); poll = null; pollValue = '' }
    currentPage = 1
    nodeStore.setServiceType(v)
  }

  function onStatusChange(v: string) {
    if (poll) { poll.stop(); poll = null; pollValue = '' }
    currentPage = 1
    nodeStore.setStatus(v)
  }
</script>

<svelte:head><title>Nodes · mountOS Admin</title></svelte:head>

<div class="space-y-4">
  <h1 class="text-2xl font-bold tracking-tight">Nodes</h1>

  <FilterPanel class="max-w-full text-base">
    <FilterSelect class="text-base"
      options={regionOptions}
      value={selectedRegionId}
      placeholder="All Regions"
      onchange={onRegionChange}
    />
    <FilterSelect class="text-base"
      options={SERVICE_TYPE_OPTIONS}
      value={nodeStore.serviceType}
      placeholder="All Types"
      onchange={onTypeChange}
    />
    <FilterSelect class="text-base"
      options={STATUS_OPTIONS}
      value={nodeStore.status}
      placeholder="All Statuses"
      onchange={onStatusChange}
    />
    <FilterSelect class="text-base"
      options={ACTIVITY_OPTIONS}
      value={activityValue}
      placeholder="All Activity"
      onchange={(v) => { currentPage = 1; nodeStore.setInactiveHours(v ? Number(v) : undefined) }}
    />
    <FilterSelect class="text-base"
      options={POLL_OPTIONS}
      value={pollValue}
      placeholder="Poll Off"
      onchange={setPoll}
    />
    {#if selectedRegionId}
      <Button variant="outline" size="sm" class="gap-1.5 font-normal text-muted-foreground text-base" href="/nodes/{selectedRegionId}">
        <Network class="h-4 w-4" />
        View Topology
      </Button>
    {/if}
  </FilterPanel>

  {#snippet headerRow()}
    <TableRow>
      <TableHead class="th-cyber">Node ID</TableHead>
      {#if !selectedRegionId}
        <TableHead class="th-cyber">Region</TableHead>
      {/if}
      <TableHead class="th-cyber">Type</TableHead>
      <TableHead class="th-cyber hidden md:table-cell">Address</TableHead>
      <TableHead class="th-cyber">Status</TableHead>
      <TableHead class="th-cyber hidden md:table-cell">Memory</TableHead>
      <TableHead class="th-cyber hidden md:table-cell">Load</TableHead>
      <TableHead class="th-cyber hidden lg:table-cell">Last Heartbeat</TableHead>
    </TableRow>
  {/snippet}

  {#if (regionStore.loading || nodeStore.loading) && nodeStore.nodes.length === 0}
    <TableSkeleton
      header={headerRow}
      caption="Loading nodes"
      cells={selectedRegionId
        ? [
            { width: 'w-32' },
            { width: 'w-20', height: 'h-5' },
            { width: 'w-32', class: 'hidden md:table-cell' },
            { width: 'w-16', height: 'h-5' },
            { width: 'w-12', class: 'hidden md:table-cell' },
            { width: 'w-12', class: 'hidden md:table-cell' },
            { width: 'w-20', class: 'hidden lg:table-cell' },
          ]
        : [
            { width: 'w-32' },
            { width: 'w-20' },
            { width: 'w-20', height: 'h-5' },
            { width: 'w-32', class: 'hidden md:table-cell' },
            { width: 'w-16', height: 'h-5' },
            { width: 'w-12', class: 'hidden md:table-cell' },
            { width: 'w-12', class: 'hidden md:table-cell' },
            { width: 'w-20', class: 'hidden lg:table-cell' },
          ]}
    />
  {:else if nodeStore.nodes.length === 0}
    <EmptyState title="No nodes" description="No nodes found matching the current filters." />
  {:else}
    <Table>
      <caption class="sr-only">Service nodes</caption>
      <TableHeader>
        {@render headerRow()}
      </TableHeader>
      <TableBody>
        {#each pagedNodes as node}
          <TableRow
            class="cursor-pointer hover:bg-muted/50"
            role="button"
            onclick={() => goto(`/nodes/${node.regionId}/${node.nodeId}`)}
            onkeydown={(e: KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), goto(`/nodes/${node.regionId}/${node.nodeId}`))}
            tabindex={0}
            aria-label="Node {node.nodeId}"
          >
            <TableCell class="font-mono text-sm">{node.nodeId}</TableCell>
            {#if !selectedRegionId}
              <TableCell>
                <button
                  type="button"
                  class="text-sm hover:underline"
                  onclick={(e: MouseEvent) => { e.stopPropagation(); goto(`/nodes/${node.regionId}`) }}
                  onkeydown={(e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); goto(`/nodes/${node.regionId}`) } }}
                >
                  {regionNameMap.get(node.regionId) ?? node.regionId}
                </button>
              </TableCell>
            {/if}
            <TableCell>
              <Badge variant="outline" class="font-mono text-xs" style="color: {SERVICE_COLORS[node.serviceType] ?? 'inherit'}; border-color: {SERVICE_COLORS[node.serviceType] ?? 'var(--border)'};">{node.serviceType}</Badge>
            </TableCell>
            <TableCell class="font-mono text-sm text-muted-foreground hidden md:table-cell">{node.advertiseAddr}</TableCell>
            <TableCell><Badge variant={nodeStatusVariant(node.status)}>{node.status}</Badge></TableCell>
            <TableCell class="font-mono text-sm hidden md:table-cell">
              {#if node.memUsage != null}
                <span style="color: {poolUtilColor(Math.round(node.memUsage * 100))}">{Math.round(node.memUsage * 100)}%</span>
              {:else}
                <span class="text-muted-foreground">·</span>
              {/if}
            </TableCell>
            <TableCell class="font-mono text-sm hidden md:table-cell">
              {#if node.sysLoad != null}
                <span style="color: {loadColor(node.sysLoad)}">{node.sysLoad}%</span>
              {:else}
                <span class="text-muted-foreground">·</span>
              {/if}
            </TableCell>
            <TableCell class="text-sm text-muted-foreground hidden lg:table-cell">
              {node.lastHeartbeat ? formatRelative(node.lastHeartbeat) : '·'}
            </TableCell>
          </TableRow>
        {/each}
      </TableBody>
    </Table>
    <Pagination {currentPage} {totalPages} onPageChange={(p) => currentPage = p} />
  {/if}
</div>
