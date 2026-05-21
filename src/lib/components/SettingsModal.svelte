<script lang="ts">
  import { usePreferences, type Theme, type FontSize } from '$lib/stores/preferences.svelte'
  import { presetsForMode, type SkinMode } from '$lib/core/themes'
  import { useSettingsModal, type SettingsTab } from '$lib/stores/settings-modal.svelte'
  import { useAccounts } from '$lib/core/stores/accounts.svelte'
  import { providerSettingsTabs, providerSettingsModalSize } from '$provider/config/settings'
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

  const maxWidth = providerSettingsModalSize?.maxWidth ?? '800px'
  const minHeight = providerSettingsModalSize?.minHeight ?? '480px'

  const builtinTabs = $derived<{ id: SettingsTab; label: string; icon: typeof Sun }[]>([
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'preferences', label: 'Preferences', icon: SlidersHorizontal },
    { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard },
    ...(!auth.isUserRole ? [{ id: 'license' as SettingsTab, label: 'License', icon: ShieldCheck }] : []),
  ])

  const allTabs = $derived([
    ...builtinTabs,
    ...providerSettingsTabs.map(vt => ({ id: vt.id as SettingsTab, label: vt.label, icon: vt.icon })),
  ])

  const activeProviderTab = $derived(providerSettingsTabs.find(vt => vt.id === modal.tab))

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

  let tablistEl: HTMLElement | null = $state(null)

  function handleTablistKey(e: KeyboardEvent) {
    const navKeys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']
    if (!navKeys.includes(e.key)) return
    e.preventDefault()
    const tabs = allTabs
    const current = tabs.findIndex(t => t.id === modal.tab)
    let next = current
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (current - 1 + tabs.length) % tabs.length
    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (current + 1) % tabs.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = tabs.length - 1
    modal.tab = tabs[next].id
    queueMicrotask(() => {
      const buttons = tablistEl?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
      buttons?.[next]?.focus()
    })
  }
</script>

<Dialog.Dialog bind:open={modal.open}>
  <Dialog.DialogContent class="p-0 gap-0 max-h-[calc(100vh-4rem)] grid-rows-[auto_minmax(0,1fr)] overflow-hidden" style="max-width: {maxWidth}">
    <Dialog.DialogHeader class="px-6 pt-6 pb-4 border-b">
      <Dialog.DialogTitle>Settings</Dialog.DialogTitle>
      <Dialog.DialogDescription class="sr-only">Application settings</Dialog.DialogDescription>
    </Dialog.DialogHeader>
    <div class="flex flex-col sm:flex-row min-w-0 min-h-0" style="min-height: min({minHeight}, 100%)">
      <div
        bind:this={tablistEl}
        class="flex sm:w-44 shrink-0 border-b sm:border-b-0 sm:border-r overflow-x-auto sm:overflow-x-visible sm:flex-col p-1.5 sm:p-2 gap-0.5"
        role="tablist"
        tabindex={-1}
        aria-label="Settings"
        aria-orientation="vertical"
        onkeydown={handleTablistKey}
      >
        {#each allTabs as t}
          {@const Icon = t.icon}
          {@const active = modal.tab === t.id}
          <button
            role="tab"
            id="settings-tab-{t.id}"
            aria-selected={active}
            aria-controls="settings-panel-{t.id}"
            tabindex={active ? 0 : -1}
            title={t.label}
            class={cn(
              'flex items-center gap-2 rounded-sm px-3 py-2 min-h-11 sm:min-h-0 text-sm transition-colors whitespace-nowrap',
              'sm:w-full',
              active
                ? 'bg-accent text-accent-foreground font-medium'
                : 'text-muted-foreground hover:bg-accent/50'
            )}
            onclick={() => modal.tab = t.id}
          >
            <Icon class="h-4 w-4 shrink-0" aria-hidden="true" />
            <span class="sr-only sm:not-sr-only">{t.label}</span>
          </button>
        {/each}
      </div>

      <div
        role="tabpanel"
        id="settings-panel-{modal.tab}"
        aria-labelledby="settings-tab-{modal.tab}"
        class="flex-1 min-w-0 min-h-0 p-4 sm:p-6 overflow-y-auto"
      >
        {#if modal.tab === 'appearance'}
          <div class="space-y-6">
            <div class="space-y-4">
              <h3 class="text-sm font-medium">Theme</h3>
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
            {#if prefs.theme === 'light'}
              {@const skins = presetsForMode('light')}
              <div class="space-y-4">
                <h3 class="text-sm font-medium">Skin</h3>
                <div class="flex flex-wrap gap-2">
                  {#each skins as preset}
                    {@const active = preset.name === 'mountOS Light' ? !prefs.skin || prefs.skin === 'mountOS Light' : prefs.skin === preset.name}
                    <button
                      class="skin-swatch {active ? 'ring-2 ring-primary' : ''}"
                      style="--sw-bg: {preset.colors.background}; --sw-fg: {preset.colors.primary};"
                      onclick={() => prefs.skin = preset.name === 'mountOS Light' ? '' : preset.name}
                      aria-label={preset.name === 'mountOS Light' ? 'mountOS (default)' : preset.name}
                      aria-pressed={active}
                      title={preset.name === 'mountOS Light' ? 'mountOS' : preset.name}
                    >
                      <span class="sw-dot"></span>
                      <span class="sw-label">{preset.name === 'mountOS Light' ? 'mountOS' : preset.name.replace(/ Light$/, '')}</span>
                    </button>
                  {/each}
                </div>
              </div>
            {:else if prefs.theme === 'dark'}
              {@const skins = presetsForMode('dark')}
              <div class="space-y-4">
                <h3 class="text-sm font-medium">Skin</h3>
                <div class="flex flex-wrap gap-2">
                  {#each skins as preset}
                    {@const active = preset.name === 'mountOS Dark' ? !prefs.skin || prefs.skin === 'mountOS Dark' : prefs.skin === preset.name}
                    <button
                      class="skin-swatch {active ? 'ring-2 ring-primary' : ''}"
                      style="--sw-bg: {preset.colors.background}; --sw-fg: {preset.colors.primary};"
                      onclick={() => prefs.skin = preset.name === 'mountOS Dark' ? '' : preset.name}
                      aria-label={preset.name === 'mountOS Dark' ? 'mountOS (default)' : preset.name}
                      aria-pressed={active}
                      title={preset.name === 'mountOS Dark' ? 'mountOS' : preset.name}
                    >
                      <span class="sw-dot"></span>
                      <span class="sw-label">{preset.name === 'mountOS Dark' ? 'mountOS' : preset.name.replace(/ Dark$/, '')}</span>
                    </button>
                  {/each}
                </div>
              </div>
            {/if}
            <div class="space-y-3">
              <h3 class="text-sm font-medium">Font Size</h3>
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
              <h3 class="text-sm font-medium">Grayscale</h3>
              <div class="flex items-center gap-3">
                <Button
                  variant={prefs.grayscale ? 'primary' : 'outline'}
                  size="sm"
                  role="switch"
                  aria-checked={prefs.grayscale}
                  onclick={() => prefs.grayscale = !prefs.grayscale}
                >
                  {prefs.grayscale ? 'On' : 'Off'}
                </Button>
                <span class="text-sm text-muted-foreground">Reduce color for low-light comfort</span>
              </div>
            </div>
            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <h3 class="text-sm font-medium">Brightness</h3>
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
              <h3 class="text-sm font-medium">Default Page Size</h3>
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
              <h3 class="text-sm font-medium">Default Account</h3>
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
            {#if !auth.isUserRole}
              <div class="space-y-3">
                <h3 class="text-sm font-medium">Notifications</h3>
                <div class="flex items-center gap-3">
                  <Button
                    variant={prefs.alertSound ? 'primary' : 'outline'}
                    size="sm"
                    role="switch"
                    aria-checked={prefs.alertSound}
                    onclick={() => prefs.alertSound = !prefs.alertSound}
                  >
                    {prefs.alertSound ? 'On' : 'Off'}
                  </Button>
                  <span class="text-sm text-muted-foreground">Play sound on new alerts</span>
                </div>
              </div>
            {/if}
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
              <div class="flex items-center justify-between gap-2 flex-wrap" aria-live="polite" aria-atomic="true">
                <h3 class="text-sm font-medium">License</h3>
                <div class="flex items-center gap-2 flex-wrap min-w-0">
                  <Badge variant={licenseStore.badgeVariant ?? 'default'}>{licenseStore.statusLabel(lic.status)}</Badge>
                  {#if lic.quota}
                    <Badge
                      variant={lic.quota.state === 'exceeded' ? 'destructive' : 'default'}
                      title="Global storage usage across all active volumes vs. license cap"
                    >
                      Quota: {lic.quota.state}
                    </Badge>
                  {/if}
                </div>
              </div>
              <dl class="grid gap-3 text-sm">
                <div class="flex justify-between gap-3 min-w-0">
                  <dt class="text-muted-foreground shrink-0">Licensee</dt>
                  <dd class="font-medium text-right truncate min-w-0" title={lic.licensee}>{lic.licensee}</dd>
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
                <hr class="border-border" aria-hidden="true" />
                <div class="flex justify-between">
                  <dt class="text-muted-foreground">Issued</dt>
                  <dd>{formatDate(lic.issuedAt)}</dd>
                </div>
                <div class="flex justify-between">
                  <dt class="text-muted-foreground">Expires</dt>
                  <dd class:text-destructive={lic.status === 'expired' || lic.status === 'expired_access'} class:text-warning={lic.status === 'expiring' || lic.status === 'grace'}>
                    {formatDate(lic.expiresAt)}
                    {#if lic.daysRemaining > 0}<span aria-label="{lic.daysRemaining} days remaining">({lic.daysRemaining}d remaining)</span>{:else if lic.daysRemaining === 0}<span aria-label="expires today">(today)</span>{:else}<span aria-label="{Math.abs(lic.daysRemaining)} days ago">({Math.abs(lic.daysRemaining)}d ago)</span>{/if}
                  </dd>
                </div>
                {#if lic.status === 'grace' || lic.status === 'expired_access' || lic.status === 'expired'}
                  <div class="flex justify-between">
                    <dt class="text-muted-foreground">{lic.status === 'grace' ? 'Grace ends' : 'Grace ended'}</dt>
                    <dd class:text-destructive={lic.graceDaysLeft <= 0}>
                      {formatDate(lic.graceEndsAt)}
                      {#if lic.graceDaysLeft > 0}<span aria-label="{lic.graceDaysLeft} days left">({lic.graceDaysLeft}d left)</span>{/if}
                    </dd>
                  </div>
                {/if}
                {#if lic.status === 'expired_access' || lic.status === 'expired'}
                  <div class="flex justify-between">
                    <dt class="text-muted-foreground">{lic.status === 'expired_access' ? 'Expired access ends' : 'Expired access ended'}</dt>
                    <dd class:text-destructive={lic.expiredAccessDaysLeft <= 0}>
                      {formatDate(lic.expiredAccessEndsAt)}
                      {#if lic.expiredAccessDaysLeft > 0}<span aria-label="{lic.expiredAccessDaysLeft} days left">({lic.expiredAccessDaysLeft}d left)</span>{/if}
                    </dd>
                  </div>
                {/if}
                <hr class="border-border" aria-hidden="true" />
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
                  <dt class="text-muted-foreground">Max Accounts</dt>
                  <dd>{licenseStore.formatLimit(lic.maxAccounts)}</dd>
                </div>
                <div class="flex justify-between">
                  <dt class="text-muted-foreground">Max Regions</dt>
                  <dd>{licenseStore.formatLimit(lic.maxRegions)}</dd>
                </div>
                <div class="flex justify-between">
                  <dt class="text-muted-foreground">Max Storage</dt>
                  <dd>{licenseStore.formatLimit(lic.maxStorageBytes, 'bytes')}</dd>
                </div>
                {#if lic.quota}
                  <hr class="border-border" aria-hidden="true" />
                  <div class="flex justify-between gap-2">
                    <dt class="text-muted-foreground">Total Used</dt>
                    <dd class:text-destructive={lic.quota.state === 'exceeded'} class="text-right">
                      {licenseStore.formatBytes(lic.quota.totalVolume)}
                      {#if lic.maxStorageBytes > 0}
                        <span class="text-muted-foreground"> / {licenseStore.formatBytes(lic.maxStorageBytes)}</span>
                        <span class:text-destructive={lic.quota.state === 'exceeded'} class="text-muted-foreground">
                          ({Math.round((lic.quota.totalVolume / lic.maxStorageBytes) * 100)}%)
                        </span>
                      {/if}
                    </dd>
                  </div>
                  <div class="flex justify-between">
                    <dt class="text-muted-foreground">Live Used</dt>
                    <dd>{licenseStore.formatBytes(lic.quota.liveVolume)}</dd>
                  </div>
                {/if}
              </dl>
              <details class="group mt-2" ontoggle={(e: Event) => { if ((e.target as HTMLDetailsElement).open) licenseStore.fetchTerms() }}>
                <summary class="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground select-none py-2">
                  License Terms
                </summary>
                <div class="mt-2 max-h-64 overflow-y-auto rounded border bg-muted/50 p-3">
                  {#if licenseStore.terms}
                    <pre class="whitespace-pre-wrap break-words text-sm text-muted-foreground font-mono leading-relaxed">{licenseStore.terms}</pre>
                  {:else if licenseStore.termsLoading}
                    <p class="text-sm text-muted-foreground">Loading terms...</p>
                  {:else}
                    <p class="text-sm text-muted-foreground">License terms not available.</p>
                  {/if}
                </div>
              </details>
            </div>
          {:else if licenseStore.loading}
            <p class="text-sm text-muted-foreground">Loading license...</p>
          {:else if licenseStore.error}
            <p class="text-sm text-destructive">{licenseStore.error}</p>
          {:else}
            <p class="text-sm text-muted-foreground">No license information available.</p>
          {/if}

        {:else if activeProviderTab}
          {@const ProviderComponent = activeProviderTab.component}
          <ProviderComponent />
        {/if}
      </div>
    </div>
  </Dialog.DialogContent>
</Dialog.Dialog>

<style>
  .skin-swatch {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 4px;
    border: 1px solid var(--border);
    background: var(--sw-bg);
    cursor: pointer;
    transition: transform 0.15s;
  }

  .skin-swatch:hover {
    transform: scale(1.05);
  }

  .skin-swatch:focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 2px;
  }

  .sw-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--sw-fg);
    border: 1px solid color-mix(in oklch, var(--sw-fg) 60%, transparent);
  }

  .sw-label {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--sw-fg);
    white-space: nowrap;
  }
</style>
