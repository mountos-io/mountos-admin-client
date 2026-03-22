<script lang="ts">
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { useAccounts } from '$lib/core/stores/accounts.svelte'
  import { useAuth } from '$lib/core/stores/auth.svelte'
  import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '$lib/components/ui/card'
  import { Button } from '$lib/components/ui/button'
  import Input from '$lib/components/ui/input/input.svelte'
  import Label from '$lib/components/ui/label/label.svelte'
  import AccountIcon from '$lib/components/shared/AccountIcon.svelte'
  import { Badge } from '$lib/components/ui/badge'
  import StatusBadge from '$lib/components/shared/StatusBadge.svelte'
  import ConfirmDialog from '$lib/components/shared/ConfirmDialog.svelte'
  import LoadingSpinner from '$lib/components/shared/LoadingSpinner.svelte'
  import ActivityFeed from '$lib/components/shared/ActivityFeed.svelte'
  import ArrowLeft from '@lucide/svelte/icons/arrow-left'
  import PencilIcon from '@lucide/svelte/icons/pencil'
  import { formatDate } from '$lib/core/utils/format'
  import { showErrorToast, showSuccessToast, handleApiError } from '$lib/core/utils/toast'
  import { useConfirmDialog } from '$lib/stores/confirm-dialog.svelte'
  import { debounce } from '$lib/utils'
  import { generateIdenticon } from '$lib/core/utils/identicon'
  import { features } from '$lib/config/features'
  import type { Account } from '$lib/core/api/types'
  import { useAuditLogs } from '$lib/core/stores/audit.svelte'

  const store = useAccounts()
  const auth = useAuth()
  const auditStore = useAuditLogs()
  const id = $derived(Number($page.params.id))
  const editOnLoad = $derived($page.url.searchParams.has('edit'))

  $effect(() => {
    if (!auth.loading && !auth.can('accounts', 'read')) {
      showErrorToast('Access denied')
      goto('/', { replaceState: true })
    }
  })
  let account = $state<Account | null>(null)
  let loading = $state(true)
  const dialog = useConfirmDialog()

  let editing = $state(false)
  let editName = $state('')
  let editDescription = $state('')
  let editIconUrl = $state('')
  let editSubmitting = $state(false)
  let editIconError = $state(false)
  let editPreviewUrl = $state('')

  const updateEditPreview = debounce((url: string) => { editPreviewUrl = url }, 300)

  $effect(() => {
    const url = editIconUrl.trim()
    editIconError = false
    if (!url) editPreviewUrl = ''
    else updateEditPreview(url)
  })

  const iconSrc = $derived.by(() => {
    if (!account) return ''
    if (editing) {
      if (editPreviewUrl && !editIconError) return editPreviewUrl
      return generateIdenticon(account.id, 36)
    }
    return account.iconUrl || generateIdenticon(account.id, 36)
  })

  function startEdit() {
    if (!account) return
    editName = account.name
    editDescription = account.description || ''
    editIconUrl = account.iconUrl || ''
    editing = true
  }

  function cancelEdit() {
    editing = false
    if (editOnLoad) goto(`/accounts/${id}`, { replaceState: true })
  }

  async function handleUpdate(e: Event) {
    e.preventDefault()
    if (!editName.trim()) return
    editSubmitting = true
    try {
      await store.editAccount(id, {
        name: editName.trim(),
        description: editDescription.trim() || undefined,
        iconUrl: editIconUrl.trim() || undefined,
      })
      account = await store.getAccount(id)
      editing = false
      showSuccessToast('Account updated')
    } catch (err: unknown) {
      handleApiError(err, 'Failed to update account')
    } finally {
      editSubmitting = false
    }
  }

  $effect(() => {
    if (Number.isNaN(id)) { loading = false; return }
    loading = true
    store.getAccount(id).then(a => { account = a }).catch(() => { account = null }).finally(() => { loading = false })
  })

  $effect(() => {
    if (editOnLoad && account && !editing && auth.can('accounts', 'update')) startEdit()
  })

  $effect(() => {
    if (!Number.isNaN(id) && auth.can('auditLogs', 'read')) {
      auditStore.fetchLogs({ accountId: id, reset: true })
    }
  })

  async function act(fn: () => Promise<void>) {
    await fn()
    account = await store.getAccount(id)
  }
</script>

<div class="space-y-6">
  <div class="flex items-center gap-4">
    <Button variant="ghost" size="sm" href="/accounts" aria-label="Back to accounts"><ArrowLeft class="h-4 w-4" /></Button>
    <h1 class="text-2xl font-bold tracking-tight">{account?.name ?? 'Account'}</h1>
    {#if account}<Badge variant="outline" style="border-color: var(--pastel-account); color: var(--pastel-account-text)">Account</Badge>{/if}
  </div>

  {#if loading}
    <LoadingSpinner />
  {:else if account}
    <div class="grid gap-6 md:grid-cols-2">
      <Card cornerBrackets>
        {#if editing}
          <form onsubmit={handleUpdate} class="flex flex-col gap-6">
            <CardHeader>
              <div class="flex items-center gap-3">
                <img
                  src={iconSrc}
                  alt={editName}
                  width={36} height={36}
                  class="rounded-full shrink-0"
                  style="width: 36px; height: 36px;"
                  onerror={() => { editIconError = true }}
                />
                <CardTitle>Edit Account</CardTitle>
              </div>
            </CardHeader>
            <CardContent class="space-y-5">
              <div class="space-y-2">
                <Label for="edit-name">Name</Label>
                <Input id="edit-name" bind:value={editName} placeholder="Account name" required />
              </div>
              <div class="space-y-2">
                <Label for="edit-description">Description</Label>
                <Input id="edit-description" bind:value={editDescription} placeholder="Description" />
              </div>
              <div class="space-y-2">
                <Label for="edit-iconUrl">Icon URL</Label>
                <Input id="edit-iconUrl" bind:value={editIconUrl} placeholder="https://example.com/icon.png" />
              </div>
            </CardContent>
            <CardFooter class="gap-4">
              <Button variant="primary" type="submit" size="sm" class="cyberpunk-skewed-sm" disabled={editSubmitting || !editName.trim()}>
                {editSubmitting ? 'Updating...' : 'Update'}
              </Button>
              <Button variant="secondary" size="sm" type="button" onclick={cancelEdit} disabled={editSubmitting}>Cancel</Button>
            </CardFooter>
          </form>
        {:else}
          <CardHeader>
            <div class="flex items-center gap-3">
              <AccountIcon {account} size={36} />
              <CardTitle class="flex-1">{account.name}</CardTitle>
              {#if auth.can('accounts', 'update')}
                <button
                  type="button"
                  onclick={startEdit}
                  class="opacity-50 hover:opacity-100 hover:text-primary transition-all"
                  title="Edit account" aria-label="Edit account"
                >
                  <PencilIcon class="size-4" aria-hidden="true" />
                </button>
              {/if}
            </div>
          </CardHeader>
          <CardContent class="space-y-3">
            <div>
              <span class="text-sm uppercase tracking-wider font-semibold text-muted-foreground">Status</span>
              <div class="mt-1"><StatusBadge active={account.isActive} locked={account.locked} /></div>
            </div>
            <div>
              <span class="text-sm uppercase tracking-wider font-semibold text-muted-foreground">Description</span>
              <p class="mt-1 text-sm">{account.description || '—'}</p>
            </div>
            <div>
              <span class="text-sm uppercase tracking-wider font-semibold text-muted-foreground">Created</span>
              <p class="mt-1 text-sm">{formatDate(account.createdAt)}</p>
            </div>
          </CardContent>
          {#if auth.can('accounts', 'update')}
            <CardFooter class="gap-2">
              {#if account.isActive}
                <Button size="sm" onclick={() => dialog.confirm('Deactivate', `Deactivate "${account!.name}"? Make sure all users, regions, storages, and volumes are deactivated first. This action cannot be reverted.`, () => act(() => store.deactivateAccount(id)))}>Deactivate</Button>
              {/if}
              {#if features.accountLock}
                {#if account.locked}
                  <Button size="sm" onclick={() => dialog.confirm('Unlock', `Unlock "${account!.name}"?`, () => act(() => store.unlockAccount(id)))}>Unlock</Button>
                {:else}
                  <Button variant="destructive" size="sm" onclick={() => dialog.confirm('Lock', `Lock "${account!.name}"?`, () => act(() => store.lockAccount(id)))}>Lock</Button>
                {/if}
              {/if}
            </CardFooter>
          {/if}
        {/if}
      </Card>

      {#if account.vendorInfo}
        <Card>
          <CardHeader><CardTitle>Vendor Info</CardTitle></CardHeader>
          <CardContent>
            <pre class="rounded-md bg-muted p-3 text-sm">{JSON.stringify(account.vendorInfo, null, 2)}</pre>
          </CardContent>
        </Card>
      {/if}
    </div>

    {#if auth.can('auditLogs', 'read')}
      <div class="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle class="text-base font-mono">Activity</CardTitle></CardHeader>
          <CardContent class="pt-0">
            <ActivityFeed
              logs={auditStore.logs}
              loading={auditStore.loading}
              hasMore={auditStore.hasMore}
              onLoadMore={() => auditStore.fetchLogs({ accountId: id })}
            />
          </CardContent>
        </Card>
      </div>
    {/if}
  {:else}
    <p class="text-muted-foreground">Account not found.</p>
  {/if}
</div>

<ConfirmDialog bind:open={dialog.open} title={dialog.title} description={dialog.desc} onConfirm={dialog.action} />
