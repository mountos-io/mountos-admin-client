<script lang="ts">
  import { page } from '$app/stores'
  import { cn } from '$lib/utils.js'
  import { navigation } from '$lib/config/navigation'
  import { features } from '$lib/config/features'
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

  let { collapsed = false }: { collapsed?: boolean } = $props()

  const iconMap: Record<string, Component> = {
    'layout-dashboard': LayoutDashboard, 'building-2': Building2,
    'users': Users, 'globe': Globe, 'hard-drive': HardDrive,
    'database': Database, 'scroll-text': ScrollText, 'server': Server,
  }

  const visibleNav = $derived(
    navigation.filter(item => !item.feature || features[item.feature])
  )
</script>

<aside
  class={cn(
    'flex h-full flex-col border-r bg-sidebar transition-[width] duration-200 ease-in-out',
    collapsed ? 'w-14' : 'w-60'
  )}
>
  <div class={cn('p-4', collapsed && 'px-2')}>
    <AccountSwitcher {collapsed} />
  </div>
  <nav aria-label="Main navigation" class={cn('flex-1 space-y-1 py-2', collapsed ? 'px-1.5' : 'px-3')}>
    {#each visibleNav as item}
      {@const Icon = iconMap[item.icon]}
      {@const active = $page.url.pathname === item.href || (item.href !== '/' && $page.url.pathname.startsWith(item.href + '/'))}
      <a
        href={item.href}
        title={collapsed ? item.label : undefined}
        class={cn(
          'flex items-center rounded-md text-sm font-medium transition-colors',
          collapsed ? 'justify-center px-2 py-2' : 'gap-3 px-3 py-2',
          active
            ? 'bg-sidebar-accent text-sidebar-accent-foreground'
            : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
        )}
      >
        {#if Icon}<Icon class="h-4 w-4 shrink-0" />{/if}
        {#if !collapsed}
          <span class="truncate">{item.label}</span>
        {/if}
      </a>
    {/each}
  </nav>
</aside>
