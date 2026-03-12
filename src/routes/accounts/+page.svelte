<script lang="ts">
  import { useAccounts } from '$lib/core/stores/accounts.svelte'
  import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '$lib/components/ui/table'
  import { Button } from '$lib/components/ui/button'
  import StatusBadge from '$lib/components/shared/StatusBadge.svelte'
  import Pagination from '$lib/components/shared/Pagination.svelte'
  import LoadingSpinner from '$lib/components/shared/LoadingSpinner.svelte'
  import EmptyState from '$lib/components/shared/EmptyState.svelte'
  import { formatDate } from '$lib/core/utils/format'

  const store = useAccounts()

  $effect(() => { store.fetchAccounts() })
</script>

<div class="space-y-4">
  <h2 class="text-2xl font-bold tracking-tight">Accounts</h2>

  {#if store.loading}
    <LoadingSpinner />
  {:else if store.accounts.length === 0}
    <EmptyState title="No accounts" description="No accounts have been created yet." />
  {:else}
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Created</TableHead>
          <TableHead class="w-24"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {#each store.accounts as account}
          <TableRow>
            <TableCell class="font-medium">{account.name}</TableCell>
            <TableCell><StatusBadge active={account.isActive} locked={account.locked} /></TableCell>
            <TableCell class="text-muted-foreground">{formatDate(account.createdAt)}</TableCell>
            <TableCell><Button variant="ghost" size="sm" href="/accounts/{account.id}">View</Button></TableCell>
          </TableRow>
        {/each}
      </TableBody>
    </Table>
    <Pagination currentPage={store.currentPage} totalPages={store.totalPages} onPageChange={(p) => store.fetchAccounts(p)} />
  {/if}
</div>
