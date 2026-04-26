<script lang="ts">
  import { goto } from '$app/navigation'
  import { useUsers } from '$lib/core/stores/users.svelte'
  import { useAccounts } from '$lib/core/stores/accounts.svelte'
  import { useAuth } from '$lib/core/stores/auth.svelte'
  import { usePreferences } from '$lib/stores/preferences.svelte'
  import { debounce } from '$lib/utils'
  import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '$lib/components/ui/table'
  import { Input } from '$lib/components/ui/input'
  import Pagination from '$lib/components/shared/Pagination.svelte'
  import LoadingSpinner from '$lib/components/shared/LoadingSpinner.svelte'
  import EmptyState from '$lib/components/shared/EmptyState.svelte'
  import { showErrorToast } from '$lib/core/utils/toast'
  import StatusBadge from '$lib/components/shared/StatusBadge.svelte'
  import PageHeader from '$lib/components/shared/PageHeader.svelte'
  import FilterPanel from '$lib/components/shared/FilterPanel.svelte'
  import Plus from '@lucide/svelte/icons/plus'
  import Search from '@lucide/svelte/icons/search'

  const userStore = useUsers()
  const accountStore = useAccounts()
  const auth = useAuth()
  const prefs = usePreferences()
  const accountId = $derived(accountStore.selectedAccountId)

  let search = $state('')
  let activeSearch = $state('')

  function fetchPage(page = 1) {
    if (accountId) userStore.fetchUsers(accountId, page, prefs.pageSize, activeSearch || undefined)
  }

  const debouncedApplySearch = debounce(() => {
    activeSearch = search
  }, 300)

  $effect(() => {
    if (!auth.loading && !auth.can('users', 'read')) {
      showErrorToast('Access denied')
      goto('/', { replaceState: true })
      return
    }
    if (accountId) fetchPage()
  })

  function onSearchInput(e: Event) {
    search = (e.target as HTMLInputElement).value
    debouncedApplySearch()
  }
</script>

<svelte:head><title>Users · mountOS Admin</title></svelte:head>

<div class="space-y-4">
  <PageHeader title="Users" action={accountId && auth.can('users', 'create') ? { label: 'Add User', href: '/users/create', icon: Plus } : undefined} />

  {#if accountId}
    <FilterPanel class="max-w-full text-base">
      <div class="relative">
        <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
        <Input class="pl-8 w-64 text-base" placeholder="Search users..." value={search} oninput={onSearchInput} aria-label="Search users" />
      </div>
    </FilterPanel>
  {/if}

  {#if !accountId}
    <EmptyState title="Select an account" description="Choose an account to view its users." />
  {:else if userStore.loading}
    <LoadingSpinner />
  {:else if userStore.users.length === 0}
    <EmptyState title="No users" description={activeSearch ? 'No users match your search.' : 'No users found for this account.'} action={!activeSearch && auth.can('users', 'create') ? { label: 'Add User', href: '/users/create' } : undefined} />
  {:else}
    <Table>
      <caption class="sr-only">Users</caption>
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
          <TableRow class="cursor-pointer hover:bg-muted/50" role="link" onclick={() => goto(`/users/${user.id}`)} onkeydown={(e: KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), goto(`/users/${user.id}`))} tabindex={0} aria-label="User {user.username}">
            <TableCell class="font-medium max-w-[160px] truncate" title={user.username}>{user.username}</TableCell>
            <TableCell class="max-w-[160px] truncate" title={user.name}>{user.name}</TableCell>
            <TableCell class="text-muted-foreground max-w-[200px] truncate" title={user.email}>{user.email}</TableCell>
            <TableCell><StatusBadge active={user.isActive} /></TableCell>
          </TableRow>
        {/each}
      </TableBody>
    </Table>
    <Pagination currentPage={userStore.currentPage} totalPages={userStore.totalPages} onPageChange={(p) => fetchPage(p)} />
  {/if}
</div>
