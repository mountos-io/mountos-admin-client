<script lang="ts">
  import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card'
  import { Button } from '$lib/components/ui/button'
  import { useAccounts } from '$lib/core/stores/accounts.svelte'
  import { useDashboard } from '$lib/core/stores/dashboard.svelte'
  import { useSessions } from '$lib/core/stores/sessions.svelte'
  import { useAuditLogs } from '$lib/core/stores/audit.svelte'
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
  import ActivityChart from '$lib/components/shared/ActivityChart.svelte'
  import { formatBytes, formatQuota } from '$lib/core/utils/format'

  const accountStore = useAccounts()
  const dashboard = useDashboard()
  const sessionStore = useSessions()
  const auditStore = useAuditLogs()
  const auth = useAuth()
  const account = $derived(accountStore.selectedAccount)
  const accountId = $derived(account?.id ?? null)
  const stats = $derived(dashboard.stats)
  const canReadSessions = $derived(features.clientSessions && auth.can('clientSessions', 'read'))
  const canReadAudit = $derived(auth.can('auditLogs', 'read'))
  let activityDays = $state(7)

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

  $effect(() => {
    if (accountId && canReadAudit) {
      auditStore.fetchLogs({ accountId, limit: 200, reset: true })
    } else {
      auditStore.reset()
    }
    return () => auditStore.reset()
  })
</script>

<div class="space-y-6">
  <h1 class="text-2xl font-bold tracking-tight">Dashboard</h1>

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

      <!-- Recent Activity -->
      {#if canReadAudit}
        <Card cornerPlus>
          <CardHeader>
            <div class="flex items-center justify-between">
              <CardTitle>Recent Activity</CardTitle>
              <div class="flex items-center gap-1">
                {#each [7, 15, 30] as d}
                  <Button variant={activityDays === d ? 'primary' : 'ghost'} size="sm"
                    class="h-6 px-2 text-xs font-mono"
                    onclick={() => activityDays = d}>{d}d</Button>
                {/each}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {#if auditStore.loading && auditStore.logs.length === 0}
              <div class="flex items-center justify-center py-16">
                <LoadingSpinner />
              </div>
            {:else if auditStore.logs.length === 0}
              <div class="flex items-center justify-center py-16 text-sm text-muted-foreground">No recent activity</div>
            {:else}
              {@const cutoff = Date.now() - activityDays * 86400000}
              {@const filtered = auditStore.logs.filter(l => new Date(l.createdAt ?? '').getTime() >= cutoff)}
              {#if filtered.length === 0}
                <div class="flex items-center justify-center py-16 text-sm text-muted-foreground">No activity in last {activityDays} days</div>
              {:else}
                <ActivityChart logs={filtered} />
              {/if}
            {/if}
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
