<script lang="ts">
  import { goto } from '$app/navigation'
  import { useVolumes } from '$lib/core/stores/volumes.svelte'
  import { useAccounts } from '$lib/core/stores/accounts.svelte'
  import { useRegions } from '$lib/core/stores/regions.svelte'
  import { useStorages } from '$lib/core/stores/storages.svelte'
  import { useAuth } from '$lib/core/stores/auth.svelte'
  import { usePreferences } from '$lib/stores/preferences.svelte'
  import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '$lib/components/ui/table'
  import StatusBadge from '$lib/components/shared/StatusBadge.svelte'
  import FilterSelect from '$lib/components/shared/FilterSelect.svelte'
  import Pagination from '$lib/components/shared/Pagination.svelte'
  import LoadingSpinner from '$lib/components/shared/LoadingSpinner.svelte'
  import EmptyState from '$lib/components/shared/EmptyState.svelte'
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
  const storageStore = useStorages()
  const auth = useAuth()
  const prefs = usePreferences()
  const accountId = $derived(accountStore.selectedAccountId)

  let selectedRegionId = $state('')
  let selectedStorageId = $state('')

  const hubRegionIds = $derived(
    new Set(regionStore.regions.filter(r => r.name === HUB_REGION_NAME).map(r => r.id))
  )

  const isHubSelected = $derived(selectedRegionId !== '' && hubRegionIds.has(Number(selectedRegionId)))
  const canCreate = $derived(auth.can('volumes', 'create') && !isHubSelected)

  const regionOptions = $derived([
    { value: '', label: 'All Regions' },
    ...regionStore.regions
      .filter(r => r.name.toLowerCase() !== 'hub')
      .map(r => ({ value: String(r.id), label: r.name })),
  ])

  const storageOptions = $derived([
    { value: '', label: 'All Storage' },
    ...storageStore.storages
      .filter(s => !hubRegionIds.has(s.regionInfo.id))
      .filter(s => !selectedRegionId || s.regionInfo.id === Number(selectedRegionId))
      .map(s => ({ value: String(s.id), label: s.name })),
  ])

  function refetch(page = 1) {
    if (!accountId) return
    volumeStore.fetchVolumes(
      accountId, page, prefs.pageSize,
      selectedRegionId ? Number(selectedRegionId) : undefined,
      selectedStorageId ? Number(selectedStorageId) : undefined,
    )
  }

  function onRegionChange(v: string) {
    selectedRegionId = v
    if (v && selectedStorageId) {
      const s = storageStore.storages.find(s => String(s.id) === selectedStorageId)
      if (s && s.regionInfo.id !== Number(v)) selectedStorageId = ''
    }
  }

  function onStorageChange(v: string) {
    selectedStorageId = v
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
        regionStore.fetchRegions(1, 100)
        storageStore.fetchStorages(accountId, 1, 100)
        filtersLoadedFor = accountId
      }
      refetch()
    }
  })
</script>

<svelte:head>
  <title>Volumes — mountOS Admin</title>
</svelte:head>

<div class="space-y-4">
  <PageHeader title="Volumes" action={accountId && canCreate ? { label: 'Create Volume', href: '/volumes/create', icon: Plus } : undefined} />
  {#if !accountId}
    <EmptyState title="Select an account" description="Choose an account to view its volumes." />
  {:else}
    <FilterPanel class="max-w-full text-base">
      <FilterSelect class="text-base"
        options={regionOptions}
        value={selectedRegionId}
        placeholder="All Regions"
        onchange={onRegionChange}
      />
      <FilterSelect class="text-base"
        options={storageOptions}
        value={selectedStorageId}
        placeholder="All Storage"
        onchange={onStorageChange}
      />
    </FilterPanel>
    {#if volumeStore.loading}
      <LoadingSpinner />
    {:else if volumeStore.volumes.length === 0}
      <EmptyState title="No volumes" action={canCreate ? { label: 'Create Volume', href: '/volumes/create' } : undefined} />
    {:else}
      <Table>
        <caption class="sr-only">Volumes</caption>
        <TableHeader>
          <TableRow>
            <TableHead class="th-cyber">Name</TableHead>
            <TableHead class="th-cyber hidden lg:table-cell">Region</TableHead>
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
        </TableHeader>
        <TableBody>
          {#each volumeStore.volumes as volume}
            <TableRow
              class="cursor-pointer hover:bg-muted/50"
              role="link"
              onclick={() => goto(`/volumes/${volume.id}`)}
              onkeydown={(e: KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), goto(`/volumes/${volume.id}`))}
              tabindex={0}
              aria-label="Volume {volume.name}"
            >
              <TableCell class="font-medium max-w-[200px] truncate" title={volume.name}>{volume.name}</TableCell>
              <TableCell class="text-sm text-muted-foreground hidden lg:table-cell">{volume.region.name}</TableCell>
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
