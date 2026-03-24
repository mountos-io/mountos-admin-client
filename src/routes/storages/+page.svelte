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
  import LoadingSpinner from '$lib/components/shared/LoadingSpinner.svelte'
  import EmptyState from '$lib/components/shared/EmptyState.svelte'
  import { showErrorToast } from '$lib/core/utils/toast'
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

<div class="space-y-4">
  <div class="flex items-center justify-between">
    <h1 class="text-2xl font-bold tracking-tight">Storages</h1>
    {#if accountId && auth.can('storages', 'create')}
      <Button href="/storages/create" variant="primary" size="sm" class="gap-1.5 cyberpunk-skewed-sm">
        <Plus class="h-4 w-4" />
        Create Storage
      </Button>
    {/if}
  </div>

  {#if accountId}
    <div class="corner-brackets relative border border-border/30 rounded-sm p-4 w-fit max-w-full">
      <div class="tech-grid absolute inset-0 pointer-events-none opacity-20"></div>
      <div class="relative flex flex-wrap items-center gap-3">
        <div class="relative">
          <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input class="pl-8 w-[200px] text-base" placeholder="Search by name..." value={search} oninput={onSearchInput} aria-label="Search storages" />
        </div>
        <FilterSelect options={regionOptions} bind:value={regionFilter} placeholder="All Regions" />
        <FilterSelect options={typeOptions} bind:value={typeFilter} placeholder="All Types" />
        <FilterSelect options={providerOptions} bind:value={providerFilter} placeholder="All Providers" />
      </div>
    </div>
  {/if}

  {#if !accountId}
    <EmptyState title="Select an account" description="Choose an account to view its storages." />
  {:else if storageStore.loading}
    <LoadingSpinner />
  {:else if storageStore.storages.length === 0}
    <EmptyState title="No storages" description={hasFilter ? 'No storages match the current filters.' : undefined} action={!hasFilter && auth.can('storages', 'create') ? { label: 'Create Storage', href: '/storages/create' } : undefined} />
  {:else}
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead class="th-cyber">Name</TableHead>
          <TableHead class="th-cyber">Region</TableHead>
          <TableHead class="th-cyber">Type</TableHead>
          <TableHead class="th-cyber">Provider</TableHead>
          <TableHead class="th-cyber">Status</TableHead>
          <TableHead class="th-cyber w-12"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {#each storageStore.storages as storage}
          <TableRow
            class="cursor-pointer hover:bg-muted/50"
            onclick={() => goto(`/storages/${storage.id}`)}
            onkeydown={(e: KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), goto(`/storages/${storage.id}`))}
            role="link"
            tabindex={0}
          >
            <TableCell class="font-medium max-w-[200px] truncate">{storage.name}</TableCell>
            <TableCell class="text-sm text-muted-foreground">{storage.regionInfo.name}</TableCell>
            <TableCell><Badge variant="outline">{storage.storageType}</Badge></TableCell>
            <TableCell><Badge variant="secondary">{storage.providerType}</Badge></TableCell>
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
