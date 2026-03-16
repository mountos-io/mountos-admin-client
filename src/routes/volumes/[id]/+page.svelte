<script lang="ts">
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { useVolumes } from '$lib/core/stores/volumes.svelte'
  import { useAccounts } from '$lib/core/stores/accounts.svelte'
  import { useAuth } from '$lib/core/stores/auth.svelte'
  import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '$lib/components/ui/card'
  import { Button } from '$lib/components/ui/button'
  import { Badge } from '$lib/components/ui/badge'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import { Separator } from '$lib/components/ui/separator'
  import StatusBadge from '$lib/components/shared/StatusBadge.svelte'
  import ConfirmDialog from '$lib/components/shared/ConfirmDialog.svelte'
  import LoadingSpinner from '$lib/components/shared/LoadingSpinner.svelte'
  import { formatBytes, formatQuota, quotaPercent } from '$lib/core/utils/format'
  import type { Volume } from '$lib/core/api/types'
  import { handleApiError, showErrorToast, showSuccessToast } from '$lib/core/utils/toast'

  const store = useVolumes()
  const auth = useAuth()
  const id = $derived(Number($page.params.id))

  $effect(() => {
    if (!auth.loading && !auth.can('volumes', 'read')) {
      showErrorToast('Access denied')
      goto('/', { replaceState: true })
    }
  })

  let volume = $state<Volume | null>(null)
  let loading = $state(true)
  let stats = $state<{ diskSize: number; activeSize: number; size: number } | null>(null)
  let confirmAction = $state<{ open: boolean; title: string; desc: string; action: () => Promise<void> }>({
    open: false, title: '', desc: '', action: async () => {},
  })

  let genUserId = $state(auth.userMountosUserId != null ? String(auth.userMountosUserId) : '')
  let genResult = $state<{ apiKey: string; apiSecret: string } | null>(null)
  let revokeKey = $state('')
  let quotaInput = $state('')

  $effect(() => {
    if (Number.isNaN(id)) { loading = false; return }
    loading = true
    Promise.all([
      store.getVolume(id),
      store.getStats(id).catch(() => null),
    ]).then(([v, s]) => {
      volume = v
      stats = s
      quotaInput = String(v.quotaLimit)
    }).catch(() => { volume = null; stats = null }).finally(() => { loading = false })
  })

  async function reload() {
    volume = await store.getVolume(id)
    stats = await store.getStats(id).catch(() => null)
  }

  function confirm(title: string, desc: string, action: () => Promise<void>) {
    confirmAction = { open: true, title, desc, action: async () => { await action(); await reload() } }
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
    confirm('Revoke API Key', `Revoke key "${key}"?`, async () => {
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
    <Button variant="ghost" size="sm" href="/volumes">Back</Button>
    <h2 class="text-2xl font-bold tracking-tight">Volume Detail</h2>
  </div>
  {#if loading}
    <LoadingSpinner />
  {:else if volume}
    <div class="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>{volume.name}</CardTitle></CardHeader>
        <CardContent class="grid gap-3">
          <div>
            <span class="text-sm text-muted-foreground">Status</span>
            <div class="mt-1"><StatusBadge active={volume.isActive} locked={volume.locked} /></div>
          </div>
          {#if volume.description}
            <div>
              <span class="text-sm text-muted-foreground">Description</span>
              <p class="mt-1 text-sm">{volume.description}</p>
            </div>
          {/if}
          <div class="flex gap-4">
            <div>
              <span class="text-sm text-muted-foreground">Encryption</span>
              <div class="mt-1"><Badge variant={volume.encryption ? 'default' : 'outline'}>{volume.encryption ? 'Enabled' : 'Disabled'}</Badge></div>
            </div>
          </div>
          <div>
            <span class="text-sm text-muted-foreground">Quota</span>
            <p class="mt-1 text-sm">{formatQuota(volume.quotaUsed, volume.quotaLimit)}</p>
            {#if volume.quotaLimit > 0}
              <div class="mt-2 h-2 rounded-full bg-muted overflow-hidden">
                <div class="h-full rounded-full bg-primary transition-all" style="width: {quotaPercent(volume.quotaUsed, volume.quotaLimit)}%"></div>
              </div>
            {/if}
          </div>
        </CardContent>
        {#if auth.can('volumes', 'update')}
          <CardFooter class="flex gap-2">
            <Button variant="outline" size="sm" onclick={() => confirm(
              volume!.isActive ? 'Deactivate' : 'Activate',
              `${volume!.isActive ? 'Deactivate' : 'Activate'} "${volume!.name}"?`,
              () => volume!.isActive ? store.deactivateVolume(id) : store.activateVolume(id),
            )}>{volume.isActive ? 'Deactivate' : 'Activate'}</Button>
            <Button variant="outline" size="sm" onclick={() => confirm(
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
              <span class="text-sm text-muted-foreground">Disk Size</span>
              <p class="mt-1 font-mono text-sm">{formatBytes(stats.diskSize)}</p>
            </div>
            <div>
              <span class="text-sm text-muted-foreground">Active Size</span>
              <p class="mt-1 font-mono text-sm">{formatBytes(stats.activeSize)}</p>
            </div>
            <div>
              <span class="text-sm text-muted-foreground">Total Size</span>
              <p class="mt-1 font-mono text-sm">{formatBytes(stats.size)}</p>
            </div>
          </CardContent>
        </Card>
      {/if}
    </div>

    {#if auth.can('volumes', 'update')}
      <Separator />

      <Card>
        <CardHeader><CardTitle>Update Quota</CardTitle></CardHeader>
        <CardContent>
          <div class="flex items-end gap-3">
            <div class="flex-1">
              <Label>Quota Limit (bytes)</Label>
              <Input bind:value={quotaInput} placeholder="0 = unlimited" />
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
              <Label>User ID</Label>
              <Input bind:value={genUserId} placeholder="User ID to generate key for" readonly={auth.isUserRole} />
            </div>
            <Button size="sm" onclick={generateKeys}>Generate</Button>
          </div>
          {#if genResult}
            <div class="rounded-md border p-3 space-y-2 bg-muted/50">
              <p class="text-sm font-medium">Generated credentials (save now, shown once):</p>
              <div>
                <span class="text-xs text-muted-foreground">API Key</span>
                <p class="font-mono text-sm break-all">{genResult.apiKey}</p>
              </div>
              <div>
                <span class="text-xs text-muted-foreground">API Secret</span>
                <p class="font-mono text-sm break-all">{genResult.apiSecret}</p>
              </div>
            </div>
          {/if}
          <Separator />
          <div class="flex items-end gap-3">
            <div class="flex-1">
              <Label>Revoke API Key</Label>
              <Input bind:value={revokeKey} placeholder="API key to revoke" />
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
<ConfirmDialog bind:open={confirmAction.open} title={confirmAction.title} description={confirmAction.desc} onConfirm={confirmAction.action} />
