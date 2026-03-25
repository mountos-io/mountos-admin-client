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
  let i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1)
  let val = parseFloat((bytes / Math.pow(k, i)).toFixed(1))
  if (val >= k && i < sizes.length - 1) { val = parseFloat((val / k).toFixed(1)); i++ }
  return `${val} ${sizes[i]}`
}

export function formatQuota(used: number, limit: number): string {
  if (limit === 0) return 'Unlimited'
  return `${formatBytes(used)} / ${formatBytes(limit)}`
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

const CLIENT_TYPE_NAMES: Record<string, string> = {
  'fuse': 'FUSE (Linux)',
  'macfuse': 'macFUSE',
  'winfsp': 'WinFSP',
  'fskit': 'FSKit (macOS)',
  'nfs': 'NFS (macOS)',
  'cfapi': 'CloudFilter (Windows)',
  'csi-driver': 'CSI Driver (K8s)',
  'fuse+iouring': 'FUSE io_uring (Linux)',
  'fp': 'File Provider (macOS)',
}

export function formatClientType(raw: string): string {
  return CLIENT_TYPE_NAMES[raw] ?? raw
}

export function formatDuration(from: string | number | Date, to?: string | number | Date): string {
  const start = parseDate(from)
  const end = to ? parseDate(to) : new Date()
  const ms = end.getTime() - start.getTime()
  if (!Number.isFinite(ms) || ms < 60_000) return '< 1m'
  const mins = Math.floor(ms / 60_000)
  const hours = Math.floor(mins / 60)
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}d ${hours % 24}h`
  if (hours > 0) return `${hours}h ${mins % 60}m`
  return `${mins}m`
}

type StatusVariant = 'success' | 'secondary' | 'warning' | 'destructive' | 'outline'

const SESSION_STATUS_MAP: Record<string, { label: string; variant: StatusVariant }> = {
  connected: { label: 'Connected', variant: 'success' },
  active: { label: 'Active', variant: 'success' },
  unhealthy: { label: 'Unhealthy', variant: 'destructive' },
  disconnected: { label: 'Disconnected', variant: 'secondary' },
  idle: { label: 'Idle', variant: 'warning' },
  error: { label: 'Error', variant: 'destructive' },
}

export function formatSessionStatus(status: string): { label: string; variant: StatusVariant } {
  return SESSION_STATUS_MAP[status] ?? { label: status, variant: 'outline' }
}

const NODE_STATUS_MAP: Record<string, StatusVariant> = {
  healthy: 'success',
  registered: 'secondary',
  unhealthy: 'destructive',
  draining: 'warning',
}

export function nodeStatusVariant(status: string): StatusVariant {
  return NODE_STATUS_MAP[status] ?? 'secondary'
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

const PLATFORM_LABELS: Record<string, string> = {
  macfuse: 'macFUSE', nfs: 'NFS', fuse: 'FUSE', fskit: 'FSKit',
  winfsp: 'WinFSP', 'fuse+iouring': 'FUSE io_uring', 'csi-driver': 'CSI Driver',
  cfapi: 'CloudFilter', fp: 'File Provider',
}

export function formatPlatform(raw: string): string {
  return PLATFORM_LABELS[raw] ?? raw
}

const OS_LABELS: Record<string, string> = { darwin: 'macOS', linux: 'Linux', windows: 'Win' }

export function formatOs(raw: string): string {
  return OS_LABELS[raw] ?? raw
}

export function formatUptime(seconds: number): string {
  if (!seconds) return '—'
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
  if (!Number.isFinite(us) || us <= 0) return '—'
  if (us < 1) return '< 1 μs'
  if (us < 1000) return `${Math.round(us)} μs`
  if (us < 1_000_000) return `${(us / 1000).toFixed(1)} ms`
  return `${(us / 1_000_000).toFixed(2)} s`
}
