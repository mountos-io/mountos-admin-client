<script lang="ts">
  import { page } from '$app/stores'
  import { Button } from '$lib/components/ui/button'
  import { useAuth } from '$lib/core/stores/auth.svelte'
  import { useAccounts } from '$lib/core/stores/accounts.svelte'
  import { navigation } from '$lib/config/navigation'
  import { features } from '$lib/config/features'
  import * as Breadcrumb from '$lib/components/ui/breadcrumb'
  import Search from '@lucide/svelte/icons/search'
  import PanelLeft from '@lucide/svelte/icons/panel-left'
  import LogOut from '@lucide/svelte/icons/log-out'
  import ConfirmDialog from '$lib/components/shared/ConfirmDialog.svelte'
  import { usePreferences } from '$lib/stores/preferences.svelte'

  const auth = useAuth()
  const accountStore = useAccounts()
  const prefs = usePreferences()

  const visibleNav = $derived(
    navigation.filter(item => !item.feature || features[item.feature])
  )

  interface Crumb { label: string; href?: string }

  const crumbs = $derived.by((): Crumb[] => {
    const pathname = $page.url.pathname
    if (pathname === '/') return [{ label: 'Dashboard' }]

    const parts = pathname.split('/').filter(Boolean)
    const result: Crumb[] = [{ label: 'Dashboard', href: '/' }]

    let accumulated = ''
    for (let i = 0; i < parts.length; i++) {
      accumulated += '/' + parts[i]
      const navItem = visibleNav.find(n => n.href === accumulated)
      const isLast = i === parts.length - 1

      if (navItem) {
        result.push(isLast ? { label: navItem.label } : { label: navItem.label, href: navItem.href })
      } else if (parts[i] === 'create') {
        result.push({ label: 'Create' })
      } else {
        const id = parseInt(parts[i])
        if (!isNaN(id)) {
          const label = resolveIdLabel(parts[i - 1], id)
          result.push(isLast ? { label } : { label, href: accumulated })
        } else {
          result.push(isLast ? { label: capitalize(parts[i]) } : { label: capitalize(parts[i]), href: accumulated })
        }
      }
    }
    return result
  })

  function resolveIdLabel(parentSegment: string | undefined, id: number): string {
    if (parentSegment === 'accounts') {
      const account = accountStore.accounts.find(a => a.id === id)
      if (account) return account.name
    }
    return `#${id}`
  }

  function capitalize(s: string) {
    return s.charAt(0).toUpperCase() + s.slice(1)
  }

  let { onOpenCommandPalette = () => {}, onToggleSidebar }: { onOpenCommandPalette?: () => void; onToggleSidebar?: () => void } = $props()
  let signOutOpen = $state(false)
</script>

<header class="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background px-4">
  <button
    class="flex h-9 w-9 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    onclick={() => onToggleSidebar ? onToggleSidebar() : (prefs.sidebarCollapsed = !prefs.sidebarCollapsed)}
    aria-label="Toggle sidebar"
    title="Toggle sidebar (⌘B)"
  >
    <PanelLeft class="h-4 w-4" />
  </button>

  <div class="h-4 w-px bg-border"></div>

  <Breadcrumb.Breadcrumb class="min-w-0 flex-1">
    <Breadcrumb.BreadcrumbList class="flex-nowrap overflow-hidden">
      {#each crumbs as crumb, i}
        {#if i > 0}
          <Breadcrumb.BreadcrumbSeparator />
        {/if}
        <Breadcrumb.BreadcrumbItem>
          {#if crumb.href}
            <Breadcrumb.BreadcrumbLink href={crumb.href}>{crumb.label}</Breadcrumb.BreadcrumbLink>
          {:else}
            <Breadcrumb.BreadcrumbPage>{crumb.label}</Breadcrumb.BreadcrumbPage>
          {/if}
        </Breadcrumb.BreadcrumbItem>
      {/each}
    </Breadcrumb.BreadcrumbList>
  </Breadcrumb.Breadcrumb>

  <div class="ml-auto flex items-center gap-3">
    <button
      type="button"
      onclick={onOpenCommandPalette}
      aria-label="Open command palette"
      class="flex items-center gap-2 rounded-sm border border-border bg-transparent px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground focus:outline-none focus:ring-1 focus:ring-ring md:min-w-[180px] md:px-3 justify-between"
    >
      <div class="flex items-center gap-2">
        <Search class="h-4 w-4" />
        <span class="hidden sm:inline">Search</span>
      </div>
      <kbd class="pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
        <span class="text-xs">⌘</span>K
      </kbd>
    </button>
    {#if auth.user}
      <span class="hidden lg:inline rounded-sm bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">{auth.user.role}</span>
      <span class="hidden md:inline text-sm text-muted-foreground truncate max-w-[120px]">{auth.user.name}</span>
    {/if}
    <button
      type="button"
      onclick={() => { signOutOpen = true }}
      class="flex h-9 w-9 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      aria-label="Sign out"
      title="Sign out"
    >
      <LogOut class="h-4 w-4" />
    </button>
  </div>
</header>

<ConfirmDialog bind:open={signOutOpen} title="Sign Out" description="Are you sure you want to sign out? Your session will be terminated." confirmLabel="Sign Out" icon={LogOut} onConfirm={() => auth.signOut()} />
