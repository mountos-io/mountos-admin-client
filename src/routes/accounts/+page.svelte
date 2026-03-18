<script lang="ts">
  import { goto } from '$app/navigation'
  import { useAccounts } from '$lib/core/stores/accounts.svelte'
  import { useAuth } from '$lib/core/stores/auth.svelte'
  import { usePreferences } from '$lib/stores/preferences.svelte'
  import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '$lib/components/ui/table'
  import { Button } from '$lib/components/ui/button'
  import StatusBadge from '$lib/components/shared/StatusBadge.svelte'
  import ConfirmDialog from '$lib/components/shared/ConfirmDialog.svelte'
  import Pagination from '$lib/components/shared/Pagination.svelte'
  import LoadingSpinner from '$lib/components/shared/LoadingSpinner.svelte'
  import EmptyState from '$lib/components/shared/EmptyState.svelte'
  import { features } from '$lib/config/features'
  import { formatDate } from '$lib/core/utils/format'
  import { showErrorToast } from '$lib/core/utils/toast'
  import { useConfirmDialog } from '$lib/stores/confirm-dialog.svelte'
  import Plus from '@lucide/svelte/icons/plus'
  import Eye from '@lucide/svelte/icons/eye'
  import Pencil from '@lucide/svelte/icons/pencil'
  import Power from '@lucide/svelte/icons/power'
  import Lock from '@lucide/svelte/icons/lock'
  import LockOpen from '@lucide/svelte/icons/lock-open'
  import ArrowRightLeft from '@lucide/svelte/icons/arrow-right-left'

  const store = useAccounts()
  const auth = useAuth()
  const prefs = usePreferences()
  const dialog = useConfirmDialog(() => store.fetchAccounts(store.currentPage, prefs.pageSize))

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
    <h1 class="text-2xl font-bold tracking-tight">Accounts</h1>
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
          <TableHead class="w-auto"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {#each store.accounts as account}
          <TableRow>
            <TableCell class="font-medium max-w-[200px] truncate">{account.name}</TableCell>
            <TableCell><StatusBadge active={account.isActive} locked={account.locked} /></TableCell>
            <TableCell class="text-muted-foreground">{formatDate(account.createdAt)}</TableCell>
            <TableCell>
              <div class="flex justify-end gap-1">
                {#if auth.can('accounts', 'update')}
                  {#if account.isActive}
                    <Button
                      variant="ghost" size="sm"
                      title="Deactivate"
                      onclick={() => dialog.confirm('Deactivate', `Deactivate "${account.name}"?`, () => store.deactivateAccount(account.id))}
                    >
                      <Power class="size-3.5 text-muted-foreground" />
                    </Button>
                  {:else}
                    <Button
                      variant="ghost" size="sm"
                      title="Activate"
                      onclick={() => dialog.confirm('Activate', `Activate "${account.name}"?`, () => store.activateAccount(account.id))}
                    >
                      <Power class="size-3.5 text-success" />
                    </Button>
                  {/if}
                  {#if features.accountLock}
                    {#if account.locked}
                      <Button
                        variant="ghost" size="sm"
                        title="Unlock"
                        onclick={() => dialog.confirm('Unlock', `Unlock "${account.name}"?`, () => store.unlockAccount(account.id))}
                      >
                        <Lock class="size-3.5 text-destructive" />
                      </Button>
                    {:else}
                      <Button
                        variant="ghost" size="sm"
                        title="Lock"
                        onclick={() => dialog.confirm('Lock', `Lock "${account.name}"?`, () => store.lockAccount(account.id))}
                      >
                        <LockOpen class="size-3.5 text-muted-foreground" />
                      </Button>
                    {/if}
                  {/if}
                  <Button variant="ghost" size="sm" href="/accounts/{account.id}?edit" title="Edit">
                    <Pencil class="size-3.5" />
                  </Button>
                {/if}
                <Button variant="ghost" size="sm" href="/accounts/{account.id}" title="View">
                  <Eye class="size-3.5" />
                </Button>
                {#if account.id !== store.selectedAccountId}
                  <Button
                    variant="ghost" size="sm"
                    title="Switch to this account"
                    onclick={() => store.selectAccount(account.id)}
                  >
                    <ArrowRightLeft class="size-3.5" />
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

<ConfirmDialog bind:open={dialog.open} title={dialog.title} description={dialog.desc} onConfirm={dialog.action} />
