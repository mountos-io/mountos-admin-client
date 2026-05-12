import type { Fork, Volume } from '@mountos-io/admin-sdk'

// Root fork name.
export const MAIN_FORK = 'main'

// Mirror of gcserv DefaultDataRetentionDays. Fallback when the volume has no
// plan-level retention set, so picker bounds match server-side cutoffs.
export const DEFAULT_RETENTION_DAYS = 30

// Picker values are authored in UTC. The HTML datetime-local control always
// uses the user's local zone for *display*, but for forensic browsing we
// label and treat the value as UTC so an SRE in any zone agrees on "what
// the volume looked like at T". Round-trip:
//   render: getUTCFullYear/getUTCHours into "YYYY-MM-DDTHH:MM"
//   parse:  parseDatetimeUTC(value) → ms (interpret as UTC)
export function toDatetimeUTC(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}

// Parse a "YYYY-MM-DDTHH:MM" picker value as UTC. Returns ms since epoch.
export function parseDatetimeUTC(value: string): number {
  if (!value) return NaN
  // Date.parse with a trailing 'Z' treats the bare date-time as UTC.
  return Date.parse(value.length === 16 ? `${value}:00Z` : `${value}Z`)
}

// Round up to the next whole minute so the value stays strictly within the
// server's bound (server compares at microsecond precision against exact
// retention timestamps).
export function ceilDatetimeUTC(d: Date): string {
  const ms = d.getTime()
  const rounded = ms % 60_000 === 0 ? ms : (Math.floor(ms / 60_000) + 1) * 60_000
  return toDatetimeUTC(new Date(rounded))
}

// gcThreshold = min(now - retention, min over all forks of snapshot_ts).
// Mirrors dataserv handleForksCreate + gcserv getEffectiveRetentionThreshold.
export function gcFloorMs(volume: Pick<Volume, 'retentionPeriod'> | null | undefined, forks: Fork[]): number {
  if (!volume) return 0
  const days = volume.retentionPeriod > 0 ? volume.retentionPeriod : DEFAULT_RETENTION_DAYS
  let floor = Date.now() - days * 86400_000
  for (const f of forks) {
    const snapMs = Math.floor(f.snapshotTs / 1000)
    if (snapMs < floor) floor = snapMs
  }
  return floor
}

// Parent/anchor fork snapshot floor: tightens the bound when reading from a
// fork whose own snapshotTs is more recent than the gc floor.
export function forkAnchorFloorMs(forks: Fork[], anchorName: string | undefined | null): number {
  if (!anchorName || anchorName === MAIN_FORK) return 0
  const anchor = forks.find(f => f.name === anchorName)
  return anchor ? Math.floor(anchor.snapshotTs / 1000) : 0
}

export function forkAsOfMin(
  volume: Pick<Volume, 'retentionPeriod'> | null | undefined,
  forks: Fork[],
  anchorName?: string | null,
): string {
  if (!volume) return ''
  return ceilDatetimeUTC(new Date(Math.max(gcFloorMs(volume, forks), forkAnchorFloorMs(forks, anchorName))))
}

// Upper bound is minute-floor(now): the current in-progress minute is
// disallowed, matching server-side minuteNow checks.
export function forkAsOfMax(now: number = Date.now()): string {
  return toDatetimeUTC(new Date(Math.floor(now / 60_000) * 60_000))
}
