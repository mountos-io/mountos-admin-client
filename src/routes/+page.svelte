<script lang="ts">
  import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card'
  import { useAccounts } from '$lib/core/stores/accounts.svelte'
  import { useDashboard } from '$lib/core/stores/dashboard.svelte'
  import AccountIcon from '$lib/components/shared/AccountIcon.svelte'
  import StatusBadge from '$lib/components/shared/StatusBadge.svelte'
  import LoadingSpinner from '$lib/components/shared/LoadingSpinner.svelte'
  import EmptyState from '$lib/components/shared/EmptyState.svelte'
  import { formatBytes, formatQuota, quotaPercent } from '$lib/core/utils/format'

  const accountStore = useAccounts()
  const dashboard = useDashboard()
  const account = $derived(accountStore.selectedAccount)
  const stats = $derived(dashboard.stats)

  $effect(() => {
    if (account) {
      dashboard.fetchStats(account.id)
    } else {
      dashboard.reset()
    }
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
    {:else if stats}
      <div class="grid gap-4 md:grid-cols-3">
        <Card cornerPlus>
          <CardHeader><CardTitle>Users</CardTitle></CardHeader>
          <CardContent>
            <p class="text-3xl font-bold">{stats.userCount}</p>
          </CardContent>
        </Card>
        <Card cornerPlus>
          <CardHeader><CardTitle>Volumes</CardTitle></CardHeader>
          <CardContent>
            <p class="text-3xl font-bold">{stats.volumeCount}</p>
          </CardContent>
        </Card>
        <Card cornerPlus>
          <CardHeader><CardTitle>Regions</CardTitle></CardHeader>
          <CardContent>
            <p class="text-3xl font-bold">{stats.regionCount}</p>
          </CardContent>
        </Card>
        <Card cornerPlus>
          <CardHeader><CardTitle>Storages</CardTitle></CardHeader>
          <CardContent>
            <p class="text-3xl font-bold">{stats.storageCount}</p>
          </CardContent>
        </Card>
        <Card cornerPlus>
          <CardHeader><CardTitle>Storage Used</CardTitle></CardHeader>
          <CardContent>
            <p class="text-3xl font-bold">{formatBytes(stats.totalQuotaUsed)}</p>
            <p class="text-sm text-muted-foreground mt-1">{formatQuota(stats.totalQuotaUsed, stats.totalQuotaLimit)}</p>
          </CardContent>
        </Card>
        <Card cornerPlus>
          <CardHeader><CardTitle>Active Sessions</CardTitle></CardHeader>
          <CardContent>
            <p class="text-3xl font-bold">{stats.activeSessionCount}</p>
          </CardContent>
        </Card>
      </div>

      {#if stats.totalQuotaLimit > 0}
        <Card cornerPlus>
          <CardHeader><CardTitle>Quota Usage</CardTitle></CardHeader>
          <CardContent>
            {@const pct = quotaPercent(stats.totalQuotaUsed, stats.totalQuotaLimit)}
            <div class="space-y-2">
              <div class="flex justify-between text-sm">
                <span class="text-muted-foreground">{formatBytes(stats.totalQuotaUsed)} used</span>
                <span class="text-muted-foreground">{formatBytes(stats.totalQuotaLimit)} total</span>
              </div>
              <div class="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  class="h-full rounded-full transition-all {pct > 90 ? 'bg-destructive' : pct > 70 ? 'bg-warning' : 'bg-primary'}"
                  style="width: {pct}%"
                ></div>
              </div>
              <p class="text-xs text-muted-foreground text-right">{pct}%</p>
            </div>
          </CardContent>
        </Card>
      {/if}

      {#if stats.regionBreakdown.length > 0}
        <Card cornerPlus>
          <CardHeader><CardTitle>Per-Region Breakdown</CardTitle></CardHeader>
          <CardContent>
            <div class="space-y-3">
              {#each stats.regionBreakdown as region}
                <div class="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p class="text-sm font-medium">Region {region.regionId}</p>
                    <p class="text-xs text-muted-foreground">{region.volumeCount} volume{region.volumeCount !== 1 ? 's' : ''}</p>
                  </div>
                  <div class="text-right">
                    <p class="text-sm font-medium">{formatBytes(region.totalQuotaUsed)}</p>
                    {#if region.totalQuotaLimit > 0}
                      <p class="text-xs text-muted-foreground">of {formatBytes(region.totalQuotaLimit)}</p>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          </CardContent>
        </Card>
      {/if}
    {/if}
  {/if}
</div>
