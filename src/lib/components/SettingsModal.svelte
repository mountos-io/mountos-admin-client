<script lang="ts">
  import { usePreferences, type Theme, type FontSize } from '$lib/stores/preferences.svelte'
  import { useSettingsModal, type SettingsTab } from '$lib/stores/settings-modal.svelte'
  import { useAccounts } from '$lib/core/stores/accounts.svelte'
  import { vendorSettingsTabs, vendorSettingsModalSize } from '$vendor/config/settings'
  import * as Dialog from '$lib/components/ui/dialog'
  import { Button } from '$lib/components/ui/button'
  import { cn } from '$lib/utils'
  import { useWebAuthn } from '$lib/core/stores/webauthn.svelte'
  import { handleApiError, showSuccessToast } from '$lib/core/utils/toast'
  import { Input } from '$lib/components/ui/input'
  import Sun from '@lucide/svelte/icons/sun'
  import Moon from '@lucide/svelte/icons/moon'
  import Monitor from '@lucide/svelte/icons/monitor'
  import Palette from '@lucide/svelte/icons/palette'
  import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal'
  import Keyboard from '@lucide/svelte/icons/keyboard'
  import Shield from '@lucide/svelte/icons/shield'
  import Pencil from '@lucide/svelte/icons/pencil'
  import Trash2 from '@lucide/svelte/icons/trash-2'
  import Check from '@lucide/svelte/icons/check'
  import X from '@lucide/svelte/icons/x'

  const MAX_CREDENTIALS = 4
  const prefs = usePreferences()
  const modal = useSettingsModal()
  const accountStore = useAccounts()
  const webauthn = useWebAuthn()

  const maxWidth = vendorSettingsModalSize?.maxWidth ?? '600px'
  const minHeight = vendorSettingsModalSize?.minHeight ?? '360px'

  const builtinTabs: { id: SettingsTab; label: string; icon: typeof Sun }[] = [
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'preferences', label: 'Preferences', icon: SlidersHorizontal },
    { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard },
    { id: 'security', label: 'Security', icon: Shield },
  ]

  let newKeyLabel = $state('')
  let registering = $state(false)
  let editingId = $state<string | null>(null)
  let editLabel = $state('')
  let pendingDeleteId = $state<string | null>(null)

  function resetSecurityState() {
    editingId = null
    editLabel = ''
    newKeyLabel = ''
    registering = false
    pendingDeleteId = null
  }

  function startRename(id: string, currentLabel: string) {
    editingId = id
    editLabel = currentLabel
  }

  function cancelRename() {
    editingId = null
    editLabel = ''
  }

  async function confirmRename(id: string) {
    try {
      await webauthn.renameCredential(id, editLabel)
      showSuccessToast('Credential renamed')
    } catch (e: unknown) { handleApiError(e, 'Rename failed') }
    cancelRename()
  }

  async function confirmDelete() {
    if (!pendingDeleteId) return
    try {
      await webauthn.deleteCredential(pendingDeleteId)
      showSuccessToast('Credential removed')
    } catch (e: unknown) { handleApiError(e, 'Delete failed') }
    pendingDeleteId = null
  }

  async function handleRegister() {
    registering = true
    try {
      await webauthn.registerCredential(newKeyLabel || 'Security Key')
      newKeyLabel = ''
      showSuccessToast('Security key registered')
    } catch (e: unknown) { handleApiError(e, 'Registration failed') }
    registering = false
  }

  $effect(() => {
    if (modal.open && modal.tab === 'security') webauthn.fetchCredentials()
    if (!modal.open) resetSecurityState()
  })

  const allTabs = $derived([
    ...builtinTabs,
    ...vendorSettingsTabs.map(vt => ({ id: vt.id as SettingsTab, label: vt.label, icon: vt.icon })),
  ])

  const activeVendorTab = $derived(vendorSettingsTabs.find(vt => vt.id === modal.tab))

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
  <Dialog.DialogContent class="p-0 gap-0" style="max-width: {maxWidth}">
    <Dialog.DialogHeader class="px-6 pt-6 pb-4 border-b">
      <Dialog.DialogTitle>Settings</Dialog.DialogTitle>
      <Dialog.DialogDescription class="sr-only">Application settings</Dialog.DialogDescription>
    </Dialog.DialogHeader>
    <div class="flex" style="min-height: {minHeight}">
      <nav class="w-44 shrink-0 border-r p-2 space-y-0.5">
        {#each allTabs as t}
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

        {:else if modal.tab === 'security'}
          <div class="space-y-6">
            <p class="text-sm text-muted-foreground">
              When registered, destructive operations require security key verification.
            </p>

            {#if webauthn.loading}
              <p class="text-sm text-muted-foreground">Loading...</p>
            {:else}
              {#if webauthn.credentials.length > 0}
                <div class="space-y-2">
                  <h4 class="text-sm font-medium">Registered Keys</h4>
                  {#each webauthn.credentials as cred}
                    <div class="flex items-center justify-between rounded-md border px-3 py-2">
                      {#if editingId === cred.id}
                        <div class="flex items-center gap-2 flex-1 mr-2">
                          <Input
                            bind:value={editLabel}
                            class="h-7 text-sm"
                            onkeydown={(e: KeyboardEvent) => { if (e.key === 'Enter') confirmRename(cred.id); if (e.key === 'Escape') cancelRename() }}
                          />
                          <button class="text-muted-foreground hover:text-foreground" aria-label="Save" onclick={() => confirmRename(cred.id)}>
                            <Check class="h-4 w-4" />
                          </button>
                          <button class="text-muted-foreground hover:text-foreground" aria-label="Cancel" onclick={cancelRename}>
                            <X class="h-4 w-4" />
                          </button>
                        </div>
                      {:else if pendingDeleteId === cred.id}
                        <div class="flex items-center justify-between flex-1">
                          <p class="text-sm text-destructive">Remove "{cred.label}"?</p>
                          <div class="flex items-center gap-2">
                            <Button variant="destructive" size="sm" onclick={confirmDelete}>Remove</Button>
                            <Button variant="outline" size="sm" onclick={() => pendingDeleteId = null}>Cancel</Button>
                          </div>
                        </div>
                      {:else}
                        <div class="flex-1 min-w-0">
                          <p class="text-sm font-medium truncate">{cred.label}</p>
                          <p class="text-xs text-muted-foreground">
                            Added {new Date(cred.createdAt).toLocaleDateString()}
                            {#if cred.lastUsedAt}
                              &middot; Last used {new Date(cred.lastUsedAt).toLocaleDateString()}
                            {/if}
                          </p>
                        </div>
                        <div class="flex items-center gap-1 shrink-0">
                          <button class="text-muted-foreground hover:text-foreground p-1" aria-label="Rename" onclick={() => startRename(cred.id, cred.label)}>
                            <Pencil class="h-3.5 w-3.5" />
                          </button>
                          <button class="text-muted-foreground hover:text-destructive p-1" aria-label="Delete" onclick={() => pendingDeleteId = cred.id}>
                            <Trash2 class="h-3.5 w-3.5" />
                          </button>
                        </div>
                      {/if}
                    </div>
                  {/each}
                </div>
              {/if}

              {#if webauthn.credentials.length < MAX_CREDENTIALS}
                <div class="space-y-3">
                  <h4 class="text-sm font-medium">Register New Key</h4>
                  <div class="flex items-end gap-2">
                    <div class="flex-1">
                      <Input bind:value={newKeyLabel} placeholder="Key label (optional)" class="h-8" />
                    </div>
                    <Button size="sm" disabled={registering} onclick={handleRegister}>
                      {registering ? 'Waiting...' : 'Register'}
                    </Button>
                  </div>
                </div>
              {/if}

              {#if webauthn.credentials.length === 1}
                <p class="text-xs text-amber-600 dark:text-amber-400">
                  This is your only security key. Removing it disables step-up verification.
                </p>
              {/if}
            {/if}
          </div>

        {:else if activeVendorTab}
          {@const VendorComponent = activeVendorTab.component}
          <VendorComponent />
        {/if}
      </div>
    </div>
  </Dialog.DialogContent>
</Dialog.Dialog>
