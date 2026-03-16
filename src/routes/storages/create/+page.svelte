<script lang="ts">
  import { goto } from '$app/navigation'
  import { useStorages } from '$lib/core/stores/storages.svelte'
  import { useRegions } from '$lib/core/stores/regions.svelte'
  import { useAccounts } from '$lib/core/stores/accounts.svelte'
  import { useAuth } from '$lib/core/stores/auth.svelte'
  import { Button } from '$lib/components/ui/button'
  import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '$lib/components/ui/card'
  import Input from '$lib/components/ui/input/input.svelte'
  import Label from '$lib/components/ui/label/label.svelte'
  import { Select } from '$lib/components/ui/select'
  import { Separator } from '$lib/components/ui/separator'
  import Combobox from '$lib/components/shared/Combobox.svelte'
  import EmptyState from '$lib/components/shared/EmptyState.svelte'
  import LoadingSpinner from '$lib/components/shared/LoadingSpinner.svelte'
  import BucketTester from '$lib/components/shared/BucketTester.svelte'
  import { showSuccessToast, showErrorToast, handleApiError } from '$lib/core/utils/toast'
  import {
    PROVIDER_OPTIONS, generateEndpoint, isCustomEndpoint, getProvider,
  } from '$lib/core/utils/object-storage-providers'

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

  let regionsLoaded = $state(false)
  $effect(() => {
    if (accountId) {
      regionId = ''
      regionsLoaded = false
      regionStore.fetchRegions(1, 100).finally(() => { regionsLoaded = true })
    }
  })

  const regionOptions = $derived(
    regionStore.regions.map(r => ({ value: String(r.id), label: r.name }))
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

  const isBlock = $derived(storageType === 'block')
  const isHybrid = $derived(isBlock && blockType === 'hybrid')
  const needsS3 = $derived(!isBlock || isHybrid)
  const blockEndpoint = $derived(
    selectedRegion?.dns ? `https://block.${selectedRegion.dns}` : ''
  )

  function resetS3Fields() {
    providerType = ''
    endpoint = ''
    region = ''
    bucket = ''
    base = ''
    accessKey = ''
    secretKey = ''
    bucketVerified = false
  }

  let prevStorageType = $state('')
  $effect(() => {
    if (storageType !== prevStorageType) {
      prevStorageType = storageType
      resetS3Fields()
      blockType = ''
      if (isBlock) providerType = 'mountOS'
    }
  })

  let prevBlockType = $state('')
  $effect(() => {
    if (blockType !== prevBlockType) {
      prevBlockType = blockType
      if (isBlock) {
        providerType = isHybrid ? '' : 'mountOS'
        endpoint = ''
        region = ''
        bucket = ''
        base = ''
        accessKey = ''
        secretKey = ''
        bucketVerified = false
      }
    }
  })

  let prevProvider = $state('')
  $effect(() => {
    if (providerType !== prevProvider) {
      prevProvider = providerType
      endpoint = ''
      region = ''
      bucketVerified = false
    }
  })

  // auto-fill endpoint for known providers
  $effect(() => {
    if (needsS3 && providerType && !isCustomEndpoint(providerType)) {
      endpoint = generateEndpoint(providerType, region)
    }
  })

  const s3RegionLabel = $derived(getProvider(providerType)?.regionLabel ?? 'Region')
  const s3RegionPlaceholder = $derived(getProvider(providerType)?.regionPlaceholder ?? 'us-east-1')

  const s3Ready = $derived(
    !!(endpoint.trim() && bucket.trim() && accessKey.trim() && secretKey.trim())
  )

  const canSubmit = $derived(
    !!(name.trim() && regionId && storageType && providerType
    && (isBlock
      ? blockType && (isHybrid ? s3Ready && bucketVerified : !!blockEndpoint)
      : s3Ready && bucketVerified))
  )

  async function handleSubmit(e: Event) {
    e.preventDefault()
    if (!canSubmit || !accountId) return
    submitting = true
    try {
      const isStandard = isBlock && !isHybrid
      await storageStore.createStorage({
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
        blockSize: isBlock ? Number(blockSize) : undefined,
        accessKey: (!isStandard && accessKey.trim()) ? accessKey.trim() : undefined,
        secretKey: (!isStandard && secretKey.trim()) ? secretKey.trim() : undefined,
      })
      showSuccessToast('Storage created')
      goto('/storages')
    } catch (err: unknown) {
      handleApiError(err, 'Failed to create storage')
    } finally {
      submitting = false
    }
  }
</script>

<div class="mx-auto max-w-2xl space-y-6">
  {#if !accountId}
    <EmptyState title="Select an account" description="Choose an account before creating a storage." />
  {:else if !regionsLoaded}
    <LoadingSpinner />
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
            <Input id="name" bind:value={name} placeholder="Storage name" required />
          </div>
          <div class="space-y-2">
            <Label for="description">Description</Label>
            <Input id="description" bind:value={description} placeholder="Description" />
          </div>
          <div class="space-y-2">
            <Label>Region</Label>
            <Combobox options={regionOptions} bind:value={regionId} placeholder="Select region..." emptyText="No regions found." />
          </div>
          <div class="space-y-2">
            <Label for="storageType">Storage Type</Label>
            <Select id="storageType" bind:value={storageType} placeholder="Select type..."
              options={[{ value: 'object', label: 'Object Storage' }, { value: 'block', label: 'Block Storage' }]} />
          </div>

          {#if storageType}
            <Separator />

            {#if isBlock}
              <div class="space-y-2">
                <Label>Provider</Label>
                <Input value="mountOS" disabled />
              </div>
              <div class="space-y-2">
                <Label>Block Endpoint</Label>
                {#if blockEndpoint}
                  <Input value={blockEndpoint} readonly class="font-mono text-sm text-muted-foreground" />
                  <p class="text-xs text-muted-foreground">Derived from region DNS (block.&lt;region-dns&gt;)</p>
                {:else if regionId}
                  <p class="text-sm text-destructive">Selected region has no DNS configured.</p>
                {:else}
                  <p class="text-sm text-muted-foreground">Select a region to derive block endpoint.</p>
                {/if}
              </div>
              <div class="grid gap-4 md:grid-cols-2">
                <div class="space-y-2">
                  <Label for="blockType">Block Type</Label>
                  <Select id="blockType" bind:value={blockType} placeholder="Select block type..." options={BLOCK_TYPES} />
                </div>
                <div class="space-y-2">
                  <Label for="blockSize">Block Size</Label>
                  <Select id="blockSize" bind:value={blockSize} options={BLOCK_SIZES} />
                </div>
              </div>

              {#if isHybrid}
                <Separator />
                <p class="text-sm font-medium">Backing Object Storage</p>
              {/if}
            {/if}

            {#if needsS3}
              {#if !isBlock}
                <div class="space-y-2">
                  <Label for="providerType">Provider</Label>
                  <Select id="providerType" bind:value={providerType} placeholder="Select provider..." options={PROVIDER_OPTIONS} />
                </div>
              {:else if isHybrid}
                <div class="space-y-2">
                  <Label for="providerType">S3 Provider</Label>
                  <Select id="providerType" bind:value={providerType} placeholder="Select provider..." options={PROVIDER_OPTIONS} />
                </div>
              {/if}

              {#if providerType && providerType !== 'mountOS'}
                <div class="space-y-2">
                  <Label for="endpoint">Endpoint</Label>
                  {#if isCustomEndpoint(providerType)}
                    <Input id="endpoint" bind:value={endpoint} placeholder="https://your-s3-endpoint.com" required />
                  {:else}
                    <Input id="endpoint" value={endpoint} readonly class="font-mono text-sm text-muted-foreground" />
                  {/if}
                </div>
                <div class="grid gap-4 md:grid-cols-2">
                  <div class="space-y-2">
                    <Label for="region">{s3RegionLabel}</Label>
                    <Input id="region" bind:value={region} placeholder={s3RegionPlaceholder} />
                  </div>
                  <div class="space-y-2">
                    <Label for="bucket">Bucket</Label>
                    <Input id="bucket" bind:value={bucket} placeholder="my-bucket" />
                  </div>
                </div>
                <div class="space-y-2">
                  <Label for="base">Base Path</Label>
                  <Input id="base" bind:value={base} placeholder="Path prefix" />
                </div>

                <Separator />

                <p class="text-sm font-medium">Credentials</p>
                <div class="grid gap-4 md:grid-cols-2">
                  <div class="space-y-2">
                    <Label for="accessKey">Access Key</Label>
                    <Input id="accessKey" bind:value={accessKey} placeholder="Access key" />
                  </div>
                  <div class="space-y-2">
                    <Label for="secretKey">Secret Key</Label>
                    <Input id="secretKey" type="password" bind:value={secretKey} placeholder="Secret key" />
                  </div>
                </div>

                <BucketTester
                  {endpoint}
                  {region}
                  {bucket}
                  {accessKey}
                  {secretKey}
                  {providerType}
                  disabled={!s3Ready}
                  onresult={(passed) => { bucketVerified = passed }}
                />
              {/if}
            {/if}
          {/if}

          <div class="flex gap-3 pt-2">
            <Button variant="primary" type="submit" class="cyberpunk-skewed-sm" disabled={submitting || !canSubmit}>
              {submitting ? 'Creating...' : 'Create Storage'}
            </Button>
            <Button variant="outline" type="button" onclick={() => goto('/storages')}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  {/if}
</div>
