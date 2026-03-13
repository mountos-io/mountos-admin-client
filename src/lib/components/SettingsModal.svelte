<script lang="ts">
  import { usePreferences, type Theme, type FontSize } from '$lib/stores/preferences.svelte'
  import { useSettingsModal, type SettingsTab } from '$lib/stores/settings-modal.svelte'
  import { useAccounts } from '$lib/core/stores/accounts.svelte'
  import * as Dialog from '$lib/components/ui/dialog'
  import { Button } from '$lib/components/ui/button'
  import { cn } from '$lib/utils'
  import Sun from '@lucide/svelte/icons/sun'
  import Moon from '@lucide/svelte/icons/moon'
  import Monitor from '@lucide/svelte/icons/monitor'
  import Palette from '@lucide/svelte/icons/palette'
  import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal'
  import Keyboard from '@lucide/svelte/icons/keyboard'

  const prefs = usePreferences()
  const modal = useSettingsModal()
  const accountStore = useAccounts()

  const tabs: { id: SettingsTab; label: string; icon: typeof Sun }[] = [
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'preferences', label: 'Preferences', icon: SlidersHorizontal },
    { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard },
  ]

  const themes: { value: Theme; label: string; icon: typeof Sun }[] = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ]

  const fontSizes: { value: FontSize; label: string }[] = [
    { value: 'standard', label: 'Standard' },
    { value: 'medium', label: 'Medium' },
    { value: 'large', label: 'Large' },
    { value: 'extra-large', label: 'Extra Large' },
  ]

  const pageSizes = [10, 20, 50]

  const shortcuts: { keys: string; description: string }[] = [
    { keys: '⌘ K', description: 'Open command palette' },
    { keys: '⌘ ,', description: 'Open settings' },
    { keys: '⌘ B', description: 'Toggle sidebar' },
    { keys: '⌘ 1-9', description: 'Switch account by index' },
  ]
</script>

<Dialog.Dialog bind:open={modal.open}>
  <Dialog.DialogContent class="sm:max-w-[600px] p-0 gap-0">
    <Dialog.DialogHeader class="px-6 pt-6 pb-4 border-b">
      <Dialog.DialogTitle>Settings</Dialog.DialogTitle>
      <Dialog.DialogDescription class="sr-only">Application settings</Dialog.DialogDescription>
    </Dialog.DialogHeader>
    <div class="flex min-h-[360px]">
      <nav class="w-44 shrink-0 border-r p-2 space-y-0.5">
        {#each tabs as t}
          {@const Icon = t.icon}
          <button
            class={cn(
              'flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm transition-colors',
              modal.tab === t.id
                ? 'bg-accent text-accent-foreground font-medium'
                : 'text-muted-foreground hover:bg-accent/50'
            )}
            onclick={() => modal.tab = t.id}
          >
            <Icon class="h-4 w-4" />
            {t.label}
          </button>
        {/each}
      </nav>

      <div class="flex-1 p-6 overflow-y-auto">
        {#if modal.tab === 'appearance'}
          <div class="space-y-6">
            <div class="space-y-3">
              <h4 class="text-sm font-medium">Theme</h4>
              <div class="flex gap-2">
                {#each themes as t}
                  {@const Icon = t.icon}
                  <Button
                    variant={prefs.theme === t.value ? 'default' : 'outline'}
                    size="sm"
                    onclick={() => prefs.theme = t.value}
                    class="gap-2"
                  >
                    <Icon class="h-4 w-4" />
                    {t.label}
                  </Button>
                {/each}
              </div>
            </div>
            <div class="space-y-3">
              <h4 class="text-sm font-medium">Font Size</h4>
              <div class="flex flex-wrap gap-2">
                {#each fontSizes as fs}
                  <Button
                    variant={prefs.fontSize === fs.value ? 'default' : 'outline'}
                    size="sm"
                    onclick={() => prefs.fontSize = fs.value}
                  >
                    {fs.label}
                  </Button>
                {/each}
              </div>
            </div>
          </div>

        {:else if modal.tab === 'preferences'}
          <div class="space-y-6">
            <div class="space-y-3">
              <h4 class="text-sm font-medium">Default Page Size</h4>
              <div class="flex gap-2">
                {#each pageSizes as ps}
                  <Button
                    variant={prefs.pageSize === ps ? 'default' : 'outline'}
                    size="sm"
                    onclick={() => prefs.pageSize = ps}
                  >
                    {ps}
                  </Button>
                {/each}
              </div>
            </div>
            <div class="space-y-3">
              <h4 class="text-sm font-medium">Default Account</h4>
              {#if accountStore.accounts.length > 0}
                <div class="flex flex-wrap gap-2">
                  <Button
                    variant={prefs.defaultAccountId === null ? 'default' : 'outline'}
                    size="sm"
                    onclick={() => prefs.defaultAccountId = null}
                  >
                    None
                  </Button>
                  {#each accountStore.accounts as account}
                    <Button
                      variant={prefs.defaultAccountId === account.id ? 'default' : 'outline'}
                      size="sm"
                      onclick={() => prefs.defaultAccountId = account.id}
                    >
                      {account.name}
                    </Button>
                  {/each}
                </div>
              {:else}
                <p class="text-sm text-muted-foreground">No accounts available</p>
              {/if}
            </div>
          </div>

        {:else if modal.tab === 'shortcuts'}
          <div class="space-y-1">
            {#each shortcuts as s}
              <div class="flex items-center justify-between py-2.5 px-1">
                <span class="text-sm">{s.description}</span>
                <kbd class="inline-flex items-center gap-1 rounded border bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
                  {s.keys}
                </kbd>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </Dialog.DialogContent>
</Dialog.Dialog>
