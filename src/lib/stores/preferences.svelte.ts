export type Theme = 'light' | 'dark' | 'system'
export type FontSize = 'standard' | 'medium' | 'large' | 'extra-large'

const KEYS = {
  theme: 'mountos-admin-theme',
  fontSize: 'mountos-admin-font-size',
  pageSize: 'mountos-admin-page-size',
  defaultAccountId: 'mountos-admin-default-account',
  sidebarCollapsed: 'mountos-admin-sidebar-collapsed',
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
let fontSize = $state<FontSize>(load(KEYS.fontSize, 'standard'))
let pageSize = $state<number>(load(KEYS.pageSize, 20))
let defaultAccountId = $state<number | null>(load(KEYS.defaultAccountId, null))
let sidebarCollapsed = $state<boolean>(load(KEYS.sidebarCollapsed, false))

const fontScaleMap: Record<FontSize, string> = {
  standard: '100%',
  medium: '110%',
  large: '120%',
  'extra-large': '130%',
}

function applyTheme(t: Theme) {
  if (typeof document === 'undefined') return
  const el = document.documentElement
  el.classList.remove('light', 'dark')
  const applied = t === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : t
  el.classList.add(applied)
}

function applyFontSize(fs: FontSize) {
  if (typeof document === 'undefined') return
  document.documentElement.style.fontSize = fontScaleMap[fs]
}

$effect.root(() => {
  $effect(() => { save(KEYS.theme, theme); applyTheme(theme) })
  $effect(() => { save(KEYS.fontSize, fontSize); applyFontSize(fontSize) })
  $effect(() => { save(KEYS.pageSize, pageSize) })
  $effect(() => { save(KEYS.defaultAccountId, defaultAccountId) })
  $effect(() => { save(KEYS.sidebarCollapsed, sidebarCollapsed) })
})

function initBrowser() {
  if (typeof window === 'undefined') return
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (theme === 'system') applyTheme('system')
  })
  applyTheme(theme)
  applyFontSize(fontSize)
}
initBrowser()

export function usePreferences() {
  return {
    get theme() { return theme },
    set theme(v: Theme) { theme = v },
    get fontSize() { return fontSize },
    set fontSize(v: FontSize) { fontSize = v },
    get pageSize() { return pageSize },
    set pageSize(v: number) { pageSize = v },
    get defaultAccountId() { return defaultAccountId },
    set defaultAccountId(v: number | null) { defaultAccountId = v },
    get sidebarCollapsed() { return sidebarCollapsed },
    set sidebarCollapsed(v: boolean) { sidebarCollapsed = v },
  }
}
