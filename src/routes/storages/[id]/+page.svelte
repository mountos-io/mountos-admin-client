<script lang="ts">
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { useStorages } from '$lib/core/stores/storages.svelte'
  import { useAuth } from '$lib/core/stores/auth.svelte'
  import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '$lib/components/ui/card'
  import { Button } from '$lib/components/ui/button'
  import { Badge } from '$lib/components/ui/badge'
  import { Separator } from '$lib/components/ui/separator'
  import Input from '$lib/components/ui/input/input.svelte'
  import SecretInput from '$lib/components/ui/input/secret-input.svelte'
  import Label from '$lib/components/ui/label/label.svelte'
  import StatusBadge from '$lib/components/shared/StatusBadge.svelte'
  import BucketTester from '$lib/components/shared/BucketTester.svelte'
  import BlockCopysets from '$lib/components/shared/BlockCopysets.svelte'
  import StorageVolumes from '$lib/components/shared/StorageVolumes.svelte'
  import CompatibleStorages from '$lib/components/shared/CompatibleStorages.svelte'
  import ConfirmDialog from '$lib/components/shared/ConfirmDialog.svelte'
  import DetailSkeleton from '$lib/components/shared/DetailSkeleton.svelte'
  import { showErrorToast, showSuccessToast, handleApiError } from '$lib/core/utils/toast'
  import { copyText } from '$lib/core/utils/clipboard'
  import { formatBytes } from '$lib/core/utils/format'
  import { useConfirmDialog } from '$lib/stores/confirm-dialog.svelte'
  import ArrowLeft from '@lucide/svelte/icons/arrow-left'
  import CopyIcon from '@lucide/svelte/icons/copy'
  import CheckIcon from '@lucide/svelte/icons/check'
  import PencilIcon from '@lucide/svelte/icons/pencil'
  import FlaskConical from '@lucide/svelte/icons/flask-conical'
  import Loader2 from '@lucide/svelte/icons/loader-2'
  import DatabaseIcon from '@lucide/svelte/icons/database'
  import ServerIcon from '@lucide/svelte/icons/server'
  import Wrench from '@lucide/svelte/icons/wrench'
  import TriangleAlert from '@lucide/svelte/icons/triangle-alert'
  import type { Storage, EditStorageRequest } from '$lib/core/api/types'
  import { getProvider } from '$lib/core/utils/object-storage-providers'

  const store = useStorages()
  const auth = useAuth()
  const id = $derived(Number($page.params.id))

  $effect(() => {
    if (!auth.loading && !auth.can('storages', 'read')) {
      showErrorToast('Access denied')
      goto('/', { replaceState: true })
    }
  })

  let storage = $state<Storage | null>(null)
  let loading = $state(true)
  let volumesRefreshKey = $state(0)
  const dialog = useConfirmDialog(() => reload())

  let editing = $state(false)
  let editName = $state('')
  let editAccessKey = $state('')
  let editSecretKey = $state('')

  const editAccessKeyLabel = $derived(getProvider(storage?.providerType ?? '')?.accessKeyLabel ?? 'Access Key')
  const editSecretKeyLabel = $derived(getProvider(storage?.providerType ?? '')?.secretKeyLabel ?? 'Secret Key')
  const editBucketLabel = $derived(getProvider(storage?.providerType ?? '')?.bucketLabel ?? 'Bucket')
  const editRegionLabel = $derived(getProvider(storage?.providerType ?? '')?.regionLabel ?? 'Region')
  // Disambiguate the provider's bucket region from the mountOS region field shown alongside it.
  const providerRegionLabel = $derived(editRegionLabel === 'Region' ? 'Bucket Region' : editRegionLabel)
  let editSubmitting = $state(false)
  let credTestPassed = $state(false)

  let bucketTesting = $state(false)

  async function runBucketTest() {
    if (!storage || bucketTesting) return
    bucketTesting = true
    try {
      await store.testStorageBucket(storage.id)
      showSuccessToast('Bucket test passed')
    } catch (e: unknown) {
      showErrorToast(e instanceof Error ? e.message : 'Bucket test failed')
    } finally {
      bucketTesting = false
    }
  }

  const credsChanged = $derived(!!(editAccessKey.trim() || editSecretKey.trim()))
  const credsBothFilled = $derived(!credsChanged || (!!editAccessKey.trim() && !!editSecretKey.trim()))
  const canSave = $derived(editName.trim() && !editSubmitting && credsBothFilled && (!credsChanged || credTestPassed))

  let fetchCtrl: AbortController | undefined
  $effect(() => {
    if (Number.isNaN(id)) { loading = false; return }
    fetchCtrl?.abort()
    fetchCtrl = new AbortController()
    const ctrl = fetchCtrl
    loading = true
    store.getStorage(id)
      .then(s => { if (!ctrl.signal.aborted) storage = s })
      .catch(() => { if (!ctrl.signal.aborted) storage = null })
      .finally(() => { if (!ctrl.signal.aborted) loading = false })
  })

  async function reload() {
    storage = await store.getStorage(id)
  }

  let fingerprintCopied = $state(false)
  async function copyFingerprint(value: string) {
    if (await copyText(value)) {
      fingerprintCopied = true
      showSuccessToast('Fingerprint copied')
      setTimeout(() => { fingerprintCopied = false }, 1500)
    } else {
      showErrorToast('Copy failed: clipboard access blocked')
    }
  }

  function startEdit() {
    if (!storage) return
    editName = storage.name
    editAccessKey = ''
    editSecretKey = ''
    credTestPassed = false
    editing = true
  }

  function cancelEdit() {
    editing = false
  }

  async function handleUpdate(e: Event) {
    e.preventDefault()
    if (!canSave || !storage) return
    editSubmitting = true
    try {
      const req: EditStorageRequest = { name: editName.trim() }
      if (editAccessKey.trim()) req.accessKey = editAccessKey.trim()
      if (editSecretKey.trim()) req.secretKey = editSecretKey.trim()
      await store.editStorage(id, req)
      storage = await store.getStorage(id)
      editing = false
      showSuccessToast('Storage updated')
    } catch (err: unknown) {
      handleApiError(err, 'Failed to update storage')
    } finally {
      editSubmitting = false
    }
  }

  const isObject = $derived(storage?.storageType === 'object')
  const isBlock = $derived(storage?.storageType === 'block')
  const maintenanceOn = $derived(!!storage?.directAccess)
  let maintenanceSubmitting = $state(false)

  // Opens BlockCopysets' servers-list register dialog from this page's top-level action row,
  // reusing that same dialog rather than duplicating its form.
  let addServerOpen = $state(false)
  let clustersAvailable = $state(true)

  // Maintenance mode ("direct access") makes a block storage bypass blockserv and hit its
  // backing object store directly, so blockserv can be safely stopped/upgraded. Flipping it
  // is operationally significant: gate behind a confirm dialog, then reload the record.
  function toggleMaintenance() {
    if (!storage || !auth.guard('storages', 'update')) return
    const next = !maintenanceOn
    dialog.confirm(
      next ? 'Enable maintenance mode' : 'Disable maintenance mode',
      next
        ? `Enable direct access on "${storage.name}"? Clients and gateways read the backing object store directly and fall back to blockserv only for objects not yet synced. Keep at least one blockserv instance running until it reports drain-ready (fully synced and no active clients streaming): stopping all instances early makes unsynced objects unreachable.`
        : `Disable direct access on "${storage.name}"? Clients and gateways will resume routing through blockserv. Ensure blockserv is running and healthy first.`,
      async () => {
        maintenanceSubmitting = true
        try {
          await store.setDirectAccess(id, storage!.name, next)
          showSuccessToast(next ? 'Maintenance mode enabled' : 'Maintenance mode disabled')
        } catch (err: unknown) {
          handleApiError(err, 'Failed to update maintenance mode')
          throw err
        } finally {
          maintenanceSubmitting = false
        }
      },
      next ? 'destructive' : 'default',
    )
  }
</script>

<svelte:head><title>{storage?.name ?? 'Storage'} · mountOS Admin</title></svelte:head>

<div class="space-y-6">
  <div class="flex items-center gap-4">
    <Button variant="ghost" size="sm" href="/storages" class="min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0" aria-label="Back to storages"><ArrowLeft class="h-4 w-4" /></Button>
    <h1 class="text-2xl font-bold tracking-tight">{storage?.name ?? 'Storage'}</h1>
    {#if storage}<Badge variant="outline" style="border-color: var(--pastel-storage); color: var(--pastel-storage-text)">Storage</Badge>{/if}
    {#if maintenanceOn}
      <Badge variant="warning" title="blockserv is bypassed; the backing object store is accessed directly">
        <Wrench class="size-3 mr-1" aria-hidden="true" />Maintenance
      </Badge>
    {/if}
  </div>
  {#if loading}
    <DetailSkeleton cards={[{ rows: 3, cols: 2 }]} />
  {:else if storage}
    <Card cornerBrackets>
      {#if editing}
        <form onsubmit={handleUpdate} class="flex flex-col gap-6">
          <CardHeader><CardTitle>Edit Storage</CardTitle></CardHeader>
          <CardContent class="space-y-5">
            <div class="space-y-2">
              <Label for="edit-name">Name</Label>
              <Input id="edit-name" bind:value={editName} placeholder="Storage name" required aria-required="true" />
            </div>

            <Separator />

            <p class="text-sm font-medium">Update Credentials</p>
            <p class="text-xs text-muted-foreground">Leave blank to keep current credentials.</p>
            <div class="grid gap-4 md:grid-cols-2">
              <div class="space-y-2">
                <Label for="edit-accessKey">{editAccessKeyLabel}</Label>
                <Input id="edit-accessKey" bind:value={editAccessKey} placeholder={`New ${editAccessKeyLabel.toLowerCase()}`} autocomplete="off" />
              </div>
              <div class="space-y-2">
                <Label for="edit-secretKey">{editSecretKeyLabel}</Label>
                <SecretInput id="edit-secretKey" bind:value={editSecretKey} placeholder={`New ${editSecretKeyLabel.toLowerCase()}`} autocomplete="off" />
              </div>
            </div>

            {#if credsChanged && !credsBothFilled}
              <p class="text-xs text-destructive">Both access key and secret key are required when updating credentials.</p>
            {/if}

            {#if credsChanged && credsBothFilled}
              <BucketTester
                endpoint={storage.endpoint}
                region={storage.region ?? ''}
                bucket={storage.bucket ?? ''}
                accessKey={editAccessKey}
                secretKey={editSecretKey}
                providerType={storage.providerType}
                onresult={(passed) => { credTestPassed = passed }}
              />
            {/if}
          </CardContent>
          <CardFooter class="gap-4 [&_[data-slot=button]]:min-h-[44px] sm:[&_[data-slot=button]]:min-h-8">
            <Button variant="primary" type="submit" size="sm" class="cyberpunk-skewed-sm" disabled={!canSave}>
              {editSubmitting ? 'Saving…' : 'Save'}
            </Button>
            <Button variant="secondary" size="sm" type="button" onclick={cancelEdit} disabled={editSubmitting}>Cancel</Button>
          </CardFooter>
        </form>
      {:else}
        <CardHeader>
          <div class="flex items-center gap-3">
            <CardTitle class="min-w-0 flex-1 truncate" title={storage.name}>{storage.name}</CardTitle>
            {#if auth.can('storages', 'update')}
              <button type="button" onclick={startEdit}
                class="inline-flex items-center justify-center min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 opacity-60 hover:opacity-100 hover:text-primary transition-[color,opacity] focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
                title="Edit storage" aria-label="Edit storage">
                <PencilIcon class="size-4" aria-hidden="true" />
              </button>
            {/if}
          </div>
        </CardHeader>
        <CardContent class="space-y-4">
          <div class="grid gap-4 md:grid-cols-2">
            <div>
              <span class="text-sm uppercase tracking-wider font-semibold text-muted-foreground">Status</span>
              <div class="mt-1"><StatusBadge active={storage.isActive} /></div>
            </div>
            <div>
              <span class="text-sm uppercase tracking-wider font-semibold text-muted-foreground">Type</span>
              <div class="mt-1 flex gap-2">
                <Badge variant="outline">{storage.storageType}</Badge>
                <Badge variant="secondary">{storage.providerType}</Badge>
              </div>
            </div>
          </div>

          {#if maintenanceOn}
            <div class="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 p-3 text-xs text-warning" role="status">
              <TriangleAlert class="size-4 shrink-0" aria-hidden="true" />
              <p>
                <span class="font-medium">Maintenance mode is active.</span>
                Clients and gateways read the backing object store directly and fall back to blockserv only for objects not yet synced. Keep at least one blockserv instance running until it reports drain&#8209;ready (fully synced and no active clients streaming): stopping all instances early makes unsynced objects unreachable.
              </p>
            </div>
          {/if}

          {#if storage.description || storage.blockSize}
            <div class="grid gap-4 md:grid-cols-2">
              {#if storage.description}
                <div>
                  <span class="text-sm uppercase tracking-wider font-semibold text-muted-foreground">Description</span>
                  <p class="mt-1 text-sm">{storage.description}</p>
                </div>
              {/if}
              {#if storage.blockSize}
                <div>
                  <span class="text-sm uppercase tracking-wider font-semibold text-muted-foreground">Block Size</span>
                  <p class="mt-1 text-sm font-mono">{formatBytes(storage.blockSize)}</p>
                </div>
              {/if}
            </div>
          {/if}

          <div class="grid gap-4 md:grid-cols-2">
            <div>
              <span class="text-sm uppercase tracking-wider font-semibold text-muted-foreground">Region</span>
              <div class="mt-1 text-sm">
                <a
                  href="/regions/{storage.regionInfo.id}"
                  aria-label="View region {storage.regionInfo.name}"
                  class="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                >{storage.regionInfo.name}</a>
              </div>
            </div>
            <div class="min-w-0">
              <span class="text-sm uppercase tracking-wider font-semibold text-muted-foreground">Endpoint</span>
              <p class="mt-1 text-sm font-mono truncate" title={storage.endpoint}>{storage.endpoint}</p>
            </div>
            {#if storage.bucket}
              <div>
                <span class="text-sm uppercase tracking-wider font-semibold text-muted-foreground">{editBucketLabel}</span>
                <p class="mt-1 text-sm font-mono">{storage.bucket}</p>
              </div>
            {/if}
            {#if storage.region}
              <div>
                <span class="text-sm uppercase tracking-wider font-semibold text-muted-foreground">{providerRegionLabel}</span>
                <p class="mt-1 text-sm font-mono">{storage.region}</p>
              </div>
            {/if}
            {#if storage.base}
              <div>
                <span class="text-sm uppercase tracking-wider font-semibold text-muted-foreground">Base Path</span>
                <p class="mt-1 text-sm font-mono">{storage.base}</p>
              </div>
            {/if}
            {#if storage.physicalFingerprint}
              <div class="md:col-span-2">
                <span class="text-sm uppercase tracking-wider font-semibold text-muted-foreground" title="Identifies the backing bucket/prefix; storages sharing this value can move volumes between them">Physical Fingerprint</span>
                <div class="mt-1 flex items-center gap-2">
                  <code class="min-w-0 break-all rounded-sm bg-muted px-2 py-1 font-mono text-xs">{storage.physicalFingerprint}</code>
                  <button type="button" onclick={() => copyFingerprint(storage!.physicalFingerprint!)}
                    class="shrink-0 inline-flex items-center justify-center min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 opacity-60 hover:opacity-100 hover:text-primary focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring rounded-sm transition-[color,opacity]"
                    title="Copy full fingerprint" aria-label="Copy full physical fingerprint">
                    {#if fingerprintCopied}<CheckIcon class="size-3.5 text-primary" aria-hidden="true" />{:else}<CopyIcon class="size-3.5" aria-hidden="true" />{/if}
                  </button>
                </div>
              </div>
            {/if}
          </div>
        </CardContent>
        <CardFooter class="gap-2 [&_[data-slot=button]]:min-h-[44px] sm:[&_[data-slot=button]]:min-h-8">
          {#if isObject}
            <Button variant="outline" size="sm" disabled={bucketTesting} onclick={runBucketTest}>
              {#if bucketTesting}
                <Loader2 class="h-4 w-4 animate-spin" />
              {:else}
                <FlaskConical class="h-4 w-4" />
              {/if}
              {bucketTesting ? 'Testing…' : 'Test Bucket'}
            </Button>
          {/if}
          {#if auth.can('volumes', 'create')}
            <Button variant="outline" size="sm" href="/volumes/create?storageId={storage.id}" class="gap-1.5">
              <DatabaseIcon class="h-4 w-4" />
              Create Volume
            </Button>
          {/if}
          {#if isBlock && auth.can('storages', 'update')}
            <Button variant="outline" size="sm" class="gap-1.5" disabled={!clustersAvailable}
              title={clustersAvailable ? undefined : 'No active, ready cluster in this region to register into'}
              onclick={() => { addServerOpen = true }}>
              <ServerIcon class="h-4 w-4" />
              Add Server
            </Button>
          {/if}
          {#if isBlock && storage.isActive && auth.can('storages', 'update')}
            <Button variant={maintenanceOn ? 'primary' : 'outline'} size="sm" class="gap-1.5"
              disabled={maintenanceSubmitting} onclick={toggleMaintenance}>
              {#if maintenanceSubmitting}
                <Loader2 class="h-4 w-4 animate-spin" />
              {:else}
                <Wrench class="h-4 w-4" />
              {/if}
              {maintenanceOn ? 'Disable Maintenance' : 'Enable Maintenance'}
            </Button>
          {/if}
          {#if storage.isActive && auth.can('storages', 'update')}
            <Button variant="destructive" size="sm" onclick={() => {
              if (!auth.guard('storages', 'update')) return
              dialog.confirm(
                'Deactivate',
                `Permanently deactivate "${storage!.name}"? All volumes on this storage must be deactivated first.`,
                () => store.deactivateStorage(id),
                'destructive',
              )
            }}>
              Deactivate
            </Button>
          {/if}
        </CardFooter>
      {/if}
    </Card>

    {#if isObject}
      {#key volumesRefreshKey}
        <StorageVolumes storageId={storage.id} accountId={storage.account.id} />
      {/key}
    {:else}
      <BlockCopysets storageId={storage.id} regionId={storage.regionInfo.id} accountId={storage.account.id} directAccess={maintenanceOn}
        canUpdate={auth.can('storages', 'update')} {volumesRefreshKey}
        bind:addServerOpen bind:clustersAvailable />
    {/if}

    {#if storage.physicalFingerprint}
      <CompatibleStorages
        storageId={storage.id}
        storageType={storage.storageType}
        onmoved={() => { volumesRefreshKey += 1 }}
      />
    {/if}
  {:else}
    <p class="text-muted-foreground">Storage not found.</p>
  {/if}
</div>
<ConfirmDialog bind:open={dialog.open} title={dialog.title} description={dialog.desc} variant={dialog.variant} onConfirm={dialog.action} />
