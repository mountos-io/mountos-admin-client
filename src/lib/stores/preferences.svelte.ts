import { findPreset, applySkin, clearSkin, familyVariant, defaultSkin, type SkinMode } from '$lib/core/themes'

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
  applySkinPreset()
}

function applySkinPreset() {
  if (typeof document === 'undefined') return
  const mode = resolvedMode()
  if (!skin) {
    clearSkin()
    if (mode === 'dark') {
      const mountOSDark = findPreset('mountOS Dark')
      if (mountOSDark) { applySkin(mountOSDark.colors, 'dark'); return }
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
  applySkin(preset.colors, preset.mode)
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
  $effect(() => { save(KEYS.fontSize, fontSize); applyFontSize(fontSize) })
  $effect(() => { save(KEYS.pageSize, pageSize) })
  $effect(() => { save(KEYS.defaultAccountId, defaultAccountId) })
  $effect(() => { save(KEYS.sidebarCollapsed, sidebarCollapsed) })
  $effect(() => { save(KEYS.grayscale, grayscale); applyFilters() })
  $effect(() => { save(KEYS.brightness, brightness); applyFilters() })
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
  }
}
