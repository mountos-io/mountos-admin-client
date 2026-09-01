<script lang="ts">
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
  import HowItWorks from '$lib/components/shared/HowItWorks.svelte'
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
      regionStore.fetchRegions(accountId, { page: 1, limit: 100 }).finally(() => {
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
  let blockSize = $state('4194304')
  let accessKey = $state('')
  let secretKey = $state('')
  let submitting = $state(false)
  let bucketVerified = $state(false)

  const isBlock = $derived(storageType === 'block')
  // Every block storage is object-backed (durable S3 floor), so both object and block
  // collect a backing object store. Clients discover the member nodes via appserv.
  // blockserv needs no DNS endpoint.

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
  }

  function onProviderChange(v: string) {
    providerType = v
    endpoint = ''; region = ''; bucketVerified = false
  }

  // auto-fill endpoint for known providers
  $effect(() => {
    if (providerType && !isCustomEndpoint(providerType)) {
      endpoint = generateEndpoint(providerType, region)
    }
  })

  // Azure: storage-account name doubles as the auth identity, so mirror the
  // "Storage Account" field into accessKey to spare the user typing it twice.
  $effect(() => {
    if (getProvider(providerType)?.regionDrivesAccessKey) {
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
      && objectStoreReady && bucketVerified)
  )

  async function handleSubmit(e: Event) {
    e.preventDefault()
    if (!canSubmit || !accountId) return
    submitting = true
    try {
      await storageStore.createStorage({
        accountId,
        regionId: Number(regionId),
        name: name.trim(),
        description: description.trim() || undefined,
        storageType,
        providerType,
        endpoint: endpoint.trim(),
        region: region.trim() || undefined,
        bucket: bucket.trim() || undefined,
        base: base.trim() || undefined,
        blockSize: Number(blockSize),
        accessKey: accessKey.trim() || undefined,
        secretKey: secretKey.trim() || undefined,
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

<svelte:head><title>Create Storage · mountOS Admin</title></svelte:head>

<div class="mx-auto max-w-2xl space-y-6">
  <h1 class="sr-only">Create Storage</h1>
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
            <div class="flex items-center gap-2">
              <Label id="storageType-label" for="storageType">Storage Type</Label>
              <HowItWorks topic="storage-type" variant="ghost" class="ml-auto" />
            </div>
            <Select id="storageType" ariaLabelledby="storageType-label" bind:value={storageType} placeholder="Select type..."
              options={[{ value: 'object', label: 'Object' }, { value: 'block', label: 'Block' }]} onchange={onStorageTypeChange} />
          </div>

          {#if storageType}
            <Separator />

            <div class="space-y-2">
              <Label id="blockSize-label" for="blockSize">Block Size</Label>
              <Select id="blockSize" ariaLabelledby="blockSize-label" bind:value={blockSize} options={BLOCK_SIZES} />
              <p class="text-xs text-muted-foreground">Chunk size for segmenting data written to the backing object store.</p>
            </div>

            {#if isBlock}
              <div class="flex items-start gap-2 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                <p>This storage starts with no copyset servers. Register copysets, in pairs, from the storage's detail page once it's created. Spreading a copyset's two servers across racks or availability zones is advised but not enforced.</p>
              </div>

              <Separator />
              <p class="text-sm font-medium">Backing Object Storage</p>
            {/if}

            <div class="space-y-2">
              <Label id="providerType-label" for="providerType">{isBlock ? 'Backing Storage Provider' : 'Object Storage Provider'}</Label>
              <Select id="providerType" ariaLabelledby="providerType-label" bind:value={providerType} placeholder="Select provider..." options={providerOptionsForContext} onchange={onProviderChange} />
            </div>

            {#if providerType}
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
