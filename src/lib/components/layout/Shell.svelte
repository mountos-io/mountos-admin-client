<script lang="ts">
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
  import type { Snippet } from 'svelte'

  let { children }: { children?: Snippet } = $props()

  const prefs = usePreferences()
  const settingsModal = useSettingsModal()
  const accountStore = useAccounts()
  const auth = useAuth()
  const licenseStore = useLicense()
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

  function handleKeydown(e: KeyboardEvent) {
    if (!e.metaKey || e.altKey || e.ctrlKey) return

    const target = e.target as HTMLElement
    const inInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

    if (e.key === 'k' && !e.shiftKey) {
      e.preventDefault()
      commandOpen = !commandOpen
      return
    }

    if (inInput) return

    switch (e.key) {
      case ',':
        if (!e.shiftKey) { e.preventDefault(); settingsModal.show() }
        break
      case 'b':
        if (!e.shiftKey) { e.preventDefault(); toggleSidebar() }
        break
      case 'g':
        if (e.shiftKey) { e.preventDefault(); prefs.grayscale = !prefs.grayscale }
        break
      default:
        if (!auth.isUserRole && !e.shiftKey && e.key >= '1' && e.key <= '9') {
          const idx = parseInt(e.key) - 1
          if (idx < accountStore.accounts.length) {
            e.preventDefault()
            accountStore.selectAccount(accountStore.accounts[idx].id)
          }
        }
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<a href="#main-content" class="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-sm focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground">
  Skip to main content
</a>
<div class="flex h-screen">
  <!-- Desktop sidebar -->
  <div class="hidden md:block">
    <Sidebar collapsed={prefs.sidebarCollapsed} />
  </div>
  <!-- Mobile sidebar overlay -->
  {#if mobileOpen}
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div class="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu" tabindex={-1}
      onkeydown={(e: KeyboardEvent) => { if (e.key === 'Escape') { mobileOpen = false; sidebarToggleRef?.focus() } }}>
      <button class="absolute inset-0 bg-foreground/50" aria-label="Close navigation menu" onclick={() => { mobileOpen = false; sidebarToggleRef?.focus() }}></button>
      <div class="relative z-10 h-full w-60">
        <Sidebar collapsed={false} />
      </div>
    </div>
  {/if}
  <div class="flex flex-1 flex-col overflow-hidden">
    <Header onOpenCommandPalette={() => commandOpen = true} onToggleSidebar={toggleSidebar} bind:sidebarToggleRef />
    <main id="main-content" class="relative flex-1 overflow-y-auto bg-background">
      <div class="bg-doodle pointer-events-none absolute inset-0 z-0" aria-hidden="true"></div>
      <div class="relative z-[1] p-4 md:p-6">
        {#if children}{@render children()}{/if}
      </div>
    </main>
  </div>
</div>

<CommandPalette bind:open={commandOpen} />
<SettingsModal />
<StepUpModal />
