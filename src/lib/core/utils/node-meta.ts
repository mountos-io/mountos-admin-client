import { formatBytes } from '$lib/core/utils/format'

// Node metadata is service-specific; NodeDetail renders it as labeled fields (not raw JSON).
// Known keys (mostly blockserv) get friendly labels, ordering and typed rendering;
// unknown keys fall back to a humanized label so any service stays readable.
export type MetaKind = 'badge' | 'mono' | 'text'
export type BadgeVariant = 'success' | 'warning' | 'secondary'
export type MetaEntry = {
  key: string; label: string; kind: MetaKind; text: string
  variant?: BadgeVariant; copy?: boolean; wide?: boolean
}

const META_LABELS: Record<string, string> = {
  name: 'Block Volume',
  block_volume_id: 'Block Volume ID',
  storage_id: 'Storage ID',
  block_data_port: 'Data Port',
  block_peer_port: 'Peer Port',
  ha_synced: 'HA Sync',
  ready: 'Ready',
  net_tuned: 'Network Tuned',
  net_cc: 'Congestion Control',
  net_system_cc: 'System Default',
  net_cc_override: 'Per-Socket Override',
  net_qdisc: 'Queue Discipline',
  net_rmem_max: 'Receive Buffer Max',
  net_wmem_max: 'Send Buffer Max',
}
// Most operationally relevant first; everything else trails alphabetically.
const META_ORDER = [
  'name', 'ready', 'ha_synced', 'block_data_port', 'block_peer_port', 'block_volume_id', 'storage_id',
  'net_tuned', 'net_cc', 'net_system_cc', 'net_cc_override', 'net_qdisc', 'net_rmem_max', 'net_wmem_max',
]
// processId/commitHash/metrics_port/metrics_path surface elsewhere on the node card;
// storage_id folds into the linked "Storage" field instead of a bare ID.
const META_HIDDEN = new Set(['processId', 'commitHash', 'metrics_port', 'metrics_path', 'storage_id'])

export function humanizeKey(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function toMetaEntry(key: string, value: unknown): MetaEntry {
  const label = META_LABELS[key] ?? humanizeKey(key)
  if (typeof value === 'boolean') {
    if (key === 'ha_synced') return { key, label, kind: 'badge', text: value ? 'Synced' : 'Pending', variant: value ? 'success' : 'warning' }
    if (key === 'ready') return { key, label, kind: 'badge', text: value ? 'Yes' : 'No', variant: value ? 'success' : 'warning' }
    if (key === 'net_tuned') return { key, label, kind: 'badge', text: value ? 'Yes' : 'Below target', variant: value ? 'success' : 'warning' }
    if (key === 'net_cc_override') return { key, label, kind: 'badge', text: 'Set for this process', variant: 'warning' }
    return { key, label, kind: 'badge', text: value ? 'Yes' : 'No', variant: value ? 'success' : 'secondary' }
  }
  // A node leaves net_tuned out when the values it read all pass but some value is missing.
  if (key === 'net_tuned') return { key, label, kind: 'text', text: 'Not reported' }
  if ((key === 'net_rmem_max' || key === 'net_wmem_max') && typeof value === 'number') {
    // A node leaves out a ceiling it cannot read, so 0 is never a real value. Show it as not reported, not a 0 B buffer.
    if (value <= 0) return { key, label, kind: 'text', text: 'Not reported' }
    return { key, label, kind: 'mono', text: formatBytes(value) }
  }
  const text = String(value)
  if (key.endsWith('_id')) return { key, label, kind: 'mono', text, copy: true, wide: true }
  if (key.endsWith('_port')) return { key, label, kind: 'mono', text }
  return { key, label, kind: 'text', text }
}

// The congestion control is a cause of "Below target" when the node is below target and
// its block data connections do not run bbr. Only then do the system default and a
// per-process override explain the verdict.
function ccBelowTarget(m: Record<string, unknown>): boolean {
  return m.net_tuned === false && typeof m.net_cc === 'string' && m.net_cc !== 'bbr'
}
const CC_CAUSE_KEYS = new Set(['net_system_cc', 'net_cc_override'])

// The rows NodeDetail shows for a node's metadata, in display order. A node with no
// net_tuned verdict gets a "Not reported" verdict row when it reports some network tuning
// value, or when reportsTuning is set (a blockserv node, which may have read no value at all).
// The system default and override rows show only when the congestion control is a cause of
// "Below target".
export function metadataRows(meta: Record<string, unknown> | undefined | null, reportsTuning = false): MetaEntry[] {
  const m = meta ?? {}
  const keys = Object.keys(m)
  if (!('net_tuned' in m) && (reportsTuning || keys.some((k) => k.startsWith('net_')))) keys.push('net_tuned')
  const ccCause = ccBelowTarget(m)
  return keys
    .filter((k) => !META_HIDDEN.has(k) && (ccCause || !CC_CAUSE_KEYS.has(k)))
    .sort((a, b) => {
      const ia = META_ORDER.indexOf(a)
      const ib = META_ORDER.indexOf(b)
      if (ia !== -1 || ib !== -1) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
      return a.localeCompare(b)
    })
    .map((k) => toMetaEntry(k, m[k]))
}
