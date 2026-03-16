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
  import type { Snippet } from 'svelte'

  let { children }: { children?: Snippet } = $props()

  const prefs = usePreferences()
  const settingsModal = useSettingsModal()
  const accountStore = useAccounts()
  const auth = useAuth()
  let commandOpen = $state(false)

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
        if (!e.shiftKey) { e.preventDefault(); prefs.sidebarCollapsed = !prefs.sidebarCollapsed }
        break
      default:
        if (!e.shiftKey && e.key >= '1' && e.key <= '9') {
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

<div class="flex h-screen">
  <Sidebar collapsed={prefs.sidebarCollapsed} />
  <div class="flex flex-1 flex-col overflow-hidden">
    <Header onOpenCommandPalette={() => commandOpen = true} />
    <main class="flex-1 overflow-y-auto p-6">
      {#if children}{@render children()}{/if}
    </main>
  </div>
</div>

<CommandPalette bind:open={commandOpen} />
<SettingsModal />
<StepUpModal />
