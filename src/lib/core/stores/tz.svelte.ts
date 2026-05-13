// Time-zone preference: browser default, persisted in localStorage, swappable
// at runtime. Date displays (modified column, snapshot chip, time picker echo)
// read .value reactively so a change propagates everywhere without prop drilling.

const STORAGE_KEY = 'mountos.tz'
const SENTINEL_LOCAL = 'local'
const SENTINEL_UTC = 'UTC'

function browserTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || SENTINEL_UTC
  } catch {
    return SENTINEL_UTC
  }
}

function read(): string {
  if (typeof localStorage === 'undefined') return browserTz()
  const v = localStorage.getItem(STORAGE_KEY)
  if (!v || v === SENTINEL_LOCAL) return browserTz()
  return v
}

// abbr() runs at module evaluation and after every `.set` — memoised so
// consumer reads (TreeContextChip, TreeFilePanel, listbox triggers) don't
// reconstruct an Intl.DateTimeFormat on every render.
function abbr(tz: string, now: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en', { timeZone: tz, timeZoneName: 'short' }).formatToParts(now)
    return parts.find(p => p.type === 'timeZoneName')?.value ?? tz
  } catch {
    return tz
  }
}

let _value = $state(read())
let _label = $state(abbr(_value))
let _local = $state(browserTz())

export const tz = {
  get value() { return _value },
  get isLocal() { return _value === _local },
  get isUtc() { return _value === SENTINEL_UTC },
  get label() { return _label },
  get localTz() { return _local },
  set(next: string) {
    const local = browserTz()
    _value = next || local
    _label = abbr(_value)
    _local = local
    if (typeof localStorage !== 'undefined') {
      if (_value === local) localStorage.removeItem(STORAGE_KEY)
      else localStorage.setItem(STORAGE_KEY, _value)
    }
  },
  reset() { this.set(browserTz()) },
}

// Full IANA list when the runtime supports it (Chrome/Edge 99+, Safari 15.4+,
// Firefox 93+); falls back to a small curated set on older engines. The
// picker exposes a text filter on top so even ~400 entries stay usable.
export const ALL_TZ: string[] = (() => {
  try {
    const fn = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf
    if (typeof fn === 'function') {
      const zones = fn('timeZone')
      if (Array.isArray(zones) && zones.length > 0) return zones
    }
  } catch { /* ignore */ }
  return [
    'UTC', 'America/Los_Angeles', 'America/Denver', 'America/Chicago',
    'America/New_York', 'America/Sao_Paulo', 'Europe/London', 'Europe/Paris',
    'Europe/Berlin', 'Africa/Cairo', 'Asia/Dubai', 'Asia/Kolkata',
    'Asia/Shanghai', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney',
    'Pacific/Auckland',
  ]
})()
