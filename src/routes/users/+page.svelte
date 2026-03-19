<script lang="ts">
  import { goto } from '$app/navigation'
  import { useUsers } from '$lib/core/stores/users.svelte'
  import { useAccounts } from '$lib/core/stores/accounts.svelte'
  import { useAuth } from '$lib/core/stores/auth.svelte'
  import { usePreferences } from '$lib/stores/preferences.svelte'
  import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '$lib/components/ui/table'
  import Pagination from '$lib/components/shared/Pagination.svelte'
  import LoadingSpinner from '$lib/components/shared/LoadingSpinner.svelte'
  import EmptyState from '$lib/components/shared/EmptyState.svelte'
  import { Button } from '$lib/components/ui/button'
  import { showErrorToast } from '$lib/core/utils/toast'
  import StatusBadge from '$lib/components/shared/StatusBadge.svelte'
  import Plus from '@lucide/svelte/icons/plus'

  const userStore = useUsers()
  const accountStore = useAccounts()
  const auth = useAuth()
  const prefs = usePreferences()
  const accountId = $derived(accountStore.selectedAccountId)

  $effect(() => {
    if (!auth.loading && !auth.can('users', 'read')) {
      showErrorToast('Access denied')
      goto('/', { replaceState: true })
      return
    }
    if (accountId) userStore.fetchUsers(accountId, 1, prefs.pageSize)
  })
</script>

<div class="space-y-4">
  <div class="flex items-center justify-between">
    <h1 class="text-2xl font-bold tracking-tight">Users</h1>
    {#if accountId && auth.can('users', 'create')}
      <Button href="/users/create" size="sm" class="gap-1.5">
        <Plus class="h-4 w-4" />
        Add User
      </Button>
    {/if}
  </div>

  {#if !accountId}
    <EmptyState title="Select an account" description="Choose an account to view its users." />
  {:else if userStore.loading}
    <LoadingSpinner />
  {:else if userStore.users.length === 0}
    <EmptyState title="No users" description="No users found for this account." action={auth.can('users', 'create') ? { label: 'Add User', href: '/users/create' } : undefined} />
  {:else}
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead class="th-cyber">Username</TableHead>
          <TableHead class="th-cyber">Name</TableHead>
          <TableHead class="th-cyber">Email</TableHead>
          <TableHead class="th-cyber">Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {#each userStore.users as user}
          <TableRow class="cursor-pointer hover:bg-muted/50" onclick={() => goto(`/users/${user.id}`)} onkeydown={(e: KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), goto(`/users/${user.id}`))} role="link" tabindex={0}>
            <TableCell class="font-medium max-w-[160px] truncate">{user.username}</TableCell>
            <TableCell class="max-w-[160px] truncate">{user.name}</TableCell>
            <TableCell class="text-muted-foreground max-w-[200px] truncate">{user.email}</TableCell>
            <TableCell><StatusBadge active={user.isActive} /></TableCell>
          </TableRow>
        {/each}
      </TableBody>
    </Table>
    <Pagination currentPage={userStore.currentPage} totalPages={userStore.totalPages} onPageChange={(p) => accountId && userStore.fetchUsers(accountId, p, prefs.pageSize)} />
  {/if}
</div>
