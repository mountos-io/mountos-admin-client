<script lang="ts">
  import { useUsers } from '$lib/core/stores/users.svelte'
  import { useAccounts } from '$lib/core/stores/accounts.svelte'
  import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '$lib/components/ui/table'
  import Pagination from '$lib/components/shared/Pagination.svelte'
  import LoadingSpinner from '$lib/components/shared/LoadingSpinner.svelte'
  import EmptyState from '$lib/components/shared/EmptyState.svelte'

  const userStore = useUsers()
  const accountStore = useAccounts()
  const accountId = $derived(accountStore.selectedAccountId)

  $effect(() => { if (accountId) userStore.fetchUsers(accountId) })
</script>

<div class="space-y-4">
  <h2 class="text-2xl font-bold tracking-tight">Users</h2>

  {#if !accountId}
    <EmptyState title="Select an account" description="Choose an account to view its users." />
  {:else if userStore.loading}
    <LoadingSpinner />
  {:else if userStore.users.length === 0}
    <EmptyState title="No users" description="No users found for this account." />
  {:else}
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Username</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {#each userStore.users as user}
          <TableRow>
            <TableCell class="font-medium">{user.username}</TableCell>
            <TableCell>{user.name}</TableCell>
            <TableCell class="text-muted-foreground">{user.email}</TableCell>
          </TableRow>
        {/each}
      </TableBody>
    </Table>
    <Pagination currentPage={userStore.currentPage} totalPages={userStore.totalPages} onPageChange={(p) => accountId && userStore.fetchUsers(accountId, p)} />
  {/if}
</div>
