<script lang="ts">
  import { goto } from '$app/navigation'
  import { untrack } from 'svelte'
  import { useAlerts, TIME_RANGES, SEVERITY_LABELS, CATEGORIES } from '$lib/core/stores/alerts.svelte'
  import { useAuth } from '$lib/core/stores/auth.svelte'
  import { Card, CardContent } from '$lib/components/ui/card'
  import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '$lib/components/ui/table'
  import { Badge } from '$lib/components/ui/badge'
  import { Button } from '$lib/components/ui/button'
  import FilterSelect from '$lib/components/shared/FilterSelect.svelte'
  import Pagination from '$lib/components/shared/Pagination.svelte'
  import LoadingSpinner from '$lib/components/shared/LoadingSpinner.svelte'
  import EmptyState from '$lib/components/shared/EmptyState.svelte'
  import { formatRelative } from '$lib/core/utils/format'
  import { showErrorToast, showSuccessToast } from '$lib/core/utils/toast'
  import ShieldAlert from '@lucide/svelte/icons/shield-alert'
  import AlertTriangle from '@lucide/svelte/icons/triangle-alert'
  import Info from '@lucide/svelte/icons/info'
  import CheckCircle from '@lucide/svelte/icons/check-circle'

  const store = useAlerts()
  const auth = useAuth()
  let redirected = false

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

  let sevFilterStr = $state('')
  function onSevChange(v: string) {
    sevFilterStr = v
    store.setSeverityFilter(v === '' ? undefined : Number(v))
  }

  async function handleResolve(alertId: string) {
    try {
      await store.resolveAlert(alertId)
      showSuccessToast('Alert resolved')
    } catch {
      showErrorToast('Failed to resolve alert')
    }
  }
</script>

<svelte:head><title>Alerts — mountOS Admin</title></svelte:head>

<div class="flex flex-1 flex-col gap-4">
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-3">
      <h1 class="text-lg font-semibold">Alerts</h1>
      {#if store.activeCount > 0}
        <Badge variant="destructive">{store.activeCount} active</Badge>
      {/if}
    </div>
    <div class="flex items-center gap-2">
      <Button
        variant={store.activeFilter ? 'primary' : 'outline'}
        size="sm"
        onclick={() => store.setActiveFilter(!store.activeFilter)}
      >
        {store.activeFilter ? 'Active Only' : 'All'}
      </Button>
    </div>
  </div>

  <div class="flex flex-wrap items-center gap-2">
    <FilterSelect
      options={severityOptions}
      value={sevFilterStr}
      placeholder="Severity"
      onchange={onSevChange}
    />
    <FilterSelect
      options={categoryOptions}
      value={store.categoryFilter}
      placeholder="Category"
      onchange={(v) => store.setCategoryFilter(v)}
    />
    <FilterSelect
      options={timeOptions}
      value={store.sinceFilter}
      placeholder="Time range"
      onchange={(v) => store.setSinceFilter(v)}
    />
    {#if store.severityFilter !== undefined || store.categoryFilter || store.sinceFilter !== '30m'}
      <Button variant="ghost" size="sm" onclick={() => { sevFilterStr = ''; store.clearFilters(); store.fetchAlerts() }}>
        Clear filters
      </Button>
    {/if}
  </div>

  {#if store.loading && store.alerts.length === 0}
    <div class="flex justify-center py-16"><LoadingSpinner /></div>
  {:else if store.error}
    <Card cornerPlus>
      <CardContent class="py-8">
        <p class="text-center text-destructive">{store.error}</p>
      </CardContent>
    </Card>
  {:else if store.alerts.length === 0}
    <EmptyState title="No alerts" description="No alerts match your current filters" />
  {:else}
    <Card cornerPlus>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead class="w-28">Severity</TableHead>
            <TableHead class="w-24">Category</TableHead>
            <TableHead>Title</TableHead>
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
              <TableCell class="hidden lg:table-cell">
                <span class="text-sm text-muted-foreground">{alert.source}</span>
              </TableCell>
              <TableCell class="hidden xl:table-cell">
                <span class="text-sm text-muted-foreground font-mono">{alert.nodeId || '—'}</span>
              </TableCell>
              <TableCell>
                <span class="text-sm text-muted-foreground whitespace-nowrap">{formatRelative(alert.eventTime)}</span>
              </TableCell>
              <TableCell>
                {#if !alert.resolvedAt}
                  <Button variant="ghost" size="sm" onclick={() => handleResolve(alert.alertId)} class="h-7 gap-1 text-xs">
                    <CheckCircle class="h-3.5 w-3.5" />
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
