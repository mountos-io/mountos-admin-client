<script lang="ts">
  import { onDestroy } from 'svelte'
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { useStorages } from '$lib/core/stores/storages.svelte'
  import { useRegions } from '$lib/core/stores/regions.svelte'
  import { useAccounts } from '$lib/core/stores/accounts.svelte'
  import { useAuth } from '$lib/core/stores/auth.svelte'
  import { Button } from '$lib/components/ui/button'
  import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '$lib/components/ui/card'
  import Input from '$lib/components/ui/input/input.svelte'
  import { SecretInput } from '$lib/components/ui/input'
  import Label from '$lib/components/ui/label/label.svelte'
  import { Select } from '$lib/components/ui/select'
  import { Separator } from '$lib/components/ui/separator'
  import Combobox from '$lib/components/shared/Combobox.svelte'
  import EmptyState from '$lib/components/shared/EmptyState.svelte'
  import FormSkeleton from '$lib/components/shared/FormSkeleton.svelte'
  import BucketTester from '$lib/components/shared/BucketTester.svelte'
  import Copy from '@lucide/svelte/icons/copy'
  import Check from '@lucide/svelte/icons/check'
  import { showSuccessToast, showErrorToast, handleApiError } from '$lib/core/utils/toast'
  import {
    PROVIDER_OPTIONS, generateEndpoint, isCustomEndpoint, getProvider, isAzureProvider,
  } from '$lib/core/utils/object-storage-providers'
  import { HUB_REGION_NAME } from '$lib/core/constants'

  const storageStore = useStorages()
  const regionStore = useRegions()
  const accountStore = useAccounts()
  const auth = useAuth()
  const accountId = $derived(accountStore.selectedAccountId)

  $effect(() => {
    if (!auth.loading && !auth.can('storages', 'create')) {
      showErrorToast('Access denied')
      goto('/', { replaceState: true })
    }
  })

  const preselectedRegionId = $page.url.searchParams.get('regionId') ?? ''

  let regionsLoaded = $state(false)
  $effect(() => {
    if (accountId) {
      regionId = ''
      regionsLoaded = false
      regionStore.fetchRegions({ page: 1, limit: 100 }).finally(() => {
        if (preselectedRegionId) regionId = preselectedRegionId
        regionsLoaded = true
      })
    }
  })

  const regionOptions = $derived(
    regionStore.regions
      .filter(r => r.name !== HUB_REGION_NAME)
      .map(r => ({ value: String(r.id), label: r.name }))
  )
  const selectedRegion = $derived(
    regionStore.regions.find(r => String(r.id) === regionId)
  )

  const BLOCK_TYPES = [
    { value: 'standard', label: 'Standard' },
    { value: 'hybrid', label: 'Hybrid' },
  ]

  const BLOCK_SIZES = [
    { value: '65536', label: '64 KiB' },
    { value: '131072', label: '128 KiB' },
    { value: '262144', label: '256 KiB' },
    { value: '524288', label: '512 KiB' },
    { value: '1048576', label: '1 MiB' },
    { value: '2097152', label: '2 MiB' },
    { value: '4194304', label: '4 MiB' },
    { value: '8388608', label: '8 MiB' },
  ]

  const STORAGE_MODES = [
    { value: 'single', label: 'Single' },
    { value: 'ha', label: 'High Availability (2 or 3 members)' },
  ]

  const HA_MEMBER_COUNTS = [
    { value: '2', label: '2 members' },
    { value: '3', label: '3 members' },
  ]

  let name = $state('')
  let description = $state('')
  let regionId = $state('')
  let storageType = $state('')
  let providerType = $state('')
  let endpoint = $state('')
  let region = $state('')
  let bucket = $state('')
  let base = $state('')
  let blockType = $state('')
  let blockSize = $state('4194304')
  let accessKey = $state('')
  let secretKey = $state('')
  let submitting = $state(false)
  let bucketVerified = $state(false)
  let storageMode = $state('single')
  let haMembers = $state('2')
  let member1Az = $state('')
  let member2Az = $state('')
  let member3Az = $state('')
  let createdBlockVolumeIds = $state<string[]>([])
  let copiedIndex = $state(-1)
  let copyTimer: ReturnType<typeof setTimeout> | undefined

  const isBlock = $derived(storageType === 'block')
  const isHybrid = $derived(isBlock && blockType === 'hybrid')
  const needsObjectStore = $derived(!isBlock || isHybrid)
  const blockEndpoint = $derived(
    selectedRegion?.dns ? `https://block.${selectedRegion.dns}` : ''
  )

  function resetObjectStoreFields() {
    providerType = ''
    endpoint = ''
    region = ''
    bucket = ''
    base = ''
    accessKey = ''
    secretKey = ''
    bucketVerified = false
  }

  function onStorageTypeChange(v: string) {
    storageType = v
    resetObjectStoreFields()
    blockType = ''
    storageMode = 'single'; haMembers = '2'; member1Az = ''; member2Az = ''; member3Az = ''
    if (v === 'block') providerType = 'mountOS'
  }

  function onBlockTypeChange(v: string) {
    blockType = v
    providerType = v === 'hybrid' ? '' : 'mountOS'
    storageMode = 'single'; haMembers = '2'; member1Az = ''; member2Az = ''; member3Az = ''
    endpoint = ''; region = ''; bucket = ''; base = ''
    accessKey = ''; secretKey = ''; bucketVerified = false
  }

  function onProviderChange(v: string) {
    providerType = v
    endpoint = ''; region = ''; bucketVerified = false
  }

  // auto-fill endpoint for known providers
  $effect(() => {
    if (needsObjectStore && providerType && !isCustomEndpoint(providerType)) {
      endpoint = generateEndpoint(providerType, region)
    }
  })

  // Azure: storage-account name doubles as the auth identity, so mirror the
  // "Storage Account" field into accessKey to spare the user typing it twice.
  $effect(() => {
    if (needsObjectStore && getProvider(providerType)?.regionDrivesAccessKey) {
      accessKey = region
    }
  })

  const regionLabel = $derived(getProvider(providerType)?.regionLabel ?? 'Region')
  const regionPlaceholder = $derived(getProvider(providerType)?.regionPlaceholder ?? 'us-east-1')
  const bucketLabel = $derived(getProvider(providerType)?.bucketLabel ?? 'Bucket')
  const bucketPlaceholder = $derived(getProvider(providerType)?.bucketPlaceholder ?? 'my-bucket')
  const accessKeyLabel = $derived(getProvider(providerType)?.accessKeyLabel ?? 'Access Key')
  const accessKeyPlaceholder = $derived(getProvider(providerType)?.accessKeyPlaceholder ?? 'Access key')
  const secretKeyLabel = $derived(getProvider(providerType)?.secretKeyLabel ?? 'Secret Key')
  const secretKeyPlaceholder = $derived(getProvider(providerType)?.secretKeyPlaceholder ?? 'Secret key')
  const accessKeyReadonly = $derived(!!getProvider(providerType)?.regionDrivesAccessKey)

  // Azure is now a valid backing store for both object and hybrid storage.
  const providerOptionsForContext = $derived(PROVIDER_OPTIONS)

  const objectStoreReady = $derived(
    !!(endpoint.trim() && bucket.trim() && accessKey.trim() && secretKey.trim())
  )

  const canSubmit = $derived(
    !!(name.trim() && regionId && storageType && providerType
    && (isBlock
      ? blockType && (isHybrid ? objectStoreReady && bucketVerified : !!blockEndpoint)
      : objectStoreReady && bucketVerified))
  )

  async function handleSubmit(e: Event) {
    e.preventDefault()
    if (!canSubmit || !accountId) return
    submitting = true
    try {
      const isStandard = isBlock && !isHybrid
      const availabilityZones = isBlock
        ? (storageMode === 'ha'
            ? (haMembers === '3'
              ? [member1Az.trim(), member2Az.trim(), member3Az.trim()]
              : [member1Az.trim(), member2Az.trim()])
            : (member1Az.trim() ? [member1Az.trim()] : undefined))
        : undefined
      const res = await storageStore.createStorage({
        accountId,
        regionId: Number(regionId),
        name: name.trim(),
        description: description.trim() || undefined,
        storageType,
        providerType: isStandard ? 'mountOS' : providerType,
        endpoint: isStandard ? blockEndpoint : endpoint.trim(),
        region: (!isStandard && region.trim()) ? region.trim() : undefined,
        bucket: (!isStandard && bucket.trim()) ? bucket.trim() : undefined,
        base: (!isStandard && base.trim()) ? base.trim() : undefined,
        blockType: isBlock ? blockType : undefined,
        blockSize: Number(blockSize),
        storageMode: isBlock ? storageMode : undefined,
        availabilityZones,
        accessKey: (!isStandard && accessKey.trim()) ? accessKey.trim() : undefined,
        secretKey: (!isStandard && secretKey.trim()) ? secretKey.trim() : undefined,
      })
      // Block storage returns the per-member block-volume id(s); show them for the
      // operator to copy into each blockserv's BLOCK_VOLUME_ID env before leaving.
      if (res.blockVolumeIds?.length) {
        createdBlockVolumeIds = res.blockVolumeIds
        showSuccessToast('Storage created: copy the block-volume IDs below')
      } else {
        showSuccessToast('Storage created')
        goto('/storages')
      }
    } catch (err: unknown) {
      handleApiError(err, 'Failed to create storage')
    } finally {
      submitting = false
    }
  }

  async function copyId(value: string, i: number) {
    try {
      await navigator.clipboard.writeText(value)
      copiedIndex = i
      clearTimeout(copyTimer)
      copyTimer = setTimeout(() => { copiedIndex = -1 }, 1500)
    } catch {
      // Clipboard unavailable (insecure context / denied); the id stays selectable.
    }
  }

  onDestroy(() => clearTimeout(copyTimer))
</script>

<svelte:head><title>Create Storage · mountOS Admin</title></svelte:head>

<div class="mx-auto max-w-2xl space-y-6">
  {#if !accountId}
    <EmptyState title="Select an account" description="Choose an account before creating a storage." />
  {:else if !regionsLoaded}
    <FormSkeleton fields={4} />
  {:else}
    <Card cornerBrackets>
      <CardHeader>
        <CardTitle>Create Storage</CardTitle>
        <CardDescription>Configure a storage backend for the current account.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onsubmit={handleSubmit} class="space-y-4">
          <div class="space-y-2">
            <Label for="name">Name</Label>
            <Input id="name" bind:value={name} placeholder="Storage name" required aria-required="true" autocomplete="off" />
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
            <Label id="storageType-label" for="storageType">Storage Type</Label>
            <Select id="storageType" ariaLabelledby="storageType-label" bind:value={storageType} placeholder="Select type..."
              options={[{ value: 'object', label: 'Object' }, { value: 'block', label: 'Block' }]} onchange={onStorageTypeChange} />
          </div>

          {#if storageType}
            <Separator />

            {#if isBlock}
              <div class="space-y-2">
                <Label for="storage-provider">Provider</Label>
                <Input id="storage-provider" value="mountOS" disabled />
              </div>
              <div class="space-y-2">
                <Label for="block-endpoint">Block Endpoint</Label>
                {#if blockEndpoint}
                  <Input id="block-endpoint" value={blockEndpoint} readonly class="font-mono text-sm text-muted-foreground" />
                  <p class="text-sm text-muted-foreground">Derived from region DNS (block.&lt;region-dns&gt;)</p>
                {:else if regionId}
                  <p class="text-sm text-destructive">Selected region has no DNS configured.</p>
                {:else}
                  <p class="text-sm text-muted-foreground">Select a region to derive block endpoint.</p>
                {/if}
              </div>
              <div class="grid gap-3 sm:gap-4 sm:grid-cols-2">
                <div class="space-y-2">
                  <Label id="blockType-label" for="blockType">Block Type</Label>
                  <Select id="blockType" ariaLabelledby="blockType-label" bind:value={blockType} placeholder="Select block type..." options={BLOCK_TYPES} onchange={onBlockTypeChange} />
                </div>
                <div class="space-y-2">
                  <Label id="blockSize-label" for="blockSize">Block Size</Label>
                  <Select id="blockSize" ariaLabelledby="blockSize-label" bind:value={blockSize} options={BLOCK_SIZES} />
                </div>
              </div>

              <div class="space-y-2">
                <Label id="storageMode-label" for="storageMode">Mode</Label>
                <Select id="storageMode" ariaLabelledby="storageMode-label" bind:value={storageMode} options={STORAGE_MODES} />
              </div>
              {#if storageMode === 'ha'}
                <div class="space-y-2">
                  <Label id="haMembers-label" for="haMembers">HA Members</Label>
                  <Select id="haMembers" ariaLabelledby="haMembers-label" bind:value={haMembers} options={HA_MEMBER_COUNTS} />
                </div>
              {/if}
              <div class="space-y-2">
                <Label for="member1Az">Availability Zone{storageMode === 'ha' ? ' (Member 1)' : ''}</Label>
                <Input id="member1Az" bind:value={member1Az} placeholder="e.g. us-east-1a" autocomplete="off" />
              </div>
              {#if storageMode === 'ha'}
                <div class="space-y-2">
                  <Label for="member2Az">Availability Zone (Member 2)</Label>
                  <Input id="member2Az" bind:value={member2Az} placeholder="e.g. us-east-1b" autocomplete="off" />
                </div>
                {#if haMembers === '3'}
                  <div class="space-y-2">
                    <Label for="member3Az">Availability Zone (Member 3)</Label>
                    <Input id="member3Az" bind:value={member3Az} placeholder="e.g. us-east-1c" autocomplete="off" />
                  </div>
                {/if}
              {/if}

              {#if isHybrid}
                <Separator />
                <p class="text-sm font-medium">Backing Object Storage</p>
              {/if}
            {/if}

            {#if needsObjectStore}
              {#if !isBlock}
                <div class="space-y-2">
                  <Label id="providerType-label" for="providerType">Object Storage Provider</Label>
                  <Select id="providerType" ariaLabelledby="providerType-label" bind:value={providerType} placeholder="Select provider..." options={providerOptionsForContext} onchange={onProviderChange} />
                </div>
              {:else if isHybrid}
                <div class="space-y-2">
                  <Label id="providerType-label" for="providerType">Backing Storage Provider</Label>
                  <Select id="providerType" ariaLabelledby="providerType-label" bind:value={providerType} placeholder="Select provider..." options={providerOptionsForContext} onchange={onProviderChange} />
                </div>
              {/if}

              {#if providerType && providerType !== 'mountOS'}
                <div class="space-y-2">
                  <Label for="endpoint">Endpoint</Label>
                  {#if isCustomEndpoint(providerType)}
                    <Input id="endpoint" bind:value={endpoint} placeholder="https://your-object-store-endpoint.com" required aria-required="true" />
                  {:else}
                    <Input id="endpoint" value={endpoint} readonly class="font-mono text-sm text-muted-foreground" />
                  {/if}
                </div>
                <div class="grid gap-3 sm:gap-4 sm:grid-cols-2">
                  <div class="space-y-2">
                    <Label for="region">{regionLabel}</Label>
                    <Input id="region" bind:value={region} placeholder={regionPlaceholder} />
                  </div>
                  <div class="space-y-2">
                    <Label for="bucket">{bucketLabel}</Label>
                    <Input id="bucket" bind:value={bucket} placeholder={bucketPlaceholder} />
                  </div>
                </div>
                <div class="space-y-2">
                  <Label for="base">Base Path</Label>
                  <Input id="base" bind:value={base} placeholder="Path prefix" />
                </div>

                <Separator />

                <p class="text-sm font-medium">Credentials</p>
                {#if accessKeyReadonly}
                  <!-- Azure: storage account name above already drives accessKey;
                       no second input needed. Just collect the account key. -->
                  <div class="space-y-2">
                    <Label for="secretKey">{secretKeyLabel}</Label>
                    <SecretInput id="secretKey" bind:value={secretKey} placeholder={secretKeyPlaceholder} />
                  </div>
                {:else}
                  <div class="grid gap-3 sm:gap-4 sm:grid-cols-2">
                    <div class="space-y-2">
                      <Label for="accessKey">{accessKeyLabel}</Label>
                      <Input id="accessKey" bind:value={accessKey} placeholder={accessKeyPlaceholder} />
                    </div>
                    <div class="space-y-2">
                      <Label for="secretKey">{secretKeyLabel}</Label>
                      <SecretInput id="secretKey" bind:value={secretKey} placeholder={secretKeyPlaceholder} />
                    </div>
                  </div>
                {/if}

                <BucketTester
                  {endpoint}
                  {region}
                  {bucket}
                  {accessKey}
                  {secretKey}
                  {providerType}
                  disabled={!objectStoreReady}
                  onresult={(passed) => { bucketVerified = passed }}
                />
              {/if}
            {/if}
          {/if}

          {#if createdBlockVolumeIds.length > 0}
            <Separator />
            <div class="space-y-2">
              <p class="text-sm font-medium">Block Volume IDs</p>
              <p class="text-sm text-muted-foreground">
                Copy each id into the matching blockserv's <code>BLOCK_VOLUME_ID</code> env.{#if createdBlockVolumeIds.length > 1} They are listed in member order.{/if}
              </p>
              {#each createdBlockVolumeIds as id, i (id)}
                <div class="flex items-center gap-2">
                  {#if createdBlockVolumeIds.length > 1}<span class="w-16 shrink-0 text-xs text-muted-foreground">Member {i + 1}</span>{/if}
                  <code class="flex-1 min-w-0 break-all rounded-sm bg-muted px-2 py-1 font-mono text-xs">{id}</code>
                  <Button
                    variant="ghost" size="icon" type="button" class="shrink-0 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0"
                    aria-label={createdBlockVolumeIds.length > 1 ? `Copy member ${i + 1} id` : 'Copy block volume id'}
                    onclick={() => copyId(id, i)}
                  >
                    {#if copiedIndex === i}
                      <Check class="size-4 text-primary" aria-hidden="true" />
                    {:else}
                      <Copy class="size-4" aria-hidden="true" />
                    {/if}
                  </Button>
                </div>
              {/each}
              <span class="sr-only" role="status" aria-live="polite">
                {copiedIndex >= 0 ? (createdBlockVolumeIds.length > 1 ? `Member ${copiedIndex + 1} id copied` : 'Block volume id copied') : ''}
              </span>
              <Button variant="primary" type="button" class="cyberpunk-skewed-sm" onclick={() => goto('/storages')}>Done</Button>
            </div>
          {:else}
            <div class="flex gap-3 pt-2">
              <Button variant="primary" type="submit" class="cyberpunk-skewed-sm" disabled={submitting || !canSubmit}>
                {submitting ? 'Creating...' : 'Create Storage'}
              </Button>
              <Button variant="outline" type="button" onclick={() => goto('/storages')}>
                Cancel
              </Button>
            </div>
          {/if}
        </form>
      </CardContent>
    </Card>
  {/if}
</div>
