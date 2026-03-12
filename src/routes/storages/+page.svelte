<script lang="ts">
  import { useStorages } from '$lib/core/stores/storages.svelte'
  import { useAccounts } from '$lib/core/stores/accounts.svelte'
  import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '$lib/components/ui/table'
  import { Button } from '$lib/components/ui/button'
  import { Badge } from '$lib/components/ui/badge'
  import StatusBadge from '$lib/components/shared/StatusBadge.svelte'
  import Pagination from '$lib/components/shared/Pagination.svelte'
  import LoadingSpinner from '$lib/components/shared/LoadingSpinner.svelte'
  import EmptyState from '$lib/components/shared/EmptyState.svelte'

  const storageStore = useStorages()
  const accountStore = useAccounts()
  const accountId = $derived(accountStore.selectedAccountId)

  $effect(() => { if (accountId) storageStore.fetchStorages(accountId) })
</script>

<div class="space-y-4">
  <h2 class="text-2xl font-bold tracking-tight">Storages</h2>
  {#if !accountId}
    <EmptyState title="Select an account" description="Choose an account to view its storages." />
  {:else if storageStore.loading}
    <LoadingSpinner />
  {:else if storageStore.storages.length === 0}
    <EmptyState title="No storages" />
  {:else}
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Provider</TableHead>
          <TableHead>Status</TableHead>
          <TableHead class="w-24"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {#each storageStore.storages as storage}
          <TableRow>
            <TableCell class="font-medium">{storage.name}</TableCell>
            <TableCell><Badge variant="outline">{storage.storageType}</Badge></TableCell>
            <TableCell><Badge variant="secondary">{storage.providerType}</Badge></TableCell>
            <TableCell><StatusBadge active={storage.isActive} /></TableCell>
            <TableCell><Button variant="ghost" size="sm" href="/storages/{storage.id}">View</Button></TableCell>
          </TableRow>
        {/each}
      </TableBody>
    </Table>
    <Pagination currentPage={storageStore.currentPage} totalPages={storageStore.totalPages} onPageChange={(p) => accountId && storageStore.fetchStorages(accountId, p)} />
  {/if}
</div>
