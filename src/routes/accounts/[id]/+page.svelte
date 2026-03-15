<script lang="ts">
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { useAccounts } from '$lib/core/stores/accounts.svelte'
  import { useAuth } from '$lib/core/stores/auth.svelte'
  import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '$lib/components/ui/card'
  import { Button } from '$lib/components/ui/button'
  import AccountIcon from '$lib/components/shared/AccountIcon.svelte'
  import StatusBadge from '$lib/components/shared/StatusBadge.svelte'
  import ConfirmDialog from '$lib/components/shared/ConfirmDialog.svelte'
  import LoadingSpinner from '$lib/components/shared/LoadingSpinner.svelte'
  import { formatDate } from '$lib/core/utils/format'
  import { showErrorToast } from '$lib/core/utils/toast'
  import { features } from '$lib/config/features'
  import type { Account } from '$lib/core/api/types'

  const store = useAccounts()
  const auth = useAuth()
  const id = $derived(Number($page.params.id))

  $effect(() => {
    if (!auth.loading && !auth.can('accounts', 'read')) {
      showErrorToast('Access denied')
      goto('/', { replaceState: true })
    }
  })
  let account = $state<Account | null>(null)
  let loading = $state(true)
  let confirmAction = $state<{ open: boolean; title: string; desc: string; action: () => Promise<void> }>({
    open: false, title: '', desc: '', action: async () => {},
  })

  $effect(() => {
    if (Number.isNaN(id)) { loading = false; return }
    loading = true
    store.getAccount(id).then(a => { account = a }).catch(() => { account = null }).finally(() => { loading = false })
  })

  function confirm(title: string, desc: string, action: () => Promise<void>) {
    confirmAction = { open: true, title, desc, action }
  }

  async function act(fn: () => Promise<void>) {
    await fn()
    account = await store.getAccount(id)
  }
</script>

<div class="space-y-6">
  <div class="flex items-center gap-4">
    <Button variant="ghost" size="sm" href="/accounts">Back</Button>
    <h2 class="text-2xl font-bold tracking-tight">Account Detail</h2>
  </div>

  {#if loading}
    <LoadingSpinner />
  {:else if account}
    <div class="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <div class="flex items-center gap-3">
            <AccountIcon {account} size={36} />
            <CardTitle>{account.name}</CardTitle>
          </div>
        </CardHeader>
        <CardContent class="space-y-3">
          <div>
            <span class="text-sm text-muted-foreground">Status</span>
            <div class="mt-1"><StatusBadge active={account.isActive} locked={account.locked} /></div>
          </div>
          <div>
            <span class="text-sm text-muted-foreground">Description</span>
            <p class="mt-1 text-sm">{account.description || '—'}</p>
          </div>
          <div>
            <span class="text-sm text-muted-foreground">Created</span>
            <p class="mt-1 text-sm">{formatDate(account.createdAt)}</p>
          </div>
        </CardContent>
        {#if auth.can('accounts', 'update')}
          <CardFooter class="gap-2">
            {#if account.isActive}
              <Button variant="outline" size="sm" onclick={() => confirm('Deactivate', `Deactivate "${account!.name}"?`, () => act(() => store.deactivateAccount(id)))}>Deactivate</Button>
            {:else}
              <Button variant="outline" size="sm" onclick={() => confirm('Activate', `Activate "${account!.name}"?`, () => act(() => store.activateAccount(id)))}>Activate</Button>
            {/if}
            {#if features.accountLock}
              {#if account.locked}
                <Button variant="outline" size="sm" onclick={() => confirm('Unlock', `Unlock "${account!.name}"?`, () => act(() => store.unlockAccount(id)))}>Unlock</Button>
              {:else}
                <Button variant="destructive" size="sm" onclick={() => confirm('Lock', `Lock "${account!.name}"?`, () => act(() => store.lockAccount(id)))}>Lock</Button>
              {/if}
            {/if}
          </CardFooter>
        {/if}
      </Card>

      {#if account.vendorInfo}
        <Card>
          <CardHeader><CardTitle>Vendor Info</CardTitle></CardHeader>
          <CardContent>
            <pre class="rounded-md bg-muted p-3 text-xs">{JSON.stringify(account.vendorInfo, null, 2)}</pre>
          </CardContent>
        </Card>
      {/if}
    </div>
  {:else}
    <p class="text-muted-foreground">Account not found.</p>
  {/if}
</div>

<ConfirmDialog bind:open={confirmAction.open} title={confirmAction.title} description={confirmAction.desc} onConfirm={confirmAction.action} />
