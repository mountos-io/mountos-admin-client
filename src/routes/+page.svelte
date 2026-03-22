<script lang="ts">
  import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card'
  import { Button } from '$lib/components/ui/button'
  import { useAccounts } from '$lib/core/stores/accounts.svelte'
  import { useDashboard } from '$lib/core/stores/dashboard.svelte'
  import { useSessions } from '$lib/core/stores/sessions.svelte'
  import { useNodes } from '$lib/core/stores/nodes.svelte'
  import { useAuditLogs } from '$lib/core/stores/audit.svelte'
  import { useAuth } from '$lib/core/stores/auth.svelte'
  import { features } from '$lib/config/features'
  import AccountIcon from '$lib/components/shared/AccountIcon.svelte'
  import StatusBadge from '$lib/components/shared/StatusBadge.svelte'
  import LoadingSpinner from '$lib/components/shared/LoadingSpinner.svelte'
  import EmptyState from '$lib/components/shared/EmptyState.svelte'
  import QuotaBar from '$lib/components/shared/QuotaBar.svelte'
  import UsersIcon from '@lucide/svelte/icons/users'
  import DatabaseIcon from '@lucide/svelte/icons/database'
  import GlobeIcon from '@lucide/svelte/icons/globe'
  import HardDriveIcon from '@lucide/svelte/icons/hard-drive'
  import ServerIcon from '@lucide/svelte/icons/server'
  import MonitorDotIcon from '@lucide/svelte/icons/monitor-dot'
  import ChevronRightIcon from '@lucide/svelte/icons/chevron-right'
  import ExternalLinkIcon from '@lucide/svelte/icons/external-link'
  import RegionRow from '$lib/components/shared/RegionRow.svelte'
  import SessionSummaryChart from '$lib/components/shared/SessionSummaryChart.svelte'
  import ActivityChart from '$lib/components/shared/ActivityChart.svelte'
  import { formatBytes, formatQuota } from '$lib/core/utils/format'
  import ClockIcon from '@lucide/svelte/icons/clock'
  import SunriseIcon from '@lucide/svelte/icons/sunrise'
  import SunIcon from '@lucide/svelte/icons/sun'
  import SunsetIcon from '@lucide/svelte/icons/sunset'
  import MoonIcon from '@lucide/svelte/icons/moon'

  const accountStore = useAccounts()
  const dashboard = useDashboard()
  const sessionStore = useSessions()
  const nodeStore = useNodes()
  const auditStore = useAuditLogs()
  const auth = useAuth()
  const account = $derived(accountStore.selectedAccount)
  const accountId = $derived(account?.id ?? null)
  const stats = $derived(dashboard.stats)
  const canReadSessions = $derived(features.clientSessions && auth.can('clientSessions', 'read'))
  const canReadNodes = $derived(auth.can('serviceNodes', 'read'))
  const canReadAudit = $derived(auth.can('auditLogs', 'read'))
  let activityDays = $state(7)
  let activityTimeRange = $state<'full' | 'morning' | 'afternoon' | 'evening' | 'night'>('full')
  const timeRangeOptions = [
    { key: 'full' as const, label: 'Full Day', icon: ClockIcon },
    { key: 'morning' as const, label: '00–12', icon: SunriseIcon },
    { key: 'afternoon' as const, label: '12–18', icon: SunIcon },
    { key: 'evening' as const, label: '18–22', icon: SunsetIcon },
    { key: 'night' as const, label: '22–24', icon: MoonIcon },
  ]
  const activityCutoff = $derived(Date.now() - activityDays * 86400000)
  const filteredActivity = $derived(auditStore.logs.filter(l => new Date(l.createdAt ?? '').getTime() >= activityCutoff))

  $effect(() => {
    if (accountId) {
      dashboard.fetchStats(accountId)
    } else {
      dashboard.reset()
    }
    return () => dashboard.reset()
  })

  $effect(() => {
    if (canReadNodes) nodeStore.fetchAllNodes()
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
  {#if !account}
    <EmptyState title="No account selected" description="Select an account to view dashboard" />
  {:else}
    <div class="flex items-center gap-3">
      <AccountIcon {account} size={36} />
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <a href="/accounts/{account.id}" class="group flex items-center gap-1.5 hover:text-primary transition-colors">
            <h1 class="text-lg font-semibold truncate">{account.name}</h1>
            <ExternalLinkIcon class="size-3.5 text-muted-foreground/0 group-hover:text-primary transition-colors shrink-0" />
          </a>
          <StatusBadge active={account.isActive} locked={account.locked} />
        </div>
        {#if account.description}
          <p class="text-sm text-muted-foreground truncate">{account.description}</p>
        {/if}
      </div>
    </div>

    {#if dashboard.loading && !stats}
      <div class="flex justify-center py-12" aria-busy="true">
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
      {@const overviewItems = [
        { label: 'Users', value: stats.userCount, href: '/users', icon: UsersIcon },
        { label: 'Volumes', value: stats.volumeCount, href: '/volumes', icon: DatabaseIcon },
        { label: 'Regions', value: stats.regionCount, href: '/regions', icon: GlobeIcon },
        { label: 'Storages', value: stats.storageCount, href: '/storages', icon: HardDriveIcon },
        { label: 'Storage', value: formatBytes(stats.totalQuotaUsed), subtitle: formatQuota(stats.totalQuotaUsed, stats.totalQuotaLimit), href: '/storages', icon: HardDriveIcon },
        ...(canReadNodes ? [{ label: 'Nodes', value: nodeStore.nodes.length, href: '/nodes', icon: ServerIcon }] : []),
        ...(canReadSessions ? [{ label: 'Sessions', value: stats.activeSessionCount, href: '/sessions', icon: MonitorDotIcon }] : []),
      ]}
      <div class="corner-brackets relative border border-border/30 rounded-sm">
        <div class="tech-grid absolute inset-0 pointer-events-none opacity-20"></div>
        <div class="relative flex">
          {#each overviewItems as item, i}
            <a href={item.href}
              class="group relative flex-1 flex items-center gap-3 px-4 py-3
                     hover:bg-muted/40 transition-colors
                     {i < overviewItems.length - 1 ? 'border-r border-border' : ''}">
              <div class="flex size-8 items-center justify-center rounded-md bg-muted/60 group-hover:bg-primary/10 transition-colors">
                <item.icon class="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <div>
                <p class="text-xl font-bold tabular-nums leading-none">{item.value}</p>
                <p class="text-xs text-muted-foreground mt-0.5">{item.label}</p>
                {#if item.subtitle}
                  <p class="text-[10px] text-muted-foreground/60 leading-none mt-0.5">{item.subtitle}</p>
                {/if}
              </div>
              <ChevronRightIcon class="size-3 invisible group-hover:visible text-muted-foreground transition-colors absolute right-2 top-1/2 -translate-y-1/2" />
            </a>
          {/each}
        </div>
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
            <div class="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle>Recent Activity</CardTitle>
              <div class="relative border border-border/30 rounded-sm px-3 py-2 w-fit">
                <div class="tech-grid absolute inset-0 pointer-events-none opacity-20"></div>
                <div class="relative flex items-center gap-1.5 flex-wrap">
                  {#each timeRangeOptions as { key, label, icon }}
                    {@const Icon = icon}
                    <Button variant={activityTimeRange === key ? 'primary' : 'ghost'} size="sm"
                      class="h-7 w-[6.5rem] text-xs font-mono justify-center"
                      onclick={() => activityTimeRange = key}>
                      <Icon class="w-3 h-3 mr-1" />{label}
                    </Button>
                  {/each}
                  <span class="filter-divider"></span>
                  {#each [7, 15, 30] as d}
                    <Button variant={activityDays === d ? 'primary' : 'ghost'} size="sm"
                      class="h-7 w-10 text-xs font-mono justify-center"
                      onclick={() => activityDays = d}>{d}d</Button>
                  {/each}
                </div>
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
              {#if filteredActivity.length === 0}
                <div class="flex items-center justify-center py-16 text-sm text-muted-foreground">No activity in last {activityDays} days</div>
              {:else}
                <ActivityChart logs={filteredActivity} bind:timeRange={activityTimeRange} />
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

<style>
  .filter-divider {
    width: 1px;
    height: 24px;
    margin: 0 10px;
    background: linear-gradient(
      180deg,
      transparent 0%,
      oklch(0.6 0.08 250 / 0.5) 30%,
      oklch(0.6 0.08 250 / 0.25) 70%,
      transparent 100%
    );
  }
</style>
