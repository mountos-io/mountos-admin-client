<script lang="ts">
  import { onDestroy } from 'svelte'
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { useStorages } from '$lib/core/stores/storages.svelte'
  import { useRegions } from '$lib/core/stores/regions.svelte'
  import { useClusters } from '$lib/core/stores/clusters.svelte'
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
  import InfoTip from '$lib/components/shared/InfoTip.svelte'
  import Copy from '@lucide/svelte/icons/copy'
  import Check from '@lucide/svelte/icons/check'
  import Plus from '@lucide/svelte/icons/plus'
  import X from '@lucide/svelte/icons/x'
  import Lightbulb from '@lucide/svelte/icons/lightbulb'
  import TriangleAlert from '@lucide/svelte/icons/triangle-alert'
  import { showSuccessToast, showErrorToast, handleApiError } from '$lib/core/utils/toast'
  import {
    PROVIDER_OPTIONS, generateEndpoint, isCustomEndpoint, getProvider, isAzureProvider,
  } from '$lib/core/utils/object-storage-providers'
  import { HUB_REGION_NAME } from '$lib/core/constants'

  const storageStore = useStorages()
  const regionStore = useRegions()
  const clusterStore = useClusters()
  const accountStore = useAccounts()
  const auth = useAuth()
  const accountId = $derived(accountStore.selectedAccountId)
  // Members added here seed the storage's member pool; this is a convenience for the common
  // small case, not a capacity limit. Register more members and set the copyset count on
  // the storage detail page afterward to grow the pool and form more copysets.

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
  // Matches the server's request-size guard on the members payload; a malformed-request
  // bound, not a capacity limit (members can always be registered into the pool later).
  const MAX_BLOCK_MEMBERS = 100

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
  type MemberDraft = { id: number; name: string; regionClusterId: string }
  let memberSeq = 0
  let members = $state<MemberDraft[]>([{ id: memberSeq++, name: '', regionClusterId: '' }])
  let createdBlockVolumeIds = $state<string[]>([])
  let copiedIndex = $state(-1)
  let copyTimer: ReturnType<typeof setTimeout> | undefined

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
    members = [{ id: memberSeq++, name: '', regionClusterId: '' }]
  }

  // Block members are placed per region cluster. Load the region's clusters when a block
  // storage is being configured so each member can pick a placement.
  $effect(() => {
    if (isBlock && regionId) clusterStore.fetchClusters(Number(regionId), { isActive: true })
  })

  // Clusters are region-scoped: clear each member's placement when the region changes so a
  // stale cluster id from a previous region can't be submitted (the backend would reject
  // it, and the Select would silently show its placeholder while holding a non-empty value).
  let lastClusterRegion = ''
  $effect(() => {
    const rid = regionId
    if (rid === lastClusterRegion) return
    lastClusterRegion = rid
    for (const m of members) m.regionClusterId = ''
  })

  // Only ready+active clusters can host a member (the API rejects others). Each cluster is
  // treated as an optional availability/placement boundary for HA.
  const clusterOptions = $derived(
    clusterStore.clustersFor(Number(regionId))
      .filter(c => c.isActive && c.isReady)
      .map(c => ({ value: String(c.id), label: c.defaultCluster ? `${c.name} (default)` : c.name }))
  )
  const hasReadyClusters = $derived(clusterOptions.length > 0)
  const clustersLoading = $derived(!!regionId && clusterStore.isLoading(Number(regionId)))
  const membersComplete = $derived(members.every(m => !!m.regionClusterId))
  const atMemberCap = $derived(members.length >= MAX_BLOCK_MEMBERS)
  // Copyset formation always draws from the two lowest-numbered clusters holding pool
  // members, so several members legitimately share a cluster once more than one copyset is
  // in play. What actually blocks copyset formation is having fewer than two distinct
  // clusters represented at all.
  const filledClusterIds = $derived(members.map(m => m.regionClusterId).filter(Boolean))
  const insufficientClusterDiversity = $derived(
    filledClusterIds.length > 1 && new Set(filledClusterIds).size < 2
  )

  // Block-volume IDs are returned in member order. Label each with its block volume name,
  // falling back to the placement cluster's name when the member was left unnamed.
  const blockVolumeRows = $derived.by(() =>
    createdBlockVolumeIds.map((id, i) => {
      const m = members[i]
      const cluster = clusterStore.clustersFor(Number(regionId)).find(c => String(c.id) === m?.regionClusterId)
      return { id, label: m?.name.trim() || cluster?.name || `Member ${i + 1}` }
    })
  )

  function addMember() {
    if (atMemberCap) return
    members = [...members, { id: memberSeq++, name: '', regionClusterId: '' }]
  }
  function removeMember(i: number) {
    if (members.length > 1) members = members.filter((_, idx) => idx !== i)
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
      && objectStoreReady && bucketVerified
      && (!isBlock || membersComplete))
  )

  async function handleSubmit(e: Event) {
    e.preventDefault()
    if (!canSubmit || !accountId) return
    submitting = true
    try {
      const res = await storageStore.createStorage({
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
        members: isBlock
          ? members.map(m => ({ name: m.name.trim() || undefined, regionClusterId: Number(m.regionClusterId) }))
          : undefined,
        accessKey: accessKey.trim() || undefined,
        secretKey: secretKey.trim() || undefined,
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
              <div class="space-y-3">
                <div class="flex items-center justify-between gap-3">
                  <div>
                    <div class="flex items-center gap-1">
                      <p class="text-sm font-medium">Block Volume Members</p>
                      <InfoTip text="A copyset provides High Availability (HA): two nodes holding identical copies." />
                    </div>
                    <p class="text-xs text-muted-foreground">Each member is a blockserv node with its own block volume. Members go into a pool; after creation, register more members and set how many copysets to form from that pool.</p>
                  </div>
                  <div class="flex items-center gap-2 shrink-0">
                    <HowItWorks topic="block-storage" />
                    <Button variant="outline" size="sm" type="button" class="gap-1.5 shrink-0"
                      onclick={addMember} disabled={!hasReadyClusters || atMemberCap}>
                      <Plus class="size-4" aria-hidden="true" /> Add member
                    </Button>
                  </div>
                </div>

                <div class="flex items-start gap-2 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                  <Lightbulb class="size-4 shrink-0 text-primary" aria-hidden="true" />
                  <p>Clusters must be in separate availability zones or placement boundaries. Placing them in the same AZ defeats the purpose.</p>
                </div>

                {#if clustersLoading}
                  <p class="text-sm text-muted-foreground">Loading clusters…</p>
                {:else if !hasReadyClusters}
                  <p class="text-sm text-destructive">This region has no ready clusters. Mark a cluster ready before creating a block storage.</p>
                {:else}
                  {#each members as member, i (member.id)}
                    <div class="rounded-lg border p-3 space-y-3">
                      <div class="flex items-center gap-2">
                        <span class="text-sm font-medium">Block Volume</span>
                        {#if members.length > 1}
                          <button type="button" onclick={() => removeMember(i)}
                            class="ml-auto inline-flex min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 items-center justify-center opacity-60 hover:opacity-100 hover:text-destructive focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring rounded-sm transition-[color,opacity]"
                            aria-label={`Remove member ${i + 1}`} title="Remove member">
                            <X class="size-4" aria-hidden="true" />
                          </button>
                        {/if}
                      </div>
                      <div class="grid gap-3 sm:grid-cols-2">
                        <div class="space-y-2">
                          <Label for={`member-name-${i}`}>Name <span class="font-normal text-muted-foreground">(optional)</span></Label>
                          <Input id={`member-name-${i}`} bind:value={member.name} placeholder="e.g. originator" autocomplete="off" />
                        </div>
                        <div class="space-y-2">
                          <Label id={`member-cluster-label-${i}`} for={`member-cluster-${i}`}>Availability / placement</Label>
                          <Select id={`member-cluster-${i}`} ariaLabelledby={`member-cluster-label-${i}`}
                            bind:value={member.regionClusterId} placeholder="Select cluster..." options={clusterOptions} />
                        </div>
                      </div>
                    </div>
                  {/each}

                  {#if insufficientClusterDiversity}
                    <div class="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 p-2.5 text-xs text-warning">
                      <TriangleAlert class="size-4 shrink-0" aria-hidden="true" />
                      <p>All members are in the same cluster. Forming a copyset needs members in at least two different clusters; place at least one member in a different cluster.</p>
                    </div>
                  {/if}
                {/if}
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

          {#if createdBlockVolumeIds.length > 0}
            <Separator />
            <div class="space-y-2">
              <p class="text-sm font-medium">Block Volume IDs</p>
              <p class="text-sm text-muted-foreground">
                Copy each id into the matching blockserv's <code>BLOCK_VOLUME_ID</code> env.
              </p>
              {#each blockVolumeRows as row, i (row.id)}
                <div class="space-y-1">
                  <span class="block text-xs text-muted-foreground">{row.label}</span>
                  <div class="flex items-center gap-2">
                    <code class="flex-1 min-w-0 break-all rounded-sm bg-muted px-2 py-1 font-mono text-xs">{row.id}</code>
                    <Button
                      variant="ghost" size="icon" type="button" class="shrink-0 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0"
                      aria-label={`Copy ${row.label} id`}
                      onclick={() => copyId(row.id, i)}
                    >
                      {#if copiedIndex === i}
                        <Check class="size-4 text-primary" aria-hidden="true" />
                      {:else}
                        <Copy class="size-4" aria-hidden="true" />
                      {/if}
                    </Button>
                  </div>
                </div>
              {/each}
              <span class="sr-only" role="status" aria-live="polite">
                {copiedIndex >= 0 && blockVolumeRows[copiedIndex] ? `${blockVolumeRows[copiedIndex].label} id copied` : ''}
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
