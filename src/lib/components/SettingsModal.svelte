<script lang="ts">
  import { usePreferences, type Theme, type FontSize } from '$lib/stores/preferences.svelte'
  import { useSettingsModal, type SettingsTab } from '$lib/stores/settings-modal.svelte'
  import { useAccounts } from '$lib/core/stores/accounts.svelte'
  import { vendorSettingsTabs, vendorSettingsModalSize } from '$vendor/config/settings'
  import * as Dialog from '$lib/components/ui/dialog'
  import { Button } from '$lib/components/ui/button'
  import { cn } from '$lib/utils'
  import Sun from '@lucide/svelte/icons/sun'
  import Moon from '@lucide/svelte/icons/moon'
  import Monitor from '@lucide/svelte/icons/monitor'
  import Palette from '@lucide/svelte/icons/palette'
  import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal'
  import Keyboard from '@lucide/svelte/icons/keyboard'
  import ShieldCheck from '@lucide/svelte/icons/shield-check'
  import { useAuth } from '$lib/core/stores/auth.svelte'
  import { useLicense } from '$lib/core/stores/license.svelte'
  import { Badge } from '$lib/components/ui/badge'
  import { formatDate } from '$lib/core/utils/format'

  const prefs = usePreferences()
  const modal = useSettingsModal()
  const accountStore = useAccounts()
  const auth = useAuth()
  const licenseStore = useLicense()

  const maxWidth = vendorSettingsModalSize?.maxWidth ?? '680px'
  const minHeight = vendorSettingsModalSize?.minHeight ?? '360px'

  const builtinTabs = $derived<{ id: SettingsTab; label: string; icon: typeof Sun }[]>([
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'preferences', label: 'Preferences', icon: SlidersHorizontal },
    { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard },
    ...(!auth.isUserRole ? [{ id: 'license' as SettingsTab, label: 'License', icon: ShieldCheck }] : []),
  ])

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
    { value: 'jumbo', label: 'Jumbo' },
  ]

  const pageSizes = [10, 20, 50]

  const shortcuts: { keys: string; description: string }[] = [
    { keys: '⌘ K', description: 'Open command palette' },
    { keys: '⌘ ,', description: 'Open settings' },
    { keys: '⌘ B', description: 'Toggle sidebar' },
    { keys: '⌘ ⇧ G', description: 'Toggle grayscale' },
    { keys: '⌘ 1-9', description: 'Switch account by index' },
  ]
</script>

<Dialog.Dialog bind:open={modal.open}>
  <Dialog.DialogContent class="p-0 gap-0" style="max-width: {maxWidth}">
    <Dialog.DialogHeader class="px-6 pt-6 pb-4 border-b">
      <Dialog.DialogTitle>Settings</Dialog.DialogTitle>
      <Dialog.DialogDescription class="sr-only">Application settings</Dialog.DialogDescription>
    </Dialog.DialogHeader>
    <div class="flex flex-col sm:flex-row" style="min-height: {minHeight}">
      <div class="flex sm:w-44 shrink-0 border-b sm:border-b-0 sm:border-r overflow-x-auto sm:overflow-x-visible sm:flex-col p-1.5 sm:p-2 gap-0.5" role="tablist" aria-label="Settings">
        {#each allTabs as t}
          {@const Icon = t.icon}
          <button
            role="tab"
            aria-selected={modal.tab === t.id}
            class={cn(
              'flex items-center gap-2 rounded-sm px-3 py-2 text-sm transition-colors whitespace-nowrap',
              'sm:w-full',
              modal.tab === t.id
                ? 'bg-accent text-accent-foreground font-medium'
                : 'text-muted-foreground hover:bg-accent/50'
            )}
            onclick={() => modal.tab = t.id}
          >
            <Icon class="h-4 w-4 shrink-0 sm:aria-hidden" aria-hidden="true" />
            <span class="sr-only sm:not-sr-only">{t.label}</span>
          </button>
        {/each}
      </div>

      <div class="flex-1 p-4 sm:p-6 overflow-y-auto">
        {#if modal.tab === 'appearance'}
          <div class="space-y-6">
            <div class="space-y-3">
              <h4 class="text-sm font-medium">Theme</h4>
              <div class="flex gap-2">
                {#each themes as t}
                  {@const Icon = t.icon}
                  <Button
                    variant={prefs.theme === t.value ? 'primary' : 'outline'}
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
                    variant={prefs.fontSize === fs.value ? 'primary' : 'outline'}
                    size="sm"
                    onclick={() => prefs.fontSize = fs.value}
                  >
                    {fs.label}
                  </Button>
                {/each}
              </div>
            </div>
            <div class="space-y-3">
              <h4 class="text-sm font-medium">Grayscale</h4>
              <div class="flex items-center gap-3">
                <Button
                  variant={prefs.grayscale ? 'primary' : 'outline'}
                  size="sm"
                  onclick={() => prefs.grayscale = !prefs.grayscale}
                >
                  {prefs.grayscale ? 'On' : 'Off'}
                </Button>
                <span class="text-sm text-muted-foreground">Reduce color for low-light comfort</span>
              </div>
            </div>
            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <h4 class="text-sm font-medium">Brightness</h4>
                <span class="text-sm tabular-nums text-muted-foreground">{prefs.brightness}%</span>
              </div>
              <div class="flex items-center gap-3">
                <input
                  type="range" min="50" max="150" step="5"
                  value={prefs.brightness}
                  oninput={(e) => prefs.brightness = Number((e.target as HTMLInputElement).value)}
                  aria-label="Brightness"
                  class="w-full h-1.5 rounded-full appearance-none bg-border accent-primary cursor-pointer"
                />
                {#if prefs.brightness !== 100}
                  <button
                    type="button"
                    class="text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
                    onclick={() => prefs.brightness = 100}
                  >Reset</button>
                {/if}
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
                    variant={prefs.pageSize === ps ? 'primary' : 'outline'}
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
                    variant={prefs.defaultAccountId === null ? 'primary' : 'outline'}
                    size="sm"
                    onclick={() => prefs.defaultAccountId = null}
                  >
                    None
                  </Button>
                  {#each accountStore.accounts as account}
                    <Button
                      variant={prefs.defaultAccountId === account.id ? 'primary' : 'outline'}
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
                <kbd class="inline-flex items-center gap-1 rounded border bg-muted px-2 py-0.5 font-mono text-sm text-muted-foreground">
                  {s.keys}
                </kbd>
              </div>
            {/each}
          </div>

        {:else if modal.tab === 'license'}
          {#if licenseStore.license}
            {@const lic = licenseStore.license}
            <div class="space-y-5">
              <div class="flex items-center justify-between">
                <h4 class="text-sm font-medium">License</h4>
                <Badge variant={licenseStore.badgeVariant ?? 'default'}>{licenseStore.statusLabel(lic.status)}</Badge>
              </div>
              <dl class="grid gap-3 text-sm">
                <div class="flex justify-between">
                  <dt class="text-muted-foreground">Licensee</dt>
                  <dd class="font-medium text-right">{lic.licensee}</dd>
                </div>
                <div class="flex justify-between">
                  <dt class="text-muted-foreground">Type</dt>
                  <dd class="font-medium capitalize">{lic.licenseType}</dd>
                </div>
                <div class="flex justify-between">
                  <dt class="text-muted-foreground">Contact</dt>
                  <dd class="font-medium"><a href="mailto:{lic.contact}" class="underline underline-offset-2 hover:text-primary">{lic.contact}</a></dd>
                </div>
                <div class="flex justify-between gap-3 min-w-0">
                  <dt class="text-muted-foreground shrink-0">ID</dt>
                  <dd class="font-mono text-sm text-muted-foreground truncate min-w-0">{lic.licenseId}</dd>
                </div>
                <hr class="border-border" />
                <div class="flex justify-between">
                  <dt class="text-muted-foreground">Issued</dt>
                  <dd>{formatDate(lic.issuedAt)}</dd>
                </div>
                <div class="flex justify-between">
                  <dt class="text-muted-foreground">Expires</dt>
                  <dd class:text-destructive={lic.status === 'expired'} class:text-warning={lic.status === 'expiring' || lic.status === 'grace'}>
                    {formatDate(lic.expiresAt)}
                    {#if lic.daysRemaining > 0}({lic.daysRemaining}d remaining){:else if lic.daysRemaining < 0}({Math.abs(lic.daysRemaining)}d ago){/if}
                  </dd>
                </div>
                {#if lic.status === 'grace' || lic.status === 'expired'}
                  <div class="flex justify-between">
                    <dt class="text-muted-foreground">Grace ends</dt>
                    <dd class:text-destructive={lic.graceDaysLeft <= 0}>
                      {formatDate(lic.graceEndsAt)}
                      {#if lic.graceDaysLeft > 0}({lic.graceDaysLeft}d left){/if}
                    </dd>
                  </div>
                {/if}
                <hr class="border-border" />
                <div class="flex justify-between">
                  <dt class="text-muted-foreground">Max Nodes</dt>
                  <dd>{licenseStore.formatLimit(lic.maxNodes)}</dd>
                </div>
                <div class="flex justify-between">
                  <dt class="text-muted-foreground">Max Volumes</dt>
                  <dd>{licenseStore.formatLimit(lic.maxVolumes)}</dd>
                </div>
                <div class="flex justify-between">
                  <dt class="text-muted-foreground">Max Users</dt>
                  <dd>{licenseStore.formatLimit(lic.maxUsers)}</dd>
                </div>
                <div class="flex justify-between">
                  <dt class="text-muted-foreground">Max Storage</dt>
                  <dd>{licenseStore.formatLimit(lic.maxStorageBytes, 'bytes')}</dd>
                </div>
              </dl>
            </div>
          {:else if licenseStore.loading}
            <p class="text-sm text-muted-foreground">Loading license...</p>
          {:else if licenseStore.error}
            <p class="text-sm text-destructive">{licenseStore.error}</p>
          {:else}
            <p class="text-sm text-muted-foreground">No license information available.</p>
          {/if}

        {:else if activeVendorTab}
          {@const VendorComponent = activeVendorTab.component}
          <VendorComponent />
        {/if}
      </div>
    </div>
  </Dialog.DialogContent>
</Dialog.Dialog>
