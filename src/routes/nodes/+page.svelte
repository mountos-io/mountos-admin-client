<script lang="ts">
  import { goto } from '$app/navigation'
  import { useNodes } from '$lib/core/stores/nodes.svelte'
  import { useRegions } from '$lib/core/stores/regions.svelte'
  import { useAuth } from '$lib/core/stores/auth.svelte'
  import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '$lib/components/ui/table'
  import { Button } from '$lib/components/ui/button'
  import { Badge } from '$lib/components/ui/badge'
  import ConfirmDialog from '$lib/components/shared/ConfirmDialog.svelte'
  import LoadingSpinner from '$lib/components/shared/LoadingSpinner.svelte'
  import EmptyState from '$lib/components/shared/EmptyState.svelte'
  import { formatRelative, nodeStatusVariant } from '$lib/core/utils/format'
  import { showErrorToast } from '$lib/core/utils/toast'
  import { useConfirmDialog } from '$lib/stores/confirm-dialog.svelte'

  const nodeStore = useNodes()
  const regionStore = useRegions()
  const auth = useAuth()
  const dialog = useConfirmDialog(() => { if (nodeStore.selectedRegionId) nodeStore.fetchNodes(nodeStore.selectedRegionId) })

  $effect(() => {
    if (!auth.loading && !auth.can('serviceNodes', 'read')) {
      showErrorToast('Access denied')
      goto('/', { replaceState: true })
      return
    }
    regionStore.fetchRegions()
  })

  function selectRegion(regionId: number) {
    nodeStore.fetchNodes(regionId)
  }
</script>

<div class="space-y-4">
  <h1 class="text-2xl font-bold tracking-tight">Service Nodes</h1>

  <div class="flex gap-2 flex-wrap">
    {#each regionStore.regions as region}
      <Button
        variant={nodeStore.selectedRegionId === region.id ? 'default' : 'outline'}
        size="sm"
        onclick={() => selectRegion(region.id)}
      >{region.name}</Button>
    {/each}
  </div>

  {#if !nodeStore.selectedRegionId}
    <EmptyState title="Select a region" description="Choose a region to view its service nodes." />
  {:else if nodeStore.loading}
    <LoadingSpinner />
  {:else if nodeStore.nodes.length === 0}
    <EmptyState title="No nodes" description="No service nodes registered in this region." />
  {:else}
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Node ID</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Address</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Last Heartbeat</TableHead>
          <TableHead class="w-auto"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {#each nodeStore.nodes as node}
          <TableRow>
            <TableCell class="font-mono text-xs">{node.nodeId}</TableCell>
            <TableCell><Badge variant="outline">{node.serviceType}</Badge></TableCell>
            <TableCell class="font-mono text-xs">{node.advertiseAddr}</TableCell>
            <TableCell>
              <Badge variant={nodeStatusVariant(node.status)}>{node.status}</Badge>
            </TableCell>
            <TableCell class="text-sm text-muted-foreground">
              {node.lastHeartbeat ? formatRelative(node.lastHeartbeat) : '—'}
            </TableCell>
            <TableCell>
              <div class="flex gap-1">
                {#if auth.can('serviceNodes', 'update')}
                  {#if node.status !== 'draining'}
                    <Button variant="outline" size="sm" onclick={() => dialog.confirm(
                      'Drain Node', `Drain node "${node.nodeId}"?`,
                      () => nodeStore.drainNode(nodeStore.selectedRegionId!, node.nodeId),
                    )}>Drain</Button>
                  {/if}
                  {#if !node.isActive}
                    <Button variant="outline" size="sm" onclick={() => dialog.confirm(
                      'Activate Node', `Activate node "${node.nodeId}"?`,
                      () => nodeStore.activateNode(nodeStore.selectedRegionId!, node.nodeId),
                    )}>Activate</Button>
                  {/if}
                {/if}
                {#if auth.can('serviceNodes', 'delete')}
                  <Button variant="destructive" size="sm" onclick={() => dialog.confirm(
                    'Remove Node', `Remove node "${node.nodeId}"? This cannot be undone.`,
                    () => nodeStore.removeNode(nodeStore.selectedRegionId!, node.nodeId),
                  )}>Remove</Button>
                {/if}
              </div>
            </TableCell>
          </TableRow>
        {/each}
      </TableBody>
    </Table>
  {/if}
</div>
<ConfirmDialog bind:open={dialog.open} title={dialog.title} description={dialog.desc} onConfirm={dialog.action} />
