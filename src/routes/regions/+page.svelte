<script lang="ts">
  import { useRegions } from '$lib/core/stores/regions.svelte'
  import { usePreferences } from '$lib/stores/preferences.svelte'
  import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '$lib/components/ui/table'
  import { Button } from '$lib/components/ui/button'
  import StatusBadge from '$lib/components/shared/StatusBadge.svelte'
  import Pagination from '$lib/components/shared/Pagination.svelte'
  import LoadingSpinner from '$lib/components/shared/LoadingSpinner.svelte'
  import EmptyState from '$lib/components/shared/EmptyState.svelte'
  import ConfirmDialog from '$lib/components/shared/ConfirmDialog.svelte'
  import { formatDate } from '$lib/core/utils/format'

  const store = useRegions()
  const prefs = usePreferences()
  let confirmAction = $state<{ open: boolean; title: string; desc: string; action: () => Promise<void> }>({
    open: false, title: '', desc: '', action: async () => {},
  })

  $effect(() => { store.fetchRegions(1, prefs.pageSize) })

  function toggle(region: { id: number; name: string; isActive: boolean }) {
    const act = region.isActive ? 'Deactivate' : 'Activate'
    confirmAction = {
      open: true, title: `${act} Region`, desc: `${act} "${region.name}"?`,
      action: async () => { region.isActive ? await store.deactivateRegion(region.id) : await store.activateRegion(region.id) },
    }
  }
</script>

<div class="space-y-4">
  <h2 class="text-2xl font-bold tracking-tight">Regions</h2>
  {#if store.loading}
    <LoadingSpinner />
  {:else if store.regions.length === 0}
    <EmptyState title="No regions" />
  {:else}
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Export ID</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Created</TableHead>
          <TableHead class="w-24"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {#each store.regions as region}
          <TableRow>
            <TableCell class="font-medium">{region.name}</TableCell>
            <TableCell class="font-mono text-xs">{region.exportId}</TableCell>
            <TableCell><StatusBadge active={region.isActive} /></TableCell>
            <TableCell class="text-muted-foreground">{formatDate(region.createdAt)}</TableCell>
            <TableCell><Button variant="ghost" size="sm" onclick={() => toggle(region)}>{region.isActive ? 'Deactivate' : 'Activate'}</Button></TableCell>
          </TableRow>
        {/each}
      </TableBody>
    </Table>
    <Pagination currentPage={store.currentPage} totalPages={store.totalPages} onPageChange={(p) => store.fetchRegions(p, prefs.pageSize)} />
  {/if}
</div>
<ConfirmDialog bind:open={confirmAction.open} title={confirmAction.title} description={confirmAction.desc} onConfirm={confirmAction.action} />
