<script lang="ts">
  import { page } from '$app/stores'
  import { cn } from '$lib/utils.js'
  import { navigation } from '$lib/config/navigation'
  import { features } from '$lib/config/features'
  import AccountSwitcher from './AccountSwitcher.svelte'

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
      <a
        href={item.href}
        class={cn(
          'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
          $page.url.pathname === item.href || (item.href !== '/' && $page.url.pathname.startsWith(item.href + '/'))
            ? 'bg-sidebar-accent text-sidebar-accent-foreground'
            : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
        )}
      >
        {item.label}
      </a>
    {/each}
  </nav>
</aside>
