<script lang="ts">
  import { goto } from '$app/navigation'
  import { useStorages } from '$lib/core/stores/storages.svelte'
  import { useAccounts } from '$lib/core/stores/accounts.svelte'
  import { useAuth } from '$lib/core/stores/auth.svelte'
  import { usePreferences } from '$lib/stores/preferences.svelte'
  import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '$lib/components/ui/table'
  import { Button } from '$lib/components/ui/button'
  import { Badge } from '$lib/components/ui/badge'
  import StatusBadge from '$lib/components/shared/StatusBadge.svelte'
  import Pagination from '$lib/components/shared/Pagination.svelte'
  import LoadingSpinner from '$lib/components/shared/LoadingSpinner.svelte'
  import EmptyState from '$lib/components/shared/EmptyState.svelte'
  import { showErrorToast } from '$lib/core/utils/toast'
  import Plus from '@lucide/svelte/icons/plus'

  const storageStore = useStorages()
  const accountStore = useAccounts()
  const auth = useAuth()
  const prefs = usePreferences()
  const accountId = $derived(accountStore.selectedAccountId)

  $effect(() => {
    if (!auth.loading && !auth.can('storages', 'read')) {
      showErrorToast('Access denied')
      goto('/', { replaceState: true })
      return
    }
    if (accountId) storageStore.fetchStorages(accountId, 1, prefs.pageSize)
  })
</script>

<div class="space-y-4">
  <div class="flex items-center justify-between">
    <h1 class="text-2xl font-bold tracking-tight">Storages</h1>
    {#if accountId && auth.can('storages', 'create')}
      <Button href="/storages/create" size="sm" class="gap-1.5">
        <Plus class="h-4 w-4" />
        Create Storage
      </Button>
    {/if}
  </div>
  {#if !accountId}
    <EmptyState title="Select an account" description="Choose an account to view its storages." />
  {:else if storageStore.loading}
    <LoadingSpinner />
  {:else if storageStore.storages.length === 0}
    <EmptyState title="No storages" action={auth.can('storages', 'create') ? { label: 'Create Storage', href: '/storages/create' } : undefined} />
  {:else}
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead class="th-cyber">Name</TableHead>
          <TableHead class="th-cyber">Type</TableHead>
          <TableHead class="th-cyber">Provider</TableHead>
          <TableHead class="th-cyber">Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {#each storageStore.storages as storage}
          <TableRow class="cursor-pointer" onclick={() => goto(`/storages/${storage.id}`)}>
            <TableCell class="font-medium max-w-[200px] truncate">{storage.name}</TableCell>
            <TableCell><Badge variant="outline">{storage.storageType}</Badge></TableCell>
            <TableCell><Badge variant="secondary">{storage.providerType}</Badge></TableCell>
            <TableCell><StatusBadge active={storage.isActive} /></TableCell>
          </TableRow>
        {/each}
      </TableBody>
    </Table>
    <Pagination currentPage={storageStore.currentPage} totalPages={storageStore.totalPages} onPageChange={(p) => accountId && storageStore.fetchStorages(accountId, p, prefs.pageSize)} />
  {/if}
</div>
