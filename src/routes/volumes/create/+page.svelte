<script lang="ts">
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { useVolumes } from '$lib/core/stores/volumes.svelte'
  import { useStorages } from '$lib/core/stores/storages.svelte'
  import { useRegions } from '$lib/core/stores/regions.svelte'
  import { useClusters } from '$lib/core/stores/clusters.svelte'
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
  import FormSkeleton from '$lib/components/shared/FormSkeleton.svelte'
  import FieldLabel from '$lib/components/shared/FieldLabel.svelte'
  import { showSuccessToast, showErrorToast, handleApiError } from '$lib/core/utils/toast'
  import { copyText } from '$lib/core/utils/clipboard'
  import { HUB_REGION_NAME } from '$lib/core/constants'
  import { gbToBytes } from '$lib/core/utils/format'
  import Copy from '@lucide/svelte/icons/copy'

  const volumeStore = useVolumes()
  const storageStore = useStorages()
  const regionStore = useRegions()
  const clusterStore = useClusters()
  const accountStore = useAccounts()
  const auth = useAuth()
  const accountId = $derived(accountStore.selectedAccountId)

  $effect(() => {
    if (!auth.loading && !auth.can('volumes', 'create')) {
      showErrorToast('Access denied')
      goto('/', { replaceState: true })
    }
  })

  let name = $state('')
  let description = $state('')
  let regionId = $state('')
  let storageId = $state('')
  let regionClusterId = $state('')
  let volumeType = $state('general')
  let encryption = $state(false)
  let encryptionKey = $state('')
  let encryptionKeyRef = $state<HTMLInputElement | null>(null)
  let retentionPeriod = $state('30')
  let gracePeriod = $state('14')
  let forkGracePeriod = $state('1')
  let eventLogRetentionPeriod = $state('0')
  let quotaLimit = $state('')
  let submitting = $state(false)
  let createResult = $state<{ id: number; encryptionKey: string } | null>(null)

  const preselectedStorageId = $page.url.searchParams.get('storageId') ?? ''
  const preselectedRegionId = $page.url.searchParams.get('regionId') ?? ''

  let regionsLoaded = $state(false)
  $effect(() => {
    if (accountId) {
      regionId = ''
      regionsLoaded = false
      regionStore.fetchRegions(accountId, { page: 1, limit: 100 }).finally(async () => {
        if (preselectedStorageId) {
          // Resolve the preselected storage's region so both fields land pre-filled.
          try {
            const storage = await storageStore.getStorage(Number(preselectedStorageId))
            regionId = String(storage.regionInfo.id)
          } catch {
            // Storage no longer resolves; fall back to manual region selection.
          }
        } else if (preselectedRegionId) {
          regionId = preselectedRegionId
        }
        regionsLoaded = true
      })
    }
  })

  // Volumes attach to a storage within a region; the hub region has no attachable storages.
  const regionOptions = $derived(
    regionStore.regions
      .filter(r => r.name !== HUB_REGION_NAME)
      .map(r => ({ value: String(r.id), label: r.name }))
  )

  // Storage options are scoped to the selected region and refetched whenever it changes.
  let lastStorageRegion = ''
  $effect(() => {
    const rid = regionId
    if (rid === lastStorageRegion) return
    lastStorageRegion = rid
    storageId = ''
    if (!rid || !accountId) return
    storageStore.fetchStorages({ accountId, page: 1, limit: 100, filters: { regionId: Number(rid) } }).finally(() => {
      // Only honor the preselection when that storage is active and attachable.
      if (preselectedStorageId && storageStore.storages.some(s => String(s.id) === preselectedStorageId && s.isActive)) {
        storageId = preselectedStorageId
      }
    })
  })

  // A volume can only attach to an active storage (the API rejects inactive ones).
  const storageOptions = $derived(
    storageStore.storages
      .filter(s => s.isActive)
      .map(s => ({ value: String(s.id), label: s.name }))
  )
  const storagesLoading = $derived(!!regionId && storageStore.loading)

  // Volumes are placed on a region cluster; load the selected region's clusters so the
  // operator can pick the availability/placement boundary explicitly.
  let lastClusterRegion = ''
  $effect(() => {
    const rid = regionId
    if (rid === lastClusterRegion) return
    lastClusterRegion = rid
    regionClusterId = ''
    if (rid) clusterStore.fetchClusters(Number(rid), { isActive: true })
  })

  // Only ready+active clusters can host a volume; each is an availability/placement boundary.
  const clusterOptions = $derived(
    clusterStore.clustersFor(Number(regionId))
      .filter(c => c.isActive && c.isReady)
      .map(c => ({ value: String(c.id), label: c.defaultCluster ? `${c.name} (default)` : c.name }))
  )
  const clustersLoading = $derived(!!regionId && clusterStore.isLoading(Number(regionId)))

  // Preselect the region's default cluster so the prior default-only behaviour is preserved.
  $effect(() => {
    if (regionClusterId || !clusterOptions.length) return
    const def = clusterStore.clustersFor(Number(regionId)).find(c => c.defaultCluster && c.isActive && c.isReady)
    regionClusterId = String(def?.id ?? clusterOptions[0].value)
  })

  $effect(() => {
    if (encryption && encryptionKeyRef) encryptionKeyRef.focus()
  })

  const canSubmit = $derived(name.trim() && storageId && volumeType)

  async function handleSubmit(e: Event) {
    e.preventDefault()
    if (!canSubmit || !accountId) return
    submitting = true
    try {
      const result = await volumeStore.createVolume({
        accountId,
        storageId: Number(storageId),
        regionClusterId: regionClusterId ? Number(regionClusterId) : undefined,
        name: name.trim(),
        description: description.trim() || undefined,
        volumeType,
        encryption: encryption ? true : undefined,
        encryptionKey: (encryption && encryptionKey.trim()) ? encryptionKey.trim() : undefined,
        retention: {
          dataDays: retentionPeriod ? Number(retentionPeriod) : undefined,
          forkGraceDays: forkGracePeriod ? Number(forkGracePeriod) : undefined,
          eventLogDays: eventLogRetentionPeriod ? Number(eventLogRetentionPeriod) : undefined,
          graceDays: !auth.isUserRole && gracePeriod ? Number(gracePeriod) : undefined,
        },
        quotaLimit: !auth.isUserRole && quotaLimit ? gbToBytes(Number(quotaLimit)) : undefined,
      })
      showSuccessToast('Volume created')
      if (result.encryptionKey) {
        createResult = { id: result.id, encryptionKey: result.encryptionKey }
      } else {
        goto(`/volumes/${result.id}`, { replaceState: true })
      }
    } catch (err: unknown) {
      handleApiError(err, 'Failed to create volume')
    } finally {
      submitting = false
    }
  }

  async function copyKey() {
    if (!createResult?.encryptionKey) return
    if (await copyText(createResult.encryptionKey)) {
      showSuccessToast('Copied to clipboard')
    } else {
      showErrorToast('Failed to copy')
    }
  }
</script>

<svelte:head><title>Create Volume · mountOS Admin</title></svelte:head>

<div class="mx-auto max-w-2xl space-y-6">
  {#if !accountId}
    <EmptyState title="Select an account" description="Choose an account before creating a volume." />
  {:else if !regionsLoaded}
    <FormSkeleton fields={7} />
  {:else if createResult}
    <Card cornerBrackets role="status" aria-live="polite">
      <CardHeader>
        <CardTitle>Volume Created</CardTitle>
      </CardHeader>
      <CardContent>
        {#if createResult.encryptionKey}
          <p class="text-sm text-muted-foreground mb-3">Save the encryption key below; it will not be shown again.</p>
          <dl class="rounded-sm border p-3 space-y-2 bg-muted/50">
            <dt class="text-sm text-muted-foreground">Encryption Key</dt>
            <dd class="font-mono text-sm break-all">{createResult.encryptionKey}</dd>
          </dl>
          <Button variant="outline" size="sm" class="mt-3 gap-1.5" onclick={copyKey}>
            <Copy class="h-4 w-4" /> Copy Key
          </Button>
        {/if}
      </CardContent>
      <CardFooter>
        <Button onclick={() => goto(`/volumes/${createResult?.id}`)}>View Volume</Button>
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
            <Input id="name" bind:value={name} placeholder="Volume name" required aria-required="true" autocomplete="off" />
          </div>
          <div class="space-y-2">
            <Label for="description">Description</Label>
            <Input id="description" bind:value={description} placeholder="Description" autocomplete="off" />
          </div>
          <div class="space-y-2">
            <Label id="region-label">Region</Label>
            <Combobox options={regionOptions} bind:value={regionId} placeholder="Select region..." emptyText="No regions found." aria-labelledby="region-label" />
          </div>
          <div class="space-y-2">
            <Label id="storage-label">Storage</Label>
            {#if !regionId}
              <p class="text-sm text-muted-foreground">Select a region first.</p>
            {:else if storagesLoading}
              <p class="text-sm text-muted-foreground">Loading storages…</p>
            {:else}
              <Combobox options={storageOptions} bind:value={storageId} placeholder="Select storage..." emptyText="No storages found." aria-labelledby="storage-label" />
            {/if}
          </div>
          <div class="space-y-2">
            <FieldLabel id="cluster-label" tooltip="The availability/placement cluster that hosts this volume's metadata. Defaults to the region's default cluster.">
              Availability / placement
            </FieldLabel>
            {#if !regionId}
              <p class="text-sm text-muted-foreground">Select a region first.</p>
            {:else if clustersLoading}
              <p class="text-sm text-muted-foreground">Loading clusters…</p>
            {:else if clusterOptions.length === 0}
              <p class="text-sm text-muted-foreground">No ready clusters in this region; the default placement is used.</p>
            {:else}
              <Select id="cluster" ariaLabelledby="cluster-label" bind:value={regionClusterId}
                placeholder="Select cluster..." options={clusterOptions} />
            {/if}
          </div>
          <div class="space-y-2">
            <FieldLabel for="volumeType" tooltip={"**General:** POSIX filesystem volume.\n**Iceberg:** lake catalog for query engines."}>
              Volume Kind
            </FieldLabel>
            <Select id="volumeType" bind:value={volumeType} placeholder="Select kind..."
              options={[
                { value: 'general', label: 'General' },
                { value: 'iceberg', label: 'Iceberg' },
              ]} />
          </div>

          <Separator />

          <fieldset class="space-y-2">
            <legend class="text-sm font-medium">Encryption</legend>
            <Checkbox bind:checked={encryption} label="Enable encryption" />
            {#if encryption}
              <div class="space-y-2">
                <Label for="encryptionKey">Encryption Key</Label>
                <Input id="encryptionKey" bind:value={encryptionKey} bind:ref={encryptionKeyRef} placeholder="Leave empty to auto-generate" />
              </div>
            {/if}
          </fieldset>

          <Separator />

          <fieldset class="space-y-2">
            <legend class="text-sm font-medium">Retention & Lifecycle</legend>
            <div class="flex flex-wrap gap-x-8 gap-y-4">
              <div class="space-y-2">
                <FieldLabel for="retentionPeriod" tooltip={"Number of days back snapshot traversal can reach.\n\nBeyond this window, snapshot mounts may show inconsistent data due to cleaned-up data. An active fork pinning older data may force retention beyond the configured window."}>
                  Day Retention Window (days)
                </FieldLabel>
                <Input id="retentionPeriod" type="number" class="w-[120px]" bind:value={retentionPeriod} placeholder="30" min="0" max="366" aria-describedby="retentionPeriod-hint" />
                <p id="retentionPeriod-hint" class="sr-only">Number of days back snapshot traversal can reach</p>
              </div>
              {#if !auth.isUserRole}
                <div class="space-y-2">
                  <FieldLabel for="gracePeriod" tooltip="After deactivation, this is the window to reactivate the volume. Once it expires, data is purged according to the cleanup options chosen at deactivation.">
                    Grace Period (days)
                  </FieldLabel>
                  <Input id="gracePeriod" type="number" class="w-[120px]" bind:value={gracePeriod} placeholder="14" min="0" max="91" aria-describedby="gracePeriod-hint" />
                  <p id="gracePeriod-hint" class="sr-only">After deactivation, this is the window to reactivate the volume</p>
                </div>
              {/if}
              <div class="space-y-2">
                <FieldLabel for="forkGracePeriod" tooltip="After a named fork is deactivated, the window to restore it before its data is permanently cleaned up.">
                  Fork Grace Period (days)
                </FieldLabel>
                <Input id="forkGracePeriod" type="number" class="w-[120px]" bind:value={forkGracePeriod} placeholder="1" min="0" max="30" aria-describedby="forkGracePeriod-hint" />
                <p id="forkGracePeriod-hint" class="sr-only">After a named fork is deactivated, the window to restore it before its data is permanently cleaned up</p>
              </div>
              <div class="space-y-2">
                <FieldLabel for="eventLogRetentionPeriod" tooltip="How many days of file/folder change events are kept for this volume. 0 disables change-event logging (saves resources).">
                  Event Log Retention (days)
                </FieldLabel>
                <Input id="eventLogRetentionPeriod" type="number" class="w-[120px]" bind:value={eventLogRetentionPeriod} placeholder="0" min="0" max="30" aria-describedby="eventLogRetentionPeriod-hint" />
                <p id="eventLogRetentionPeriod-hint" class="sr-only">How many days of file/folder change events are kept for this volume. 0 disables change-event logging</p>
              </div>
            </div>
          </fieldset>

          {#if !auth.isUserRole}
            <Separator />

            <div class="space-y-2">
              <Label for="quotaLimit">Quota Limit (GB)</Label>
              <Input id="quotaLimit" type="number" class="w-[120px]" bind:value={quotaLimit} placeholder="0" min="0" step="0.01" aria-describedby="quotaLimit-hint" />
              <p id="quotaLimit-hint" class="text-xs text-muted-foreground">0 means unlimited.</p>
            </div>
          {/if}

          <div class="flex flex-wrap gap-3 pt-2">
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
