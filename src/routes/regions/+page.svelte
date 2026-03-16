<script lang="ts">
  import { goto } from '$app/navigation'
  import { useRegions } from '$lib/core/stores/regions.svelte'
  import { useAccounts } from '$lib/core/stores/accounts.svelte'
  import { useAuth } from '$lib/core/stores/auth.svelte'
  import { usePreferences } from '$lib/stores/preferences.svelte'
  import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '$lib/components/ui/table'
  import { Button } from '$lib/components/ui/button'
  import StatusBadge from '$lib/components/shared/StatusBadge.svelte'
  import Pagination from '$lib/components/shared/Pagination.svelte'
  import LoadingSpinner from '$lib/components/shared/LoadingSpinner.svelte'
  import EmptyState from '$lib/components/shared/EmptyState.svelte'
  import ConfirmDialog from '$lib/components/shared/ConfirmDialog.svelte'
  import { formatDate } from '$lib/core/utils/format'
  import { showErrorToast, showSuccessToast } from '$lib/core/utils/toast'
  import Plus from '@lucide/svelte/icons/plus'
  import Power from '@lucide/svelte/icons/power'
  import Copy from '@lucide/svelte/icons/copy'
  import Lightbulb from '@lucide/svelte/icons/lightbulb'

  const store = useRegions()
  const accountStore = useAccounts()
  const auth = useAuth()
  const accountId = $derived(accountStore.selectedAccountId)
  const prefs = usePreferences()
  let confirmAction = $state<{ open: boolean; title: string; desc: string; action: () => Promise<void> }>({
    open: false, title: '', desc: '', action: async () => {},
  })

  $effect(() => {
    if (!auth.loading && !auth.can('regions', 'read')) {
      showErrorToast('Access denied')
      goto('/', { replaceState: true })
      return
    }
    store.fetchRegions(1, prefs.pageSize)
  })

  async function copyExportId(exportId: string) {
    try {
      await navigator.clipboard.writeText(exportId)
      showSuccessToast('Copied to clipboard')
    } catch {
      showErrorToast('Failed to copy')
    }
  }

  function toggle(region: { id: number; name: string; isActive: boolean }) {
    if (!auth.guard('regions', 'update')) return
    const act = region.isActive ? 'Deactivate' : 'Activate'
    confirmAction = {
      open: true, title: `${act} Region`, desc: `${act} "${region.name}"?`,
      action: async () => { region.isActive ? await store.deactivateRegion(region.id) : await store.activateRegion(region.id) },
    }
  }
</script>

<div class="space-y-4">
  <div class="flex items-center justify-between">
    <h2 class="text-2xl font-bold tracking-tight">Regions</h2>
    {#if accountId && auth.can('regions', 'create')}
      <Button href="/regions/create" size="sm" class="gap-1.5">
        <Plus class="h-4 w-4" />
        Create Region
      </Button>
    {/if}
  </div>
  {#if store.loading}
    <LoadingSpinner />
  {:else if store.regions.length === 0}
    <EmptyState title="No regions" />
  {:else}
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Base DNS</TableHead>
          <TableHead>
            <span class="inline-flex items-center gap-1">
              Export ID
              <Lightbulb class="size-3.5 text-amber-500" title="Set as env on service instances so appserv groups them under one regional umbrella" />
            </span>
          </TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Created</TableHead>
          <TableHead class="w-24"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {#each store.regions as region}
          <TableRow>
            <TableCell class="font-medium">{region.name}</TableCell>
            <TableCell class="font-mono text-xs">{region.dns}</TableCell>
            <TableCell>
              <span class="inline-flex items-center gap-1 font-mono text-xs">
                {region.exportId}
                <button
                  type="button"
                  title="Copy Export ID"
                  class="text-muted-foreground hover:text-foreground transition-colors"
                  onclick={() => copyExportId(region.exportId)}
                >
                  <Copy class="size-3" />
                </button>
              </span>
            </TableCell>
            <TableCell><StatusBadge active={region.isActive} /></TableCell>
            <TableCell class="text-muted-foreground">{formatDate(region.createdAt)}</TableCell>
            <TableCell>
              {#if auth.can('regions', 'update')}
                <Button
                  variant="ghost" size="sm"
                  title={region.isActive ? 'Deactivate' : 'Activate'}
                  onclick={() => toggle(region)}
                >
                  <Power class="size-3.5 {region.isActive ? 'text-muted-foreground' : 'text-emerald-500'}" />
                </Button>
              {/if}
            </TableCell>
          </TableRow>
        {/each}
      </TableBody>
    </Table>
    <Pagination currentPage={store.currentPage} totalPages={store.totalPages} onPageChange={(p) => store.fetchRegions(p, prefs.pageSize)} />
  {/if}
</div>
<ConfirmDialog bind:open={confirmAction.open} title={confirmAction.title} description={confirmAction.desc} onConfirm={confirmAction.action} />
