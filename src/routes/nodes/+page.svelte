<script lang="ts">
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
  import LoadingSpinner from '$lib/components/shared/LoadingSpinner.svelte'
  import EmptyState from '$lib/components/shared/EmptyState.svelte'
  import { showErrorToast } from '$lib/core/utils/toast'
  import { formatRelative, nodeStatusVariant } from '$lib/core/utils/format'
  import Network from '@lucide/svelte/icons/network'

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
    { value: 'appserv', label: 'appserv' },
    { value: 'dataserv', label: 'dataserv' },
    { value: 'gcserv', label: 'gcserv' },
    { value: 'fuseserv', label: 'fuseserv' },
    { value: 'blockserv', label: 'blockserv' },
    { value: 's3gatewayserv', label: 's3gatewayserv' },
    { value: 'csiserv', label: 'csiserv' },
    { value: 'mfuse', label: 'mfuse' },
    { value: 'hub', label: 'hub' },
  ] as const

  const STATUS_OPTIONS = [
    { value: '', label: 'All Statuses' },
    { value: 'healthy', label: 'Healthy' },
    { value: 'registered', label: 'Registered' },
    { value: 'unhealthy', label: 'Unhealthy' },
    { value: 'draining', label: 'Draining' },
  ] as const

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
    nodeStore.fetchAllNodes(regionStore.regions.map(r => r.id))
  })

  function onRegionChange(v: string) {
    selectedRegionId = v
    currentPage = 1
    nodeStore.clearFilters()
    if (v) nodeStore.fetchNodes(Number(v))
    else nodeStore.fetchAllNodes(regionStore.regions.map(r => r.id))
  }

  function onTypeChange(v: string) {
    currentPage = 1
    nodeStore.setServiceType(v)
  }

  function onStatusChange(v: string) {
    currentPage = 1
    nodeStore.setStatus(v)
  }
</script>

<div class="space-y-4">
  <div class="flex items-center justify-between">
    <h1 class="text-2xl font-bold tracking-tight">Nodes</h1>
    {#if selectedRegionId}
      <Button variant="outline" size="sm" class="gap-1.5" href="/nodes/{selectedRegionId}">
        <Network class="h-3.5 w-3.5" />
        View Topology
      </Button>
    {/if}
  </div>

  <div class="flex flex-wrap items-center gap-2">
    <FilterSelect
      options={regionOptions}
      value={selectedRegionId}
      placeholder="All Regions"
      onchange={onRegionChange}
    />
    <FilterSelect
      options={SERVICE_TYPE_OPTIONS}
      value={nodeStore.serviceType}
      placeholder="All Types"
      onchange={onTypeChange}
    />
    <FilterSelect
      options={STATUS_OPTIONS}
      value={nodeStore.status}
      placeholder="All Statuses"
      onchange={onStatusChange}
    />
  </div>

  {#if regionStore.loading || nodeStore.loading}
    <LoadingSpinner />
  {:else if nodeStore.nodes.length === 0}
    <EmptyState title="No nodes" description="No nodes found matching the current filters." />
  {:else}
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Node ID</TableHead>
          {#if !selectedRegionId}
            <TableHead>Region</TableHead>
          {/if}
          <TableHead>Type</TableHead>
          <TableHead>Address</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Last Heartbeat</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {#each pagedNodes as node}
          <TableRow
            class="cursor-pointer hover:bg-muted/50"
            onclick={() => goto(`/nodes/${node.regionId}/${node.nodeId}`)}
            onkeydown={(e: KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), goto(`/nodes/${node.regionId}/${node.nodeId}`))}
            role="link"
            tabindex={0}
          >
            <TableCell class="font-mono text-xs">{node.nodeId}</TableCell>
            {#if !selectedRegionId}
              <TableCell>
                <button
                  class="text-xs hover:underline"
                  onclick={(e: MouseEvent) => { e.stopPropagation(); goto(`/nodes/${node.regionId}`) }}
                  onkeydown={(e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); goto(`/nodes/${node.regionId}`) } }}
                >
                  {regionNameMap.get(node.regionId) ?? node.regionId}
                </button>
              </TableCell>
            {/if}
            <TableCell><Badge variant="outline">{node.serviceType}</Badge></TableCell>
            <TableCell class="font-mono text-xs text-muted-foreground">{node.advertiseAddr}</TableCell>
            <TableCell><Badge variant={nodeStatusVariant(node.status)}>{node.status}</Badge></TableCell>
            <TableCell class="text-xs text-muted-foreground">
              {node.lastHeartbeat ? formatRelative(node.lastHeartbeat) : '—'}
            </TableCell>
          </TableRow>
        {/each}
      </TableBody>
    </Table>
    <Pagination {currentPage} {totalPages} onPageChange={(p) => currentPage = p} />
  {/if}
</div>
