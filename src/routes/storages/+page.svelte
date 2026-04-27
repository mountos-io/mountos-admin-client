<script lang="ts">
  import { goto } from '$app/navigation'
  import { useStorages } from '$lib/core/stores/storages.svelte'
  import { useAccounts } from '$lib/core/stores/accounts.svelte'
  import { useRegions } from '$lib/core/stores/regions.svelte'
  import { useAuth } from '$lib/core/stores/auth.svelte'
  import { usePreferences } from '$lib/stores/preferences.svelte'
  import { debounce } from '$lib/utils'
  import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '$lib/components/ui/table'
  import { Button } from '$lib/components/ui/button'
  import { Badge } from '$lib/components/ui/badge'
  import { Input } from '$lib/components/ui/input'
  import StatusBadge from '$lib/components/shared/StatusBadge.svelte'
  import FilterSelect from '$lib/components/shared/FilterSelect.svelte'
  import Pagination from '$lib/components/shared/Pagination.svelte'
  import EmptyState from '$lib/components/shared/EmptyState.svelte'
  import TableSkeleton from '$lib/components/shared/TableSkeleton.svelte'
  import { showErrorToast } from '$lib/core/utils/toast'
  import PageHeader from '$lib/components/shared/PageHeader.svelte'
  import FilterPanel from '$lib/components/shared/FilterPanel.svelte'
  import Plus from '@lucide/svelte/icons/plus'
  import Search from '@lucide/svelte/icons/search'
  import DatabaseIcon from '@lucide/svelte/icons/database'

  const storageStore = useStorages()
  const accountStore = useAccounts()
  const regionStore = useRegions()
  const auth = useAuth()
  const prefs = usePreferences()
  const accountId = $derived(accountStore.selectedAccountId)

  let search = $state('')
  let activeSearch = $state('')
  let regionFilter = $state('')
  let typeFilter = $state('')
  let providerFilter = $state('')
  let filtersLoadedFor: number | null = null

  const hasFilter = $derived(activeSearch || regionFilter || typeFilter || providerFilter)

  const regionOptions = $derived([
    { value: '', label: 'All Regions' },
    ...regionStore.regions.map(r => ({ value: String(r.id), label: r.name })),
  ])

  const unique = (items: string[]) => [...new Set(items)].sort()
  const toOptions = (values: string[], allLabel: string) =>
    [{ value: '', label: allLabel }, ...values.map(v => ({ value: v, label: v }))]
  const typeOptions = $derived(toOptions(unique(storageStore.storages.map(s => s.storageType)), 'All Types'))
  const providerOptions = $derived(toOptions(unique(storageStore.storages.map(s => s.providerType)), 'All Providers'))

  function buildFilters() {
    return {
      search: activeSearch || undefined,
      regionId: regionFilter ? Number(regionFilter) : undefined,
      storageType: typeFilter || undefined,
      providerType: providerFilter || undefined,
    }
  }

  function fetchPage(page = 1) {
    if (accountId) storageStore.fetchStorages(accountId, page, prefs.pageSize, buildFilters())
  }

  const debouncedApplySearch = debounce(() => {
    activeSearch = search
  }, 300)

  function onSearchInput(e: Event) {
    search = (e.target as HTMLInputElement).value
    debouncedApplySearch()
  }

  $effect(() => {
    if (!auth.loading && !auth.can('storages', 'read')) {
      showErrorToast('Access denied')
      goto('/', { replaceState: true })
      return
    }
    if (accountId) {
      if (filtersLoadedFor !== accountId) {
        regionStore.fetchRegions(1, 100)
        filtersLoadedFor = accountId
      }
      fetchPage()
    }
  })
</script>

<svelte:head><title>Storages · mountOS Admin</title></svelte:head>

<div class="space-y-4">
  <PageHeader title="Storages" action={accountId && auth.can('storages', 'create') ? { label: 'Create Storage', href: '/storages/create', icon: Plus } : undefined} />

  {#if accountId}
    <FilterPanel class="max-w-full">
      <div class="relative">
        <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
        <Input class="pl-8 w-full sm:w-[200px] text-base" placeholder="Search by name..." value={search} oninput={onSearchInput} aria-label="Search storages" />
      </div>
      <FilterSelect options={regionOptions} bind:value={regionFilter} placeholder="All Regions" label="Filter by region" />
      <FilterSelect options={typeOptions} bind:value={typeFilter} placeholder="All Types" label="Filter by type" />
      <FilterSelect options={providerOptions} bind:value={providerFilter} placeholder="All Providers" label="Filter by provider" />
    </FilterPanel>
  {/if}

  {#snippet headerRow()}
    <TableRow>
      <TableHead class="th-cyber">Name</TableHead>
      <TableHead class="th-cyber hidden sm:table-cell">Region</TableHead>
      <TableHead class="th-cyber hidden md:table-cell">Type</TableHead>
      <TableHead class="th-cyber hidden md:table-cell">Provider</TableHead>
      <TableHead class="th-cyber">Status</TableHead>
      <TableHead class="th-cyber w-12"></TableHead>
    </TableRow>
  {/snippet}

  {#if !accountId}
    <EmptyState title="Select an account" description="Choose an account to view its storages." />
  {:else if storageStore.loading}
    <TableSkeleton
      header={headerRow}
      caption="Loading storages"
      cells={[
        { width: 'w-32' },
        { width: 'w-24', class: 'hidden sm:table-cell' },
        { width: 'w-16', height: 'h-5', class: 'hidden md:table-cell' },
        { width: 'w-20', height: 'h-5', class: 'hidden md:table-cell' },
        { width: 'w-16', height: 'h-5' },
        { width: 'w-6' },
      ]}
    />
  {:else if storageStore.storages.length === 0}
    <EmptyState title="No storages" description={hasFilter ? 'No storages match the current filters.' : undefined} action={!hasFilter && auth.can('storages', 'create') ? { label: 'Create Storage', href: '/storages/create' } : undefined} />
  {:else}
    <Table>
      <caption class="sr-only">Storages</caption>
      <TableHeader>
        {@render headerRow()}
      </TableHeader>
      <TableBody>
        {#each storageStore.storages as storage}
          <TableRow
            class="cursor-pointer hover:bg-muted/50"
            role="button"
            onclick={() => goto(`/storages/${storage.id}`)}
            onkeydown={(e: KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), goto(`/storages/${storage.id}`))}
            tabindex={0}
            aria-label="Storage {storage.name}"
          >
            <TableCell class="font-medium max-w-[200px] truncate" title={storage.name}>{storage.name}</TableCell>
            <TableCell class="text-sm text-muted-foreground hidden sm:table-cell">{storage.regionInfo.name}</TableCell>
            <TableCell class="hidden md:table-cell"><Badge variant="outline">{storage.storageType}</Badge></TableCell>
            <TableCell class="hidden md:table-cell"><Badge variant="secondary">{storage.providerType}</Badge></TableCell>
            <TableCell><StatusBadge active={storage.isActive} /></TableCell>
            <TableCell>
              {#if auth.can('volumes', 'create')}
                <Button variant="ghost" size="sm"
                  href="/volumes/create?storageId={storage.id}"
                  title="Create Volume" aria-label="Create Volume"
                  onclick={(e: MouseEvent) => e.stopPropagation()}>
                  <DatabaseIcon class="size-3.5" aria-hidden="true" />
                </Button>
              {/if}
            </TableCell>
          </TableRow>
        {/each}
      </TableBody>
    </Table>
    <Pagination currentPage={storageStore.currentPage} totalPages={storageStore.totalPages} onPageChange={(p) => fetchPage(p)} />
  {/if}
</div>
