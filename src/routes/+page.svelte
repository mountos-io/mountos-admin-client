<script lang="ts">
  import { untrack } from 'svelte'
  import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card'
  import { Button } from '$lib/components/ui/button'
  import { useAccounts } from '$lib/core/stores/accounts.svelte'
  import { useDashboard } from '$lib/core/stores/dashboard.svelte'
  import { useSessions } from '$lib/core/stores/sessions.svelte'
  import { useNodes } from '$lib/core/stores/nodes.svelte'
  import { useAuditLogs } from '$lib/core/stores/audit.svelte'
  import { useAuth } from '$lib/core/stores/auth.svelte'
  import { useAlerts } from '$lib/core/stores/alerts.svelte'
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
  import PlusIcon from '@lucide/svelte/icons/plus'
  import BuildingIcon from '@lucide/svelte/icons/building'
  import ShieldAlertIcon from '@lucide/svelte/icons/shield-alert'
  import SessionSummaryStrip from '$lib/components/shared/SessionSummaryStrip.svelte'
  import ActivityChart from '$lib/components/shared/ActivityChart.svelte'
  import ActivityFeed from '$lib/components/shared/ActivityFeed.svelte'
  import { formatBytes, formatQuota } from '$lib/core/utils/format'

  const accountStore = useAccounts()
  const dashboard = useDashboard()
  const sessionStore = useSessions()
  const nodeStore = useNodes()
  const auditStore = useAuditLogs()
  const auth = useAuth()
  const alertStore = useAlerts()
  const account = $derived(accountStore.selectedAccount)
  const accountId = $derived(account?.id ?? null)
  const stats = $derived(dashboard.stats)
  const canReadSessions = $derived(features.clientSessions && auth.can('clientSessions', 'read'))
  const canReadNodes = $derived(auth.can('serviceNodes', 'read'))
  const canReadAudit = $derived(auth.can('auditLogs', 'read'))
  let activityDays = $state(7)
  let activityView = $state<'feed' | 'chart'>('chart')
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
    const acctId = accountId
    if (acctId && canReadSessions) {
      untrack(() => sessionStore.fetchAllSessions(acctId))
    }
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

<svelte:head><title>Dashboard — mountOS Admin</title></svelte:head>

<div class="flex flex-1 flex-col gap-6">
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
        { label: 'Usage', value: formatBytes(stats.totalVolumeUsed), subtitle: formatQuota(stats.totalVolumeUsed, stats.totalQuotaLimit), href: '/volumes', icon: DatabaseIcon },
        ...(canReadNodes ? [{ label: 'Nodes', value: nodeStore.nodes.length, href: '/nodes', icon: ServerIcon }] : []),
        ...(canReadSessions ? [{ label: 'Sessions', value: sessionStore.summary.activeCount || stats.activeSessionCount, href: '/sessions', icon: MonitorDotIcon }] : []),
      ]}
      <div class="corner-brackets relative border border-border/30 rounded-sm">
        <div class="tech-grid absolute inset-0 pointer-events-none opacity-20"></div>
        <div class="relative flex flex-wrap">
          {#each overviewItems as item, i}
            <a href={item.href}
              class="group relative flex-1 min-w-[120px] sm:min-w-[140px] flex items-center gap-3 px-4 py-3
                     hover:bg-muted/40 transition-colors
                     border-r border-border last:border-r-0">
              <div class="flex size-8 items-center justify-center rounded-md bg-muted/60 group-hover:bg-primary/10 transition-colors">
                <item.icon class="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <div>
                <p class="text-xl font-bold tabular-nums leading-none">{item.value}</p>
                <p class="text-xs text-muted-foreground mt-0.5">{item.label}</p>
                {#if item.subtitle}
                  <p class="text-xs text-muted-foreground/60 leading-none mt-0.5">{item.subtitle}</p>
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
            <QuotaBar used={stats.totalVolumeUsed} limit={stats.totalQuotaLimit} />
          </CardContent>
        </Card>
      {/if}

      <!-- Quick Actions -->
      {@const quickActions = [
        { label: 'Account', icon: BuildingIcon, href: '/accounts/create', can: auth.can('accounts', 'create'), clip: 'cyberpunk-rskewed' },
        { label: 'User', icon: UsersIcon, href: '/users/create', can: !!accountId && auth.can('users', 'create'), clip: 'cyberpunk-rskewed' },
        { label: 'Volume', icon: DatabaseIcon, href: '/volumes/create', can: !!accountId && auth.can('volumes', 'create'), clip: '' },
        { label: 'Storage', icon: HardDriveIcon, href: '/storages/create', can: !!accountId && auth.can('storages', 'create'), clip: 'cyberpunk-skewed' },
        { label: 'Region', icon: GlobeIcon, href: '/regions/create', can: auth.can('regions', 'create'), clip: 'cyberpunk-skewed' },
      ]}
      <div class="flex flex-wrap justify-center gap-4">
        {#each quickActions as action}
          {@const Icon = action.icon}
          {#if action.can}
            <a href={action.href}
              class="flex flex-col items-center justify-center gap-3 w-full min-w-[120px] max-w-[10rem] h-32 sm:w-36 md:w-48 md:h-40 rounded-sm border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer">
              <div class="flex items-center justify-center w-12 h-12 md:w-16 md:h-16 {action.clip} bg-primary/10">
                <Icon class="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 text-primary" />
              </div>
              <span class="text-sm md:text-base font-medium flex items-center gap-1.5">
                <PlusIcon class="w-4 h-4" />{action.label}
              </span>
            </a>
          {:else}
            <button type="button" disabled class="flex flex-col items-center justify-center gap-3 w-full min-w-[120px] max-w-[10rem] h-32 sm:w-36 md:w-48 md:h-40 rounded-sm border border-border opacity-25 cursor-not-allowed"
              title="Requires {action.label.toLowerCase()} create permission"
              aria-label="Create {action.label} (no permission)">
              <div class="flex items-center justify-center w-12 h-12 md:w-16 md:h-16 {action.clip} bg-primary/10">
                <Icon class="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 text-primary" />
              </div>
              <span class="text-sm md:text-base font-medium flex items-center gap-1.5">
                <PlusIcon class="w-4 h-4" />{action.label}
              </span>
            </button>
          {/if}
        {/each}
      </div>

      <div class="flex-1"></div>

      <!-- Active Alerts & Sessions Summary -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        {#if features.alerts && !auth.isUserRole}
          <Card cornerPlus>
            <CardHeader>
              <div class="flex items-center justify-between">
                <CardTitle class="flex items-center gap-2">
                  <ShieldAlertIcon class="h-4 w-4 {alertStore.activeCount > 0 ? 'text-destructive' : 'text-muted-foreground'}" />
                  Active Alerts
                </CardTitle>
                <a href="/alerts" class="text-sm text-primary hover:underline">View All &rarr;</a>
              </div>
            </CardHeader>
            <CardContent>
              {#if alertStore.activeCount > 0}
                {@const severityItems = [
                  { count: alertStore.criticalCount, label: 'Critical', dotClass: 'dot-destructive' },
                  { count: alertStore.warningCount, label: 'Warning', dotClass: 'dot-warning' },
                  { count: alertStore.infoCount, label: 'Info', dotClass: 'dot-primary' },
                ]}
                <div class="flex gap-4">
                  {#each severityItems.filter(s => s.count > 0) as sev}
                    <div class="flex items-center gap-2">
                      <span class="severity-dot {sev.dotClass}" aria-hidden="true"></span>
                      <span class="text-sm font-medium">{sev.count}</span>
                      <span class="text-sm text-muted-foreground">{sev.label}</span>
                    </div>
                  {/each}
                </div>
              {:else}
                <p class="text-sm text-muted-foreground">No active alerts</p>
              {/if}
            </CardContent>
          </Card>
        {/if}

        {#if canReadSessions}
          <Card cornerPlus>
            <CardHeader>
              <div class="flex items-center justify-between">
                <CardTitle>Sessions Summary</CardTitle>
                <a href="/sessions" class="text-sm text-primary hover:underline">View All &rarr;</a>
              </div>
            </CardHeader>
            <CardContent>
              <SessionSummaryStrip summary={sessionStore.summary} loading={sessionStore.loading} />
            </CardContent>
          </Card>
        {/if}
      </div>

      <!-- Recent Activity -->
      {#if canReadAudit}
        <Card cornerPlus>
          <CardHeader>
            <div class="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle>Recent Activity</CardTitle>
              <div class="relative border border-border/30 rounded-sm px-3 py-2 w-fit">
                <div class="tech-grid absolute inset-0 pointer-events-none opacity-20"></div>
                <div class="relative flex items-center gap-1.5">
                  {#each [7, 15, 30] as d}
                    <Button variant={activityDays === d ? 'primary' : 'ghost'} size="sm"
                      class="h-7 w-10 min-h-[44px] sm:min-h-0 text-xs font-mono justify-center"
                      onclick={() => activityDays = d}>{d}d</Button>
                  {/each}
                  <span class="filter-divider"></span>
                  <Button variant={activityView === 'feed' ? 'primary' : 'ghost'} size="sm"
                    class="h-7 px-3 min-h-[44px] sm:min-h-0 text-xs font-mono justify-center"
                    onclick={() => activityView = 'feed'}>Feed</Button>
                  <Button variant={activityView === 'chart' ? 'primary' : 'ghost'} size="sm"
                    class="h-7 px-3 min-h-[44px] sm:min-h-0 text-xs font-mono justify-center"
                    onclick={() => activityView = 'chart'}>Chart</Button>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div class="audit-content-scroll">
              {#if auditStore.loading && auditStore.logs.length === 0}
                <div class="flex items-center justify-center py-16">
                  <LoadingSpinner />
                </div>
              {:else if auditStore.logs.length === 0}
                <div class="flex items-center justify-center py-16 text-sm text-muted-foreground">No recent activity</div>
              {:else}
                {#if filteredActivity.length === 0}
                  <div class="flex items-center justify-center py-16 text-sm text-muted-foreground">No activity in last {activityDays} days</div>
                {:else if activityView === 'chart'}
                  <ActivityChart logs={filteredActivity} />
                {:else}
                  <ActivityFeed logs={filteredActivity} loading={false} hasMore={false} />
                {/if}
              {/if}
            </div>
          </CardContent>
        </Card>
      {/if}

    {/if}
  {/if}
  <div class="pb-6"></div>
</div>

<style>
  .audit-content-scroll {
    min-height: 300px;
    max-height: min(500px, 60vh);
    overflow-y: auto;
  }

  .filter-divider {
    width: 1px;
    height: 24px;
    margin: 0 10px;
    background: linear-gradient(
      180deg,
      transparent 0%,
      color-mix(in oklch, var(--border) 60%, transparent) 30%,
      color-mix(in oklch, var(--border) 30%, transparent) 70%,
      transparent 100%
    );
  }

  .severity-dot {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }

  .dot-destructive { background: var(--destructive); }
  .dot-warning { background: var(--warning); }
  .dot-primary { background: var(--primary); }
</style>
