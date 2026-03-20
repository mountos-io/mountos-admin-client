// Generalized Prometheus metrics parser and formatting utilities
// Used by HUB (appserv) metrics visualization, extensible for other service types

export interface ScalarEntry { name: string; value: number | string }
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
  buckets: HistBucket[]
}
export interface MetricSection {
  name: string
  kind: 'scalar' | 'histogram'
  scalars: ScalarEntry[]
  groups: HistogramGroup[]
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
      result.push({ name, kind: 'histogram', scalars: [], groups: [] })
      continue
    }
    const hasLabels = lines.some(l => l.includes('{'))

    if (!hasLabels) {
      const scalars: ScalarEntry[] = []
      for (const l of lines) {
        const m = l.match(/^(\S+)\s+(.+)$/)
        if (!m) continue
        const n = parseFloat(m[2])
        scalars.push({ name: m[1], value: isNaN(n) ? m[2] : n })
      }
      result.push({ name, kind: 'scalar', scalars, groups: [] })
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
        const pv = pk ? labels[pk] : 'unknown'

        if (!gmap.has(pv)) gmap.set(pv, { metrics: new Map(), buckets: [] })
        const g = gmap.get(pv)!

        if (metricName!.includes('_bucket') && labels.le != null) {
          g.buckets.push({ le: labels.le, leUs: parseLeValue(labels.le), count: value })
        } else {
          const suffixes = ['total', 'duration_seconds', 'avg_latency_us', 'stddev_us', 'histogram_min_us', 'histogram_max_us', 'histogram_count', 'histogram_sum_seconds']
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
          buckets: buckets.sort((a, b) => a.leUs - b.leUs),
        })
      }
      groups.sort((a, b) => b.avgLatencyUs - a.avgLatencyUs)
      result.push({ name, kind: 'histogram', scalars: [], groups })
    }
  }
  return result
}

// Section scalar accessors
export function sv(s: MetricSection[], sec: string, key: string): number {
  const e = s.find(x => x.name === sec)?.scalars.find(x => x.name === key)
  return typeof e?.value === 'number' ? e.value : 0
}
export function ssv(s: MetricSection[], sec: string, key: string): string {
  return String(s.find(x => x.name === sec)?.scalars.find(x => x.name === key)?.value ?? '')
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
  if (avgUs <= 0) return '\u2014'
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

// Coefficient of variation (β) — latency stability indicator
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
  if (buckets.length === 0) return '\u2014'
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
export function betaVariant(cv: number): 'success' | 'outline' | 'warning' | 'destructive' {
  if (cv <= 0) return 'outline'
  if (cv < 0.5) return 'success'
  if (cv < 1.0) return 'warning'
  return 'destructive'
}
export function poolUtilColor(pct: number): string {
  if (pct < 50) return 'var(--success)'
  if (pct < 80) return 'var(--warning)'
  return 'var(--destructive)'
}
export function bucketBarColor(leUs: number): string {
  if (leUs <= 1000) return 'var(--success)'
  if (leUs <= 10000) return 'var(--primary)'
  if (leUs <= 100000) return 'var(--warning)'
  return 'var(--destructive)'
}

export type SortCol = 'label' | 'total' | 'opsPerSec' | 'durationSec' | 'avgLatencyUs' | 'cv' | 'minUs' | 'maxUs' | 'p50' | 'p95' | 'p99'
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
