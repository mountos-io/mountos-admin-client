import { request } from './client.svelte'

// Published release metadata, fetched from this dashboard's own server (server/releases.ts),
// which caches it. Used to mark a node or a service as behind the latest available version.
//
// Everything here degrades to "show nothing". An unreachable bucket, an air-gapped install
// (MOUNTOS_UPDATE_CHECK=off) or a unit missing from the index must never produce a false
// "up to date" claim, so callers get null and render no indicator at all.

export type Severity = 'critical' | 'recommended' | 'optional'

export interface ReleaseUnit {
  version: string
  platforms: Record<string, string>
  pkgs: string[]
  severity: Severity
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

interface ReleasesState {
  enabled: boolean
  index: ReleaseIndex | null
  fetchedAt: string | null
  error: string | null
}

// service_type as reported by a node -> the release unit that publishes it.
// dataserv and gcserv share one unit: they migrate the same database, so their versions
// are never allowed to drift apart.
const UNIT_BY_SERVICE: Record<string, string> = {
  dataserv: 'dbserv',
  gcserv: 'dbserv',
  appserv: 'appserv',
  blockserv: 'blockserv',
}

let enabled = $state(false)
let index = $state<ReleaseIndex | null>(null)
let fetchedAt = $state<string | null>(null)
let error = $state('')
let loading = $state(false)
let loaded = $state(false)

async function fetchReleases(): Promise<void> {
  if (loading) return
  loading = true
  try {
    const state = (await request('GET', '/api/releases')) as ReleasesState
    enabled = state.enabled
    index = state.index
    fetchedAt = state.fetchedAt
    error = state.error ?? ''
  } catch (e) {
    // The indicator is additive. Failing to fetch it must not surface as a page error.
    error = e instanceof Error ? e.message : String(e)
    index = null
  } finally {
    loading = false
    loaded = true
  }
}

/** Component-wise semver compare. Matches the server's ordering. */
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

export interface UpdateStatus {
  unit: string
  latest: string
  behind: boolean
  severity: Severity
  summary: string
  breaking: boolean
  requiresSchema?: string
  requiresProtocol?: string
  actionRequired?: string
}

/**
 * Update status for a running service version, or null when nothing is known.
 * Null means "render no indicator", never "up to date".
 */
export function updateStatusFor(serviceType: string, running: string | null | undefined): UpdateStatus | null {
  if (!enabled || !index || !running) return null
  const unit = UNIT_BY_SERVICE[serviceType]
  if (!unit) return null
  const info = index.units[unit]
  if (!info?.version) return null
  return {
    unit,
    latest: info.version,
    behind: semverLess(running, info.version),
    severity: info.severity,
    summary: info.summary,
    breaking: info.breaking,
    requiresSchema: info.requires_schema || undefined,
    requiresProtocol: info.requires_protocol || undefined,
    actionRequired: info.action_required || undefined,
  }
}

/** Update status for a mounted client, whose unit is the CLI on its own platform. */
export function clientUpdateStatusFor(osName: string | null | undefined, running: string | null | undefined): UpdateStatus | null {
  if (!enabled || !index || !running) return null
  const info = index.units['mountos-cli']
  if (!info) return null
  // The CLI versions per platform (each links a different set of mount backends), so the
  // platform's own number is the one to compare against.
  const goos = (osName ?? '').toLowerCase()
  const platform = goos === 'darwin' || goos === 'macos' ? 'darwin' : goos === 'windows' ? 'windows' : 'linux'
  const latest = info.platforms?.[platform] ?? info.version
  if (!latest) return null
  return {
    unit: 'mountos-cli',
    latest,
    behind: semverLess(running, latest),
    severity: info.severity,
    summary: info.summary,
    breaking: info.breaking,
    requiresSchema: info.requires_schema || undefined,
    requiresProtocol: info.requires_protocol || undefined,
    actionRequired: info.action_required || undefined,
  }
}

/** Tailwind classes for a severity, so every surface renders it identically. */
export function severityClass(severity: Severity): string {
  switch (severity) {
    case 'critical':
      return 'text-destructive'
    case 'recommended':
      return 'text-amber-600 dark:text-amber-500'
    default:
      return 'text-muted-foreground'
  }
}

export function severityLabel(severity: Severity): string {
  switch (severity) {
    case 'critical':
      return 'Critical update'
    case 'recommended':
      return 'Recommended update'
    default:
      return 'Update available'
  }
}

export function useReleases() {
  return {
    get enabled() { return enabled },
    get index() { return index },
    get fetchedAt() { return fetchedAt },
    get error() { return error },
    get loading() { return loading },
    get loaded() { return loaded },
    fetchReleases,
    updateStatusFor,
    clientUpdateStatusFor,
  }
}
