<script lang="ts">
  import { goto } from '$app/navigation'
  import Sidebar from './Sidebar.svelte'
  import Header from './Header.svelte'
  import CommandPalette from '$lib/components/CommandPalette.svelte'
  import SettingsModal from '$lib/components/SettingsModal.svelte'
  import StepUpModal from '$lib/components/shared/StepUpModal.svelte'
  import { usePreferences } from '$lib/stores/preferences.svelte'
  import { useSettingsModal } from '$lib/stores/settings-modal.svelte'
  import { useAccounts } from '$lib/core/stores/accounts.svelte'
  import { useAuth } from '$lib/core/stores/auth.svelte'
  import { useLicense } from '$lib/core/stores/license.svelte'
  import { useAlerts } from '$lib/core/stores/alerts.svelte'
  import { features } from '$lib/config/features'
  import { visibleNavItems } from '$lib/config/navigation'
  import { isMacPlatform } from '$lib/utils'
  import type { Snippet } from 'svelte'

  let { children }: { children?: Snippet } = $props()

  const prefs = usePreferences()
  const settingsModal = useSettingsModal()
  const accountStore = useAccounts()
  const auth = useAuth()
  const licenseStore = useLicense()
  const alertStore = useAlerts()
  const hasAccount = $derived(accountStore.selectedAccountId !== null)
  const visibleNav = $derived(visibleNavItems(auth, hasAccount))
  let commandOpen = $state(false)
  let mobileOpen = $state(false)
  let sidebarToggleRef = $state<HTMLButtonElement | null>(null)

  const isMobile = () => typeof window !== 'undefined' && window.innerWidth < 768

  function toggleSidebar() {
    if (isMobile()) mobileOpen = !mobileOpen
    else prefs.sidebarCollapsed = !prefs.sidebarCollapsed
  }

  $effect(() => {
    if (!auth.loading && !auth.isUserRole) licenseStore.fetchLicense()
  })

  $effect(() => {
    if (!auth.loading && !auth.isUserRole && features.alerts) {
      alertStore.startPolling()
      return () => alertStore.reset()
    }
  })

  // e.key for a digit key reflects the character the modifiers actually
  // produce (Shift+3 is '#', Option+3 is '£' on a US layout), so it can't
  // identify a number-row press once Shift or Alt is held. e.code names the
  // physical key instead and stays 'Digit0'..'Digit9' regardless of layout
  // or modifiers, which is what a digit shortcut needs.
  function digitFromCode(code: string): number | null {
    const m = /^Digit([0-9])$/.exec(code)
    return m ? parseInt(m[1], 10) : null
  }

  function handleKeydown(e: KeyboardEvent) {
    // e.metaKey is the Cmd key on macOS but the Windows/Super key elsewhere
    // (already claimed by the OS), so Windows/Linux users need ctrlKey for
    // this to reach them at all, swap which one counts as "the" modifier,
    // and which one disqualifies the combo, based on the actual platform.
    const mac = isMacPlatform()
    const modPressed = mac ? e.metaKey : e.ctrlKey
    const otherModifier = mac ? e.ctrlKey : e.metaKey
    if (!modPressed || otherModifier) return

    const target = e.target as HTMLElement
    const inInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

    if (e.key === 'k' && !e.shiftKey && !e.altKey) {
      e.preventDefault()
      commandOpen = !commandOpen
      return
    }

    if (inInput) return

    // Browsers reserve bare Cmd/Ctrl+1-9 for switching to browser tab N, and
    // Cmd/Ctrl+0 for resetting zoom; preventDefault cannot override either in
    // Chrome or Safari. Account switching and sidebar-item jumps each need
    // their own extra modifier to reach a combo the browser doesn't already
    // own: Option/Alt for accounts, Shift for sidebar items.
    if (e.altKey) {
      const digit = digitFromCode(e.code)
      if (!e.shiftKey && !auth.isUserRole && digit !== null && digit >= 1) {
        const idx = digit - 1
        if (idx < accountStore.accounts.length) {
          e.preventDefault()
          accountStore.selectAccount(accountStore.accounts[idx].id)
        }
      }
      return
    }

    if (e.shiftKey) {
      const digit = digitFromCode(e.code)
      if (digit !== null) {
        const idx = digit === 0 ? 9 : digit - 1
        if (idx < visibleNav.length) {
          e.preventDefault()
          goto(visibleNav[idx].href)
        }
      } else if (e.key.toLowerCase() === 'g') {
        e.preventDefault(); prefs.grayscale = !prefs.grayscale
      }
      return
    }

    switch (e.key) {
      case ',':
        e.preventDefault(); settingsModal.show()
        break
      case 'b':
        e.preventDefault(); toggleSidebar()
        break
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<a href="#main-content" class="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-sm focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground">
  Skip to main content
</a>
<div class="app-shell h-screen" class:sidebar-collapsed={prefs.sidebarCollapsed}>
  <!-- Desktop sidebar -->
  <div class="hidden md:block overflow-hidden">
    <Sidebar collapsed={prefs.sidebarCollapsed} />
  </div>
  <!-- Mobile sidebar overlay -->
  {#if mobileOpen}
    <div class="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu" tabindex={-1}
      onkeydown={(e: KeyboardEvent) => { if (e.key === 'Escape') { mobileOpen = false; sidebarToggleRef?.focus() } }}>
      <button type="button" class="absolute inset-0 bg-foreground/50 dark:bg-foreground/30" aria-label="Close navigation menu" onclick={() => { mobileOpen = false; sidebarToggleRef?.focus() }}></button>
      <div class="relative z-10 h-full w-60" onfocusout={(e: FocusEvent) => {
        const related = e.relatedTarget as Node | null
        const container = e.currentTarget as HTMLElement
        if (related && !container.contains(related)) { mobileOpen = false; sidebarToggleRef?.focus() }
      }}>
        <Sidebar collapsed={false} />
      </div>
    </div>
  {/if}
  <div class="flex flex-1 flex-col overflow-hidden min-w-0">
    <Header onOpenCommandPalette={() => commandOpen = true} onToggleSidebar={toggleSidebar} bind:sidebarToggleRef />
    <main id="main-content" class="relative flex-1 overflow-y-auto bg-background">
      <div class="bg-non-doodle pointer-events-none absolute inset-0 z-0" aria-hidden="true"></div>
      <div class="relative z-[1] p-3 sm:p-4 md:p-6">
        {#if children}{@render children()}{/if}
      </div>
    </main>
  </div>
</div>

<CommandPalette bind:open={commandOpen} />
<SettingsModal />
<StepUpModal />

<style>
  .app-shell {
    display: flex;
  }

  @media (min-width: 768px) {
    .app-shell {
      display: grid;
      grid-template-columns: 15rem 1fr;
    }
    .app-shell.sidebar-collapsed {
      grid-template-columns: 3.5rem 1fr;
    }
  }
</style>
