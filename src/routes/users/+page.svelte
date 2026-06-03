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
  import EmptyState from '$lib/components/shared/EmptyState.svelte'
  import TableSkeleton from '$lib/components/shared/TableSkeleton.svelte'
  import { showErrorToast } from '$lib/core/utils/toast'
  import StatusBadge from '$lib/components/shared/StatusBadge.svelte'
  import PageHeader from '$lib/components/shared/PageHeader.svelte'
  import FilterPanel from '$lib/components/shared/FilterPanel.svelte'
  import FilterSelect from '$lib/components/shared/FilterSelect.svelte'
  import Plus from '@lucide/svelte/icons/plus'
  import Search from '@lucide/svelte/icons/search'

  const userStore = useUsers()
  const accountStore = useAccounts()
  const auth = useAuth()
  const prefs = usePreferences()
  const accountId = $derived(accountStore.selectedAccountId)

  let search = $state('')
  let activeSearch = $state('')
  let statusFilter = $state<'active' | 'inactive' | 'all'>('active')
  const statusOptions = [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'all', label: 'All' },
  ]
  const hasFilter = $derived(activeSearch !== '' || statusFilter !== 'active')

  function fetchPage(page = 1) {
    if (accountId) userStore.fetchUsers(
      accountId, page, prefs.pageSize,
      activeSearch || undefined,
      statusFilter === 'all' ? undefined : statusFilter === 'active',
    )
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
    void statusFilter
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
      <FilterSelect
        options={statusOptions}
        value={statusFilter}
        placeholder="Active"
        label="Filter by status"
        onchange={(v) => (statusFilter = v as 'active' | 'inactive' | 'all')}
      />
    </FilterPanel>
  {/if}

  {#snippet headerRow()}
    <TableRow>
      <TableHead class="th-cyber">Username</TableHead>
      <TableHead class="th-cyber">Name</TableHead>
      <TableHead class="th-cyber">Email</TableHead>
      <TableHead class="th-cyber">Status</TableHead>
    </TableRow>
  {/snippet}

  {#if !accountId}
    <EmptyState title="Select an account" description="Choose an account to view its users." />
  {:else if userStore.loading}
    <TableSkeleton
      header={headerRow}
      caption="Loading users"
      cells={[
        { width: 'w-28' },
        { width: 'w-32' },
        { width: 'w-48' },
        { width: 'w-16', height: 'h-5' },
      ]}
    />
  {:else if userStore.users.length === 0}
    <EmptyState title="No users" description={hasFilter ? 'No users match the current filters.' : 'No users found for this account.'} action={!hasFilter && auth.can('users', 'create') ? { label: 'Add User', href: '/users/create' } : undefined} />
  {:else}
    <Table>
      <caption class="sr-only">Users</caption>
      <TableHeader>
        {@render headerRow()}
      </TableHeader>
      <TableBody>
        {#each userStore.users as user}
          <TableRow class={`relative cursor-pointer hover:bg-muted/50 ${user.isActive ? '' : 'bg-muted/40'}`}>
            <TableCell class="font-medium max-w-[160px] truncate" title={user.username}>
              <a href="/users/{user.id}" class="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring" aria-label="User {user.username}{user.isActive ? '' : ', deactivated'}">{user.username}</a>
            </TableCell>
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
