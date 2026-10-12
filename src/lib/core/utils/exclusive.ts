import { ApiError } from '../api/errors'
import type { ExclusiveGrant, MountFlag } from '../api/types'

export type LoadFailure = 'forbidden' | 'not-found' | 'error'

// Maps a failed admin read to the state the panels render. 403 means the role
// may not read the data, 404 means the server holds nothing for the id.
export function classifyFailure(e: unknown): LoadFailure {
  if (e instanceof ApiError) {
    if (e.status === 403) return 'forbidden'
    if (e.status === 404) return 'not-found'
  }
  return 'error'
}

export function sortFlags(flags: MountFlag[] | undefined): MountFlag[] {
  return [...(flags ?? [])].sort((a, b) => a.name.localeCompare(b.name) || a.value.localeCompare(b.value))
}

// Quotes a word for display as a shell command line.
function quoteWord(w: string): string {
  return /^[A-Za-z0-9_@%+=:,./-]+$/.test(w) ? w : `'${w.replace(/'/g, `'\\''`)}'`
}

export function flagToken(f: MountFlag): string {
  const name = f.name.length === 1 ? `-${f.name}` : `--${f.name}`
  return f.value === '' || f.value === 'true' ? name : `${name}=${quoteWord(f.value)}`
}

// Rebuilds a readable command line from the stored report. The server keeps
// no raw argv, so flag order is sorted and short flags show their stored name.
export function commandLine(m: { command?: string; args?: string[]; flags?: MountFlag[]; mountOptions?: string[] }): string {
  const parts = ['mountos']
  if (m.command) parts.push(m.command)
  for (const f of sortFlags(m.flags)) parts.push(flagToken(f))
  if (m.mountOptions?.length) parts.push('-o', quoteWord(m.mountOptions.join(',')))
  for (const a of m.args ?? []) parts.push(quoteWord(a))
  return parts.join(' ')
}

export function flagsAsText(flags: MountFlag[] | undefined): string {
  return sortFlags(flags).map((f) => `${f.name}=${f.value}`).join('\n')
}

export function hasReportContent(m: { command?: string; args?: string[]; flags?: MountFlag[]; mountOptions?: string[]; mountPoint?: string } | null | undefined): boolean {
  if (!m) return false
  return !!(m.command || m.mountPoint || m.args?.length || m.flags?.length || m.mountOptions?.length)
}

// A missing clock means the owner did not report it. It never means dead.
export function formatClockMs(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return 'unknown'
  if (ms < 1000) return `${Math.round(ms)} ms`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(s < 10 ? 1 : 0)} s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} min ${Math.floor(s % 60)} s`
  return `${Math.floor(m / 60)} h ${m % 60} min`
}

export function liveLabel(live: boolean | null | undefined): string {
  if (live == null) return 'unknown'
  return live ? 'live' : 'not live'
}

export function grantStateVariant(state: string): 'success' | 'warning' | 'destructive' | 'secondary' {
  switch (state) {
    case 'active': return 'success'
    case 'lapsed': return 'warning'
    case 'fenced': return 'destructive'
    default: return 'secondary'
  }
}

export function grantRoleLabel(g: Pick<ExclusiveGrant, 'role' | 'standbyPosition'>): string {
  return g.role === 'standby' ? `standby #${g.standbyPosition}` : 'primary'
}

export function scopeLabel(g: Pick<ExclusiveGrant, 'path' | 'kind'>): string {
  return `${g.path || '/'} (${g.kind})`
}

export interface MountIdentity {
  ipAddr?: string
  hostname?: string
  friendlyName?: string
}

// The session record holds no data-plane session id, so a mount is matched to
// its grants by holder IP and holder name. An empty grant field matches any
// mount. A grant on a NAT'd address can miss. When the mount report carries an
// exclusive path flag, only grants on that path are kept.
export function grantsForMount(grants: ExclusiveGrant[], mount: MountIdentity, exclusivePath?: string): ExclusiveGrant[] {
  const names = new Set([mount.hostname, mount.friendlyName].filter((n): n is string => !!n))
  const matched = grants.filter((g) => {
    if (g.holderIp && mount.ipAddr && g.holderIp !== mount.ipAddr) return false
    if (g.sessionName && names.size > 0 && !names.has(g.sessionName)) return false
    return true
  })
  if (!exclusivePath) return matched
  const want = normalizePath(exclusivePath)
  const onPath = matched.filter((g) => normalizePath(g.path) === want)
  return onPath.length > 0 ? onPath : matched
}

function normalizePath(p: string): string {
  const t = p.replace(/\/+$/, '')
  return t.startsWith('/') ? t : `/${t}`
}

export function exclusivePathFromFlags(flags: MountFlag[] | undefined): string | undefined {
  return flags?.find((f) => f.name === 'exclusive')?.value || undefined
}
