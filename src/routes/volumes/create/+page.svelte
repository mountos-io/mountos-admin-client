<script lang="ts">
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { useVolumes } from '$lib/core/stores/volumes.svelte'
  import { useStorages } from '$lib/core/stores/storages.svelte'
  import { useAccounts } from '$lib/core/stores/accounts.svelte'
  import { useAuth } from '$lib/core/stores/auth.svelte'
  import { Button } from '$lib/components/ui/button'
  import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '$lib/components/ui/card'
  import Input from '$lib/components/ui/input/input.svelte'
  import Label from '$lib/components/ui/label/label.svelte'
  import { Select } from '$lib/components/ui/select'
  import { Checkbox } from '$lib/components/ui/checkbox'
  import { Separator } from '$lib/components/ui/separator'
  import Combobox from '$lib/components/shared/Combobox.svelte'
  import EmptyState from '$lib/components/shared/EmptyState.svelte'
  import LoadingSpinner from '$lib/components/shared/LoadingSpinner.svelte'
  import { showSuccessToast, showErrorToast, handleApiError } from '$lib/core/utils/toast'
  import { HUB_REGION_NAME } from '$lib/core/constants'
  import { gbToBytes } from '$lib/core/utils/format'
  import Copy from '@lucide/svelte/icons/copy'
  import InfoTip from '$lib/components/shared/InfoTip.svelte'

  const volumeStore = useVolumes()
  const storageStore = useStorages()
  const accountStore = useAccounts()
  const auth = useAuth()
  const accountId = $derived(accountStore.selectedAccountId)

  $effect(() => {
    if (!auth.loading && !auth.can('volumes', 'create')) {
      showErrorToast('Access denied')
      goto('/', { replaceState: true })
    }
  })

  const preselectedStorageId = $page.url.searchParams.get('storageId') ?? ''

  let storagesLoaded = $state(false)
  $effect(() => {
    if (accountId) {
      storageId = ''
      storagesLoaded = false
      storageStore.fetchStorages(accountId, 1, 100).finally(() => {
        if (preselectedStorageId) storageId = preselectedStorageId
        storagesLoaded = true
      })
    }
  })

  const storageOptions = $derived(
    storageStore.storages
      .filter(s => s.regionInfo.name !== HUB_REGION_NAME)
      .map(s => ({ value: String(s.id), label: s.name }))
  )

  let name = $state('')
  let description = $state('')
  let storageId = $state('')
  let volumeType = $state('')
  let encryption = $state(false)
  let encryptionKey = $state('')
  let retentionPeriod = $state('30')
  let gracePeriod = $state('14')
  let quotaLimit = $state('')
  let submitting = $state(false)
  let createResult = $state<{ id: number; encryptionKey: string } | null>(null)

  const canSubmit = $derived(name.trim() && storageId && volumeType)

  async function handleSubmit(e: Event) {
    e.preventDefault()
    if (!canSubmit || !accountId) return
    submitting = true
    try {
      const result = await volumeStore.createVolume({
        accountId,
        storageId: Number(storageId),
        name: name.trim(),
        description: description.trim() || undefined,
        volumeType,
        encryption: encryption ? true : undefined,
        encryptionKey: (encryption && encryptionKey.trim()) ? encryptionKey.trim() : undefined,
        retentionPeriod: retentionPeriod ? Number(retentionPeriod) : undefined,
        gracePeriod: gracePeriod ? Number(gracePeriod) : undefined,
        quotaLimit: quotaLimit ? gbToBytes(Number(quotaLimit)) : undefined,
      })
      createResult = result
      showSuccessToast('Volume created')
    } catch (err: unknown) {
      handleApiError(err, 'Failed to create volume')
    } finally {
      submitting = false
    }
  }

  async function copyKey() {
    if (!createResult?.encryptionKey) return
    try {
      await navigator.clipboard.writeText(createResult.encryptionKey)
      showSuccessToast('Copied to clipboard')
    } catch {
      showErrorToast('Failed to copy')
    }
  }
</script>

<svelte:head><title>Create Volume · mountOS Admin</title></svelte:head>

<div class="mx-auto max-w-2xl space-y-6">
  {#if !accountId}
    <EmptyState title="Select an account" description="Choose an account before creating a volume." />
  {:else if !storagesLoaded}
    <LoadingSpinner />
  {:else if createResult}
    <Card cornerBrackets>
      <CardHeader>
        <CardTitle>Volume Created</CardTitle>
      </CardHeader>
      <CardContent>
        {#if createResult.encryptionKey}
          <p class="text-sm text-muted-foreground mb-3">Save the encryption key below; it will not be shown again.</p>
          <div class="rounded-sm border p-3 space-y-2 bg-muted/50">
            <span class="text-sm text-muted-foreground">Encryption Key</span>
            <p class="font-mono text-sm break-all">{createResult.encryptionKey}</p>
          </div>
          <Button variant="outline" size="sm" class="mt-3 gap-1.5" onclick={copyKey}>
            <Copy class="h-4 w-4" /> Copy Key
          </Button>
        {:else}
          <p class="text-sm text-muted-foreground">Volume created successfully (no encryption key generated).</p>
        {/if}
      </CardContent>
      <CardFooter>
        <Button onclick={() => goto('/volumes')}>Go to Volumes</Button>
      </CardFooter>
    </Card>
  {:else}
    <Card cornerBrackets>
      <CardHeader>
        <CardTitle>Create Volume</CardTitle>
        <CardDescription>Create a volume on an existing storage backend.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onsubmit={handleSubmit} class="space-y-4">
          <div class="space-y-2">
            <Label for="name">Name</Label>
            <Input id="name" bind:value={name} placeholder="Volume name" required autocomplete="off" />
          </div>
          <div class="space-y-2">
            <Label for="description">Description</Label>
            <Input id="description" bind:value={description} placeholder="Description" autocomplete="off" />
          </div>
          <div class="space-y-2">
            <Label>Storage</Label>
            <Combobox options={storageOptions} bind:value={storageId} placeholder="Select storage..." emptyText="No storages found." />
          </div>
          <div class="space-y-2">
            <Label for="volumeType">Volume Type</Label>
            <Select id="volumeType" bind:value={volumeType} placeholder="Select type..."
              options={[{ value: 'object', label: 'Object' }, { value: 'block', label: 'Block' }]} />
          </div>

          <Separator />

          <p class="text-sm font-medium">Encryption</p>
          <Checkbox bind:checked={encryption} label="Enable encryption" />
          {#if encryption}
            <div class="space-y-2">
              <Label for="encryptionKey">Encryption Key</Label>
              <Input id="encryptionKey" bind:value={encryptionKey} placeholder="Leave empty to auto-generate" />
            </div>
          {/if}

          <Separator />

          <p class="text-sm font-medium">Retention & Lifecycle</p>
          <div class="grid gap-4 sm:grid-cols-2">
            <div class="space-y-2">
              <Label for="retentionPeriod">
                <span class="inline-flex items-center gap-1">
                  Snapshot Window (days)
                  <InfoTip text="How long deleted items and old versions are retained before cleanup. Beyond this window, snapshot mounts may show inconsistent data due to cleaned-up data." />
                </span>
              </Label>
              <Input id="retentionPeriod" type="number" bind:value={retentionPeriod} placeholder="30" min="0" max="366" aria-describedby="retentionPeriod-hint" />
              <p id="retentionPeriod-hint" class="sr-only">How long deleted items and old versions are retained before cleanup, in days</p>
            </div>
            <div class="space-y-2">
              <Label for="gracePeriod">
                <span class="inline-flex items-center gap-1">
                  Grace Period (days)
                  <InfoTip text="How long data stays before cleanup after deactivation" />
                </span>
              </Label>
              <Input id="gracePeriod" type="number" bind:value={gracePeriod} placeholder="14" min="0" max="91" aria-describedby="gracePeriod-hint" />
              <p id="gracePeriod-hint" class="sr-only">How long data stays before cleanup after deactivation, in days</p>
            </div>
          </div>

          <Separator />

          <div class="space-y-2">
            <Label for="quotaLimit">Quota Limit (GB)</Label>
            <Input id="quotaLimit" type="number" bind:value={quotaLimit} placeholder="0 = unlimited" min="0" step="0.01" />
          </div>

          <div class="flex gap-3 pt-2">
            <Button variant="primary" type="submit" class="cyberpunk-skewed-sm" disabled={submitting || !canSubmit}>
              {submitting ? 'Creating...' : 'Create Volume'}
            </Button>
            <Button variant="outline" type="button" onclick={() => goto('/volumes')}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  {/if}
</div>
