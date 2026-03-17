<script lang="ts">
  import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card'
  import { useAccounts } from '$lib/core/stores/accounts.svelte'
  import { useDashboard } from '$lib/core/stores/dashboard.svelte'
  import { useSessions } from '$lib/core/stores/sessions.svelte'
  import { useAuth } from '$lib/core/stores/auth.svelte'
  import { features } from '$lib/config/features'
  import AccountIcon from '$lib/components/shared/AccountIcon.svelte'
  import StatusBadge from '$lib/components/shared/StatusBadge.svelte'
  import LoadingSpinner from '$lib/components/shared/LoadingSpinner.svelte'
  import EmptyState from '$lib/components/shared/EmptyState.svelte'
  import StatCard from '$lib/components/shared/StatCard.svelte'
  import QuotaBar from '$lib/components/shared/QuotaBar.svelte'
  import RegionRow from '$lib/components/shared/RegionRow.svelte'
  import SessionSummaryChart from '$lib/components/shared/SessionSummaryChart.svelte'
  import { formatBytes, formatQuota } from '$lib/core/utils/format'

  const accountStore = useAccounts()
  const dashboard = useDashboard()
  const sessionStore = useSessions()
  const auth = useAuth()
  const account = $derived(accountStore.selectedAccount)
  const accountId = $derived(account?.id ?? null)
  const stats = $derived(dashboard.stats)
  const canReadSessions = $derived(features.clientSessions && auth.can('clientSessions', 'read'))

  $effect(() => {
    if (accountId) {
      dashboard.fetchStats(accountId)
    } else {
      dashboard.reset()
    }
    return () => dashboard.reset()
  })

  $effect(() => {
    if (accountId && canReadSessions) {
      sessionStore.fetchSummary(accountId)
    } else {
      sessionStore.reset()
    }
    return () => sessionStore.reset()
  })
</script>

<div class="space-y-6">
  <h2 class="text-2xl font-bold tracking-tight">Dashboard</h2>

  {#if !account}
    <EmptyState title="No account selected" description="Select an account to view dashboard" />
  {:else}
    <Card cornerPlus>
      <CardContent class="py-4">
        <div class="flex items-center gap-3">
          <AccountIcon {account} size={40} />
          <div class="flex-1 min-w-0">
            <p class="text-lg font-medium truncate">{account.name}</p>
            <p class="text-sm text-muted-foreground truncate">{account.description || 'No description'}</p>
          </div>
          <StatusBadge active={account.isActive} locked={account.locked} />
        </div>
      </CardContent>
    </Card>

    {#if dashboard.loading && !stats}
      <div class="flex justify-center py-12">
        <LoadingSpinner />
      </div>
    {:else if dashboard.error}
      <Card cornerPlus>
        <CardContent class="py-8">
          <p class="text-center text-destructive">{dashboard.error}</p>
        </CardContent>
      </Card>
    {:else if stats}
      <!-- Overview Stats -->
      <div class="grid gap-4 md:grid-cols-3">
        <StatCard title="Users" value={stats.userCount} />
        <StatCard title="Volumes" value={stats.volumeCount} />
        <StatCard title="Regions" value={stats.regionCount} />
        <StatCard title="Storages" value={stats.storageCount} />
        <StatCard title="Storage Used" value={formatBytes(stats.totalQuotaUsed)}
          subtitle={formatQuota(stats.totalQuotaUsed, stats.totalQuotaLimit)} />
        <StatCard title="Active Sessions" value={stats.activeSessionCount} />
      </div>

      <!-- Quota Usage -->
      {#if stats.totalQuotaLimit > 0}
        <Card cornerPlus>
          <CardHeader><CardTitle>Quota Usage</CardTitle></CardHeader>
          <CardContent>
            <QuotaBar used={stats.totalQuotaUsed} limit={stats.totalQuotaLimit} />
          </CardContent>
        </Card>
      {/if}

      <!-- Sessions Summary -->
      {#if canReadSessions}
        <Card cornerPlus>
          <CardHeader>
            <div class="flex items-center justify-between">
              <CardTitle>Sessions Summary</CardTitle>
              <a href="/sessions" class="text-sm text-primary hover:underline">View All &rarr;</a>
            </div>
          </CardHeader>
          <CardContent>
            <SessionSummaryChart summary={sessionStore.summary} loading={sessionStore.summaryLoading} />
          </CardContent>
        </Card>
      {/if}

      <!-- Per-Region Breakdown -->
      {#if stats.regionBreakdown.length > 0}
        <Card cornerPlus>
          <CardHeader><CardTitle>Per-Region Breakdown</CardTitle></CardHeader>
          <CardContent>
            <div class="space-y-1">
              {#each stats.regionBreakdown as region (region.regionId)}
                <RegionRow {region} />
              {/each}
            </div>
          </CardContent>
        </Card>
      {/if}
    {/if}
  {/if}
</div>
