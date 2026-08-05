const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
const dtf = new Intl.DateTimeFormat('en', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31536000000],
  ['month', 2592000000],
  ['week', 604800000],
  ['day', 86400000],
  ['hour', 3600000],
  ['minute', 60000],
  ['second', 1000],
]

export function parseDate(date: string | number | Date): Date {
  if (date instanceof Date) return date
  if (typeof date === 'number') return new Date(date * 1000)
  if (/^\d+$/.test(date)) return new Date(Number(date) * 1000)
  // No timezone suffix → treat as UTC
  if (!/Z$|[+-]\d{2}:?\d{2}$/.test(date))
    return new Date(date.replace(' ', 'T') + 'Z')
  return new Date(date)
}

export function formatDate(date: string | number | Date): string {
  return dtf.format(parseDate(date))
}

// Operator-readable UTC stamp: "2026-05-12 01:14 UTC". Forensic surfaces
// must show this as the primary string (relative time is the secondary
// scanning aid) so incident-time comparisons don't require math.
export function formatUTCShort(date: string | number | Date): string {
  const d = parseDate(date)
  if (!Number.isFinite(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`
}

// Second-precision variant for surfaces that need to distinguish writes
// within the same minute (e.g. file version histories).
export function formatUTCFull(date: string | number | Date): string {
  const d = parseDate(date)
  if (!Number.isFinite(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`
}

// Render `date` in IANA `tz` as "2026-05-13 15:16 IST". The abbreviation is
// derived from Intl so it matches the user's chosen zone, including DST.
// Falls back to formatUTCShort when tz="UTC" to keep the canonical label.
export function formatTzShort(date: string | number | Date, tz: string): string {
  if (!tz || tz === 'UTC') return formatUTCShort(date)
  const d = parseDate(date)
  if (!Number.isFinite(d.getTime())) return ''
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
      timeZoneName: 'short',
    }).formatToParts(d)
    const get = (t: string) => parts.find(p => p.type === t)?.value ?? ''
    const tag = get('timeZoneName') || tz
    return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')} ${tag}`
  } catch {
    return formatUTCShort(date)
  }
}

// Second-precision tz-aware variant for version history surfaces that need
// to distinguish writes within the same minute.
export function formatTzFull(date: string | number | Date, tz: string): string {
  if (!tz || tz === 'UTC') return formatUTCFull(date)
  const d = parseDate(date)
  if (!Number.isFinite(d.getTime())) return ''
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
      timeZoneName: 'short',
    }).formatToParts(d)
    const get = (t: string) => parts.find(p => p.type === t)?.value ?? ''
    const tag = get('timeZoneName') || tz
    return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')} ${tag}`
  } catch {
    return formatUTCFull(date)
  }
}

export function formatRelative(date: string | number | Date): string {
  const d = parseDate(date)
  const diff = d.getTime() - Date.now()
  for (const [unit, ms] of UNITS) {
    if (Math.abs(diff) >= ms) {
      return rtf.format(Math.round(diff / ms), unit)
    }
  }
  return 'just now'
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes === 0) return '0 B'
  if (bytes < 0) bytes = -bytes
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  let i = Math.min(Math.max(Math.floor(Math.log(bytes) / Math.log(k)), 0), sizes.length - 1)
  let val = parseFloat((bytes / Math.pow(k, i)).toFixed(1))
  if (val >= k && i < sizes.length - 1) { val = parseFloat((val / k).toFixed(1)); i++ }
  return `${val} ${sizes[i]}`
}

// Decimal (1000-base) bit rate, matching how network/stream throughput is
// conventionally reported (bps/Kbps/Mbps), distinct from formatBytes' binary
// (1024-base) byte units.
export function formatBitrate(bitsPerSec: number): string {
  if (!Number.isFinite(bitsPerSec) || bitsPerSec === 0) return '0 bps'
  const k = 1000
  const units = ['bps', 'Kbps', 'Mbps', 'Gbps', 'Tbps']
  const sign = bitsPerSec < 0 ? -1 : 1
  let mag = Math.abs(bitsPerSec)
  let i = 0
  while (mag >= k && i < units.length - 1) {
    mag /= k
    i++
  }
  let val = parseFloat(mag.toFixed(1))
  if (val >= k && i < units.length - 1) { val = parseFloat((val / k).toFixed(1)); i++ }
  return `${sign * val} ${units[i]}`
}

export function formatQuota(used: number, limit: number): string {
  if (limit === 0) return 'Unlimited'
  return `${formatBytes(used)} / ${formatBytes(limit)}`
}

// Inverse of the server's packed version number: x*1_000_000 + y*1_000 + z -> "x.y.z".
export function formatBinaryVersion(n: number): string {
  return `${Math.floor(n / 1_000_000)}.${Math.floor(n / 1_000) % 1_000}.${n % 1_000}`
}

const GB = 1024 ** 3

export function gbToBytes(gb: number): number {
  return Math.round(Math.max(0, gb) * GB)
}

export function bytesToGb(bytes: number): number {
  return parseFloat((bytes / GB).toFixed(2))
}

export function quotaPercent(used: number, limit: number): number {
  if (limit === 0) return 0
  return Math.min(100, Math.round((used / limit) * 100))
}

// Inbound labels for values already written into client_sessions rows, so
// retired clients keep rendering a friendly name in historical sessions.
// "mountos" is what the shipped client binary stamps today.
const CLIENT_TYPE_NAMES: Record<string, string> = {
  'mountos': 'mountOS Client',
  'fuse': 'FUSE (Linux)',
  'macfuse': 'macFUSE',
  'mountosio': 'mountOSIO (Windows)',
  'cloudfilter': 'CloudFilter (Windows, retired)',
  'fskit': 'FSKit (macOS)',
  'nfs': 'NFS (macOS)',
  'cfapi': 'CloudFilter (Windows, retired)',
  'fuse+iouring': 'FUSE io_uring (Linux)',
  'fp': 'File Provider (macOS, retired)',
  'hdfs-sdk': 'HDFS SDK',
}

export function formatClientType(raw: string): string {
  return CLIENT_TYPE_NAMES[raw] ?? raw
}

// mountMode vocabulary sent by every client (Go, Swift, HDFS SDK).
// "rw" for read-write, "r" alone or comma-joined with a view suffix
// ("r,ver", "r,del", "r,snap") for every read-only variant. "rw" itself
// starts with "r" too, so this can't be a plain prefix check.
export function isReadOnlyMountMode(mode: string): boolean {
  return mode === 'r' || mode.startsWith('r,')
}

export function formatDuration(from: string | number | Date, to?: string | number | Date): string {
  const start = parseDate(from)
  const end = to ? parseDate(to) : new Date()
  const ms = end.getTime() - start.getTime()
  if (!Number.isFinite(ms) || ms < 0) return '·'
  // Surface sub-minute lifetimes literally: short-lived sessions (mount/unmount
  // within the heartbeat interval) are exactly what operators want to spot.
  if (ms < 1000) return '< 1s'
  const secs = Math.floor(ms / 1000)
  if (secs < 60) return `${secs}s`
  const mins = Math.floor(secs / 60)
  const hours = Math.floor(mins / 60)
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}d ${hours % 24}h`
  if (hours > 0) return `${hours}h ${mins % 60}m`
  return `${mins}m ${secs % 60}s`
}

type StatusVariant = 'success' | 'primary' | 'secondary' | 'warning' | 'destructive' | 'outline'

const SESSION_STATUS_MAP: Record<string, { label: string; variant: StatusVariant }> = {
  connected: { label: 'Connected', variant: 'success' },
  active: { label: 'Active', variant: 'success' },
  degraded: { label: 'Degraded', variant: 'destructive' },
  disconnected: { label: 'Disconnected', variant: 'primary' },
  // expired: dead-sweep gave up after 15m of silence with no explicit
  // disconnect. Terminal state, no longer recoverable; calm rather than
  // alarming like the live degraded state.
  expired: { label: 'Expired', variant: 'primary' },
  idle: { label: 'Idle', variant: 'warning' },
  error: { label: 'Error', variant: 'destructive' },
}

export function formatSessionStatus(status: string): { label: string; variant: StatusVariant } {
  return SESSION_STATUS_MAP[status] ?? { label: status, variant: 'outline' }
}

const NODE_STATUS_MAP: Record<string, StatusVariant> = {
  healthy: 'success',
  registered: 'primary',
  unhealthy: 'destructive',
  draining: 'warning',
}

export function nodeStatusVariant(status: string): StatusVariant {
  return NODE_STATUS_MAP[status] ?? 'primary'
}

// Sink runner states (metadata.sink.state on a sink client session): running
// is healthy, paused/draining are operator-initiated holds, halted is a stop
// needing attention.
const SINK_STATE_MAP: Record<string, StatusVariant> = {
  running: 'success',
  paused: 'warning',
  draining: 'warning',
  halted: 'destructive',
}

export function sinkStateVariant(state: string): StatusVariant {
  return SINK_STATE_MAP[state] ?? 'primary'
}

export interface PrometheusMetric {
  name: string
  labels: Record<string, string>
  value: number
}

export function parsePrometheusText(text: string): Map<string, PrometheusMetric[]> {
  const sections = new Map<string, PrometheusMetric[]>()
  let section = 'general'
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (trimmed.startsWith('# HELP')) {
      section = trimmed.slice(7).split(' ')[0] ?? 'general'
      continue
    }
    if (trimmed.startsWith('# TYPE')) continue
    if (trimmed.startsWith('#')) {
      section = trimmed.slice(2).trim() || 'general'
      continue
    }
    const match = trimmed.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)\{?(.*?)\}?\s+([\d.eE+\-NnIi]+)$/)
    if (!match) continue
    const [, name, rawLabels, rawVal] = match
    const labels: Record<string, string> = {}
    if (rawLabels) {
      for (const pair of rawLabels.match(/(\w+)="([^"]*)"/g) ?? []) {
        const eq = pair.indexOf('=')
        labels[pair.slice(0, eq)] = pair.slice(eq + 2, -1)
      }
    }
    const list = sections.get(section) ?? []
    list.push({ name: name!, labels, value: parseFloat(rawVal!) })
    sections.set(section, list)
  }
  return sections
}

// Same historical-value rule as CLIENT_TYPE_NAMES. Retired platforms stay
// mapped so old sessions render a name instead of a raw token.
const PLATFORM_LABELS: Record<string, string> = {
  macfuse: 'macFUSE', nfs: 'NFS', fuse: 'FUSE', fskit: 'FSKit',
  mountosio: 'mountOSIO', 'fuse+iouring': 'FUSE io_uring',
  cloudfilter: 'CloudFilter (retired)', cfapi: 'CloudFilter (retired)',
  fp: 'File Provider (retired)', hdfs: 'HDFS',
}

export function formatPlatform(raw: string): string {
  return PLATFORM_LABELS[raw] ?? raw
}

const OS_LABELS: Record<string, string> = { darwin: 'macOS', linux: 'Linux', windows: 'Win' }

export function formatOs(raw: string): string {
  return OS_LABELS[raw] ?? raw
}

export function formatUptime(seconds: number): string {
  if (!seconds) return '·'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 24) return `${Math.floor(h / 24)}d ${h % 24}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export function formatNum(n: number): string {
  return n.toLocaleString()
}

export function formatLatency(us: number): string {
  if (!Number.isFinite(us) || us <= 0) return '·'
  if (us < 1) return '< 1 μs'
  if (us < 1000) return `${Math.round(us)} μs`
  if (us < 1_000_000) return `${(us / 1000).toFixed(1)} ms`
  return `${(us / 1_000_000).toFixed(2)} s`
}
