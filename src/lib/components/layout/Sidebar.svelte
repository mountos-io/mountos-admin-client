<script lang="ts">
  import { page } from '$app/stores'
  import { cn } from '$lib/utils.js'
  import { navigation, navFilter } from '$lib/config/navigation'
  import { features } from '$lib/config/features'
  import { useAuth } from '$lib/core/stores/auth.svelte'
  import { useAccounts } from '$lib/core/stores/accounts.svelte'
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
  import Box from '@lucide/svelte/icons/box'

  let { collapsed = false }: { collapsed?: boolean } = $props()

  const auth = useAuth()
  const accountStore = useAccounts()
  const hasAccount = $derived(accountStore.selectedAccountId !== null)

  const iconMap: Record<string, Component> = {
    'layout-dashboard': LayoutDashboard, 'building-2': Building2,
    'users': Users, 'globe': Globe, 'hard-drive': HardDrive,
    'database': Database, 'scroll-text': ScrollText, 'monitor-dot': MonitorDot, 'server': Server,
  }

  const accountFreeRoutes = new Set(['/', '/accounts'])

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
      <a
        href={item.href}
        title={collapsed ? item.label : undefined}
        aria-label={collapsed ? item.label : undefined}
        aria-current={active ? 'page' : undefined}
        class={cn(
          'flex items-center rounded-md text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none',
          collapsed ? 'justify-center px-2 py-2' : 'gap-3 px-3 py-2',
          active
            ? 'bg-sidebar-accent text-sidebar-accent-foreground'
            : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
        )}
      >
        {#if Icon}<Icon class={cn(collapsed ? 'h-5 w-5' : 'h-4 w-4', 'shrink-0')} />{/if}
        {#if !collapsed}
          <span class="truncate">{item.label}</span>
        {/if}
      </a>
    {/each}
  </nav>
</aside>
