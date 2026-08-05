// Generalized Prometheus metrics parser and formatting utilities
// Used by HUB (appserv) metrics visualization, extensible for other service types

import { formatBytes } from './format'

export interface ScalarEntry { name: string; value: number | string }
export interface MetricRecord { label: string; fields: Record<string, number | string> }
export interface HistBucket { le: string; leUs: number; count: number }
export interface HistogramGroup {
  label: string
  total: number
  durationSec: number
  avgLatencyUs: number
  stddevUs: number
  minUs: number
  maxUs: number
  count: number
  sumSec: number
  rollbacks: number
  buckets: HistBucket[]
}
export interface MetricSection {
  name: string
  kind: 'scalar' | 'histogram' | 'record'
  scalars: ScalarEntry[]
  groups: HistogramGroup[]
  records: MetricRecord[]
  recordFields: string[]
}

// Known field suffixes for the per-entity KV-record shape (mirrors
// internal/jobs/workers/goal_metrics.go's AppendGoalStatsFormat field list:
// goal_<name>_runs, goal_<name>_errors, etc). A scalar section renders as a
// 'record' table (one row per entity, one column per field) instead of a
// flat list when every key decomposes into <entity>_<suffix> for one of
// these suffixes, across at least 2 distinct entities. Checked longest-first
// so a shared trailing token (e.g. "_us" inside "last_duration_us") can't
// short-match before the real suffix.
const RECORD_SUFFIXES = [
  'last_duration_us', 'last_run_unix', 'lease_acquired', 'need_more',
  'last_error', 'errors', 'skips', 'runs',
].sort((a, b) => b.length - a.length)

// detectRecords returns null (caller keeps the flat scalar list) unless
// EVERY key in the section matches the shape, so a section with any
// unexpected field never silently drops data into a partial table.
function detectRecords(scalars: ScalarEntry[]): { records: MetricRecord[]; fields: string[] } | null {
  if (scalars.length < 2) return null
  const byEntity = new Map<string, Record<string, number | string>>()
  const fieldOrder: string[] = []
  for (const { name, value } of scalars) {
    const suffix = RECORD_SUFFIXES.find(s => name.endsWith('_' + s))
    if (!suffix) return null
    const entity = name.slice(0, -(suffix.length + 1))
    if (!entity) return null
    if (!byEntity.has(entity)) byEntity.set(entity, {})
    byEntity.get(entity)![suffix] = value
    if (!fieldOrder.includes(suffix)) fieldOrder.push(suffix)
  }
  if (byEntity.size < 2) return null

  // Strip the longest common leading token (e.g. "goal_") shared by every
  // entity so labels read as "blob defect orphan", not "goal blob defect
  // orphan". This is structural, not tied to today's specific section/prefix.
  const entities = [...byEntity.keys()]
  let commonPrefix = entities[0]!
  for (const e of entities.slice(1)) {
    let i = 0
    while (i < commonPrefix.length && i < e.length && commonPrefix[i] === e[i]) i++
    commonPrefix = commonPrefix.slice(0, i)
  }
  const cut = commonPrefix.lastIndexOf('_')
  const stripLen = cut >= 0 ? cut + 1 : 0

  const records = entities.map(e => ({
    label: (stripLen > 0 ? e.slice(stripLen) : e).replaceAll('_', ' '),
    fields: byEntity.get(e)!,
  }))
  return { records, fields: fieldOrder }
}

function parseLeValue(le: string): number {
  if (le === '+Inf') return Infinity
  const m = le.match(/^([\d.]+)(us|ms|s)?$/)
  if (!m) return parseFloat(le)
  const v = parseFloat(m[1])
  if (m[2] === 'us') return v
  if (m[2] === 'ms') return v * 1000
  if (m[2] === 's') return v * 1_000_000
  return v
}

export function parseMetrics(text: string): MetricSection[] {
  const result: MetricSection[] = []
  let current = 'Overview'
  const sectionMap = new Map<string, string[]>()
  sectionMap.set(current, [])

  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    if (line.startsWith('#')) {
      current = line.slice(2).trim() || 'Overview'
      if (!sectionMap.has(current)) sectionMap.set(current, [])
      continue
    }
    sectionMap.get(current)!.push(line)
  }

  for (const [name, lines] of sectionMap) {
    if (!lines.length) {
      result.push({ name, kind: 'histogram', scalars: [], groups: [], records: [], recordFields: [] })
      continue
    }
    const hasLabels = lines.some(l => l.includes('{'))

    if (!hasLabels) {
      const scalars: ScalarEntry[] = []
      for (const l of lines) {
        const m = l.match(/^(\S+)\s+(.+)$/)
        if (!m) continue
        const raw = m[2]
        const n = Number(raw)
        scalars.push({ name: m[1], value: isNaN(n) ? raw : n })
      }
      const rec = detectRecords(scalars)
      if (rec) {
        result.push({ name, kind: 'record', scalars: [], groups: [], records: rec.records, recordFields: rec.fields })
      } else {
        result.push({ name, kind: 'scalar', scalars, groups: [], records: [], recordFields: [] })
      }
    } else {
      const gmap = new Map<string, { metrics: Map<string, number>; buckets: HistBucket[] }>()

      for (const l of lines) {
        const m = l.match(/^([a-zA-Z_:]\w*)\{(.*?)\}\s+([\d.eE+\-]+)$/)
        if (!m) continue
        const [, metricName, rawLabels, rawVal] = m
        const value = parseFloat(rawVal!)
        const labels: Record<string, string> = {}
        for (const pair of rawLabels!.match(/(\w+)="([^"]*)"/g) ?? []) {
          const eq = pair.indexOf('=')
          labels[pair.slice(0, eq)] = pair.slice(eq + 2, -1)
        }
        const pk = Object.keys(labels).find(k => k !== 'le')
        const pv = pk ? labels[pk] : metricName!.replace(/_bucket$/, '')

        if (!gmap.has(pv)) gmap.set(pv, { metrics: new Map(), buckets: [] })
        const g = gmap.get(pv)!

        if (metricName!.includes('_bucket') && labels.le != null) {
          g.buckets.push({ le: labels.le, leUs: parseLeValue(labels.le), count: value })
        } else {
          const suffixes = ['total', 'duration_seconds', 'avg_latency_us', 'stddev_us', 'histogram_min_us', 'histogram_max_us', 'histogram_count', 'histogram_sum_seconds', 'rollbacks']
          let key = metricName!
          for (const s of suffixes) {
            if (metricName!.endsWith('_' + s)) { key = s; break }
          }
          g.metrics.set(key, value)
        }
      }

      const groups: HistogramGroup[] = []
      for (const [label, { metrics, buckets }] of gmap) {
        groups.push({
          label,
          total: metrics.get('total') ?? 0,
          durationSec: metrics.get('duration_seconds') ?? 0,
          avgLatencyUs: metrics.get('avg_latency_us') ?? 0,
          stddevUs: metrics.get('stddev_us') ?? 0,
          minUs: metrics.get('histogram_min_us') ?? 0,
          maxUs: metrics.get('histogram_max_us') ?? 0,
          count: metrics.get('histogram_count') ?? 0,
          sumSec: metrics.get('histogram_sum_seconds') ?? 0,
          rollbacks: metrics.get('rollbacks') ?? 0,
          buckets: buckets.sort((a, b) => a.leUs - b.leUs),
        })
      }
      groups.sort((a, b) => b.avgLatencyUs - a.avgLatencyUs)
      result.push({ name, kind: 'histogram', scalars: [], groups, records: [], recordFields: [] })
    }
  }
  return result
}

// Column header for a record-table field. Known suffixes get a short label;
// anything else (a future field this list doesn't know about yet) falls back
// to a humanized version of the raw suffix so the table never renders blank.
const RECORD_FIELD_LABELS: Record<string, string> = {
  runs: 'Runs', errors: 'Errors', skips: 'Skips', need_more: 'Need More',
  lease_acquired: 'Leased', last_run_unix: 'Last Run',
  last_duration_us: 'Duration', last_error: 'Last Error',
}
export function recordFieldLabel(field: string): string {
  return RECORD_FIELD_LABELS[field] ?? field.replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase())
}

// Section scalar accessors
export function sv(s: MetricSection[], sec: string, key: string): number {
  const e = s.find(x => x.name === sec)?.scalars.find(x => x.name === key)
  return typeof e?.value === 'number' ? e.value : 0
}
export function ssv(s: MetricSection[], sec: string, key: string): string {
  return String(s.find(x => x.name === sec)?.scalars.find(x => x.name === key)?.value ?? '')
}

// Shared formatting for a raw scalar KV pair from a parsed section (Config,
// Raft, Semaphore, etc). Used by both the generic scalar cards and any
// caller that lifts specific scalar fields into its own layout.
const scalarByteKeys = new Set([
  'cache_size_bytes', 'cache_hit_bytes', 'cache_miss_bytes',
  'sys_mem_total', 'sys_mem_available',
])
const scalarIdSuffixes = ['_port', '_id']
const scalarDateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })
export function fmtScalar(name: string, value: number | string): string {
  if (typeof value === 'string') {
    const d = Date.parse(value)
    if (!isNaN(d) && /^\d{4}-\d{2}-\d{2}/.test(value)) return scalarDateFmt.format(d)
    return value
  }
  if (name.endsWith('_bytes') || scalarByteKeys.has(name)) return formatBytes(value)
  if (name.endsWith('_us')) return formatUs(value)
  if (name.endsWith('_pct')) return `${value}%`
  if (name.endsWith('_ratio')) return value.toFixed(4)
  if (name === 'pid' || name === 'view_mode' || scalarIdSuffixes.some(s => name.endsWith(s))) return String(value)
  return value.toLocaleString()
}

// Formatting
export function formatUs(us: number): string {
  if (us >= 1_000_000) return `${(us / 1_000_000).toFixed(2)}s`
  if (us >= 1000) return `${(us / 1000).toFixed(2)}ms`
  return `${us.toFixed(1)}µs`
}
export function formatTotalTime(secs: number): string {
  if (secs < 0.001) return `${(secs * 1e6).toFixed(1)}µs`
  if (secs < 1) return `${(secs * 1e3).toFixed(2)}ms`
  if (secs < 60) return `${secs.toFixed(2)}s`
  if (secs < 3600) return `${(secs / 60).toFixed(1)}mn`
  return `${(secs / 3600).toFixed(1)}hr`
}
export function formatOpsPerSec(avgUs: number): string {
  if (avgUs <= 0) return '-'
  const ops = 1e6 / avgUs
  if (ops >= 1000) return `${(ops / 1000).toFixed(1)}K`
  return ops.toFixed(1)
}
export function formatUptime(s: number): string {
  if (s < 60) return `${s.toFixed(1)}s`
  if (s < 3600) return `${Math.floor(s / 60)}m ${Math.floor(s % 60)}s`
  if (s < 86400) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`
  return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`
}
export function formatNs(ns: number): string {
  if (ns >= 1e9) return `${(ns / 1e9).toFixed(1)}s`
  if (ns >= 1e6) return `${(ns / 1e6).toFixed(2)}ms`
  if (ns >= 1e3) return `${(ns / 1e3).toFixed(1)}µs`
  return `${ns.toFixed(0)}ns`
}

// Coefficient of variation (σ/μ); latency stability indicator
export function estimateCV(buckets: HistBucket[], avgUs: number): number {
  if (avgUs <= 0 || buckets.length === 0) return 0
  let total = 0
  for (const b of buckets) total += b.count
  if (total < 2) return 0
  let variance = 0, lo = 0
  for (const b of buckets) {
    const hi = b.leUs
    const mid = (lo + hi) / 2
    const diff = mid - avgUs
    variance += b.count * diff * diff
    lo = hi
  }
  variance /= total
  return variance > 0 ? Math.sqrt(variance) / avgUs : 0
}

// Percentile interpolation from histogram buckets
export function interpolatePercentile(buckets: HistBucket[], pct: number): number {
  let total = 0
  for (const b of buckets) total += b.count
  if (total === 0) return 0
  const target = total * pct / 100
  let cum = 0, prevBound = 0
  for (const b of buckets) {
    cum += b.count
    if (cum >= target) {
      const prevCum = cum - b.count
      const frac = b.count > 0 ? (target - prevCum) / b.count : 0
      return prevBound + frac * (b.leUs - prevBound)
    }
    prevBound = b.leUs
  }
  return buckets[buckets.length - 1]?.leUs ?? 0
}
export function fmtPercentile(buckets: HistBucket[], pct: number): string {
  if (buckets.length === 0) return '-'
  return formatUs(interpolatePercentile(buckets, pct))
}

// Color/variant helpers
export function latencyVariant(us: number): 'success' | 'outline' | 'warning' | 'destructive' {
  if (us < 1000) return 'success'
  if (us < 10000) return 'outline'
  if (us < 100000) return 'warning'
  return 'destructive'
}
export function latencyColor(us: number): string {
  if (us < 1000) return 'var(--success)'
  if (us < 10000) return 'var(--primary)'
  if (us < 100000) return 'var(--warning)'
  return 'var(--destructive)'
}
export function pingRttColor(ms: number): string {
  if (ms < 30) return 'var(--success)'
  if (ms < 150) return 'var(--primary)'
  if (ms < 500) return 'var(--warning)'
  return 'var(--destructive)'
}
// DB ping round-trip (node -> DB network latency, not query execution
// time). Tighter bands than pingRttColor above: same-DC/private-network DB
// traffic, not a client-facing network hop.
export function dbPingColor(ms: number): string {
  if (ms < 3) return 'var(--success)'
  if (ms < 10) return 'var(--warning)'
  return 'var(--destructive)'
}
// 5 visual steps within the reading bands below, built from opacity
// variations of the 3 sanctioned status hues (success/warning/destructive)
// per DESIGN.md's rationed-color rule, no new hue families, just an
// intensity step within "tight" (two greens) and within "moderate" (two
// ambers) before handing off to destructive red at the "high" threshold.
export function cvClass(cv: number): string {
  if (cv <= 0) return 'text-muted-foreground border-border'
  if (cv < 0.25) return 'bg-success/25 text-success border-success/50'
  if (cv < 0.5) return 'bg-success/10 text-success border-success/25'
  if (cv < 0.75) return 'bg-warning/10 text-warning border-warning/25'
  if (cv < 1.0) return 'bg-warning/25 text-warning border-warning/50'
  return 'bg-destructive/15 text-destructive border-destructive/30'
}

// InfoTip copy for the σ/μ column header; thresholds mirror cvClass above
export const CV_TOOLTIP_TEXT = "**σ/μ: coefficient of variation.** Ratio of the latency distribution's standard deviation (σ) to its mean (μ): 0 means every request took the same time; the higher it climbs, the more request latencies spread around the average. Estimated from the histogram's bucket midpoints weighted by bucket counts, so it's an approximation, not an exact sample σ.\n\n**Reading it:**\n• < 0.5 → tight, predictable latency\n• 0.5 – 1.0 → moderate spread\n• ≥ 1.0 → high variability: a long tail is pulling values away from the average, so the average alone understates worst-case latency"
export function poolUtilColor(pct: number): string {
  if (pct < 50) return 'var(--success)'
  if (pct < 80) return 'var(--warning)'
  return 'var(--destructive)'
}
// EWMA/baseline ratio (TCP backpressure, DB admission gradients): ~1 is
// stable, <1 recovering (treated as neutral), >1 degrading toward the 10x clamp.
export function gradientColor(g: number): string {
  if (g > 1.25) return 'var(--destructive)'
  if (g > 1.0) return 'var(--warning)'
  return 'var(--success)'
}

// Client process resident-memory pressure bands. Calibrated for FUSE
// clients (mountos, hdfs-sdk) which legitimately hold large
// page caches and may balloon under write back-pressure when the
// upstream object store is slow; a 2 GB footprint alone is not a bug:
//   < 512 MB  healthy        - light mounts, cold cache
//   < 2   GB  active         - normal hot mount, expected during heavy use
//   < 4   GB  warning        - large, plausibly write back-pressure; watch
//   >= 4  GB  destructive    - rare in steady state; pair with rpcErrors /
//                              connDropped to confirm a real problem
export function memAllocColor(bytes: number): string {
  if (bytes < 512 * 1024 * 1024) return 'var(--success)'
  if (bytes < 2 * 1024 * 1024 * 1024) return 'var(--primary)'
  if (bytes < 4 * 1024 * 1024 * 1024) return 'var(--warning)'
  return 'var(--destructive)'
}
export function bucketBarColor(leUs: number): string {
  if (leUs <= 1000) return 'var(--success)'
  if (leUs <= 10000) return 'var(--primary)'
  if (leUs <= 100000) return 'var(--warning)'
  return 'var(--destructive)'
}

export type SortCol = 'label' | 'total' | 'opsPerSec' | 'durationSec' | 'avgLatencyUs' | 'cv' | 'minUs' | 'maxUs' | 'p50' | 'p95' | 'p99' | 'rollbacks'
export type SortDir = 'asc' | 'desc'

export function sortGroups(groups: HistogramGroup[], col: SortCol, dir: SortDir): HistogramGroup[] {
  const sorted = [...groups]
  const m = dir === 'asc' ? 1 : -1
  sorted.sort((a, b) => {
    let va: number | string, vb: number | string
    switch (col) {
      case 'label': return m * a.label.localeCompare(b.label)
      case 'total': va = a.total; vb = b.total; break
      case 'opsPerSec': va = a.avgLatencyUs > 0 ? 1e6 / a.avgLatencyUs : 0; vb = b.avgLatencyUs > 0 ? 1e6 / b.avgLatencyUs : 0; break
      case 'durationSec': va = a.durationSec; vb = b.durationSec; break
      case 'avgLatencyUs': va = a.avgLatencyUs; vb = b.avgLatencyUs; break
      case 'cv': va = estimateCV(a.buckets, a.avgLatencyUs); vb = estimateCV(b.buckets, b.avgLatencyUs); break
      case 'minUs': va = a.minUs; vb = b.minUs; break
      case 'maxUs': va = a.maxUs; vb = b.maxUs; break
      case 'p50': va = interpolatePercentile(a.buckets, 50); vb = interpolatePercentile(b.buckets, 50); break
      case 'p95': va = interpolatePercentile(a.buckets, 95); vb = interpolatePercentile(b.buckets, 95); break
      case 'p99': va = interpolatePercentile(a.buckets, 99); vb = interpolatePercentile(b.buckets, 99); break
      case 'rollbacks': va = a.rollbacks; vb = b.rollbacks; break
      default: va = a.avgLatencyUs; vb = b.avgLatencyUs
    }
    return m * ((va as number) - (vb as number))
  })
  return sorted
}

export function latencyBands(groups: HistogramGroup[]) {
  const bands = { sub1ms: 0, sub10ms: 0, sub100ms: 0, over100ms: 0 }
  for (const g of groups) {
    if (g.avgLatencyUs < 1000) bands.sub1ms++
    else if (g.avgLatencyUs < 10000) bands.sub10ms++
    else if (g.avgLatencyUs < 100000) bands.sub100ms++
    else bands.over100ms++
  }
  return bands
}
