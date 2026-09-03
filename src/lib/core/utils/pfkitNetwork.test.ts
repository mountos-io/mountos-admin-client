import { describe, it, expect } from 'vitest'
import { parseFlowStats } from './pfkitNetwork'

// Fixtures mirror exactly what mountos-servers' internal/pfkitclient.AppendFlowStats writes
// (see internal/pfkitclient/statsfmt.go); the round-trip tests in
// internal/pfkitclient/parse_test.go build the same blob via AppendFlowStats itself. These
// are hand-written here since this is a different repo/stack, but the line format is the
// same ground truth.

describe('parseFlowStats', () => {
  it('decodes matched rows, escaped labels, and the unresolved summary', () => {
    const blob = [
      'uptime_seconds 12.3',
      'pid 999',
      '',
      '# Network (per peer)',
      '# real OS-level TCP counters (pfkit), joined against this service\'s own peer/connection tracking',
      'pfkit_running 1',
      'network_tx_bytes{peer="peer-a",role="block_ha_peer"} 100',
      'network_rx_bytes{peer="peer-a",role="block_ha_peer"} 200',
      'network_tx_packets{peer="peer-a",role="block_ha_peer"} 3',
      'network_rx_packets{peer="peer-a",role="block_ha_peer"} 4',
      'network_retrans_packets{peer="peer-a",role="block_ha_peer"} 1',
      'network_rtt_micros{peer="peer-a",role="block_ha_peer"} 500',
      'network_tx_bytes{peer="weird\\"peer\\\\name",role="raft_peer"} 10',
      'network_rx_bytes{peer="weird\\"peer\\\\name",role="raft_peer"} 20',
      'network_tx_packets{peer="weird\\"peer\\\\name",role="raft_peer"} 1',
      'network_rx_packets{peer="weird\\"peer\\\\name",role="raft_peer"} 1',
      'network_retrans_packets{peer="weird\\"peer\\\\name",role="raft_peer"} 0',
      'network_rtt_micros{peer="weird\\"peer\\\\name",role="raft_peer"} 100',
      'network_unresolved_flows 1',
      'network_unresolved_tx_bytes 5',
      'network_unresolved_rx_bytes 6',
      '',
    ].join('\n')

    const parsed = parseFlowStats(blob)
    expect(parsed).not.toBeNull()
    expect(parsed!.running).toBe(true)
    expect(parsed!.rows).toHaveLength(2)

    expect(parsed!.rows[0]).toEqual({
      label: 'peer-a', role: 'block_ha_peer',
      txBytes: 100, rxBytes: 200, txPackets: 3, rxPackets: 4, retransPackets: 1, rttMicros: 500,
    })
    expect(parsed!.rows[1]!.label).toBe('weird"peer\\name')
    expect(parsed!.rows[1]!.role).toBe('raft_peer')
    expect(parsed!.rows[1]!.txBytes).toBe(10)
    expect(parsed!.rows[1]!.rttMicros).toBe(100)

    expect(parsed!.unresolvedFlows).toBe(1)
    expect(parsed!.unresolvedTxBytes).toBe(5)
    expect(parsed!.unresolvedRxBytes).toBe(6)
  })

  it('reports running=false with no rows when pfkit is not running, without consuming the rest of the blob', () => {
    const blob = [
      '# Network (per peer)',
      '# real OS-level TCP counters (pfkit), joined against this service\'s own peer/connection tracking',
      'pfkit_running 0',
    ].join('\n')

    const parsed = parseFlowStats(blob)
    expect(parsed).toEqual({
      running: false, rows: [], unresolvedFlows: 0, unresolvedTxBytes: 0, unresolvedRxBytes: 0,
    })
  })

  it('returns running=true with no rows when nothing matched and nothing is unresolved', () => {
    const blob = [
      '# Network (per peer)',
      '# real OS-level TCP counters (pfkit), joined against this service\'s own peer/connection tracking',
      'pfkit_running 1',
    ].join('\n')

    const parsed = parseFlowStats(blob)
    expect(parsed!.running).toBe(true)
    expect(parsed!.rows).toHaveLength(0)
    expect(parsed!.unresolvedFlows).toBe(0)
  })

  it('returns null when the section is entirely absent', () => {
    const blob = 'uptime_seconds 1.0\npid 123\n\n# Runtime\ngoroutines 4\n'
    expect(parseFlowStats(blob)).toBeNull()
  })

  it('finds the section regardless of what precedes or follows it in the blob', () => {
    const blob = [
      '# Runtime',
      'goroutines 4',
      '',
      '# Network (per peer)',
      '# real OS-level TCP counters (pfkit), joined against this service\'s own peer/connection tracking',
      'pfkit_running 1',
      'network_tx_bytes{peer="p",role="r"} 1',
      'network_rx_bytes{peer="p",role="r"} 2',
      'network_tx_packets{peer="p",role="r"} 1',
      'network_rx_packets{peer="p",role="r"} 1',
      'network_retrans_packets{peer="p",role="r"} 0',
      'network_rtt_micros{peer="p",role="r"} 10',
    ].join('\n')

    const parsed = parseFlowStats(blob)
    expect(parsed!.running).toBe(true)
    expect(parsed!.rows).toHaveLength(1)
    expect(parsed!.rows[0]!.label).toBe('p')
  })

  it('gcserv-style: running with only unresolved flows, no matched rows', () => {
    const blob = [
      '# Network (per peer)',
      '# real OS-level TCP counters (pfkit), joined against this service\'s own peer/connection tracking',
      'pfkit_running 1',
      'network_unresolved_flows 2',
      'network_unresolved_tx_bytes 8',
      'network_unresolved_rx_bytes 10',
    ].join('\n')

    const parsed = parseFlowStats(blob)
    expect(parsed!.rows).toHaveLength(0)
    expect(parsed!.unresolvedFlows).toBe(2)
    expect(parsed!.unresolvedTxBytes).toBe(8)
    expect(parsed!.unresolvedRxBytes).toBe(10)
  })
})
