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

function parseDate(date: string | number | Date): Date {
  if (date instanceof Date) return date
  if (typeof date === 'number') return new Date(date * 1000)
  // Postgres timestamps lack timezone — treat as UTC
  if (!date.includes('T') && !date.includes('Z') && !date.includes('+'))
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
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1)
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export function formatQuota(used: number, limit: number): string {
  if (limit === 0) return 'Unlimited'
  return `${formatBytes(used)} / ${formatBytes(limit)}`
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
