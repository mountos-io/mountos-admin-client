<script lang="ts">
  import { goto } from '$app/navigation'
  import { untrack } from 'svelte'
  import { useAlerts, TIME_RANGES, SEVERITY_LABELS, CATEGORIES } from '$lib/core/stores/alerts.svelte'
  import { useAuth } from '$lib/core/stores/auth.svelte'
  import { Card, CardContent } from '$lib/components/ui/card'
  import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '$lib/components/ui/table'
  import { Badge } from '$lib/components/ui/badge'
  import { Button } from '$lib/components/ui/button'
  import FilterPanel from '$lib/components/shared/FilterPanel.svelte'
  import FilterSelect from '$lib/components/shared/FilterSelect.svelte'
  import Pagination from '$lib/components/shared/Pagination.svelte'
  import EmptyState from '$lib/components/shared/EmptyState.svelte'
  import { Skeleton } from '$lib/components/ui/skeleton'
  import { formatRelative } from '$lib/core/utils/format'
  import { showErrorToast, showSuccessToast } from '$lib/core/utils/toast'
  import ShieldAlert from '@lucide/svelte/icons/shield-alert'
  import AlertTriangle from '@lucide/svelte/icons/triangle-alert'
  import Info from '@lucide/svelte/icons/info'
  import CheckCircle from '@lucide/svelte/icons/check-circle'
  import Loader2 from '@lucide/svelte/icons/loader-2'

  const store = useAlerts()
  const auth = useAuth()
  let redirected = false
  let resolvingId = $state<string | null>(null)


  $effect(() => {
    if (auth.loading) return
    if (!auth.can('alerts', 'read')) {
      if (!redirected) { redirected = true; showErrorToast('Access denied'); goto('/', { replaceState: true }) }
      return
    }
    untrack(() => {
      store.markSeen()
      store.fetchAlerts()
    })
  })

  const severityOptions: readonly { value: string; label: string }[] = [
    { value: '', label: 'All Severities' },
    { value: '2', label: 'Critical' },
    { value: '1', label: 'Warning' },
    { value: '0', label: 'Info' },
  ]

  const categoryOptions: readonly { value: string; label: string }[] = [
    { value: '', label: 'All Categories' },
    ...CATEGORIES.map(c => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) })),
  ]

  const timeOptions: readonly { value: string; label: string }[] = TIME_RANGES.map(r => ({ value: r.value, label: r.label }))

  function severityBadgeVariant(severity: number): 'destructive' | 'warning' | 'default' {
    if (severity === 2) return 'destructive'
    if (severity === 1) return 'warning'
    return 'default'
  }

  function severityIcon(severity: number) {
    if (severity === 2) return ShieldAlert
    if (severity === 1) return AlertTriangle
    return Info
  }

  const sevFilterStr = $derived(store.severityFilter !== undefined ? String(store.severityFilter) : '')
  function onSevChange(v: string) {
    store.setSeverityFilter(v === '' ? undefined : Number(v))
  }

  async function handleResolve(alertId: string) {
    if (resolvingId) return
    resolvingId = alertId
    try {
      await store.resolveAlert(alertId)
      showSuccessToast('Alert resolved')
    } catch {
      showErrorToast('Failed to resolve alert')
    } finally {
      resolvingId = null
    }
  }
</script>

<svelte:head><title>Alerts — mountOS Admin</title></svelte:head>

<div class="space-y-4">
  <div class="flex items-center gap-3">
    <h1 class="text-2xl font-bold tracking-tight">Alerts</h1>
    {#if store.activeCount > 0}
      <Badge variant="destructive" aria-live="polite">{store.activeCount} active</Badge>
    {/if}
  </div>

  <FilterPanel>
    <FilterSelect
      options={severityOptions}
      value={sevFilterStr}
      placeholder="Severity"
      label="Filter by severity"
      onchange={onSevChange}
    />
    <FilterSelect
      options={categoryOptions}
      value={store.categoryFilter}
      placeholder="Category"
      label="Filter by category"
      onchange={(v) => store.setCategoryFilter(v)}
    />
    <FilterSelect
      options={timeOptions}
      value={store.sinceFilter}
      placeholder="Time range"
      label="Filter by time range"
      onchange={(v) => store.setSinceFilter(v)}
    />
    {#if store.severityFilter !== undefined || store.categoryFilter || store.sinceFilter !== '30m'}
      <Button variant="ghost" size="sm" onclick={() => store.clearFilters()}>Clear filters</Button>
    {/if}
    <div class="ml-auto flex items-center rounded-md border border-border/50 p-0.5" role="tablist" aria-label="Alert status">
      <button
        role="tab"
        aria-selected={store.activeFilter}
        class="px-3 py-1 text-sm font-medium rounded transition-colors {store.activeFilter ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}"
        onclick={() => store.setActiveFilter(true)}
      >Active</button>
      <button
        role="tab"
        aria-selected={!store.activeFilter}
        class="px-3 py-1 text-sm font-medium rounded transition-colors {!store.activeFilter ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}"
        onclick={() => store.setActiveFilter(false)}
      >All</button>
    </div>
  </FilterPanel>

  {#if store.loading && store.alerts.length === 0}
    <Card cornerPlus class="px-4">
      <Table>
        <caption class="sr-only">Loading alerts</caption>
        <TableHeader>
          <TableRow>
            <TableHead class="w-28">Severity</TableHead>
            <TableHead class="w-24">Category</TableHead>
            <TableHead>Title</TableHead>
            <TableHead class="hidden md:table-cell">Account</TableHead>
            <TableHead class="hidden md:table-cell">Region</TableHead>
            <TableHead class="hidden lg:table-cell">Source</TableHead>
            <TableHead class="hidden xl:table-cell">Node</TableHead>
            <TableHead class="w-32">Time</TableHead>
            <TableHead class="w-20">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {#each { length: 5 } as _}
            <TableRow>
              <TableCell><Skeleton class="h-5 w-16" /></TableCell>
              <TableCell><Skeleton class="h-4 w-14" /></TableCell>
              <TableCell><Skeleton class="h-4 w-48" /></TableCell>
              <TableCell class="hidden md:table-cell"><Skeleton class="h-4 w-20" /></TableCell>
              <TableCell class="hidden md:table-cell"><Skeleton class="h-4 w-20" /></TableCell>
              <TableCell class="hidden lg:table-cell"><Skeleton class="h-4 w-20" /></TableCell>
              <TableCell class="hidden xl:table-cell"><Skeleton class="h-4 w-24" /></TableCell>
              <TableCell><Skeleton class="h-4 w-20" /></TableCell>
              <TableCell><Skeleton class="h-5 w-16" /></TableCell>
            </TableRow>
          {/each}
        </TableBody>
      </Table>
    </Card>
  {:else if store.error}
    <Card cornerPlus>
      <CardContent class="py-8 space-y-3">
        <p class="text-center text-destructive" role="alert">{store.error}</p>
        <div class="flex justify-center">
          <Button variant="outline" size="sm" onclick={() => store.fetchAlerts()}>Retry</Button>
        </div>
      </CardContent>
    </Card>
  {:else if store.alerts.length === 0}
    <EmptyState title="No alerts" description="No alerts match your current filters" />
  {:else}
    <Card cornerPlus class="px-4">
      <Table>
        <caption class="sr-only">Service alerts</caption>
        <TableHeader>
          <TableRow>
            <TableHead class="w-28">Severity</TableHead>
            <TableHead class="w-24">Category</TableHead>
            <TableHead>Title</TableHead>
            <TableHead class="hidden md:table-cell">Account</TableHead>
            <TableHead class="hidden md:table-cell">Region</TableHead>
            <TableHead class="hidden lg:table-cell">Source</TableHead>
            <TableHead class="hidden xl:table-cell">Node</TableHead>
            <TableHead class="w-32">Time</TableHead>
            <TableHead class="w-20">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {#each store.alerts as alert (alert.alertId)}
            {@const SevIcon = severityIcon(alert.severity)}
            <TableRow>
              <TableCell>
                <Badge variant={severityBadgeVariant(alert.severity)} class="gap-1">
                  <SevIcon class="h-3 w-3" />
                  {SEVERITY_LABELS[alert.severity] ?? 'Unknown'}
                </Badge>
              </TableCell>
              <TableCell>
                <span class="capitalize text-sm">{alert.category}</span>
              </TableCell>
              <TableCell>
                <div class="min-w-0">
                  <p class="font-medium text-sm truncate">{alert.title}</p>
                  {#if alert.description}
                    <p class="text-xs text-muted-foreground truncate mt-0.5">{alert.description}</p>
                  {/if}
                </div>
              </TableCell>
              <TableCell class="hidden md:table-cell">
                {#if alert.account}
                  <span class="text-sm">{alert.account.name}</span>
                {:else}
                  <span class="text-xs text-muted-foreground">(not set)</span>
                {/if}
              </TableCell>
              <TableCell class="hidden md:table-cell">
                {#if alert.region}
                  <span class="text-sm">{alert.region.name}</span>
                {:else}
                  <span class="text-xs text-muted-foreground">(not set)</span>
                {/if}
              </TableCell>
              <TableCell class="hidden lg:table-cell">
                <Badge variant="outline" class="text-xs font-mono">{alert.source}</Badge>
              </TableCell>
              <TableCell class="hidden xl:table-cell">
                {#if alert.nodeId && alert.region}
                  <a href="/regions/{alert.region.id}/{alert.nodeId}" class="text-sm font-mono text-primary hover:underline">{alert.nodeId}</a>
                {:else}
                  <span class="text-sm text-muted-foreground font-mono">{alert.nodeId || ''}</span>
                  {#if !alert.nodeId}<span class="text-xs text-muted-foreground">(not set)</span>{/if}
                {/if}
              </TableCell>
              <TableCell>
                <span class="text-sm text-muted-foreground whitespace-nowrap">{formatRelative(alert.eventTime)}</span>
              </TableCell>
              <TableCell>
                {#if !alert.resolvedAt}
                  {@const isResolving = resolvingId === alert.alertId}
                  <Button variant="ghost" size="sm" disabled={!!resolvingId} aria-busy={isResolving} onclick={() => handleResolve(alert.alertId)} class="h-7 min-h-[44px] sm:min-h-0 gap-1 text-xs">
                    {#if isResolving}
                      <Loader2 class="h-3.5 w-3.5 animate-spin" />
                    {:else}
                      <CheckCircle class="h-3.5 w-3.5" />
                    {/if}
                    Resolve
                  </Button>
                {:else}
                  <Badge variant="outline" class="text-xs">Resolved</Badge>
                {/if}
              </TableCell>
            </TableRow>
          {/each}
        </TableBody>
      </Table>
    </Card>

    {#if store.totalPages > 1}
      <Pagination
        currentPage={store.page}
        totalPages={store.totalPages}
        onPageChange={(p) => store.setPage(p)}
      />
    {/if}
  {/if}
</div>
