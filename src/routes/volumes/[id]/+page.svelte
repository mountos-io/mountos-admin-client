<script lang="ts">
  import { onDestroy } from 'svelte'
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { useVolumes } from '$lib/core/stores/volumes.svelte'
  import { useUsers } from '$lib/core/stores/users.svelte'
  import { useAuth } from '$lib/core/stores/auth.svelte'
  import { cn, debounce } from '$lib/utils'
  import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '$lib/components/ui/card'
  import { Button } from '$lib/components/ui/button'
  import { Badge } from '$lib/components/ui/badge'
  import { Input } from '$lib/components/ui/input'
  import { Textarea } from '$lib/components/ui/textarea'
  import { Label } from '$lib/components/ui/label'
  import { Separator } from '$lib/components/ui/separator'
  import { Popover, PopoverTrigger, PopoverContent } from '$lib/components/ui/popover'
  import { Command, CommandInput, CommandList, CommandEmpty, CommandItem } from '$lib/components/ui/command'
  import StatusBadge from '$lib/components/shared/StatusBadge.svelte'
  import ConfirmDialog from '$lib/components/shared/ConfirmDialog.svelte'
  import DeactivateVolumeDialog from '$lib/components/shared/DeactivateVolumeDialog.svelte'
  import LoadingSpinner from '$lib/components/shared/LoadingSpinner.svelte'
  import { formatBytes, formatQuota, quotaPercent, bytesToGb, gbToBytes, formatClientType, formatSessionStatus, formatDuration, formatRelative } from '$lib/core/utils/format'
  import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '$lib/components/ui/table'
  import Pagination from '$lib/components/shared/Pagination.svelte'
  import { api } from '$lib/core/stores/client.svelte'
  import type { Volume, User, DeactivateVolumeRequest, ClientSession } from '$lib/core/api/types'
  import { handleApiError, showErrorToast, showSuccessToast } from '$lib/core/utils/toast'
  import ArrowLeft from '@lucide/svelte/icons/arrow-left'
  import InfoTip from '$lib/components/shared/InfoTip.svelte'
  import PencilIcon from '@lucide/svelte/icons/pencil'
  import ChevronsUpDown from '@lucide/svelte/icons/chevrons-up-down'
  import Check from '@lucide/svelte/icons/check'
  import Loader2 from '@lucide/svelte/icons/loader-2'
  import * as Dialog from '$lib/components/ui/dialog'
  import Copy from '@lucide/svelte/icons/copy'
  import ShieldAlert from '@lucide/svelte/icons/shield-alert'
  import { useConfirmDialog } from '$lib/stores/confirm-dialog.svelte'

  const store = useVolumes()
  const userStore = useUsers()
  const auth = useAuth()
  const id = $derived(Number($page.params.id))

  $effect(() => {
    if (auth.loading) return
    if (!auth.can('volumes', 'read')) {
      showErrorToast('Access denied')
      goto('/', { replaceState: true })
      return
    }
    if (auth.isUserRole && auth.userVolumeId != null && id !== auth.userVolumeId) {
      showErrorToast('Access denied')
      goto('/volumes', { replaceState: true })
    }
  })

  let volume = $state<Volume | null>(null)
  let loading = $state(true)
  const dialog = useConfirmDialog(() => reload())
  const canEdit = $derived(volume?.isActive && auth.can('volumes', 'update'))

  let editing = $state(false)
  let deactivateOpen = $state(false)

  async function handleDeactivate(req: DeactivateVolumeRequest) {
    await store.deactivateVolume(id, req)
    await reload()
  }

  let revokeUserId = $state('')
  let genResult = $state<{ apiKey: string; apiSecret: string } | null>(null)
  let credentialsOpen = $state(false)
  let userSelectOpen = $state(false)
  let userSearchQuery = $state('')
  let userOptions = $state<User[]>([])
  let userSearchLoading = $state(false)
  const selectedUserLabel = $derived(userOptions.find(u => String(u.id) === revokeUserId)?.username ?? (revokeUserId ? `User #${revokeUserId}` : ''))

  const debouncedUserSearch = debounce(async (accountId: number, query: string) => {
    userSearchLoading = true
    try {
      userOptions = await userStore.searchUsers(accountId, query)
    } catch { /* swallow */ }
    finally { userSearchLoading = false }
  }, 300)

  $effect(() => {
    if (!userSelectOpen) return
    if (!volume?.account?.id) return
    debouncedUserSearch(volume.account.id, userSearchQuery)
  })

  let revokeKey = $state('')
  let editDesc = $state('')
  let editRetention = $state('')
  let editGrace = $state('')
  let editQuota = $state('')
  let editSaving = $state(false)

  const editDirty = $derived(
    volume != null && (
      editDesc !== (volume.description ?? '') ||
      editRetention !== String(volume.retentionPeriod) ||
      editGrace !== String(volume.gracePeriod) ||
      editQuota !== String(bytesToGb(volume.quotaLimit))
    )
  )

  function syncEditFields(v: Volume) {
    editDesc = v.description ?? ''
    editRetention = String(v.retentionPeriod)
    editGrace = String(v.gracePeriod)
    editQuota = String(bytesToGb(v.quotaLimit))
  }

  $effect(() => {
    if (Number.isNaN(id)) { loading = false; return }
    volSessions = []; sessionsTotal = 0; sessionsTotalPages = 0; sessionsPage = 1
    loading = true
    store.getVolume(id).then(v => {
      volume = v
      syncEditFields(v)
      fetchVolumeSessions()
    }).catch(() => { volume = null }).finally(() => { loading = false })
  })

  onDestroy(() => { sessionsCtrl?.abort() })

  async function reload() {
    const v = await store.getVolume(id)
    volume = v
    syncEditFields(v)
  }

  function cancelEdit() {
    if (volume) syncEditFields(volume)
    editing = false
  }

  async function saveEdit() {
    if (!volume) return
    editSaving = true
    try {
      const quotaChanged = editQuota !== String(bytesToGb(volume.quotaLimit))
      await store.editVolume(id, {
        description: editDesc.trim() || undefined,
        retentionPeriod: editRetention ? Number(editRetention) : undefined,
        gracePeriod: editGrace ? Number(editGrace) : undefined,
      })
      if (quotaChanged) {
        const gb = Number(editQuota)
        await store.updateQuota(id, isNaN(gb) || gb <= 0 ? 0 : gbToBytes(gb))
      }
      showSuccessToast('Volume updated')
      editing = false
      await reload()
    } catch (e: unknown) { handleApiError(e, 'Failed to update volume') }
    finally { editSaving = false }
  }

  function generateKeys() {
    const uid = auth.userMountosUserId
    if (uid == null) return
    dialog.confirm('Generate API Keys', 'Any existing key pair for this user will be revoked.', async () => {
      try {
        genResult = await store.generateApiKeys(id, { userId: uid })
        credentialsOpen = true
      } catch (e: unknown) { handleApiError(e, 'Failed to generate keys') }
    })
  }

  function closeCredentials() {
    credentialsOpen = false
    genResult = null
  }

  let copiedField = $state<string | null>(null)
  async function copyToClipboard(text: string, field: string) {
    try {
      await navigator.clipboard.writeText(text)
      copiedField = field
      setTimeout(() => { if (copiedField === field) copiedField = null }, 1500)
    } catch { showErrorToast('Failed to copy') }
  }

  function handleRevokeKey() {
    if (!revokeKey) return
    const key = revokeKey
    dialog.confirm('Revoke API Key', `Revoke key "${key}"?`, async () => {
      await store.revokeApiKey(id, key)
      revokeKey = ''
      showSuccessToast('API key revoked')
    }, 'destructive')
  }

  let volSessions = $state<ClientSession[]>([])
  let sessionsLoading = $state(false)
  let sessionsTotal = $state(0)
  let sessionsTotalPages = $state(0)
  let sessionsPage = $state(1)
  let sessionsCtrl: AbortController | null = null

  async function fetchVolumeSessions(page = 1) {
    if (!volume) return
    sessionsCtrl?.abort()
    const ctrl = sessionsCtrl = new AbortController()
    sessionsLoading = true
    try {
      const res = await api.clientSessions.list({
        accountId: volume.account.id,
        volumeId: id,
        status: '1',
        page,
        limit: 10,
      }, ctrl.signal)
      volSessions = res.items
      sessionsTotal = res.pagination?.total ?? 0
      sessionsTotalPages = res.pagination?.totalPages ?? 0
      sessionsPage = res.pagination?.page ?? 1
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
    } finally {
      if (sessionsCtrl === ctrl) sessionsLoading = false
    }
  }

  function handleRevokeKeysByUser() {
    const uid = Number(revokeUserId)
    if (!revokeUserId || Number.isNaN(uid)) return
    const label = selectedUserLabel || `User #${uid}`
    dialog.confirm('Revoke Key', `Revoke API key for ${label}?`, async () => {
      await store.revokeApiKeysByUser(id, uid)
      showSuccessToast(`API key revoked for ${label}`)
    }, 'destructive')
  }
</script>

<svelte:head>
  <title>{volume?.name ?? 'Volume'} — mountOS Admin</title>
</svelte:head>

<div class="space-y-6">
  <div class="flex items-center gap-4">
    <Button variant="ghost" size="sm" href="/volumes" aria-label="Back to volumes"><ArrowLeft class="h-4 w-4" /></Button>
    <h1 class="text-2xl font-bold tracking-tight min-w-0 truncate">{volume?.name ?? 'Volume'}</h1>
    {#if volume}<Badge variant="outline" style="border-color: var(--pastel-volume); color: var(--pastel-volume-text)">Volume</Badge>{/if}
  </div>
  {#if loading}
    <LoadingSpinner />
  {:else if volume}
    <div class="grid gap-6">
      <Card cornerBrackets>
        <CardHeader>
          <div class="flex items-center gap-3">
            <CardTitle class="flex-1">Details</CardTitle>
            {#if canEdit && !editing}
              <button
                type="button"
                onclick={() => (editing = true)}
                class="opacity-50 hover:opacity-100 hover:text-primary transition-all"
                title="Edit volume" aria-label="Edit volume"
              >
                <PencilIcon class="size-4" aria-hidden="true" />
              </button>
            {/if}
          </div>
        </CardHeader>
        <CardContent class="grid gap-3">
          {#if editing}
            <div class="space-y-1.5">
              <Label for="edit-desc" class="text-sm uppercase tracking-wider font-semibold text-muted-foreground">Description</Label>
              <Textarea id="edit-desc" bind:value={editDesc} placeholder="Volume description" rows={2} />
            </div>
          {:else if volume.description}
            <div>
              <span class="text-sm uppercase tracking-wider font-semibold text-muted-foreground">Description</span>
              <p class="mt-1 text-sm break-words">{volume.description}</p>
            </div>
          {/if}
          <div>
            <span class="text-sm uppercase tracking-wider font-semibold text-muted-foreground">Status</span>
            <div class="mt-1"><StatusBadge active={volume.isActive} locked={volume.locked} /></div>
          </div>
          <div>
            <span class="text-sm uppercase tracking-wider font-semibold text-muted-foreground">Encryption</span>
            <div class="mt-1"><Badge variant={volume.encryption ? 'default' : 'outline'}>{volume.encryption ? 'Enabled' : 'Disabled'}</Badge></div>
          </div>
          {#if editing}
            <div class="grid gap-4 md:grid-cols-2">
              <div class="space-y-1.5">
                <Label for="edit-retention" class="text-sm uppercase tracking-wider font-semibold text-muted-foreground">
                  <span class="inline-flex items-center gap-1">
                    Snapshot Window (days)
                    <InfoTip text="How long deleted items and old versions are retained before cleanup. Beyond this window, snapshot mounts may show inconsistent data due to cleaned-up data." />
                  </span>
                </Label>
                <Input id="edit-retention" type="number" bind:value={editRetention} placeholder="30" min="0" max="366" />
              </div>
              <div class="space-y-1.5">
                <Label for="edit-grace" class="text-sm uppercase tracking-wider font-semibold text-muted-foreground">
                  <span class="inline-flex items-center gap-1">
                    Grace Period (days)
                    <InfoTip text="How long data stays before cleanup after deactivation" />
                  </span>
                </Label>
                <Input id="edit-grace" type="number" bind:value={editGrace} placeholder="14" min="0" max="91" />
              </div>
            </div>
          {:else}
            <div class="flex gap-4">
              <div>
                <span class="text-sm uppercase tracking-wider font-semibold text-muted-foreground">Snapshot Window</span>
                <p class="mt-1 text-sm">{volume.retentionPeriod} days</p>
              </div>
              <div>
                <span class="text-sm uppercase tracking-wider font-semibold text-muted-foreground">Grace Period</span>
                <p class="mt-1 text-sm">{volume.gracePeriod} days</p>
              </div>
            </div>
          {/if}
          {#if !volume.isActive}
            <div>
              <span class="text-sm uppercase tracking-wider font-semibold text-muted-foreground inline-flex items-center gap-1">
                Cleanup
                <InfoTip text="Can be changed on deactivate" />
              </span>
              <div class="mt-1 flex gap-2" role="list" aria-label="Cleanup flags">
                <span role="listitem"><Badge variant={volume.isCleanupMetaEnabled ? 'default' : 'outline'} aria-label="Meta: {volume.isCleanupMetaEnabled ? 'enabled' : 'disabled'}">Meta</Badge></span>
                <span role="listitem"><Badge variant={volume.isCleanupStorageEnabled ? 'default' : 'outline'} aria-label="Storage: {volume.isCleanupStorageEnabled ? 'enabled' : 'disabled'}">Storage</Badge></span>
                <span role="listitem"><Badge variant={volume.isCleanupVaultEnabled ? 'default' : 'outline'} aria-label="Vault: {volume.isCleanupVaultEnabled ? 'enabled' : 'disabled'}">Vault</Badge></span>
              </div>
            </div>
          {/if}
          {#if editing}
            <div class="space-y-1.5">
              <Label for="edit-quota" class="text-sm uppercase tracking-wider font-semibold text-muted-foreground">Quota Limit (GB)</Label>
              <Input id="edit-quota" type="number" bind:value={editQuota} placeholder="0 = unlimited" min="0" step="0.01" />
            </div>
          {:else}
            <div>
              <span class="text-sm uppercase tracking-wider font-semibold text-muted-foreground">Quota</span>
              <p class="mt-1 text-sm">{formatQuota(volume.totalVolume, volume.quotaLimit)}</p>
              {#if volume.quotaLimit > 0}
                {@const pct = quotaPercent(volume.totalVolume, volume.quotaLimit)}
                <div class="mt-2 h-2 rounded-full bg-muted overflow-hidden" role="progressbar"
                  aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}
                  aria-label="Quota usage {pct}%">
                  <div class="h-full rounded-full transition-transform origin-left {pct > 90 ? 'bg-destructive' : pct > 70 ? 'bg-warning' : 'bg-primary'}" style="transform: scaleX({pct / 100})"></div>
                </div>
              {/if}
            </div>
            <div class="flex flex-wrap gap-4">
              <div>
                <span class="text-sm uppercase tracking-wider font-semibold text-muted-foreground inline-flex items-center gap-1">
                  Live
                  <InfoTip text={"Sum of all files across forks for this volume.\n\nCan exceed total volume due to hard links, sparse files, etc.\nOnly live (non-deleted, current version) files are tracked."} />
                </span>
                <p class="mt-1 font-mono text-sm">{formatBytes(volume.liveVolume)}</p>
              </div>
              <div>
                <span class="text-sm uppercase tracking-wider font-semibold text-muted-foreground inline-flex items-center gap-1">
                  Total
                  <InfoTip text={"Object / block storage space used.\n\nIncludes all versions, pending, and yet-to-be-discarded file segments."} />
                </span>
                <p class="mt-1 font-mono text-sm">{formatBytes(volume.totalVolume)}</p>
              </div>
              <div>
                <span class="text-sm uppercase tracking-wider font-semibold text-muted-foreground inline-flex items-center gap-1">
                  Pending
                  <InfoTip text={"Pending or yet-to-be-discarded file segments.\n\nThese segments are scheduled for cleanup after the retention window expires."} />
                </span>
                <p class="mt-1 font-mono text-sm">{formatBytes(volume.pendingVolume)}</p>
              </div>
            </div>
          {/if}
        </CardContent>
        {#if editing}
          <CardFooter class="gap-4">
            <Button variant="primary" size="sm" class="cyberpunk-skewed-sm" disabled={editSaving || !editDirty} onclick={saveEdit}>
              {editSaving ? 'Saving...' : 'Update'}
            </Button>
            <Button variant="secondary" size="sm" onclick={cancelEdit} disabled={editSaving}>Cancel</Button>
          </CardFooter>
        {:else if auth.can('volumes', 'update')}
          <CardFooter class="flex gap-2">
            {#if volume.isActive}
              <Button variant="destructive" size="sm" onclick={() => { deactivateOpen = true }}>Deactivate</Button>
            {/if}
            <Button variant="outline" size="sm" onclick={() => dialog.confirm(
              volume!.locked ? 'Unlock' : 'Lock',
              `${volume!.locked ? 'Unlock' : 'Lock'} "${volume!.name}"?`,
              () => volume!.locked ? store.unlockVolume(id) : store.lockVolume(id),
            )}>{volume.locked ? 'Unlock' : 'Lock'}</Button>
          </CardFooter>
        {/if}
      </Card>

    </div>

    {#if auth.can('clientSessions', 'read')}
      <Card>
        <CardHeader>
          <div class="flex items-center justify-between">
            <CardTitle>Active Sessions ({sessionsTotal})</CardTitle>
            <Button variant="outline" size="sm" class="text-sm font-normal text-muted-foreground" href="/sessions?volumeId={id}">
              View all sessions
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {#if sessionsLoading}
            <LoadingSpinner />
          {:else if volSessions.length === 0}
            <p class="text-sm text-muted-foreground">No active sessions</p>
          {:else}
            <Table containerLabel="Active sessions">
              <TableHeader>
                <TableRow>
                  <TableHead class="th-cyber">Client</TableHead>
                  <TableHead class="th-cyber hidden md:table-cell">Host</TableHead>
                  <TableHead class="th-cyber hidden lg:table-cell">Mount</TableHead>
                  <TableHead class="th-cyber">Status</TableHead>
                  <TableHead class="th-cyber hidden md:table-cell">Duration</TableHead>
                  <TableHead class="th-cyber hidden lg:table-cell">Last Heartbeat</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {#each volSessions as session}
                  {@const st = formatSessionStatus(session.status)}
                  <TableRow>
                    <TableCell class="text-sm">
                      <span class="font-medium">{formatClientType(session.clientType)}</span>
                      {#if session.osVersion}
                        <span class="text-muted-foreground ml-1">{session.osName} {session.osVersion}</span>
                      {/if}
                    </TableCell>
                    <TableCell class="text-sm text-muted-foreground hidden md:table-cell font-mono">
                      {session.hostname || session.ipAddr}
                    </TableCell>
                    <TableCell class="text-sm text-muted-foreground hidden lg:table-cell">
                      {session.mountMode ?? '—'}
                    </TableCell>
                    <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                    <TableCell class="text-sm text-muted-foreground hidden md:table-cell">
                      {session.connectedAt ? formatDuration(session.connectedAt) : '—'}
                    </TableCell>
                    <TableCell class="text-sm text-muted-foreground hidden lg:table-cell">
                      {session.lastHeartbeat ? formatRelative(session.lastHeartbeat) : '—'}
                    </TableCell>
                  </TableRow>
                {/each}
              </TableBody>
            </Table>
            {#if sessionsTotalPages > 1}
              <Pagination currentPage={sessionsPage} totalPages={sessionsTotalPages} onPageChange={(p) => fetchVolumeSessions(p)} />
            {/if}
          {/if}
        </CardContent>
      </Card>
    {/if}

    {#if auth.can('volumes', 'update') || auth.userMountosUserId != null}
      <Separator />

      <Card>
        <CardHeader><CardTitle>API Keys</CardTitle></CardHeader>
        <CardContent class="space-y-4">
          {#if auth.userMountosUserId != null}
            <fieldset class="space-y-3">
              <legend class="text-sm font-semibold">Generate API Keys</legend>
              <div class="flex items-end gap-3">
                <div class="w-full max-w-64 space-y-1">
                  <Label for="api-key-user">User</Label>
                  <Input id="api-key-user" value={auth.username ?? `User #${auth.userMountosUserId}`} readonly />
                </div>
                <Button size="sm" class="shrink-0" aria-describedby="api-key-user" onclick={generateKeys}>Generate</Button>
              </div>
            </fieldset>
          {/if}
          {#if auth.can('volumes', 'update')}
            {#if auth.userMountosUserId != null}<Separator />{/if}
            <div class="space-y-4 rounded-md bg-destructive/5 p-3">
              <fieldset class="space-y-3">
                <legend class="text-sm font-semibold">Revoke by User</legend>
                <div class="flex items-end gap-3">
                  <div class="w-full max-w-64 space-y-1">
                    <Label for="revoke-user-id">User</Label>
                    <Popover bind:open={userSelectOpen}>
                      <PopoverTrigger>
                        {#snippet child({ props })}
                          <Button {...props} id="revoke-user-id" variant="outline" role="combobox" aria-expanded={userSelectOpen}
                            class={cn("w-full justify-between font-normal", !revokeUserId && "text-muted-foreground")}>
                            {selectedUserLabel || 'Select user...'}
                            <ChevronsUpDown class="ml-auto h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        {/snippet}
                      </PopoverTrigger>
                      <PopoverContent class="w-[--bits-popover-anchor-width] p-0">
                        <Command shouldFilter={false}>
                          <CommandInput placeholder="Search users..." bind:value={userSearchQuery} />
                          <CommandList>
                            {#if userSearchLoading}
                              <div class="flex items-center justify-center py-4">
                                <Loader2 class="h-4 w-4 animate-spin text-muted-foreground" />
                              </div>
                            {:else if userOptions.length === 0}
                              <CommandEmpty>{userSearchQuery ? 'No users found.' : 'Type to search users...'}</CommandEmpty>
                            {:else}
                              {#each userOptions as user}
                                <CommandItem value={String(user.id)} onSelect={() => { revokeUserId = String(user.id); userSelectOpen = false }}>
                                  <Check class={cn("h-4 w-4", revokeUserId === String(user.id) ? "opacity-100" : "opacity-0")} />
                                  <span>{user.username}</span>
                                  <span class="ml-auto text-xs text-muted-foreground">{user.email}</span>
                                </CommandItem>
                              {/each}
                            {/if}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <Button variant="destructive" size="sm" class="shrink-0" disabled={!revokeUserId} onclick={handleRevokeKeysByUser}>Revoke</Button>
                </div>
              </fieldset>
              <Separator class="opacity-50" />
              <fieldset class="space-y-3">
                <legend class="text-sm font-semibold">Revoke API Key</legend>
                <div class="flex items-end gap-3">
                  <div class="w-full max-w-64 space-y-1">
                    <Label for="revoke-key-id">API Key</Label>
                    <Input id="revoke-key-id" bind:value={revokeKey} placeholder="API key to revoke" />
                  </div>
                  <Button variant="destructive" size="sm" class="shrink-0" disabled={!revokeKey} onclick={handleRevokeKey}>Revoke</Button>
                </div>
              </fieldset>
            </div>
          {/if}
        </CardContent>
      </Card>
    {/if}
  {:else}
    <p class="text-muted-foreground">Volume not found.</p>
  {/if}
</div>
<ConfirmDialog bind:open={dialog.open} title={dialog.title} description={dialog.desc} variant={dialog.variant} onConfirm={dialog.action} />
{#if volume}
  <DeactivateVolumeDialog bind:open={deactivateOpen} volumeName={volume.name} onConfirm={handleDeactivate} />
{/if}

<Dialog.Root bind:open={credentialsOpen}>
  <Dialog.Content class="cyberpunk-skewed sm:max-w-lg p-0 gap-0 border-none"
    showCloseButton={false}
    interactOutsideBehavior="ignore"
    escapeKeydownBehavior="ignore">
    <div class="cyberpunk-skewed-inner flex flex-col gap-4">
      <div class="flex items-start gap-3">
        <ShieldAlert class="size-5 shrink-0 text-warning mt-0.5" />
        <div class="flex flex-col gap-1">
          <Dialog.Title class="text-base font-semibold tracking-tight">API Credentials Generated</Dialog.Title>
          <Dialog.Description class="text-sm text-muted-foreground leading-relaxed">
            Copy and save these credentials now. They will not be shown again.
          </Dialog.Description>
        </div>
      </div>
      {#if genResult}
        <div class="space-y-3">
          <div class="space-y-1">
            <span class="text-xs uppercase tracking-wider font-semibold text-muted-foreground">API Key</span>
            <div class="flex items-center gap-2">
              <code class="flex-1 font-mono text-sm break-all bg-muted/50 rounded-sm px-2.5 py-1.5 border select-all">{genResult.apiKey}</code>
              <button type="button"
                class="shrink-0 size-11 inline-flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                onclick={() => copyToClipboard(genResult!.apiKey, 'key')} aria-label="Copy API key">
                {#if copiedField === 'key'}<Check class="size-4 text-success" />{:else}<Copy class="size-4" />{/if}
              </button>
            </div>
          </div>
          <div class="space-y-1">
            <span class="text-xs uppercase tracking-wider font-semibold text-muted-foreground">API Secret</span>
            <div class="flex items-center gap-2">
              <code class="flex-1 font-mono text-sm break-all bg-muted/50 rounded-sm px-2.5 py-1.5 border select-all">{genResult.apiSecret}</code>
              <button type="button"
                class="shrink-0 size-11 inline-flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                onclick={() => copyToClipboard(genResult!.apiSecret, 'secret')} aria-label="Copy API secret">
                {#if copiedField === 'secret'}<Check class="size-4 text-success" />{:else}<Copy class="size-4" />{/if}
              </button>
            </div>
          </div>
        </div>
      {/if}
      <div class="pt-2 flex justify-end">
        <Button variant="primary" class="cyberpunk-skewed-sm" onclick={closeCredentials}>Done</Button>
      </div>
    </div>
  </Dialog.Content>
</Dialog.Root>
