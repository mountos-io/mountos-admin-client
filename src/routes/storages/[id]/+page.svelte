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
  import ConfirmDialog from '$lib/components/shared/ConfirmDialog.svelte'
  import LoadingSpinner from '$lib/components/shared/LoadingSpinner.svelte'
  import { showErrorToast, showSuccessToast, handleApiError } from '$lib/core/utils/toast'
  import { useConfirmDialog } from '$lib/stores/confirm-dialog.svelte'
  import ArrowLeft from '@lucide/svelte/icons/arrow-left'
  import PencilIcon from '@lucide/svelte/icons/pencil'
  import FlaskConical from '@lucide/svelte/icons/flask-conical'
  import Loader2 from '@lucide/svelte/icons/loader-2'
  import DatabaseIcon from '@lucide/svelte/icons/database'
  import type { Storage, EditStorageRequest } from '$lib/core/api/types'

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
  const dialog = useConfirmDialog(() => reload())

  let editing = $state(false)
  let editName = $state('')
  let editAccessKey = $state('')
  let editSecretKey = $state('')
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

  $effect(() => {
    if (Number.isNaN(id)) { loading = false; return }
    loading = true
    store.getStorage(id).then(s => { storage = s }).catch(() => { storage = null }).finally(() => { loading = false })
  })

  async function reload() {
    storage = await store.getStorage(id)
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
</script>

<div class="space-y-6">
  <div class="flex items-center gap-4">
    <Button variant="ghost" size="sm" href="/storages" aria-label="Back to storages"><ArrowLeft class="h-4 w-4" /></Button>
    <h1 class="text-2xl font-bold tracking-tight">{storage?.name ?? 'Storage'}</h1>
    {#if storage}<Badge variant="outline" style="border-color: var(--pastel-storage); color: var(--pastel-storage-text)">Storage</Badge>{/if}
  </div>
  {#if loading}
    <LoadingSpinner />
  {:else if storage}
    <Card cornerBrackets>
      {#if editing}
        <form onsubmit={handleUpdate} class="flex flex-col gap-6">
          <CardHeader><CardTitle>Edit Storage</CardTitle></CardHeader>
          <CardContent class="space-y-5">
            <div class="space-y-2">
              <Label for="edit-name">Name</Label>
              <Input id="edit-name" bind:value={editName} placeholder="Storage name" required />
            </div>

            <Separator />

            <p class="text-sm font-medium">Update Credentials</p>
            <p class="text-xs text-muted-foreground">Leave blank to keep current credentials.</p>
            <div class="grid gap-4 md:grid-cols-2">
              <div class="space-y-2">
                <Label for="edit-accessKey">Access Key</Label>
                <Input id="edit-accessKey" bind:value={editAccessKey} placeholder="New access key" autocomplete="off" />
              </div>
              <div class="space-y-2">
                <Label for="edit-secretKey">Secret Key</Label>
                <SecretInput id="edit-secretKey" bind:value={editSecretKey} placeholder="New secret key" autocomplete="off" />
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
          <CardFooter class="gap-4">
            <Button variant="primary" type="submit" size="sm" class="cyberpunk-skewed-sm" disabled={!canSave}>
              {editSubmitting ? 'Saving…' : 'Save'}
            </Button>
            <Button variant="secondary" size="sm" type="button" onclick={cancelEdit} disabled={editSubmitting}>Cancel</Button>
          </CardFooter>
        </form>
      {:else}
        <CardHeader>
          <div class="flex items-center gap-3">
            <CardTitle class="flex-1 truncate">{storage.name}</CardTitle>
            {#if auth.can('storages', 'update')}
              <button type="button" onclick={startEdit}
                class="opacity-50 hover:opacity-100 hover:text-primary transition-all"
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

          {#if storage.description}
            <div>
              <span class="text-sm uppercase tracking-wider font-semibold text-muted-foreground">Description</span>
              <p class="mt-1 text-sm">{storage.description}</p>
            </div>
          {/if}

          <div class="grid gap-4 md:grid-cols-2">
            <div>
              <span class="text-sm uppercase tracking-wider font-semibold text-muted-foreground">Endpoint</span>
              <p class="mt-1 text-sm font-mono truncate" title={storage.endpoint}>{storage.endpoint}</p>
            </div>
            {#if storage.bucket}
              <div>
                <span class="text-sm uppercase tracking-wider font-semibold text-muted-foreground">Bucket</span>
                <p class="mt-1 text-sm font-mono">{storage.bucket}</p>
              </div>
            {/if}
            {#if storage.region}
              <div>
                <span class="text-sm uppercase tracking-wider font-semibold text-muted-foreground">Region</span>
                <p class="mt-1 text-sm font-mono">{storage.region}</p>
              </div>
            {/if}
            {#if storage.base}
              <div>
                <span class="text-sm uppercase tracking-wider font-semibold text-muted-foreground">Base Path</span>
                <p class="mt-1 text-sm font-mono">{storage.base}</p>
              </div>
            {/if}
          </div>
        </CardContent>
        <CardFooter class="gap-2">
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
          {#if storage.isActive && auth.can('storages', 'update')}
            <Button variant="destructive" size="sm" onclick={() => {
              if (!auth.guard('storages', 'update')) return
              dialog.confirm(
                'Deactivate',
                `Deactivate "${storage!.name}"? Make sure all volumes on this storage are deactivated first. This action cannot be reverted.`,
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
  {:else}
    <p class="text-muted-foreground">Storage not found.</p>
  {/if}
</div>
<ConfirmDialog bind:open={dialog.open} title={dialog.title} description={dialog.desc} variant={dialog.variant} onConfirm={dialog.action} />
