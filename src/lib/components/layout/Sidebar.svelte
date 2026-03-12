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

  const iconMap: Record<string, Component> = {
    'layout-dashboard': LayoutDashboard, 'building-2': Building2,
    'users': Users, 'globe': Globe, 'hard-drive': HardDrive,
    'database': Database, 'scroll-text': ScrollText, 'server': Server,
  }

  const visibleNav = $derived(
    navigation.filter(item => !item.feature || features[item.feature])
  )
</script>

<aside class="flex h-full w-60 flex-col border-r bg-sidebar">
  <div class="p-4">
    <AccountSwitcher />
  </div>
  <nav class="flex-1 space-y-1 px-3 py-2">
    {#each visibleNav as item}
      {@const Icon = iconMap[item.icon]}
      <a
        href={item.href}
        class={cn(
          'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
          $page.url.pathname === item.href || (item.href !== '/' && $page.url.pathname.startsWith(item.href + '/'))
            ? 'bg-sidebar-accent text-sidebar-accent-foreground'
            : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
        )}
      >
        {#if Icon}<Icon class="h-4 w-4" />{/if}
        {item.label}
      </a>
    {/each}
  </nav>
</aside>
