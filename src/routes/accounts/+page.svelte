<script lang="ts">
  import { goto } from '$app/navigation'
  import { useAccounts } from '$lib/core/stores/accounts.svelte'
  import { useAuth } from '$lib/core/stores/auth.svelte'
  import { usePreferences } from '$lib/stores/preferences.svelte'
  import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '$lib/components/ui/table'
  import { Button } from '$lib/components/ui/button'
  import StatusBadge from '$lib/components/shared/StatusBadge.svelte'
  import Pagination from '$lib/components/shared/Pagination.svelte'
  import LoadingSpinner from '$lib/components/shared/LoadingSpinner.svelte'
  import EmptyState from '$lib/components/shared/EmptyState.svelte'
  import { formatDate } from '$lib/core/utils/format'
  import { showErrorToast } from '$lib/core/utils/toast'
  import Plus from '@lucide/svelte/icons/plus'
  import Eye from '@lucide/svelte/icons/eye'
  import Pencil from '@lucide/svelte/icons/pencil'

  const store = useAccounts()
  const auth = useAuth()
  const prefs = usePreferences()

  $effect(() => {
    if (!auth.loading && !auth.can('accounts', 'read')) {
      showErrorToast('Access denied')
      goto('/', { replaceState: true })
      return
    }
    store.fetchAccounts(1, prefs.pageSize)
  })
</script>

<div class="space-y-4">
  <div class="flex items-center justify-between">
    <h2 class="text-2xl font-bold tracking-tight">Accounts</h2>
    {#if auth.can('accounts', 'create')}
      <Button href="/accounts/create" size="sm" class="gap-1.5">
        <Plus class="h-4 w-4" />
        Create Account
      </Button>
    {/if}
  </div>

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
            <TableCell class="flex gap-1">
              {#if auth.can('accounts', 'update')}
                <Button variant="ghost" size="sm" href="/accounts/{account.id}?edit" class="gap-1.5">
                  <Pencil class="size-3.5" />Edit
                </Button>
              {/if}
              <Button variant="ghost" size="sm" href="/accounts/{account.id}" class="gap-1.5">
                <Eye class="size-3.5" />View
              </Button>
            </TableCell>
          </TableRow>
        {/each}
      </TableBody>
    </Table>
    <Pagination currentPage={store.currentPage} totalPages={store.totalPages} onPageChange={(p) => store.fetchAccounts(p, prefs.pageSize)} />
  {/if}
</div>
