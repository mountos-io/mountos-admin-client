import type { Fork, Volume } from '@mountos-io/admin-sdk'

// Root fork name.
export const MAIN_FORK = 'main'

// Mirror of gcserv DefaultDataRetentionDays. Fallback when the volume has no
// plan-level retention set, so picker bounds match server-side cutoffs.
export const DEFAULT_RETENTION_DAYS = 30

// Picker values are authored in the operator's chosen display timezone.
// datetime-local strings are tz-naive, so we render via Intl using the
// chosen zone and parse via an iterative-offset trick (Intl has no inverse
// of formatToParts).

export function toDatetimeTz(d: Date, tz: string): string {
  if (!tz || tz === 'UTC') {
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
  }
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(d)
    const get = (t: string) => parts.find(p => p.type === t)?.value ?? '00'
    return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
  } catch {
    return toDatetimeTz(d, 'UTC')
  }
}

// Parse a "YYYY-MM-DDTHH:MM" picker value as a wall-clock time in `tz`.
// Returns ms since epoch (UTC), or NaN if `tz` is invalid or the wall clock
// is non-existent (DST spring-forward gap). Converges in ≤2 iterations for
// normal inputs; the third iteration acts as a convergence guard for the
// fall-back-hour duplicate (two instants render to the same wall clock —
// we pick the later one, matching the browser datetime-local behaviour).
export function parseDatetimeTz(value: string, tz: string): number {
  if (!value) return NaN
  if (!tz || tz === 'UTC') {
    return Date.parse(value.length === 16 ? `${value}:00Z` : `${value}Z`)
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2})?$/.exec(value)
  if (!m) return NaN
  const Y = +m[1]!, Mo = +m[2]! - 1, D = +m[3]!, h = +m[4]!, mn = +m[5]!
  const target = Date.UTC(Y, Mo, D, h, mn, 0)
  let guess = target
  let fmt: Intl.DateTimeFormat
  try {
    fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    })
  } catch {
    return NaN
  }
  const render = (ms: number): number | null => {
    const parts = fmt.formatToParts(new Date(ms))
    const get = (t: string) => {
      const v = parts.find(p => p.type === t)?.value
      return v ? +v : NaN
    }
    const Yr = get('year'), Mr = get('month'), Dr = get('day'), Hr = get('hour'), Min = get('minute')
    if (!Number.isFinite(Yr * Mr * Dr * Hr * Min)) return null
    // Intl returns hour 24 for midnight in some zones; normalise to next-day 00.
    const normH = Hr === 24 ? 0 : Hr
    const dayAdj = Hr === 24 ? 86_400_000 : 0
    return Date.UTC(Yr, Mr - 1, Dr, normH, Min, 0) + dayAdj
  }
  for (let i = 0; i < 3; i++) {
    const rendered = render(guess)
    if (rendered === null) return NaN
    const delta = target - rendered
    if (delta === 0) {
      // DST fall-back: the same wall clock maps to two UTC instants one
      // hour apart (e.g. 01:30 PDT = 08:30 UTC vs 01:30 PST = 09:30 UTC).
      // Match the browser's datetime-local convention and prefer the later
      // (standard-time) instant — probe +1 h.
      const later = guess + 3_600_000
      if (render(later) === rendered) return later
      return guess
    }
    guess += delta
  }
  // Did not converge — DST spring-forward gap. Caller should fall back to a
  // valid bound (e.g. the input's `max`) rather than acting on a wrong ms.
  return NaN
}

// Always advance to the next whole minute so the rendered min lies strictly
// inside the server's window (server compares against exact retention
// timestamps at microsecond precision; an on-the-minute equality would land
// on the boundary).
export function ceilDatetimeTz(d: Date, tz: string): string {
  const ms = d.getTime()
  return toDatetimeTz(new Date((Math.floor(ms / 60_000) + 1) * 60_000), tz)
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
  anchorName: string | null | undefined,
  tz: string,
): string {
  if (!volume) return ''
  return ceilDatetimeTz(new Date(Math.max(gcFloorMs(volume, forks), forkAnchorFloorMs(forks, anchorName))), tz)
}

// Upper bound is minute-floor(now): the current in-progress minute is
// disallowed, matching server-side minuteNow checks.
export function forkAsOfMax(tz: string, now: number = Date.now()): string {
  return toDatetimeTz(new Date(Math.floor(now / 60_000) * 60_000), tz)
}
