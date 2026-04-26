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
  import PageHeader from '$lib/components/shared/PageHeader.svelte'
  import Plus from '@lucide/svelte/icons/plus'
  import Pencil from '@lucide/svelte/icons/pencil'
  import ArrowRightLeft from '@lucide/svelte/icons/arrow-right-left'

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

<svelte:head><title>Accounts · mountOS Admin</title></svelte:head>

<div class="space-y-4">
  <PageHeader title="Accounts" action={auth.can('accounts', 'create') ? { label: 'Create Account', href: '/accounts/create', icon: Plus } : undefined} />

  {#if store.loading}
    <LoadingSpinner />
  {:else if store.accounts.length === 0}
    <EmptyState title="No accounts" description="No accounts have been created yet." action={auth.can('accounts', 'create') ? { label: 'Create Account', href: '/accounts/create' } : undefined} />
  {:else}
    <Table>
      <caption class="sr-only">Accounts</caption>
      <TableHeader>
        <TableRow>
          <TableHead class="th-cyber">Name</TableHead>
          <TableHead class="th-cyber">Status</TableHead>
          <TableHead class="th-cyber">Created</TableHead>
          <TableHead class="w-auto"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {#each store.accounts as account}
          <TableRow>
            <TableCell class="font-medium max-w-[200px]">
              <a href="/accounts/{account.id}" class="hover:text-primary truncate block transition-colors" title={account.name}>{account.name}</a>
            </TableCell>
            <TableCell><StatusBadge active={account.isActive} locked={account.locked} /></TableCell>
            <TableCell class="text-muted-foreground">{formatDate(account.createdAt)}</TableCell>
            <TableCell>
              <div class="flex justify-end gap-1">
                {#if auth.can('accounts', 'update')}
                  <Button variant="ghost" size="sm" href="/accounts/{account.id}?edit" title="Edit" aria-label="Edit">
                    <Pencil class="size-3.5" aria-hidden="true" />
                  </Button>
                {/if}
                {#if account.id !== store.selectedAccountId}
                  <Button
                    variant="ghost" size="sm"
                    title="Switch to this account" aria-label="Switch to this account"
                    onclick={() => store.selectAccount(account.id)}
                  >
                    <ArrowRightLeft class="size-3.5" aria-hidden="true" />
                  </Button>
                {/if}
              </div>
            </TableCell>
          </TableRow>
        {/each}
      </TableBody>
    </Table>
    <Pagination currentPage={store.currentPage} totalPages={store.totalPages} onPageChange={(p) => store.fetchAccounts(p, prefs.pageSize)} />
  {/if}
</div>

