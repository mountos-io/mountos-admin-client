<script lang="ts">
  import { goto } from '$app/navigation'
  import { useVolumes } from '$lib/core/stores/volumes.svelte'
  import { useAccounts } from '$lib/core/stores/accounts.svelte'
  import { useRegions } from '$lib/core/stores/regions.svelte'
  import { useStorages } from '$lib/core/stores/storages.svelte'
  import { useAuth } from '$lib/core/stores/auth.svelte'
  import { usePreferences } from '$lib/stores/preferences.svelte'
  import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '$lib/components/ui/table'
  import { Button } from '$lib/components/ui/button'
  import StatusBadge from '$lib/components/shared/StatusBadge.svelte'
  import FilterSelect from '$lib/components/shared/FilterSelect.svelte'
  import Pagination from '$lib/components/shared/Pagination.svelte'
  import LoadingSpinner from '$lib/components/shared/LoadingSpinner.svelte'
  import EmptyState from '$lib/components/shared/EmptyState.svelte'
  import { formatQuota } from '$lib/core/utils/format'
  import { showErrorToast } from '$lib/core/utils/toast'
  import Plus from '@lucide/svelte/icons/plus'
  import Eye from '@lucide/svelte/icons/eye'
  import Lock from '@lucide/svelte/icons/lock'
  import Shield from '@lucide/svelte/icons/shield-check'

  const volumeStore = useVolumes()
  const accountStore = useAccounts()
  const regionStore = useRegions()
  const storageStore = useStorages()
  const auth = useAuth()
  const prefs = usePreferences()
  const accountId = $derived(accountStore.selectedAccountId)

  let selectedRegionId = $state('')
  let selectedStorageId = $state('')

  const allOption = { value: '', label: 'All' } as const
  const regionOptions = $derived(
    [allOption, ...regionStore.regions.map(r => ({ value: String(r.id), label: r.name }))]
  )
  const storageOptions = $derived(
    [allOption, ...storageStore.storages.map(s => ({ value: String(s.id), label: s.name }))]
  )

  function refetch(page = 1) {
    if (!accountId) return
    volumeStore.fetchVolumes(
      accountId, page, prefs.pageSize,
      selectedRegionId ? Number(selectedRegionId) : undefined,
      selectedStorageId ? Number(selectedStorageId) : undefined,
    )
  }

  let filtersLoaded = false
  $effect(() => {
    if (!auth.loading && !auth.can('volumes', 'read')) {
      showErrorToast('Access denied')
      goto('/', { replaceState: true })
      return
    }
    if (accountId) {
      if (!filtersLoaded) {
        regionStore.fetchRegions(1, 100)
        storageStore.fetchStorages(accountId, 1, 100)
        filtersLoaded = true
      }
      refetch()
    }
  })
</script>

<div class="space-y-4">
  <div class="flex items-center justify-between">
    <h1 class="text-2xl font-bold tracking-tight">Volumes</h1>
    {#if accountId && auth.can('volumes', 'create')}
      <Button href="/volumes/create" variant="primary" size="sm" class="gap-1.5 cyberpunk-skewed-sm">
        <Plus class="h-4 w-4" />
        Create Volume
      </Button>
    {/if}
  </div>
  {#if !accountId}
    <EmptyState title="Select an account" description="Choose an account to view its volumes." />
  {:else}
    <div class="flex flex-wrap items-center gap-2">
      <FilterSelect options={regionOptions} value={selectedRegionId} placeholder="Region" onchange={(v) => { selectedRegionId = v }} />
      <FilterSelect options={storageOptions} value={selectedStorageId} placeholder="Storage" onchange={(v) => { selectedStorageId = v }} />
    </div>
    {#if volumeStore.loading}
      <LoadingSpinner />
    {:else if volumeStore.volumes.length === 0}
      <EmptyState title="No volumes" action={auth.can('volumes', 'create') ? { label: 'Create Volume', href: '/volumes/create' } : undefined} />
    {:else}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead class="th-cyber">Name</TableHead>
            <TableHead class="th-cyber hidden lg:table-cell">Region</TableHead>
            <TableHead class="th-cyber hidden lg:table-cell">Storage</TableHead>
            <TableHead class="th-cyber w-10"><span class="sr-only">Lock</span></TableHead>
            <TableHead class="th-cyber w-10"><span class="sr-only">Encryption</span></TableHead>
            <TableHead class="th-cyber hidden md:table-cell">Quota</TableHead>
            <TableHead class="th-cyber">Status</TableHead>
            <TableHead class="w-10"><span class="sr-only">Actions</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {#each volumeStore.volumes as volume}
            <TableRow>
              <TableCell class="font-medium max-w-[200px] truncate">{volume.name}</TableCell>
              <TableCell class="text-sm text-muted-foreground hidden lg:table-cell">{volume.region.name}</TableCell>
              <TableCell class="text-sm text-muted-foreground hidden lg:table-cell">{volume.storage.name}</TableCell>
              <TableCell>
                {#if volume.locked}<Lock class="size-4 text-warning" aria-label="Locked" />{/if}
              </TableCell>
              <TableCell>
                {#if volume.encryption}<Shield class="size-4 text-primary" aria-label="Encrypted" />{/if}
              </TableCell>
              <TableCell class="text-sm text-muted-foreground hidden md:table-cell">{formatQuota(volume.quotaUsed, volume.quotaLimit)}</TableCell>
              <TableCell><StatusBadge active={volume.isActive} locked={volume.locked} /></TableCell>
              <TableCell>
                <Button variant="ghost" size="icon" href="/volumes/{volume.id}" aria-label="View volume">
                  <Eye class="size-4" />
                </Button>
              </TableCell>
            </TableRow>
          {/each}
        </TableBody>
      </Table>
      <Pagination currentPage={volumeStore.currentPage} totalPages={volumeStore.totalPages} onPageChange={(p) => refetch(p)} />
    {/if}
  {/if}
</div>
