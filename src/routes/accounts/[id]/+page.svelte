<script lang="ts">
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { useAccounts } from '$lib/core/stores/accounts.svelte'
  import { useAuth } from '$lib/core/stores/auth.svelte'
  import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '$lib/components/ui/card'
  import { Button } from '$lib/components/ui/button'
  import Input from '$lib/components/ui/input/input.svelte'
  import Label from '$lib/components/ui/label/label.svelte'
  import * as Dialog from '$lib/components/ui/dialog'
  import AccountIcon from '$lib/components/shared/AccountIcon.svelte'
  import { Badge } from '$lib/components/ui/badge'
  import StatusBadge from '$lib/components/shared/StatusBadge.svelte'
  import ConfirmDialog from '$lib/components/shared/ConfirmDialog.svelte'
  import DetailSkeleton from '$lib/components/shared/DetailSkeleton.svelte'
  import ActivityFeed from '$lib/components/shared/ActivityFeed.svelte'
  import ArrowLeft from '@lucide/svelte/icons/arrow-left'
  import PencilIcon from '@lucide/svelte/icons/pencil'
  import { formatDate, formatBytes, formatQuota, quotaPercent, bytesToGb, gbToBytes } from '$lib/core/utils/format'
  import InfoTip from '$lib/components/shared/InfoTip.svelte'
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
  // Retention is a policy object on the account; the storage representation is a
  // server concern and never reaches this form. Held as a string and coerced on
  // submit, matching the quota fields: binding a number directly yields null the
  // moment the operator clears the input, which would post a null the server
  // then has to interpret.
  let editClientSessionDays = $state('')
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
    editClientSessionDays = String(account.retention?.clientSessionDays ?? 90)
    editing = true
  }

  function cancelEdit() {
    editing = false
    if (editOnLoad) goto(`/accounts/${id}`, { replaceState: true })
  }

  // An empty or out-of-range box means "leave it alone", not "reset to default":
  // omitting the policy is what the server treats as untouched.
  function retentionPayload() {
    const days = Number(editClientSessionDays)
    if (!editClientSessionDays.trim() || isNaN(days) || days < 1 || days > 3650) return undefined
    return { clientSessionDays: Math.round(days) }
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
        retention: retentionPayload(),
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

  let fetchCtrl: AbortController | undefined
  $effect(() => {
    if (Number.isNaN(id)) { loading = false; return }
    fetchCtrl?.abort()
    fetchCtrl = new AbortController()
    const ctrl = fetchCtrl
    loading = true
    store.getAccount(id).then(a => { if (!ctrl.signal.aborted) account = a }).catch(() => { if (!ctrl.signal.aborted) account = null }).finally(() => { if (!ctrl.signal.aborted) loading = false })
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

  let editingQuota = $state(false)
  let editQuotaGb = $state('')
  let editExcessPct = $state('')
  let quotaSubmitting = $state(false)
  let quotaLimitInputEl = $state<HTMLInputElement | null>(null)

  function startQuotaEdit() {
    if (!account) return
    editQuotaGb = String(bytesToGb(account.quotaLimit))
    editExcessPct = String(account.quotaExcessPct)
    editingQuota = true
  }

  async function handleQuotaUpdate(e: Event) {
    e.preventDefault()
    quotaSubmitting = true
    try {
      const gb = Number(editQuotaGb)
      const pct = Number(editExcessPct)
      await store.updateQuota(id, {
        quotaLimit: isNaN(gb) || gb <= 0 ? 0 : gbToBytes(gb),
        quotaExcessPct: isNaN(pct) || pct < 0 ? 0 : Math.round(pct),
      })
      account = await store.getAccount(id)
      editingQuota = false
      showSuccessToast('Account quota updated')
    } catch (err: unknown) {
      handleApiError(err, 'Failed to update account quota')
    } finally {
      quotaSubmitting = false
    }
  }

</script>

<svelte:head><title>{account?.name ?? 'Account'} · mountOS Admin</title></svelte:head>

<div class="space-y-6">
  <div class="flex flex-wrap items-center gap-4">
    <Button variant="ghost" size="sm" href="/accounts" class="min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0" aria-label="Back to accounts"><ArrowLeft class="h-4 w-4" /></Button>
    <h1 class="text-2xl font-bold tracking-tight">{account?.name ?? 'Account'}</h1>
    {#if account}
      <Badge variant="outline" style="border-color: var(--pastel-account); color: var(--pastel-account-text)">Account</Badge>
      <Badge variant="outline" class="font-mono text-xs bg-muted/50" title="Sum of all live files across volumes in this account. Can exceed Total due to clones, hard links, and sparse files.">Live: {formatBytes(account.liveVolume)}</Badge>
      <Badge variant="outline" class="font-mono text-xs bg-muted/50" title="Total storage space used across volumes in this account">Total: {formatBytes(account.totalVolume)}</Badge>
    {/if}
  </div>

  {#if loading}
    <DetailSkeleton gridCols={1} cards={[{ rows: 4, cols: 1 }, { rows: 2, cols: 1 }]} />
  {:else if account}
    <div class="grid gap-6">
      <Card cornerBrackets>
        {#if editing}
          <form onsubmit={handleUpdate} class="flex flex-col gap-6">
            <CardHeader>
              <div class="flex items-center gap-3">
                <img
                  src={iconSrc}
                  alt={editName ? `${editName} icon` : 'Account icon'}
                  width={36} height={36}
                  loading="lazy"
                  decoding="async"
                  class="rounded-full shrink-0"
                  onerror={() => { editIconError = true }}
                />
                <CardTitle>Edit Account</CardTitle>
              </div>
            </CardHeader>
            <CardContent class="space-y-5">
              <div class="space-y-2">
                <Label for="edit-name">Name</Label>
                <Input id="edit-name" bind:value={editName} placeholder="Account name" required aria-required="true" autocomplete="organization" />
              </div>
              <div class="space-y-2">
                <Label for="edit-description">Description</Label>
                <Input id="edit-description" bind:value={editDescription} placeholder="Description" autocomplete="off" />
              </div>
              <div class="space-y-2">
                <Label for="edit-iconUrl">Icon URL</Label>
                <Input id="edit-iconUrl" bind:value={editIconUrl} placeholder="https://example.com/icon.png" autocomplete="url" />
              </div>
              <div class="space-y-2">
                <Label for="edit-clientSessionDays">Client session retention (days)</Label>
                <Input id="edit-clientSessionDays" type="number" min="1" max="3650" bind:value={editClientSessionDays} placeholder="90" />
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
                  class="inline-flex items-center justify-center min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 opacity-60 hover:opacity-100 hover:text-primary transition-[color,opacity] focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
                  title="Edit account" aria-label="Edit account"
                >
                  <PencilIcon class="size-4" aria-hidden="true" />
                </button>
              {/if}
            </div>
          </CardHeader>
          <CardContent>
            <dl class="space-y-3">
              <div>
                <dt class="text-sm font-medium text-muted-foreground">Status</dt>
                <dd class="mt-1"><StatusBadge active={account.isActive} locked={account.locked} /></dd>
              </div>
              <div>
                <dt class="text-sm font-medium text-muted-foreground">Description</dt>
                <dd class="mt-1 text-sm">{account.description || '·'}</dd>
              </div>
              <div>
                <dt class="text-sm font-medium text-muted-foreground">Created</dt>
                <dd class="mt-1 text-sm">{formatDate(account.createdAt)}</dd>
              </div>
              <div>
                <dt class="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <span class="flex-1 inline-flex items-center gap-1">
                    Quota
                    {#if account.quotaExcessPct > 0}
                      <Badge variant="outline" class="text-xs">+{account.quotaExcessPct}% excess</Badge>
                    {/if}
                  </span>
                  {#if auth.can('accounts', 'update') && account.isActive}
                    <button
                      type="button"
                      onclick={startQuotaEdit}
                      class="inline-flex items-center justify-center min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 opacity-60 hover:opacity-100 hover:text-primary transition-[color,opacity] focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
                      title="Edit quota" aria-label="Edit account quota"
                    >
                      <PencilIcon class="size-3.5" aria-hidden="true" />
                    </button>
                  {/if}
                </dt>
                <dd class="mt-1 font-mono text-sm">{formatQuota(account.totalVolume, account.quotaLimit)}</dd>
                {#if account.quotaLimit > 0}
                  {@const pct = quotaPercent(account.totalVolume, account.quotaLimit)}
                  <div class="mt-2 h-1.5 w-full rounded-sm bg-muted overflow-hidden" role="progressbar"
                    aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}
                    aria-label="Account quota usage {pct}%">
                    <div class="h-full rounded-sm transition-transform origin-left {pct > 90 ? 'bg-destructive' : pct > 70 ? 'bg-warning' : 'bg-primary'}" style="transform: scaleX({pct / 100})"></div>
                  </div>
                {/if}
              </div>
            </dl>
          </CardContent>
          {#if auth.can('accounts', 'update')}
            <CardFooter class="gap-2">
              {#if account.isActive}
                <Button variant="destructive" size="sm" onclick={() => dialog.confirm('Deactivate', `Permanently deactivate "${account!.name}"? All users, regions, storages, and volumes must be deactivated first.`, () => act(() => store.deactivateAccount(id)), 'destructive')}>Deactivate</Button>
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

      {#if account.providerInfo}
        <Card>
          <CardHeader><CardTitle>Provider Info</CardTitle></CardHeader>
          <CardContent>
            <pre class="rounded-md bg-muted p-3 text-sm">{JSON.stringify(account.providerInfo, null, 2)}</pre>
          </CardContent>
        </Card>
      {/if}
    </div>

    {#if auth.can('auditLogs', 'read')}
      <div class="grid gap-6">
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

<ConfirmDialog bind:open={dialog.open} title={dialog.title} description={dialog.desc} variant={dialog.variant} onConfirm={dialog.action} />

<Dialog.Root bind:open={editingQuota}>
  <Dialog.Content class="sm:max-w-md" onOpenAutoFocus={(e) => { e.preventDefault(); quotaLimitInputEl?.focus() }}>
    <Dialog.Header>
      <Dialog.Title>Edit Account Quota</Dialog.Title>
    </Dialog.Header>
    <form onsubmit={handleQuotaUpdate} class="space-y-5">
      <div class="space-y-2">
        <Label for="edit-quota-limit" class="inline-flex items-center gap-1">
          Quota Limit (GB)
          <InfoTip text="This sets the hard storage cap for the account, in GB, across all volumes. **0** means **unlimited**. The cap applies to total usage, not per-volume quotas." />
        </Label>
        <Input id="edit-quota-limit" bind:ref={quotaLimitInputEl} type="number" bind:value={editQuotaGb} placeholder="0 = unlimited" min="0" step="0.01" />
      </div>
      <div class="space-y-2">
        <Label for="edit-excess-pct" class="inline-flex items-center gap-1">
          Excess Allowed (%)
          <InfoTip text="This percentage sets the headroom above the limit before writes stop. **0** means **no excess**. The hard cap equals the limit." />
        </Label>
        <Input id="edit-excess-pct" type="number" bind:value={editExcessPct} placeholder="0" min="0" max="1000" step="1" />
      </div>
      <Dialog.Footer class="gap-2">
        <Button variant="secondary" type="button" onclick={() => editingQuota = false} disabled={quotaSubmitting}>Cancel</Button>
        <Button variant="primary" type="submit" class="cyberpunk-skewed-sm" disabled={quotaSubmitting}>
          {quotaSubmitting ? 'Updating...' : 'Update'}
        </Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>
