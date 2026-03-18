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

export function formatDate(date: string | Date): string {
  return dtf.format(typeof date === 'string' ? new Date(date) : date)
}

export function formatRelative(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
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
  'cfapi': 'CloudFilter (Windows)',
  'csi-driver': 'CSI Driver (K8s)',
  'fuse+iouring': 'FUSE io_uring (Linux)',
  'file provider (FP)': 'File Provider (macOS)',
}

export function formatClientType(raw: string): string {
  return CLIENT_TYPE_NAMES[raw] ?? raw
}

export function formatDuration(from: string | Date, to?: string | Date): string {
  const start = typeof from === 'string' ? new Date(from) : from
  const end = to ? (typeof to === 'string' ? new Date(to) : to) : new Date()
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
  active: 'default' as StatusVariant,
  draining: 'warning',
  inactive: 'secondary',
}

export function nodeStatusVariant(status: string): StatusVariant {
  return NODE_STATUS_MAP[status] ?? 'secondary'
}
