import { describe, it, expect } from 'vitest'
import { metadataRows } from './node-meta'

describe('metadataRows', () => {
  it('renders blockserv network tuning keys with labels, badge, byte sizes and order', () => {
    const rows = metadataRows({
      net_wmem_max: 67108864,
      net_cc: 'bbr',
      storage_id: 'storage-uuid',
      net_tuned: false,
      net_rmem_max: 67108864,
      ready: true,
      zeta: 'x',
    })
    expect(rows.map((r) => r.key)).toEqual(['ready', 'net_tuned', 'net_cc', 'net_rmem_max', 'net_wmem_max', 'zeta'])
    const tuned = rows.find((r) => r.key === 'net_tuned')
    expect(tuned).toMatchObject({ label: 'Network Tuned', kind: 'badge', text: 'Below target', variant: 'warning' })
    expect(rows.find((r) => r.key === 'net_rmem_max')).toMatchObject({ label: 'Receive Buffer Max', kind: 'mono', text: '64 MB' })
    expect(rows.find((r) => r.key === 'net_cc')).toMatchObject({ label: 'Congestion Control', text: 'bbr' })
  })

  it('shows a tuned node with a success badge', () => {
    expect(metadataRows({ net_tuned: true })[0]).toMatchObject({ text: 'Yes', variant: 'success' })
  })

  it('shows an unread buffer ceiling as not reported, never as 0 B', () => {
    const row = metadataRows({ net_rmem_max: 0, net_tuned: false }).find((r) => r.key === 'net_rmem_max')
    expect(row).toMatchObject({ label: 'Receive Buffer Max', kind: 'text', text: 'Not reported' })
  })

  it('shows the tuning verdict as not reported when a node leaves it out', () => {
    const rows = metadataRows({ net_cc: 'cubic', net_rmem_max: 67108864, ready: true })
    expect(rows.map((r) => r.key)).toEqual(['ready', 'net_tuned', 'net_cc', 'net_rmem_max'])
    expect(rows[1]).toMatchObject({ label: 'Network Tuned', kind: 'text', text: 'Not reported' })
  })

  it('adds no tuning row for a node that reports no tuning value', () => {
    expect(metadataRows({ ready: true }).map((r) => r.key)).toEqual(['ready'])
  })

  it('explains a congestion control below target with the system default and the override', () => {
    const rows = metadataRows({ net_tuned: false, net_cc: 'cubic', net_system_cc: 'bbr', net_cc_override: true, net_rmem_max: 67108864 })
    expect(rows.map((r) => r.key)).toEqual(['net_tuned', 'net_cc', 'net_system_cc', 'net_cc_override', 'net_rmem_max'])
    expect(rows[2]).toMatchObject({ label: 'System Default', text: 'bbr' })
    expect(rows[3]).toMatchObject({ label: 'Per-Socket Override', kind: 'badge', text: 'Set for this process', variant: 'warning' })
  })

  it('leaves out the system default and the override when the congestion control is not a cause', () => {
    const meta = { net_cc: 'bbr', net_system_cc: 'cubic', net_rmem_max: 67108864 }
    expect(metadataRows({ ...meta, net_tuned: true }).map((r) => r.key)).toEqual(['net_tuned', 'net_cc', 'net_rmem_max'])
    expect(metadataRows({ ...meta, net_tuned: false, net_rmem_max: 1048576 }).map((r) => r.key)).toEqual(['net_tuned', 'net_cc', 'net_rmem_max'])
    expect(metadataRows({ net_cc: 'cubic', net_system_cc: 'cubic', net_cc_override: true }).map((r) => r.key)).toEqual(['net_tuned', 'net_cc'])
  })

  it('shows the tuning verdict as not reported for a blockserv node that read no value', () => {
    const rows = metadataRows({ ready: true }, true)
    expect(rows.map((r) => r.key)).toEqual(['ready', 'net_tuned'])
    expect(rows[1]).toMatchObject({ label: 'Network Tuned', kind: 'text', text: 'Not reported' })
    expect(metadataRows(null, true)).toEqual([expect.objectContaining({ key: 'net_tuned', text: 'Not reported' })])
  })
})
