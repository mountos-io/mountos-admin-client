import { findPreset, applySkin, clearSkin, familyVariant, defaultSkin, type SkinMode } from '$lib/core/themes'
import { applyAccent, DEFAULT_ACCENT_CHROMA } from '$lib/core/accent-palette'

export type Theme = 'light' | 'dark' | 'system'
export type FontSize = 'standard' | 'medium' | 'large' | 'extra-large' | 'jumbo'

const KEYS = {
  theme: 'mountos-admin-theme',
  skin: 'mountos-admin-skin',
  fontSize: 'mountos-admin-font-size',
  pageSize: 'mountos-admin-page-size',
  defaultAccountId: 'mountos-admin-default-account',
  sidebarCollapsed: 'mountos-admin-sidebar-collapsed',
  grayscale: 'mountos-admin-grayscale',
  brightness: 'mountos-admin-brightness',
  alertSound: 'mountos-admin-alert-sound',
  accentHueLight: 'mountos-admin-accent-hue-light',
  accentHueDark: 'mountos-admin-accent-hue-dark',
  accentCustomHueLight: 'mountos-admin-accent-custom-hue-light',
  accentCustomHueDark: 'mountos-admin-accent-custom-hue-dark',
  accentChromaLight: 'mountos-admin-accent-chroma-light',
  accentChromaDark: 'mountos-admin-accent-chroma-dark',
} as const

function load<T>(key: string, fallback: T): T {
  if (typeof localStorage === 'undefined') return fallback
  const v = localStorage.getItem(key)
  if (v === null) return fallback
  try { return JSON.parse(v) as T } catch { return v as unknown as T }
}

function save(key: string, value: unknown) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value))
}

let theme = $state<Theme>(load(KEYS.theme, 'system'))
let skin = $state<string>(load(KEYS.skin, ''))
let fontSize = $state<FontSize>(load(KEYS.fontSize, 'standard'))
let pageSize = $state<number>(load(KEYS.pageSize, 20))
let defaultAccountId = $state<number | null>(load(KEYS.defaultAccountId, null))
let sidebarCollapsed = $state<boolean>(load(KEYS.sidebarCollapsed, false))
let grayscale = $state<boolean>(load(KEYS.grayscale, false))
let brightness = $state<number>(load(KEYS.brightness, 100))
let alertSound = $state<boolean>(load(KEYS.alertSound, false))
// Pastel accent-hue override for the mountOS Light/Dark skins, tracked
// separately per mode (a hue picked for light shouldn't silently reappear
// on dark). null = theme default.
let accentHueLight = $state<number | null>(load(KEYS.accentHueLight, null))
let accentHueDark = $state<number | null>(load(KEYS.accentHueDark, null))
// Last hue picked off the continuous strip, kept even after Reset or after
// switching to a preset, so the user can return to it in one click.
let accentCustomHueLight = $state<number | null>(load(KEYS.accentCustomHueLight, null))
let accentCustomHueDark = $state<number | null>(load(KEYS.accentCustomHueDark, null))
// Saturation dial for the accent override; independent of hue so Reset can
// restore just the color while keeping the user's preferred intensity.
let accentChromaLight = $state<number>(load(KEYS.accentChromaLight, DEFAULT_ACCENT_CHROMA))
let accentChromaDark = $state<number>(load(KEYS.accentChromaDark, DEFAULT_ACCENT_CHROMA))

const fontScaleMap: Record<FontSize, string> = {
  standard: '100%',
  medium: '112.5%',
  large: '125%',
  'extra-large': '137.5%',
  jumbo: '150%',
}

function resolvedMode(): SkinMode {
  if (theme === 'system') return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  return theme
}

function applyTheme(t: Theme) {
  if (typeof document === 'undefined') return
  const el = document.documentElement
  el.classList.remove('light', 'dark')
  const mode = t === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : t
  el.classList.add(mode)
  // Pin color-scheme inline so native form controls (datetime picker, scrollbars)
  // match the chosen theme even when an extension injects color-scheme: dark.
  el.style.colorScheme = mode
  applySkinPreset()
}

function applySkinPreset() {
  if (typeof document === 'undefined') return
  const mode = resolvedMode()
  if (!skin) {
    clearSkin()
    if (mode === 'dark') {
      const mountOSDark = findPreset('mountOS Dark')
      if (mountOSDark) { applySkin(mountOSDark); return }
    }
    return
  }
  let preset = findPreset(skin)
  if (preset && preset.mode !== mode) {
    const variant = familyVariant(skin, mode)
    if (variant) { preset = variant; skin = variant.name }
    else { skin = ''; clearSkin(); return }
  }
  if (!preset) { skin = ''; clearSkin(); return }
  clearSkin()
  applySkin(preset)
}

// The accent-hue override only makes sense on the mountOS Light/Dark skins -
// other skins bring their own hand-tuned accent. Every property applyAccent
// touches is also one applySkin/clearSkin (run just before this, same tick)
// fully owns and overwrites for the active skin - so when a non-mountOS
// skin is active this must do nothing at all, not clear anything. Clearing
// would remove the skin's own just-applied inline values (same property,
// same element), not just ours.
function applyAccentOverride() {
  if (typeof document === 'undefined') return
  const mode = resolvedMode()
  const isMountOSDefault = mode === 'dark'
    ? (!skin || skin === 'mountOS Dark')
    : (!skin || skin === 'mountOS Light')
  if (!isMountOSDefault) return
  if (mode === 'dark') applyAccent(accentHueDark, accentChromaDark, 'dark')
  else applyAccent(accentHueLight, accentChromaLight, 'light')
}

function applyFontSize(fs: FontSize) {
  if (typeof document === 'undefined') return
  document.documentElement.style.fontSize = fontScaleMap[fs]
}

function applyFilters() {
  if (typeof document === 'undefined') return
  const parts: string[] = []
  if (grayscale) parts.push('grayscale(1)')
  if (brightness !== 100) parts.push(`brightness(${brightness / 100})`)
  document.documentElement.style.filter = parts.length ? parts.join(' ') : ''
}

$effect.root(() => {
  $effect(() => { save(KEYS.theme, theme); applyTheme(theme) })
  $effect(() => { save(KEYS.skin, skin); applySkinPreset() })
  $effect(() => {
    save(KEYS.accentHueLight, accentHueLight)
    save(KEYS.accentHueDark, accentHueDark)
    save(KEYS.accentChromaLight, accentChromaLight)
    save(KEYS.accentChromaDark, accentChromaDark)
    applyAccentOverride()
  })
  $effect(() => {
    save(KEYS.accentCustomHueLight, accentCustomHueLight)
    save(KEYS.accentCustomHueDark, accentCustomHueDark)
  })
  $effect(() => { save(KEYS.fontSize, fontSize); applyFontSize(fontSize) })
  $effect(() => { save(KEYS.pageSize, pageSize) })
  $effect(() => { save(KEYS.defaultAccountId, defaultAccountId) })
  $effect(() => { save(KEYS.sidebarCollapsed, sidebarCollapsed) })
  $effect(() => { save(KEYS.grayscale, grayscale); applyFilters() })
  $effect(() => { save(KEYS.brightness, brightness); applyFilters() })
  $effect(() => { save(KEYS.alertSound, alertSound) })
})

function initBrowser() {
  if (typeof window === 'undefined') return
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (theme === 'system') applyTheme('system')
  })
  applyTheme(theme)
  applyFontSize(fontSize)
  applyFilters()
}
initBrowser()

export function usePreferences() {
  return {
    get theme() { return theme },
    set theme(v: Theme) { theme = v },
    get skin() { return skin },
    set skin(v: string) { skin = v },
    get resolvedMode() { return resolvedMode() },
    get fontSize() { return fontSize },
    set fontSize(v: FontSize) { fontSize = v },
    get pageSize() { return pageSize },
    set pageSize(v: number) { pageSize = v },
    get defaultAccountId() { return defaultAccountId },
    set defaultAccountId(v: number | null) { defaultAccountId = v },
    get sidebarCollapsed() { return sidebarCollapsed },
    set sidebarCollapsed(v: boolean) { sidebarCollapsed = v },
    get grayscale() { return grayscale },
    set grayscale(v: boolean) { grayscale = v },
    get brightness() { return brightness },
    set brightness(v: number) { brightness = Math.max(50, Math.min(150, v)) },
    get alertSound() { return alertSound },
    set alertSound(v: boolean) { alertSound = v },
    // Routed to the light/dark backing store by the currently resolved
    // mode, so callers (the Appearance tab) don't need to branch themselves.
    get accentHue() { return resolvedMode() === 'dark' ? accentHueDark : accentHueLight },
    set accentHue(v: number | null) {
      if (resolvedMode() === 'dark') accentHueDark = v; else accentHueLight = v
    },
    get accentCustomHue() { return resolvedMode() === 'dark' ? accentCustomHueDark : accentCustomHueLight },
    set accentCustomHue(v: number | null) {
      if (resolvedMode() === 'dark') accentCustomHueDark = v; else accentCustomHueLight = v
    },
    get accentChroma() { return resolvedMode() === 'dark' ? accentChromaDark : accentChromaLight },
    set accentChroma(v: number) {
      const clamped = Math.max(0.02, Math.min(0.24, v))
      if (resolvedMode() === 'dark') accentChromaDark = clamped; else accentChromaLight = clamped
    },
  }
}
