<script lang="ts">
  import { usePreferences, type Theme, type FontSize } from '$lib/stores/preferences.svelte'
  import { presetsForMode, type SkinMode } from '$lib/core/themes'
  import { ACCENT_PRESETS, MIN_ACCENT_CHROMA, MAX_ACCENT_CHROMA, DEFAULT_ACCENT_CHROMA, accentHueLabel, accentSwatchColor, defaultAccentHue, type AccentMode } from '$lib/core/accent-palette'
  import { useSettingsModal, type SettingsTab } from '$lib/stores/settings-modal.svelte'
  import { useAccounts } from '$lib/core/stores/accounts.svelte'
  import { providerSettingsTabs, providerSettingsModalSize } from '$provider/config/settings'
  import * as Dialog from '$lib/components/ui/dialog'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import { Textarea } from '$lib/components/ui/textarea'
  import { cn, isMacPlatform } from '$lib/utils'
  import Sun from '@lucide/svelte/icons/sun'
  import Moon from '@lucide/svelte/icons/moon'
  import Monitor from '@lucide/svelte/icons/monitor'
  import Palette from '@lucide/svelte/icons/palette'
  import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal'
  import Keyboard from '@lucide/svelte/icons/keyboard'
  import ShieldCheck from '@lucide/svelte/icons/shield-check'
  import Info from '@lucide/svelte/icons/info'
  import ScrollText from '@lucide/svelte/icons/scroll-text'
  import RefreshCw from '@lucide/svelte/icons/refresh-cw'
  import { useAuth } from '$lib/core/stores/auth.svelte'
  import { useLicense } from '$lib/core/stores/license.svelte'
  import { useReleases, severityClass, severityLabel, semverLess, type ReleaseUnit } from '$lib/core/stores/releases.svelte'
  import { Badge } from '$lib/components/ui/badge'
  import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '$lib/components/ui/table'
  import EmptyState from '$lib/components/shared/EmptyState.svelte'
  import { formatDate, formatRelative } from '$lib/core/utils/format'

  const prefs = usePreferences()
  const modal = useSettingsModal()
  const accountStore = useAccounts()
  const auth = useAuth()
  const licenseStore = useLicense()
  const releases = useReleases()

  $effect(() => {
    if (modal.tab === 'updates' && !releases.loaded && !releases.loading) {
      releases.fetchReleases().catch(() => { /* rendered as the error state below */ })
    }
  })

  // A release unit covers the binaries that must never drift apart (dataserv and gcserv
  // share `dbserv` because they migrate the same database). Separate units that shipped
  // the identical note in lockstep (same version, severity, and every other displayed
  // field) are one row here, so a fix that landed in blockserv and dbserv together, or a
  // desktop build that bundles the same CLI note across platforms, reads as one entry
  // instead of duplicate text. Newest version first, ties broken by unit names; capped so
  // a growing unit count never reshapes the modal.
  interface ReleaseGroup {
    names: string[]
    pkgs: string[]
    platforms: Record<string, string>
    unit: ReleaseUnit
  }
  const MAX_RELEASE_ROWS = 8
  const releaseGroups = $derived.by(() => {
    const groups = new Map<string, ReleaseGroup>()
    for (const [name, unit] of Object.entries(releases.index?.units ?? {})) {
      const key = JSON.stringify([
        unit.version, unit.severity, unit.breaking,
        unit.requires_schema ?? '', unit.requires_protocol ?? '', unit.action_required ?? '',
        unit.summary,
      ])
      let group = groups.get(key)
      if (!group) {
        group = { names: [], pkgs: [], platforms: {}, unit }
        groups.set(key, group)
      }
      group.names.push(name)
      for (const pkg of unit.pkgs) if (!group.pkgs.includes(pkg)) group.pkgs.push(pkg)
      Object.assign(group.platforms, unit.platforms)
    }
    return Array.from(groups.values())
      .sort((a, b) => {
        if (a.unit.version !== b.unit.version) return semverLess(a.unit.version, b.unit.version) ? 1 : -1
        return a.names.join('+').localeCompare(b.names.join('+'))
      })
      .slice(0, MAX_RELEASE_ROWS)
  })

  // Load-license (admin-only; the License tab is already gated by !auth.isUserRole)
  let licenseFiles = $state<FileList | undefined>(undefined)
  let uploadingLicense = $state(false)
  let licenseUploadError = $state<string | null>(null)
  let licenseUploaded = $state(false)
  let licenseText = $state('')
  let pastingLicense = $state(false)

  async function handleLicenseUpload() {
    if (!licenseFiles?.length) return
    uploadingLicense = true
    licenseUploadError = null
    licenseUploaded = false
    try {
      await licenseStore.uploadLicense(licenseFiles)
      licenseUploaded = true
      licenseFiles = undefined
    } catch (e) {
      licenseUploadError = (e as Error).message || 'Failed to load license'
    } finally {
      uploadingLicense = false
    }
  }

  async function handleLicensePaste() {
    if (!licenseText.trim()) return
    pastingLicense = true
    licenseUploadError = null
    licenseUploaded = false
    try {
      await licenseStore.pasteLicense(licenseText)
      licenseUploaded = true
      licenseText = ''
    } catch (e) {
      licenseUploadError = (e as Error).message || 'Failed to load license'
    } finally {
      pastingLicense = false
    }
  }

  const maxWidth = providerSettingsModalSize?.maxWidth ?? '800px'
  const modalHeight = providerSettingsModalSize?.height ?? '620px'

  const builtinTabs = $derived<{ id: SettingsTab; label: string; icon: typeof Sun }[]>([
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'preferences', label: 'Preferences', icon: SlidersHorizontal },
    { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard },
    ...(!auth.isUserRole ? [{ id: 'license' as SettingsTab, label: 'License', icon: ShieldCheck }] : []),
    ...(!auth.isUserRole ? [{ id: 'updates' as SettingsTab, label: 'Updates', icon: RefreshCw }] : []),
    { id: 'about', label: 'About', icon: Info },
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

  // Gradient stops for the accent hue strip, swept across the full hue
  // circle at the current saturation so the strip previews the real
  // primary color rather than a separate paler stand-in.
  function accentStripGradient(chroma: number, mode: AccentMode): string {
    return Array.from({ length: 13 }, (_, i) => accentSwatchColor(i * 30, chroma, mode)).join(', ')
  }

  const mac = isMacPlatform()
  const modKey = mac ? '⌘' : 'Ctrl'
  const shiftKey = mac ? '⇧' : 'Shift'
  const shortcuts: { keys: string; description: string }[] = [
    { keys: `${modKey} K`, description: 'Open command palette' },
    { keys: `${modKey} ,`, description: 'Open settings' },
    { keys: `${modKey} B`, description: 'Toggle sidebar' },
    { keys: `${modKey} ${shiftKey} G`, description: 'Toggle grayscale' },
    { keys: `${modKey} 1-9`, description: 'Switch account by index' },
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
  <Dialog.DialogContent class="p-0 gap-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden" style="max-width: {maxWidth}; height: min({modalHeight}, calc(100vh - 4rem)); max-height: calc(100vh - 4rem)">
    <Dialog.DialogHeader class="px-6 pt-6 pb-4 border-b">
      <Dialog.DialogTitle>Settings</Dialog.DialogTitle>
      <Dialog.DialogDescription class="sr-only">Application settings</Dialog.DialogDescription>
    </Dialog.DialogHeader>
    <div class="flex flex-col sm:flex-row min-w-0 min-h-0">
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
                      style="--sw-bg: {preset.color('background')}; --sw-fg: {preset.color('primary')};"
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
                      style="--sw-bg: {preset.color('background')}; --sw-fg: {preset.color('primary')};"
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
            {#if (prefs.theme === 'light' && (!prefs.skin || prefs.skin === 'mountOS Light')) || (prefs.theme === 'dark' && (!prefs.skin || prefs.skin === 'mountOS Dark'))}
              {@const mode = prefs.theme === 'dark' ? 'dark' : 'light'}
              {@const activeHue = prefs.accentHue}
              {@const defaultHue = defaultAccentHue(mode)}
              {@const strandHue = activeHue ?? defaultHue}
              {@const customHue = prefs.accentCustomHue}
              {@const chroma = prefs.accentChroma}
              {@const gradient = accentStripGradient(chroma, mode)}
              {@const saturationPct = Math.round(((chroma - MIN_ACCENT_CHROMA) / (MAX_ACCENT_CHROMA - MIN_ACCENT_CHROMA)) * 100)}
              <div class="space-y-3">
                <div class="flex items-center justify-between">
                  <h3 class="text-sm font-medium">Accent Color</h3>
                  {#if activeHue !== null || chroma !== DEFAULT_ACCENT_CHROMA}
                    <button
                      type="button"
                      class="text-sm text-muted-foreground hover:text-foreground transition-colors"
                      onclick={() => { prefs.accentHue = null; prefs.accentChroma = DEFAULT_ACCENT_CHROMA }}
                    >Reset</button>
                  {/if}
                </div>
                <div class="space-y-1.5">
                  <input
                    type="range" min="0" max="360" step="1"
                    value={strandHue}
                    oninput={(e) => {
                      const hue = Number((e.target as HTMLInputElement).value)
                      prefs.accentHue = hue
                      prefs.accentCustomHue = hue
                    }}
                    aria-label="Accent hue"
                    class="accent-strip w-full cursor-pointer"
                    style="background: linear-gradient(to right, {gradient}); --aw-thumb: {accentSwatchColor(strandHue, chroma, mode)};"
                  />
                  <p class="text-xs text-muted-foreground">{activeHue === null ? 'Default' : accentHueLabel(strandHue)}</p>
                </div>
                <div class="flex flex-wrap gap-2">
                  <button
                    type="button"
                    class="accent-swatch {activeHue === null ? 'is-active' : ''}"
                    style="--aw-bg: {accentSwatchColor(defaultHue, DEFAULT_ACCENT_CHROMA, mode)}; --aw-mark: {mode === 'dark' ? 'oklch(0.15 0 0)' : 'oklch(1 0 0)'};"
                    onclick={() => { prefs.accentHue = null; prefs.accentChroma = DEFAULT_ACCENT_CHROMA }}
                    aria-label="Default"
                    aria-pressed={activeHue === null}
                    title="Default (mountOS)"
                  ><span class="accent-swatch-default-mark" aria-hidden="true"></span></button>
                  {#each ACCENT_PRESETS as preset}
                    {@const active = activeHue === preset.hue}
                    <button
                      type="button"
                      class="accent-swatch {active ? 'is-active' : ''}"
                      style="--aw-bg: {accentSwatchColor(preset.hue, chroma, mode)};"
                      onclick={() => prefs.accentHue = preset.hue}
                      aria-label={preset.name}
                      aria-pressed={active}
                      title={preset.name}
                    ></button>
                  {/each}
                  {#if customHue !== null && !ACCENT_PRESETS.some((p) => p.hue === customHue)}
                    <button
                      type="button"
                      class="accent-swatch {activeHue === customHue ? 'is-active' : ''}"
                      style="--aw-bg: {accentSwatchColor(customHue, chroma, mode)};"
                      onclick={() => prefs.accentHue = customHue}
                      aria-label={accentHueLabel(customHue)}
                      aria-pressed={activeHue === customHue}
                      title={accentHueLabel(customHue)}
                    ></button>
                  {/if}
                </div>
                <div class="space-y-1.5">
                  <div class="flex items-center justify-between">
                    <span class="text-xs text-muted-foreground">Saturation</span>
                    <span class="text-xs tabular-nums text-muted-foreground">{saturationPct}%</span>
                  </div>
                  <input
                    type="range" min={MIN_ACCENT_CHROMA} max={MAX_ACCENT_CHROMA} step="0.01"
                    value={chroma}
                    oninput={(e) => prefs.accentChroma = Number((e.target as HTMLInputElement).value)}
                    aria-label="Accent saturation"
                    class="brightness-slider w-full cursor-pointer"
                  />
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
                  class="brightness-slider w-full cursor-pointer"
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
                  <dd>{licenseStore.formatLimit(lic.maxStorageBytes, 'bytes', lic.unlimitedStorage)}</dd>
                </div>
                {#if lic.distribution}
                  <div class="flex justify-between gap-3 min-w-0">
                    <dt class="text-muted-foreground shrink-0">Distribution</dt>
                    <dd class="text-right truncate min-w-0">
                      {lic.distribution}
                      {#if lic.distributionRef?.length}
                        <span class="text-muted-foreground font-mono text-xs"> ({lic.distributionRef.join(', ')})</span>
                      {/if}
                    </dd>
                  </div>
                {/if}
                {#if lic.quota}
                  <hr class="border-border" aria-hidden="true" />
                  <div class="flex justify-between gap-2">
                    <dt class="text-muted-foreground">Total Used</dt>
                    <dd class:text-destructive={lic.quota.state === 'exceeded'} class="text-right">
                      {licenseStore.formatBytes(lic.quota.totalVolume)}
                      {#if lic.unlimitedStorage}
                        <span class="text-muted-foreground"> / Unlimited</span>
                      {:else if lic.maxStorageBytes > 0}
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
            </div>
          {:else if licenseStore.loading}
            <p class="text-sm text-muted-foreground">Loading license...</p>
          {:else if licenseStore.error}
            <p class="text-sm text-destructive">{licenseStore.error}</p>
          {:else}
            <p class="text-sm text-muted-foreground">No license information available.</p>
          {/if}

          <div class="space-y-4 border-t border-border pt-5 mt-5">
            <div>
              <h3 class="text-sm font-medium">Load License</h3>
              <p class="text-xs text-muted-foreground mt-1">Paste a signed license payload, or upload a license file. Stacked licenses sum; separate multiple payloads with newlines.</p>
            </div>
            <div class="space-y-2">
              <Textarea
                bind:value={licenseText}
                rows={4}
                spellcheck={false}
                placeholder="Paste signed license payload(s) here, one per line…"
                aria-label="License payload"
                class="font-mono text-xs resize-y"
                disabled={pastingLicense}
              />
              <div class="flex justify-end">
                <Button onclick={handleLicensePaste} disabled={pastingLicense || !licenseText.trim()}>
                  {pastingLicense ? 'Loading…' : 'Load'}
                </Button>
              </div>
            </div>
            <div class="flex items-center gap-3 text-xs text-muted-foreground" aria-hidden="true">
              <span class="h-px flex-1 bg-border"></span>
              or upload a file
              <span class="h-px flex-1 bg-border"></span>
            </div>
            <div class="flex items-center gap-2 flex-wrap">
              <Input type="file" multiple class="max-w-xs" aria-label="License file(s)" bind:files={licenseFiles} disabled={uploadingLicense} />
              <Button variant="outline" onclick={handleLicenseUpload} disabled={uploadingLicense || !licenseFiles?.length}>
                {uploadingLicense ? 'Uploading…' : 'Upload'}
              </Button>
            </div>
            {#if licenseUploadError}
              <p class="text-sm text-destructive" role="alert">{licenseUploadError}</p>
            {:else if licenseUploaded}
              <p class="text-sm text-success" role="status">License loaded.</p>
            {/if}
          </div>

        {:else if modal.tab === 'updates'}
          <div class="space-y-4">
            <div>
              <h3 class="text-sm font-medium">Available versions</h3>
              <p class="text-xs text-muted-foreground mt-1">Deployment-wide release information for every mountOS component.</p>
            </div>
            {#if !releases.enabled && releases.loaded}
              <EmptyState title="Update checks are disabled"
                description="MOUNTOS_UPDATE_CHECK is off, so this deployment does not contact the distribution service. Versions below are not available." />
            {:else if releases.loading && !releases.index}
              <p class="text-sm text-muted-foreground">Loading release information...</p>
            {:else if !releases.index}
              <EmptyState title="Release information unavailable"
                description={releases.error || 'The distribution service could not be reached.'} />
            {:else}
              <div class="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-muted-foreground">
                <span>Release series <span class="font-mono text-foreground">{releases.index.suite}</span></span>
                <span>DB schema level <span class="font-mono text-foreground">{releases.index.schema_version}</span></span>
                <span>Wire protocol <span class="font-mono text-foreground">{releases.index.protocol_version}</span></span>
                {#if releases.fetchedAt}
                  <span class="ml-auto">Checked {formatRelative(releases.fetchedAt)}</span>
                {/if}
              </div>

              {#if releases.error}
                <p class="text-sm text-amber-600 dark:text-amber-500">
                  Showing the last known data; the most recent check failed ({releases.error}).
                </p>
              {/if}

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Release unit</TableHead>
                    <TableHead>Latest</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {#each releaseGroups as group (group.names.join('+'))}
                    <TableRow>
                      <TableCell>
                        <div class="flex flex-wrap gap-1">
                          {#each group.pkgs as pkg, i (i + ':' + pkg)}
                            <Badge variant="outline" class="font-mono text-xs">{pkg}</Badge>
                          {/each}
                        </div>
                      </TableCell>
                      <TableCell class="align-top">
                        <span class="font-mono text-sm">{group.unit.version}</span>
                        <!-- A unit can version per platform (the CLI does, since each platform
                             links a different set of mount backends). Show the split when it
                             differs, so "latest" is never ambiguous. -->
                        {#if Object.values(group.platforms).some(v => v !== group.unit.version)}
                          <div class="mt-0.5 space-y-0.5 text-xs text-muted-foreground">
                            {#each Object.entries(group.platforms) as [plat, ver] (plat)}
                              <div class="font-mono">{plat} {ver}</div>
                            {/each}
                          </div>
                        {/if}
                      </TableCell>
                      <TableCell class="align-top">
                        <span class={cn('text-sm', severityClass(group.unit.severity))}>{severityLabel(group.unit.severity)}</span>
                        {#if group.unit.breaking}
                          <div class="text-xs text-destructive">Breaking</div>
                        {/if}
                      </TableCell>
                      <TableCell class="align-top text-sm text-muted-foreground">
                        {group.unit.summary}
                        {#if group.unit.action_required}
                          <div class="mt-1 rounded bg-muted px-2 py-1 text-xs text-foreground">{group.unit.action_required}</div>
                        {/if}
                        {#if group.unit.requires_schema || group.unit.requires_protocol}
                          <div class="mt-1 text-xs">
                            {#if group.unit.requires_schema}Needs schema {group.unit.requires_schema}.{/if}
                            {#if group.unit.requires_protocol} Speaks protocol {group.unit.requires_protocol}.{/if}
                          </div>
                        {/if}
                      </TableCell>
                    </TableRow>
                  {/each}
                </TableBody>
              </Table>
            {/if}
          </div>

        {:else if modal.tab === 'about'}
          <div class="space-y-5">
            <div class="space-y-1">
              <h3 class="text-sm font-medium">Open-source licenses</h3>
              <p class="text-xs text-muted-foreground">
                This dashboard is built with open-source software. The full license
                notices for every bundled package are reproduced in one file.
              </p>
            </div>
            <a
              href="/THIRD-PARTY-NOTICES.txt"
              target="_blank"
              rel="noopener"
              class="inline-flex items-center gap-2 text-sm text-primary underline underline-offset-2 hover:text-primary/80"
            >
              <ScrollText class="h-4 w-4" aria-hidden="true" />
              View third-party licenses
            </a>
          </div>

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
    font-size: var(--text-xs);
    font-weight: 500;
    color: var(--sw-fg);
    white-space: nowrap;
  }

  .accent-swatch {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    border: 1px solid var(--border);
    background: var(--aw-bg);
    cursor: pointer;
    transition: transform 0.15s;
  }

  /* --aw-mark is the same fixed white/near-black pairing --primary-foreground
     itself uses for this mode (white text on light's mid-tone default,
     near-black on dark's bright default) - not a blend-mode trick, which
     only collapses to true black/white against an actually-neutral
     backdrop and reads as a stray hue (e.g. cyan) against any saturated
     swatch fill like this one. */
  .accent-swatch-default-mark {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--aw-mark);
  }

  .accent-swatch:hover {
    transform: scale(1.12);
  }

  .accent-swatch:focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 2px;
  }

  /* A fixed foreground/background double ring, not var(--ring) or
     var(--primary) - both of those ARE the swatch's own color once an
     accent is active, which would make the "selected" indicator blend into
     the swatch it's marking instead of standing out from it. */
  .accent-swatch.is-active {
    box-shadow: 0 0 0 2px var(--background), 0 0 0 4px var(--foreground);
  }

  .accent-strip {
    appearance: none;
    -webkit-appearance: none;
    height: 10px;
    border-radius: var(--radius);
    outline: none;
  }

  .accent-strip:focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 4px;
  }

  .accent-strip::-webkit-slider-thumb {
    appearance: none;
    -webkit-appearance: none;
    width: 18px;
    height: 18px;
    border-radius: var(--radius);
    background: var(--aw-thumb);
    border: 2px solid var(--background);
    box-shadow: 0 0 0 1px var(--border);
    cursor: pointer;
    transition: transform 0.15s;
  }

  .accent-strip::-webkit-slider-thumb:hover {
    transform: scale(1.1);
  }

  .accent-strip::-moz-range-thumb {
    width: 18px;
    height: 18px;
    border-radius: var(--radius);
    background: var(--aw-thumb);
    border: 2px solid var(--background);
    box-shadow: 0 0 0 1px var(--border);
    cursor: pointer;
    transition: transform 0.15s;
  }

  .accent-strip::-moz-range-thumb:hover {
    transform: scale(1.1);
  }

  .accent-strip::-moz-range-track {
    height: 10px;
    border-radius: var(--radius);
  }

  @media (pointer: coarse) {
    .accent-strip::-webkit-slider-thumb {
      width: 26px;
      height: 26px;
    }

    .accent-strip::-moz-range-thumb {
      width: 26px;
      height: 26px;
    }
  }

  .brightness-slider {
    appearance: none;
    -webkit-appearance: none;
    height: 6px;
    border-radius: 4px;
    background: var(--border);
    outline: none;
  }

  .brightness-slider:focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 4px;
  }

  .brightness-slider::-webkit-slider-thumb {
    appearance: none;
    -webkit-appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 4px;
    background: var(--primary);
    border: 1px solid color-mix(in oklch, var(--primary) 70%, var(--foreground));
    cursor: pointer;
    transition: transform 0.15s;
  }

  .brightness-slider::-webkit-slider-thumb:hover {
    transform: scale(1.1);
  }

  .brightness-slider::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border-radius: 4px;
    background: var(--primary);
    border: 1px solid color-mix(in oklch, var(--primary) 70%, var(--foreground));
    cursor: pointer;
    transition: transform 0.15s;
  }

  .brightness-slider::-moz-range-thumb:hover {
    transform: scale(1.1);
  }

  .brightness-slider::-moz-range-track {
    height: 6px;
    border-radius: 4px;
    background: var(--border);
  }

  @media (pointer: coarse) {
    .brightness-slider::-webkit-slider-thumb {
      width: 24px;
      height: 24px;
    }

    .brightness-slider::-moz-range-thumb {
      width: 24px;
      height: 24px;
    }
  }
</style>
