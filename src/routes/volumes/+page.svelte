<script lang="ts">
  import { goto } from '$app/navigation'
  import { useVolumes } from '$lib/core/stores/volumes.svelte'
  import { useAccounts } from '$lib/core/stores/accounts.svelte'
  import { useRegions } from '$lib/core/stores/regions.svelte'
  import { useClusters } from '$lib/core/stores/clusters.svelte'
  import { useStorages } from '$lib/core/stores/storages.svelte'
  import { useAuth } from '$lib/core/stores/auth.svelte'
  import { usePreferences } from '$lib/stores/preferences.svelte'
  import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '$lib/components/ui/table'
  import StatusBadge from '$lib/components/shared/StatusBadge.svelte'
  import { Badge } from '$lib/components/ui/badge'
  import FilterSelect from '$lib/components/shared/FilterSelect.svelte'
  import { Checkbox } from '$lib/components/ui/checkbox'
  import Pagination from '$lib/components/shared/Pagination.svelte'
  import EmptyState from '$lib/components/shared/EmptyState.svelte'
  import TableSkeleton from '$lib/components/shared/TableSkeleton.svelte'
  import { formatBytes, formatQuota } from '$lib/core/utils/format'
  import { showErrorToast } from '$lib/core/utils/toast'
  import { HUB_REGION_NAME } from '$lib/core/constants'
  import PageHeader from '$lib/components/shared/PageHeader.svelte'
  import FilterPanel from '$lib/components/shared/FilterPanel.svelte'
  import Plus from '@lucide/svelte/icons/plus'
  import Lock from '@lucide/svelte/icons/lock'
  import Shield from '@lucide/svelte/icons/shield-check'
  import InfoTip from '$lib/components/shared/InfoTip.svelte'

  const volumeStore = useVolumes()
  const accountStore = useAccounts()
  const regionStore = useRegions()
  const clusterStore = useClusters()
  const storageStore = useStorages()
  const auth = useAuth()
  const prefs = usePreferences()
  const accountId = $derived(accountStore.selectedAccountId)

  let selectedRegionId = $state('')
  let selectedClusterId = $state('')
  let selectedStorageId = $state('')
  let selectedVolumeType = $state('')
  // 'active' (default) | 'inactive' | 'all'.  'active' maps to isActive=true,
  // 'inactive' to isActive=false, 'all' to omitting the param (server returns both).
  let statusFilter = $state<'active' | 'inactive' | 'all'>('active')
  let lockedOnly = $state(false)

  const hubRegionIds = $derived(
    new Set(regionStore.regions.filter(r => r.name === HUB_REGION_NAME).map(r => r.id))
  )

  const isHubSelected = $derived(selectedRegionId !== '' && hubRegionIds.has(Number(selectedRegionId)))
  const canCreate = $derived(auth.can('volumes', 'create') && !isHubSelected)

  const regionOptions = $derived([
    { value: '', label: 'Any region' },
    ...regionStore.regions
      .filter(r => r.name.toLowerCase() !== 'hub')
      .map(r => ({ value: String(r.id), label: r.name })),
  ])

  // Cluster filter is dependent on the selected region. If no region is
  // selected we hide the dropdown entirely; clusters don't span regions so
  // a global cluster-id filter would be misleading.
  const clusterOptions = $derived(
    selectedRegionId
      ? [{ value: '', label: 'Any cluster' }].concat(
          clusterStore.clustersFor(Number(selectedRegionId)).map(c => ({ value: String(c.id), label: c.name })),
        )
      : [],
  )

  const storageOptions = $derived([
    { value: '', label: 'Any storage' },
    ...storageStore.storages
      .filter(s => !hubRegionIds.has(s.regionInfo.id))
      .filter(s => !selectedRegionId || s.regionInfo.id === Number(selectedRegionId))
      .map(s => ({ value: String(s.id), label: s.name })),
  ])

  const volumeTypeOptions = [
    { value: '', label: 'Any type' },
    { value: 'general', label: 'General' },
    { value: 'iceberg', label: 'Iceberg' },
  ]

  const statusOptions = [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'all', label: 'All' },
  ]

  const hasFilter = $derived(
    selectedRegionId !== '' || selectedClusterId !== '' || selectedStorageId !== '' || selectedVolumeType !== '' ||
    statusFilter !== 'active' || lockedOnly
  )

  function refetch(page = 1) {
    if (!accountId) return
    volumeStore.fetchVolumes({
      accountId,
      page,
      limit: prefs.pageSize,
      regionId: selectedRegionId ? Number(selectedRegionId) : undefined,
      regionClusterId: selectedClusterId ? Number(selectedClusterId) : undefined,
      storageId: selectedStorageId ? Number(selectedStorageId) : undefined,
      volumeType: selectedVolumeType || undefined,
      locked: lockedOnly || undefined,
      isActive: statusFilter === 'all' ? undefined : statusFilter === 'active',
    })
  }

  function onRegionChange(v: string) {
    selectedRegionId = v
    // Reset the cluster filter when region changes; load the new region's
    // clusters so the dependent dropdown has options before the user opens it.
    selectedClusterId = ''
    if (v) clusterStore.fetchClusters(Number(v))
    if (v && selectedStorageId) {
      const s = storageStore.storages.find(s => String(s.id) === selectedStorageId)
      if (s && s.regionInfo.id !== Number(v)) selectedStorageId = ''
    }
  }

  function onClusterChange(v: string) {
    selectedClusterId = v
  }

  function onStorageChange(v: string) {
    selectedStorageId = v
  }

  function onVolumeTypeChange(v: string) {
    selectedVolumeType = v
  }

  function onStatusChange(v: string) {
    statusFilter = v as 'active' | 'inactive' | 'all'
  }

  let filtersLoadedFor: number | null = null
  $effect(() => {
    if (!auth.loading && !auth.can('volumes', 'read')) {
      showErrorToast('Access denied')
      goto('/', { replaceState: true })
      return
    }
    if (accountId) {
      if (filtersLoadedFor !== accountId) {
        regionStore.fetchRegions({ page: 1, limit: 100 })
        storageStore.fetchStorages({ accountId, page: 1, limit: 100 })
        filtersLoadedFor = accountId
      }
      // Refetch on any filter change (tracked via reactive reads).
      void selectedRegionId; void selectedClusterId; void selectedStorageId; void selectedVolumeType
      void statusFilter; void lockedOnly
      refetch()
    }
  })
</script>

<svelte:head>
  <title>Volumes · mountOS Admin</title>
</svelte:head>

<div class="space-y-4">
  <PageHeader title="Volumes" action={accountId && canCreate ? { label: 'Create Volume', href: '/volumes/create', icon: Plus } : undefined} />
  {#if !accountId}
    <EmptyState title="Select an account" description="Choose an account to view its volumes." />
  {:else}
    <fieldset>
      <legend class="sr-only">Volume filters</legend>
      <FilterPanel class="max-w-full text-base">
        <FilterSelect class="text-base"
          options={regionOptions}
          value={selectedRegionId}
          placeholder="Any region"
          label="Filter by region"
          controls="volumes-table"
          onchange={onRegionChange}
        />
        {#if clusterOptions.length > 1}
          <FilterSelect class="text-base"
            options={clusterOptions}
            value={selectedClusterId}
            placeholder="Any cluster"
            label="Filter by cluster"
            controls="volumes-table"
            onchange={onClusterChange}
          />
        {/if}
        <FilterSelect class="text-base"
          options={storageOptions}
          value={selectedStorageId}
          placeholder="Any storage"
          label="Filter by storage"
          controls="volumes-table"
          onchange={onStorageChange}
        />
        <FilterSelect class="text-base"
          options={volumeTypeOptions}
          value={selectedVolumeType}
          placeholder="Any type"
          label="Filter by volume type"
          controls="volumes-table"
          onchange={onVolumeTypeChange}
        />
        <FilterSelect class="text-base"
          options={statusOptions}
          value={statusFilter}
          placeholder="Active"
          label="Filter by status"
          controls="volumes-table"
          onchange={onStatusChange}
        />
        <Checkbox bind:checked={lockedOnly} label="Locked only" aria-controls="volumes-table" />
      </FilterPanel>
    </fieldset>
    {#snippet headerRow()}
      <TableRow>
        <TableHead class="th-cyber">Name</TableHead>
        <TableHead class="th-cyber">Type</TableHead>
        <TableHead class="th-cyber hidden sm:table-cell">Kind</TableHead>
        <TableHead class="th-cyber hidden lg:table-cell">Region</TableHead>
        <TableHead class="th-cyber hidden lg:table-cell">Cluster</TableHead>
        <TableHead class="th-cyber hidden lg:table-cell">Storage</TableHead>
        <TableHead class="th-cyber w-10"><span class="sr-only">Lock</span></TableHead>
        <TableHead class="th-cyber w-10"><span class="sr-only">Encryption</span></TableHead>
        <TableHead class="th-cyber hidden md:table-cell">
          <span class="inline-flex items-center gap-1">
            Live
            <InfoTip text="Sum of all live files for this volume" />
          </span>
        </TableHead>
        <TableHead class="th-cyber hidden md:table-cell">
          <span class="inline-flex items-center gap-1">
            Quota
            <InfoTip text="Total volume usage vs allocated quota limit" />
          </span>
        </TableHead>
        <TableHead class="th-cyber">Status</TableHead>
      </TableRow>
    {/snippet}
    {#if volumeStore.loading}
      <TableSkeleton
        header={headerRow}
        caption="Loading volumes"
        cells={[
          { width: 'w-32' },
          { width: 'w-16' },
          { width: 'w-16', class: 'hidden sm:table-cell' },
          { width: 'w-20', class: 'hidden lg:table-cell' },
          { width: 'w-20', class: 'hidden lg:table-cell' },
          { width: 'w-24', class: 'hidden lg:table-cell' },
          { width: 'w-4' },
          { width: 'w-4' },
          { width: 'w-16', class: 'hidden md:table-cell' },
          { width: 'w-24', class: 'hidden md:table-cell' },
          { width: 'w-16', height: 'h-5' },
        ]}
      />
    {:else if volumeStore.volumes.length === 0}
      <EmptyState title="No volumes" description={hasFilter ? 'No volumes match the current filters.' : undefined} action={!hasFilter && canCreate ? { label: 'Create Volume', href: '/volumes/create' } : undefined} />
    {:else}
      <p class="sr-only" role="status" aria-live="polite">
        Showing {volumeStore.volumes.length} {volumeStore.volumes.length === 1 ? 'volume' : 'volumes'} on page {volumeStore.currentPage} of {volumeStore.totalPages}
      </p>
      <Table id="volumes-table" containerLabel="Volumes">
        <caption class="sr-only">Volumes</caption>
        <TableHeader>
          {@render headerRow()}
        </TableHeader>
        <TableBody>
          {#each volumeStore.volumes as volume}
            <TableRow
              class={`relative cursor-pointer hover:bg-muted/50 ${volume.isActive ? '' : 'bg-muted/40'}`}
            >
              <TableCell class="font-medium max-w-[200px] truncate" title={volume.name}>
                <a href="/volumes/{volume.id}" class="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring" aria-label="Volume {volume.name}{volume.isActive ? '' : ', deactivated'}">{volume.name}</a>
              </TableCell>
              <TableCell>
                <Badge variant={volume.volumeType === 'iceberg' ? 'primary' : 'secondary'} class="capitalize">{volume.volumeType}</Badge>
              </TableCell>
              <TableCell class="hidden sm:table-cell">
                {#if volume.storageType}<Badge variant="outline" class="capitalize">{volume.storageType}</Badge>{/if}
              </TableCell>
              <TableCell class="text-sm text-muted-foreground hidden lg:table-cell">{volume.region.name}</TableCell>
              <TableCell class="text-sm text-muted-foreground hidden lg:table-cell">{volume.regionCluster?.name || '(not set)'}</TableCell>
              <TableCell class="text-sm text-muted-foreground hidden lg:table-cell">{volume.storage.name}</TableCell>
              <TableCell>
                {#if volume.locked}<Lock class="size-4 text-warning" aria-label="Locked" />{/if}
              </TableCell>
              <TableCell>
                {#if volume.encryption}<Shield class="size-4 text-primary" aria-label="Encrypted" />{/if}
              </TableCell>
              <TableCell class="text-sm text-muted-foreground hidden md:table-cell font-mono">{formatBytes(volume.liveVolume)}</TableCell>
              <TableCell class="text-sm text-muted-foreground hidden md:table-cell">{formatQuota(volume.totalVolume, volume.quotaLimit)}</TableCell>
              <TableCell><StatusBadge active={volume.isActive} locked={volume.locked} /></TableCell>
            </TableRow>
          {/each}
        </TableBody>
      </Table>
      <Pagination currentPage={volumeStore.currentPage} totalPages={volumeStore.totalPages} onPageChange={(p) => refetch(p)} />
    {/if}
  {/if}
</div>
