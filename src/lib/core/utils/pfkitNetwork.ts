// Parses pfkit's "# Network (per peer)" stats-blob section. Every mountOS service
// (blockserv/dataserv/gcserv/appserv) folds this section into its own existing stats blob via
// mountos-servers' internal/pfkitclient.AppendFlowStats; see that Go function for the exact
// line format this file mirrors, and internal/pfkitclient/parse.go's ParseFlowStats for the
// reference algorithm this ports.
//
// This section is NOT run through the generic parseMetrics() parser in ./metrics:
// AppendFlowStats writes a second, plain "#"-prefixed description comment right after the
// section title line, and parseMetrics treats every "#" line as a new section boundary, which
// would split this section in two and lose the pfkit_running line. This parser reads the raw
// stats text directly instead.

export interface FlowStatRow {
  label: string
  role: string
  txBytes: number
  rxBytes: number
  txPackets: number
  rxPackets: number
  retransPackets: number
  rttMicros: number
}

export interface ParsedFlowStats {
  running: boolean
  rows: FlowStatRow[]
  unresolvedFlows: number
  unresolvedTxBytes: number
  unresolvedRxBytes: number
}

const SECTION_HEADER = '# Network (per peer)'

// The fixed per-flow line order AppendFlowStats always writes together (appendFlowLines);
// parseFlowRow walks it in lockstep rather than matching each metric name independently.
const FLOW_METRICS = [
  'network_tx_bytes',
  'network_rx_bytes',
  'network_tx_packets',
  'network_rx_packets',
  'network_retrans_packets',
  'network_rtt_micros',
] as const

const notRunning = (): ParsedFlowStats => ({
  running: false, rows: [], unresolvedFlows: 0, unresolvedTxBytes: 0, unresolvedRxBytes: 0,
})

/**
 * Decodes AppendFlowStats's "# Network (per peer)" section out of a full stats-blob string
 * (as returned by a service's own stats control-socket/HTTP proxy endpoint). Parses exactly
 * what AppendFlowStats writes, line for line, rather than a loose scan; a line that does not
 * match the expected shape ends parsing right there (defensive: the section is always present
 * post-enrichment, but a stale/mismatched blob must not throw or return garbage rows).
 *
 * Returns null only when the section itself is entirely absent from statsText.
 */
export function parseFlowStats(statsText: string): ParsedFlowStats | null {
  const lines = statsText.split('\n')

  let headerIdx = -1
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]!.trim() === SECTION_HEADER) { headerIdx = i; break }
  }
  if (headerIdx < 0) return null

  let i = headerIdx + 1
  // Skip the section's own descriptive "#"-prefixed comment line(s).
  while (i < lines.length && lines[i]!.trim().startsWith('#')) i++

  const RUNNING_PREFIX = 'pfkit_running '
  if (i >= lines.length || !lines[i]!.startsWith(RUNNING_PREFIX)) return notRunning()
  const running = lines[i]!.slice(RUNNING_PREFIX.length).trim() === '1'
  i++
  if (!running) return notRunning()

  const rows: FlowStatRow[] = []
  let unresolvedFlows = 0
  let unresolvedTxBytes = 0
  let unresolvedRxBytes = 0

  while (i < lines.length) {
    const line = lines[i]!
    if (line === '') { i++; continue }

    if (line.startsWith('network_tx_bytes{')) {
      const parsed = parseFlowRow(lines, i)
      if (!parsed) break
      rows.push(parsed.row)
      i += parsed.consumed
      continue
    }
    if (line.startsWith('network_unresolved_flows ')) {
      const v = parseScalarLine(line, 'network_unresolved_flows ')
      if (v == null) break
      unresolvedFlows = v
      i++
      continue
    }
    if (line.startsWith('network_unresolved_tx_bytes ')) {
      const v = parseScalarLine(line, 'network_unresolved_tx_bytes ')
      if (v == null) break
      unresolvedTxBytes = v
      i++
      continue
    }
    if (line.startsWith('network_unresolved_rx_bytes ')) {
      const v = parseScalarLine(line, 'network_unresolved_rx_bytes ')
      if (v == null) break
      unresolvedRxBytes = v
      i++
      continue
    }
    // Unrecognized line: end of this section (either the stats blob continues with
    // something else, or the remaining content doesn't match the format this parses).
    break
  }

  return { running, rows, unresolvedFlows, unresolvedTxBytes, unresolvedRxBytes }
}

// parseFlowRow decodes one matched flow's six consecutive lines (starting at lines[start]),
// which appendFlowLines always writes together, in order, sharing one (peer, role) label
// pair. Returns the decoded row and 6 (the number of lines consumed) on success.
function parseFlowRow(lines: string[], start: number): { row: FlowStatRow; consumed: number } | null {
  if (start + FLOW_METRICS.length > lines.length) return null
  let peer = ''
  let role = ''
  const values: number[] = []
  for (let idx = 0; idx < FLOW_METRICS.length; idx++) {
    const parsed = parseFlowMetricLine(lines[start + idx]!, FLOW_METRICS[idx]!)
    if (!parsed) return null
    if (idx === 0) {
      peer = parsed.peer
      role = parsed.role
    } else if (parsed.peer !== peer || parsed.role !== role) {
      return null
    }
    values.push(parsed.value)
  }
  return {
    row: {
      label: peer,
      role,
      txBytes: values[0]!,
      rxBytes: values[1]!,
      txPackets: values[2]!,
      rxPackets: values[3]!,
      retransPackets: values[4]!,
      rttMicros: values[5]!,
    },
    consumed: FLOW_METRICS.length,
  }
}

// parseFlowMetricLine parses one `metric{peer="...",role="..."} value` line (appendLabeled2's
// exact format), unescaping the label values per appendEscapedLabelValue's scheme. Returns
// null when the line doesn't start with wantMetric or doesn't otherwise match that shape.
function parseFlowMetricLine(line: string, wantMetric: string): { peer: string; role: string; value: number } | null {
  const prefix = `${wantMetric}{peer="`
  if (!line.startsWith(prefix)) return null
  let rest = line.slice(prefix.length)

  const peer = readEscapedLabelValue(rest)
  if (!peer) return null
  rest = rest.slice(peer.consumed)
  if (!rest.startsWith('",role="')) return null
  rest = rest.slice('",role="'.length)

  const role = readEscapedLabelValue(rest)
  if (!role) return null
  rest = rest.slice(role.consumed)
  if (!rest.startsWith('"} ')) return null
  rest = rest.slice('"} '.length)

  const value = Number(rest)
  if (!Number.isFinite(value)) return null
  return { peer: peer.value, role: role.value, value }
}

// readEscapedLabelValue reads a label value up to (not including) the next unescaped double
// quote, undoing the Go writer's \\ and \" escapes. consumed is the number of characters of s
// the value occupied (i.e. the index of the closing quote); null when s ends before an
// unescaped quote is found.
function readEscapedLabelValue(s: string): { value: string; consumed: number } | null {
  let out = ''
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '\\') {
      if (i + 1 >= s.length) return null
      out += s[i + 1]
      i++
      continue
    }
    if (c === '"') return { value: out, consumed: i }
    out += c
  }
  return null
}

// parseScalarLine parses one `prefixNNN` line (a bare, unlabeled counter) into its value.
function parseScalarLine(line: string, prefix: string): number | null {
  if (!line.startsWith(prefix)) return null
  const value = Number(line.slice(prefix.length))
  return Number.isFinite(value) ? value : null
}
