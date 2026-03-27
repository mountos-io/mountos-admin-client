<script lang="ts">
  import { page } from '$app/stores'
  import { cn } from '$lib/utils.js'
  import { navigation, navFilter } from '$lib/config/navigation'
  import { features } from '$lib/config/features'
  import { useAuth } from '$lib/core/stores/auth.svelte'
  import { useAccounts } from '$lib/core/stores/accounts.svelte'
  import { useAlerts } from '$lib/core/stores/alerts.svelte'
  import AccountSwitcher from './AccountSwitcher.svelte'
  import type { Component } from 'svelte'
  import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard'
  import Building2 from '@lucide/svelte/icons/building-2'
  import Users from '@lucide/svelte/icons/users'
  import Globe from '@lucide/svelte/icons/globe'
  import HardDrive from '@lucide/svelte/icons/hard-drive'
  import Database from '@lucide/svelte/icons/database'
  import ScrollText from '@lucide/svelte/icons/scroll-text'
  import Server from '@lucide/svelte/icons/server'
  import MonitorDot from '@lucide/svelte/icons/monitor-dot'
  import Bell from '@lucide/svelte/icons/bell'
  import Box from '@lucide/svelte/icons/box'

  let { collapsed = false }: { collapsed?: boolean } = $props()

  const auth = useAuth()
  const accountStore = useAccounts()
  const alertStore = useAlerts()
  const hasAccount = $derived(accountStore.selectedAccountId !== null)

  const iconMap: Record<string, Component> = {
    'layout-dashboard': LayoutDashboard, 'building-2': Building2,
    'users': Users, 'globe': Globe, 'hard-drive': HardDrive,
    'database': Database, 'scroll-text': ScrollText, 'monitor-dot': MonitorDot, 'server': Server,
    'bell': Bell,
  }

  const accountFreeRoutes = new Set(['/', '/accounts', '/alerts'])

  const visibleNav = $derived(
    navigation.filter(item => {
      if (!hasAccount && !accountFreeRoutes.has(item.href)) return false
      if (navFilter) return navFilter(item, auth.capabilities)
      if (item.feature && !features[item.feature]) return false
      if (item.feature && !auth.can(item.feature, 'read')) return false
      return true
    })
  )
</script>

<aside
  class={cn(
    'flex h-full flex-col border-r bg-sidebar transition-[width] duration-200 ease-in-out will-change-[width]',
    collapsed ? 'w-14' : 'w-60'
  )}
>
  <div class={cn('p-4', collapsed && 'px-2')}>
    <AccountSwitcher {collapsed} />
  </div>
  <nav aria-label="Main navigation" class={cn('flex-1 space-y-1 py-2', collapsed ? 'px-1.5' : 'px-3')}>
    {#each visibleNav as item (item.href)}
      {@const Icon = item.iconComponent ?? iconMap[item.icon] ?? Box}
      {@const active = $page.url.pathname === item.href || (item.href !== '/' && $page.url.pathname.startsWith(item.href + '/'))}
      {@const isBell = item.icon === 'bell'}
      <a
        href={item.href}
        title={collapsed ? item.label : undefined}
        aria-label={collapsed ? item.label : undefined}
        aria-current={active ? 'page' : undefined}
        class={cn(
          'relative flex items-center rounded-md text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none',
          collapsed ? 'justify-center px-2 py-2' : 'gap-3 px-3 py-2',
          active
            ? 'bg-sidebar-accent text-sidebar-accent-foreground'
            : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
        )}
      >
        {#if Icon}
          <Icon class={cn(
            collapsed ? 'h-5 w-5' : 'h-4 w-4', 'shrink-0',
            isBell && alertStore.hasNewAlert && 'bell-ring'
          )} />
        {/if}
        {#if !collapsed}
          <span class="truncate">{item.label}</span>
        {/if}
        {#if isBell && alertStore.recentCount > 0}
          <span class="alert-badge" class:collapsed-badge={collapsed}
            role="status" aria-atomic="true"
            aria-label="{alertStore.recentCount} recent {alertStore.recentCount === 1 ? 'alert' : 'alerts'}">
            {alertStore.recentCount > 99 ? '99+' : alertStore.recentCount}
          </span>
        {/if}
      </a>
    {/each}
  </nav>
</aside>

<style>
  .alert-badge {
    position: absolute;
    right: 6px;
    top: 50%;
    transform: translateY(-50%);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    padding: 0 4px;
    border-radius: 9px;
    background: hsl(var(--destructive));
    color: hsl(var(--destructive-foreground));
    font-size: 0.65rem;
    font-weight: 600;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }

  .collapsed-badge {
    right: 2px;
    top: 2px;
    transform: none;
    min-width: 16px;
    height: 16px;
    font-size: 0.6rem;
  }

  :global(.bell-ring) {
    animation: ring 0.6s ease-in-out 3;
    transform-origin: 50% 4px;
  }

  @keyframes ring {
    0% { transform: rotate(0); }
    10% { transform: rotate(14deg); }
    20% { transform: rotate(-13deg); }
    30% { transform: rotate(12deg); }
    40% { transform: rotate(-10deg); }
    50% { transform: rotate(6deg); }
    60% { transform: rotate(-4deg); }
    70% { transform: rotate(2deg); }
    80% { transform: rotate(-1deg); }
    100% { transform: rotate(0); }
  }
</style>
