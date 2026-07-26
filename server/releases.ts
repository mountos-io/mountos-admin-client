// Release-metadata fetcher for the update indicator.
//
// mountOS publishes a static release index to the distribution bucket after every
// release (mountos-servers: scripts/distribution/publish-release-meta.sh). This module
// fetches it here, on the dashboard's own server, rather than from the browser:
//
//   - no CORS requirement on the bucket
//   - one fetch per deployment, not one per open tab
//   - a single place to disable it for air-gapped installs
//
// No mountOS *service* fetches this. That is deliberate: nothing phones home, and the
// request carries no identity.

const DIST_URL = (process.env.MOUNTOS_DIST_URL ?? 'https://mountos.sh/install').replace(/\/+$/, '')
const ENABLED = (process.env.MOUNTOS_UPDATE_CHECK ?? '').toLowerCase() !== 'off'

// Long enough that a busy dashboard does not hammer the bucket, short enough that an
// operator who just released does not wait a day to see it.
const REFRESH_MS = 6 * 60 * 60 * 1000
// A failed fetch must not turn into a retry storm; serve the stale copy meanwhile.
const RETRY_MS = 10 * 60 * 1000

export interface ReleaseUnit {
  version: string
  platforms: Record<string, string>
  pkgs: string[]
  severity: 'critical' | 'recommended' | 'optional'
  categories: string[]
  breaking: boolean
  requires_schema?: string
  requires_protocol?: string
  action_required?: string
  summary: string
  changelog: string
}

export interface ReleaseIndex {
  generated_at: string
  suite: string
  schema_version: string
  protocol_version: string
  units: Record<string, ReleaseUnit>
}

export interface ReleasesState {
  /** false when MOUNTOS_UPDATE_CHECK=off, so the UI can hide the indicator entirely. */
  enabled: boolean
  index: ReleaseIndex | null
  /** When the cached copy was fetched. Null while nothing has ever been fetched. */
  fetchedAt: string | null
  /** Last failure, surfaced so a silently-stale dashboard is distinguishable from a fresh one. */
  error: string | null
}

let cache: ReleaseIndex | null = null
let fetchedAt: number | null = null
let lastError: string | null = null
let inFlight: Promise<void> | null = null

function seriesUrl(): string {
  // The index is published per major series. Without a cached copy there is nothing to
  // derive the major from, so v1 is the bootstrap guess; once fetched, the suite version
  // in the document itself decides.
  const major = cache?.suite?.split('.')[0] ?? '1'
  return `${DIST_URL}/dist/releases/v${major}/index.json`
}

async function refresh(): Promise<void> {
  try {
    const res = await fetch(seriesUrl(), {
      signal: AbortSignal.timeout(15_000),
      headers: { accept: 'application/json' },
    })
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)

    const body = (await res.json()) as ReleaseIndex
    if (!body || typeof body !== 'object' || !body.units) {
      throw new Error('release index is missing a units map')
    }
    cache = body
    fetchedAt = Date.now()
    lastError = null
  } catch (err) {
    // Keep serving the previous copy. A bucket hiccup should degrade the indicator's
    // freshness, never the dashboard.
    lastError = err instanceof Error ? err.message : String(err)
  }
}

/**
 * Returns the cached release index, refreshing in the background when it is stale.
 * Never throws and never blocks on the network beyond the first call.
 */
export async function getReleases(): Promise<ReleasesState> {
  if (!ENABLED) {
    return { enabled: false, index: null, fetchedAt: null, error: null }
  }

  const age = fetchedAt === null ? Infinity : Date.now() - fetchedAt
  const due = cache === null ? age > RETRY_MS : age > REFRESH_MS

  if (due && !inFlight) {
    inFlight = refresh().finally(() => {
      inFlight = null
    })
    // Block only when there is nothing to serve yet; afterwards refresh in the
    // background and answer from cache (stale-while-revalidate).
    if (cache === null) await inFlight
  }

  return {
    enabled: true,
    index: cache,
    fetchedAt: fetchedAt === null ? null : new Date(fetchedAt).toISOString(),
    error: lastError,
  }
}

/**
 * Compares a running version against the latest for its unit.
 * Returns null when nothing is known, so callers render no indicator rather than a
 * misleading "up to date".
 */
export function compareToLatest(
  index: ReleaseIndex | null,
  unit: string,
  running: string,
  platform?: string,
): { latest: string; behind: boolean; unitInfo: ReleaseUnit } | null {
  const unitInfo = index?.units?.[unit]
  if (!unitInfo) return null
  // A unit can version per platform (the CLI does), so prefer the platform's own number.
  const latest = (platform && unitInfo.platforms?.[platform]) || unitInfo.version
  if (!latest) return null
  return { latest, behind: semverLess(running, latest), unitInfo }
}

/** Component-wise semver compare. Matches relver's ordering in mountos-servers. */
export function semverLess(a: string, b: string): boolean {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    const x = pa[i] ?? 0
    const y = pb[i] ?? 0
    if (x !== y) return x < y
  }
  return false
}
