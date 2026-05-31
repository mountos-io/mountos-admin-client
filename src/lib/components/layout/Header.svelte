<script lang="ts">
  import { page } from '$app/stores'
  import { Button } from '$lib/components/ui/button'
  import { useAuth } from '$lib/core/stores/auth.svelte'
  import { useAccounts } from '$lib/core/stores/accounts.svelte'
  import { useRegions } from '$lib/core/stores/regions.svelte'
  import { navigation } from '$lib/config/navigation'
  import { features } from '$lib/config/features'
  import * as Breadcrumb from '$lib/components/ui/breadcrumb'
  import { Badge } from '$lib/components/ui/badge'
  import Search from '@lucide/svelte/icons/search'
  import PanelLeft from '@lucide/svelte/icons/panel-left'
  import LogOut from '@lucide/svelte/icons/log-out'
  import ShieldAlert from '@lucide/svelte/icons/shield-alert'
  import AlertOctagon from '@lucide/svelte/icons/alert-octagon'
  import ConfirmDialog from '$lib/components/shared/ConfirmDialog.svelte'
  import { usePreferences } from '$lib/stores/preferences.svelte'
  import { useLicense } from '$lib/core/stores/license.svelte'
  import { useSettingsModal } from '$lib/stores/settings-modal.svelte'

  const auth = useAuth()
  const accountStore = useAccounts()
  const regionStore = useRegions()
  const prefs = usePreferences()
  const licenseStore = useLicense()
  const settingsModal = useSettingsModal()

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
          const prevIsId = i > 0 && !isNaN(parseInt(parts[i - 1]))
          const label = prevIsId ? parts[i] : capitalize(parts[i])
          result.push(isLast ? { label } : { label, href: accumulated })
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
    if (parentSegment === 'regions' || parentSegment === 'nodes') {
      const region = regionStore.regions.find(r => r.id === id)
      if (region) return region.name
    }
    return `#${id}`
  }

  function capitalize(s: string) {
    return s.charAt(0).toUpperCase() + s.slice(1)
  }

  let { onOpenCommandPalette = () => {}, onToggleSidebar, sidebarToggleRef = $bindable(null) }: { onOpenCommandPalette?: () => void; onToggleSidebar?: () => void; sidebarToggleRef?: HTMLButtonElement | null } = $props()
  let signOutOpen = $state(false)
</script>

<header class="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background px-4">
  <button
    bind:this={sidebarToggleRef}
    class="flex h-9 w-9 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    onclick={() => onToggleSidebar ? onToggleSidebar() : (prefs.sidebarCollapsed = !prefs.sidebarCollapsed)}
    aria-label="Toggle sidebar"
    aria-expanded={!prefs.sidebarCollapsed}
    title="Toggle sidebar (⌘B)"
  >
    <PanelLeft class="h-4 w-4" />
  </button>

  <div class="h-4 w-px bg-border"></div>

  <Breadcrumb.Breadcrumb class="min-w-0 flex-1 relative mask-breadcrumb">
    <Breadcrumb.BreadcrumbList class="flex-nowrap overflow-x-auto scrollbar-none">
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
      class="flex items-center gap-2 rounded-sm border border-border bg-transparent px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-w-[180px] md:px-3 justify-between"
    >
      <div class="flex items-center gap-2">
        <Search class="h-4 w-4" aria-hidden="true" />
        <span class="hidden sm:inline">Search</span>
      </div>
      <kbd class="pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-xs font-medium text-muted-foreground">
        <span class="text-sm">⌘</span>K
      </kbd>
    </button>
    {#if !auth.isUserRole && licenseStore.license?.quota?.state === 'exceeded'}
      {@const q = licenseStore.license.quota}
      {@const cap = licenseStore.license.maxStorageBytes}
      <button
        type="button"
        class="flex items-center gap-1.5 rounded-sm px-2 min-h-[44px] text-sm font-medium transition-colors hover:bg-accent/50"
        onclick={() => settingsModal.show('license')}
        title="License storage quota exceeded - click for details"
        aria-label="License storage quota exceeded. Total used: {licenseStore.formatBytes(q.totalVolume)}{cap > 0 ? `, cap: ${licenseStore.formatBytes(cap)}` : ''}"
      >
        <AlertOctagon class="size-3.5 text-destructive" aria-hidden="true" />
        <span aria-hidden="true">
          <Badge variant="destructive">
            Quota{cap > 0 ? ` ${Math.round((q.totalVolume / cap) * 100)}%` : ''}
          </Badge>
        </span>
      </button>
    {/if}
    {#if !auth.isUserRole && licenseStore.needsAttention && licenseStore.license}
      {@const lic = licenseStore.license}
      <button
        type="button"
        class="flex items-center gap-1.5 rounded-sm px-2 min-h-[44px] text-sm font-medium transition-colors hover:bg-accent/50"
        onclick={() => settingsModal.show('license')}
        title="License: {licenseStore.statusLabel(lic.status)}"
        aria-label="License: {licenseStore.statusLabel(lic.status)}{lic.status === 'expiring' && lic.daysRemaining > 0 ? `, ${lic.daysRemaining} days remaining` : lic.status === 'grace' && lic.graceDaysLeft > 0 ? `, ${lic.graceDaysLeft} days left in grace period` : ''}"
      >
        <ShieldAlert class="size-3.5 {lic.status === 'expired' || lic.status === 'expired_access' ? 'text-destructive' : 'text-warning'}" aria-hidden="true" />
        <span aria-hidden="true">
          <Badge variant={licenseStore.badgeVariant}>
            {#if lic.status === 'expired'}Expired{:else if lic.status === 'expired_access'}Read-only{:else if lic.status === 'grace'}Grace{:else if lic.daysRemaining > 0}{lic.daysRemaining}d left{:else}Today{/if}
          </Badge>
        </span>
        {#if lic.licenseType === 'trial'}
          <span class="hidden sm:inline text-muted-foreground">Trial</span>
        {/if}
      </button>
    {:else if !auth.isUserRole && licenseStore.license?.licenseType === 'trial'}
      <button
        type="button"
        class="flex items-center gap-1.5 rounded-sm px-2 min-h-[44px] text-sm transition-colors hover:bg-accent/50"
        onclick={() => settingsModal.show('license')}
        title="Trial license" aria-label="Trial license"
      >
        <Badge variant="outline">Trial</Badge>
      </button>
    {/if}
    {#if auth.user}
      <span class="hidden lg:inline rounded-sm bg-muted px-1.5 py-0.5 text-sm font-medium text-muted-foreground" aria-label="Role: {auth.user.role}">{auth.user.role}</span>
      <span class="hidden md:inline text-sm text-muted-foreground truncate max-w-[clamp(80px,15vw,200px)]" aria-label="User: {auth.user.name}">{auth.user.name}</span>
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

<style>
  :global(.mask-breadcrumb) {
    mask-image: linear-gradient(to right, black calc(100% - clamp(1rem, 5vw, 2rem)), transparent);
    -webkit-mask-image: linear-gradient(to right, black calc(100% - clamp(1rem, 5vw, 2rem)), transparent);
  }
</style>
