<script lang="ts">
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { useVolumes } from '$lib/core/stores/volumes.svelte'
  import { useAuth } from '$lib/core/stores/auth.svelte'
  import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '$lib/components/ui/card'
  import { Button } from '$lib/components/ui/button'
  import { Badge } from '$lib/components/ui/badge'
  import { Input } from '$lib/components/ui/input'
  import { Textarea } from '$lib/components/ui/textarea'
  import { Label } from '$lib/components/ui/label'
  import { Separator } from '$lib/components/ui/separator'
  import StatusBadge from '$lib/components/shared/StatusBadge.svelte'
  import ConfirmDialog from '$lib/components/shared/ConfirmDialog.svelte'
  import DeactivateVolumeDialog from '$lib/components/shared/DeactivateVolumeDialog.svelte'
  import LoadingSpinner from '$lib/components/shared/LoadingSpinner.svelte'
  import { formatBytes, formatQuota, quotaPercent } from '$lib/core/utils/format'
  import type { Volume, DeactivateVolumeRequest } from '$lib/core/api/types'
  import { handleApiError, showErrorToast, showSuccessToast } from '$lib/core/utils/toast'
  import ArrowLeft from '@lucide/svelte/icons/arrow-left'
  import Lightbulb from '@lucide/svelte/icons/lightbulb'
  import { useConfirmDialog } from '$lib/stores/confirm-dialog.svelte'

  const store = useVolumes()
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
  let stats = $state<{ diskSize: number; activeSize: number; size: number } | null>(null)
  const dialog = useConfirmDialog(() => reload())

  let deactivateOpen = $state(false)

  async function handleDeactivate(req: DeactivateVolumeRequest) {
    await store.deactivateVolume(id, req)
    await reload()
  }

  let genUserId = $state(auth.userMountosUserId != null ? String(auth.userMountosUserId) : '')
  let genResult = $state<{ apiKey: string; apiSecret: string } | null>(null)
  let revokeKey = $state('')
  let quotaInput = $state('')

  let editDesc = $state('')
  let editRetention = $state('')
  let editGrace = $state('')
  let editSaving = $state(false)

  const editDirty = $derived(
    volume != null && (
      editDesc !== (volume.description ?? '') ||
      editRetention !== String(volume.retentionPeriod) ||
      editGrace !== String(volume.gracePeriod)
    )
  )

  function syncEditFields(v: Volume) {
    editDesc = v.description ?? ''
    editRetention = String(v.retentionPeriod)
    editGrace = String(v.gracePeriod)
    quotaInput = String(v.quotaLimit)
  }

  $effect(() => {
    if (Number.isNaN(id)) { loading = false; return }
    loading = true
    Promise.all([
      store.getVolume(id),
      store.getStats(id).catch(() => null),
    ]).then(([v, s]) => {
      volume = v
      stats = s
      syncEditFields(v)
    }).catch(() => { volume = null; stats = null }).finally(() => { loading = false })
  })

  async function reload() {
    const v = await store.getVolume(id)
    volume = v
    stats = await store.getStats(id).catch(() => null)
    syncEditFields(v)
  }

  async function saveEdit() {
    editSaving = true
    try {
      await store.editVolume(id, {
        description: editDesc.trim() || undefined,
        retentionPeriod: editRetention ? Number(editRetention) : undefined,
        gracePeriod: editGrace ? Number(editGrace) : undefined,
      })
      showSuccessToast('Volume updated')
      await reload()
    } catch (e: unknown) { handleApiError(e, 'Failed to update volume') }
    finally { editSaving = false }
  }

  async function generateKeys() {
    const uid = Number(genUserId)
    if (!genUserId || Number.isNaN(uid)) return
    try {
      genResult = await store.generateApiKeys(id, { userId: uid })
      showSuccessToast('API keys generated')
    } catch (e: unknown) { handleApiError(e, 'Failed to generate keys') }
  }

  function handleRevokeKey() {
    if (!revokeKey) return
    const key = revokeKey
    dialog.confirm('Revoke API Key', `Revoke key "${key}"?`, async () => {
      await store.revokeApiKey(id, key)
      revokeKey = ''
      showSuccessToast('API key revoked')
    })
  }

  async function updateQuota() {
    const limit = Number(quotaInput)
    if (isNaN(limit) || limit < 0) return
    try {
      await store.updateQuota(id, limit)
      showSuccessToast('Quota updated')
      await reload()
    } catch (e: unknown) { handleApiError(e, 'Failed to update quota') }
  }
</script>

<div class="space-y-6">
  <div class="flex items-center gap-4">
    <Button variant="ghost" size="sm" href="/volumes" aria-label="Back to volumes"><ArrowLeft class="h-4 w-4" /></Button>
    <h1 class="text-2xl font-bold tracking-tight min-w-0 truncate">{volume?.name ?? 'Volume'}</h1>
    {#if volume}<Badge variant="outline" style="border-color: var(--pastel-volume); color: var(--pastel-volume-text)">Volume</Badge>{/if}
  </div>
  {#if loading}
    <LoadingSpinner />
  {:else if volume}
    <div class="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Details</CardTitle></CardHeader>
        <CardContent class="grid gap-3">
          <div>
            <span class="text-sm uppercase tracking-wider font-semibold text-muted-foreground">Status</span>
            <div class="mt-1"><StatusBadge active={volume.isActive} locked={volume.locked} /></div>
          </div>
          {#if volume.description}
            <div>
              <span class="text-sm uppercase tracking-wider font-semibold text-muted-foreground">Description</span>
              <p class="mt-1 text-sm break-words">{volume.description}</p>
            </div>
          {/if}
          <div>
            <span class="text-sm uppercase tracking-wider font-semibold text-muted-foreground">Encryption</span>
            <div class="mt-1"><Badge variant={volume.encryption ? 'default' : 'outline'}>{volume.encryption ? 'Enabled' : 'Disabled'}</Badge></div>
          </div>
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
          {#if !volume.isActive}
            <div>
              <span class="text-sm uppercase tracking-wider font-semibold text-muted-foreground inline-flex items-center gap-1">
                Cleanup
                <span title="Can be changed on deactivate">
                  <Lightbulb class="size-3.5 text-warning" aria-hidden="true" />
                </span>
              </span>
              <div class="mt-1 flex gap-2" role="list" aria-label="Cleanup flags">
                <span role="listitem"><Badge variant={volume.isCleanupMetaEnabled ? 'default' : 'outline'} aria-label="Meta: {volume.isCleanupMetaEnabled ? 'enabled' : 'disabled'}">Meta</Badge></span>
                <span role="listitem"><Badge variant={volume.isCleanupStorageEnabled ? 'default' : 'outline'} aria-label="Storage: {volume.isCleanupStorageEnabled ? 'enabled' : 'disabled'}">Storage</Badge></span>
                <span role="listitem"><Badge variant={volume.isCleanupVaultEnabled ? 'default' : 'outline'} aria-label="Vault: {volume.isCleanupVaultEnabled ? 'enabled' : 'disabled'}">Vault</Badge></span>
              </div>
            </div>
          {/if}
          <div>
            <span class="text-sm uppercase tracking-wider font-semibold text-muted-foreground">Quota</span>
            <p class="mt-1 text-sm">{formatQuota(volume.quotaUsed, volume.quotaLimit)}</p>
            {#if volume.quotaLimit > 0}
              {@const pct = quotaPercent(volume.quotaUsed, volume.quotaLimit)}
              <div class="mt-2 h-2 rounded-full bg-muted overflow-hidden" role="progressbar"
                aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}
                aria-label="Quota usage {pct}%">
                <div class="h-full rounded-full transition-transform origin-left {pct > 90 ? 'bg-destructive' : pct > 70 ? 'bg-warning' : 'bg-primary'}" style="transform: scaleX({pct / 100})"></div>
              </div>
            {/if}
          </div>
        </CardContent>
        {#if auth.can('volumes', 'update')}
          <CardFooter class="flex gap-2">
            {#if volume.isActive}
              <Button variant="outline" size="sm" onclick={() => { deactivateOpen = true }}>Deactivate</Button>
            {/if}
            <Button variant="outline" size="sm" onclick={() => dialog.confirm(
              volume!.locked ? 'Unlock' : 'Lock',
              `${volume!.locked ? 'Unlock' : 'Lock'} "${volume!.name}"?`,
              () => volume!.locked ? store.unlockVolume(id) : store.lockVolume(id),
            )}>{volume.locked ? 'Unlock' : 'Lock'}</Button>
          </CardFooter>
        {/if}
      </Card>

      {#if stats}
        <Card>
          <CardHeader><CardTitle>Storage Stats</CardTitle></CardHeader>
          <CardContent class="grid gap-3">
            <div>
              <span class="text-sm uppercase tracking-wider font-semibold text-muted-foreground">Disk Size</span>
              <p class="mt-1 font-mono text-sm">{formatBytes(stats.diskSize)}</p>
            </div>
            <div>
              <span class="text-sm uppercase tracking-wider font-semibold text-muted-foreground">Active Size</span>
              <p class="mt-1 font-mono text-sm">{formatBytes(stats.activeSize)}</p>
            </div>
            <div>
              <span class="text-sm uppercase tracking-wider font-semibold text-muted-foreground">Total Size</span>
              <p class="mt-1 font-mono text-sm">{formatBytes(stats.size)}</p>
            </div>
          </CardContent>
        </Card>
      {/if}
    </div>

    {#if volume.isActive && auth.can('volumes', 'update')}
      <Separator />

      <Card>
        <CardHeader><CardTitle>Edit Volume</CardTitle></CardHeader>
        <CardContent class="space-y-4">
          <div class="space-y-2">
            <Label for="edit-desc">Description</Label>
            <Textarea id="edit-desc" bind:value={editDesc} placeholder="Volume description" rows={2} />
          </div>
          <div class="grid gap-4 md:grid-cols-2">
            <div class="space-y-2">
              <Label for="edit-retention">
                <span class="inline-flex items-center gap-1">
                  Snapshot Window (days)
                  <span title="How long deleted items and old versions are retained before cleanup. Beyond this window, snapshot mounts may show inconsistent data due to cleaned-up data.">
                    <Lightbulb class="size-3.5 text-warning" aria-hidden="true" />
                  </span>
                </span>
              </Label>
              <Input id="edit-retention" type="number" bind:value={editRetention} placeholder="30" min="0" max="366" />
            </div>
            <div class="space-y-2">
              <Label for="edit-grace">
                <span class="inline-flex items-center gap-1">
                  Grace Period (days)
                  <span title="How long data stays before cleanup after deactivation">
                    <Lightbulb class="size-3.5 text-warning" aria-hidden="true" />
                  </span>
                </span>
              </Label>
              <Input id="edit-grace" type="number" bind:value={editGrace} placeholder="14" min="0" max="91" />
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button size="sm" disabled={editSaving || !editDirty} onclick={saveEdit}>{editSaving ? 'Saving...' : 'Save'}</Button>
        </CardFooter>
      </Card>

      <Separator />

      <Card>
        <CardHeader><CardTitle>Update Quota</CardTitle></CardHeader>
        <CardContent>
          <div class="flex items-end gap-3">
            <div class="flex-1">
              <Label for="quota-limit">Quota Limit (bytes)</Label>
              <Input id="quota-limit" bind:value={quotaInput} placeholder="0 = unlimited" />
            </div>
            <Button size="sm" onclick={updateQuota}>Update</Button>
          </div>
        </CardContent>
      </Card>
    {/if}

    {#if auth.can('volumes', 'update') || auth.isUserRole}
      <Separator />

      <Card>
        <CardHeader><CardTitle>API Keys</CardTitle></CardHeader>
        <CardContent class="space-y-4">
          <div class="flex items-end gap-3">
            <div class="flex-1">
              <Label for="api-key-user-id">User ID</Label>
              <Input id="api-key-user-id" bind:value={genUserId} placeholder="User ID to generate key for" readonly={auth.isUserRole} />
            </div>
            <Button size="sm" onclick={generateKeys}>Generate</Button>
          </div>
          {#if genResult}
            <div class="rounded-md border p-3 space-y-2 bg-muted/50">
              <p class="text-sm font-medium">Generated credentials (save now, shown once):</p>
              <div>
                <span class="text-sm text-muted-foreground">API Key</span>
                <p class="font-mono text-sm break-all">{genResult.apiKey}</p>
              </div>
              <div>
                <span class="text-sm text-muted-foreground">API Secret</span>
                <p class="font-mono text-sm break-all">{genResult.apiSecret}</p>
              </div>
            </div>
          {/if}
          <Separator />
          <div class="flex items-end gap-3">
            <div class="flex-1">
              <Label for="revoke-key-id">Revoke API Key</Label>
              <Input id="revoke-key-id" bind:value={revokeKey} placeholder="API key to revoke" />
            </div>
            <Button variant="destructive" size="sm" onclick={handleRevokeKey}>Revoke</Button>
          </div>
        </CardContent>
      </Card>
    {/if}
  {:else}
    <p class="text-muted-foreground">Volume not found.</p>
  {/if}
</div>
<ConfirmDialog bind:open={dialog.open} title={dialog.title} description={dialog.desc} onConfirm={dialog.action} />
{#if volume}
  <DeactivateVolumeDialog bind:open={deactivateOpen} volumeName={volume.name} onConfirm={handleDeactivate} />
{/if}
