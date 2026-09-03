<script lang="ts">
  import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card'
  import { Badge } from '$lib/components/ui/badge'
  import { formatBytes } from '$lib/core/utils/format'
  import type { ParsedFlowStats } from '$lib/core/utils/pfkitNetwork'

  let { stats }: { stats: ParsedFlowStats } = $props()

  // One row per (role, peer): rows sharing a peer within a role are summed together, so this
  // reads as "which peer, doing what role, is moving how much traffic": an interpreted,
  // bucketed summary, not a live per-flow table. AppendFlowStats can emit more than one row
  // for the same peer (e.g. multiple TCP connections to the same HA sibling); those combine
  // into one line here.
  interface PeerAgg {
    label: string
    flowCount: number
    txBytes: number
    rxBytes: number
    txPackets: number
    rxPackets: number
    retransPackets: number
    maxRttMicros: number
  }
  interface RoleGroup {
    role: string
    label: string
    peers: PeerAgg[]
    flowCount: number
    txBytes: number
    rxBytes: number
    retransPackets: number
  }

  const roleGroups = $derived.by<RoleGroup[]>(() => {
    const byRole = new Map<string, Map<string, PeerAgg>>()
    const roleOrder: string[] = []
    for (const row of stats.rows) {
      if (!byRole.has(row.role)) { byRole.set(row.role, new Map()); roleOrder.push(row.role) }
      const peers = byRole.get(row.role)!
      const existing = peers.get(row.label)
      if (existing) {
        existing.flowCount += 1
        existing.txBytes += row.txBytes
        existing.rxBytes += row.rxBytes
        existing.txPackets += row.txPackets
        existing.rxPackets += row.rxPackets
        existing.retransPackets += row.retransPackets
        existing.maxRttMicros = Math.max(existing.maxRttMicros, row.rttMicros)
      } else {
        peers.set(row.label, {
          label: row.label, flowCount: 1,
          txBytes: row.txBytes, rxBytes: row.rxBytes,
          txPackets: row.txPackets, rxPackets: row.rxPackets,
          retransPackets: row.retransPackets, maxRttMicros: row.rttMicros,
        })
      }
    }
    return roleOrder.map((role) => {
      const peers = [...byRole.get(role)!.values()].sort((a, b) => b.txBytes + b.rxBytes - (a.txBytes + a.rxBytes))
      return {
        role, label: humanizeRole(role), peers,
        flowCount: peers.reduce((s, p) => s + p.flowCount, 0),
        txBytes: peers.reduce((s, p) => s + p.txBytes, 0),
        rxBytes: peers.reduce((s, p) => s + p.rxBytes, 0),
        retransPackets: peers.reduce((s, p) => s + p.retransPackets, 0),
      }
    }).sort((a, b) => (b.txBytes + b.rxBytes) - (a.txBytes + a.rxBytes))
  })

  const totalFlows = $derived(roleGroups.reduce((s, g) => s + g.flowCount, 0) + stats.unresolvedFlows)

  // Known roles get a friendly label (see cmd/{blockserv,dataserv,gcserv,appserv}'s
  // pfkitclient resolvers in mountos-servers for the exact strings each service produces).
  // appserv's resolver labels a match with the peer's own service_type (blockserv, dataserv,
  // ...), which already reads fine as-is. Anything else falls back to a humanized version of
  // the raw role string so a role this list doesn't know about yet still renders sensibly.
  const KNOWN_ROLES: Record<string, string> = {
    block_ha_peer: 'HA Peer',
    raft_peer: 'Raft Peer',
    dataserv_peer_data: 'Cluster Peer',
    dataserv_peer_data_private: 'Cluster Peer (Private)',
    client_unauthenticated: 'Unauthenticated Client',
  }
  function humanizeRole(role: string): string {
    if (KNOWN_ROLES[role]) return KNOWN_ROLES[role]
    if (role.startsWith('client_')) {
      const scope = role.slice('client_'.length).replaceAll('_', ' ')
      return scope ? `Client (${scope})` : 'Client'
    }
    if (/^[a-z]+$/.test(role)) return role[0]!.toUpperCase() + role.slice(1) // e.g. appserv's bare service_type
    return role.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  }

  function fmtNum(n: number): string { return n.toLocaleString() }
  function fmtRtt(us: number): string {
    if (us <= 0) return '-'
    return us >= 1000 ? `${(us / 1000).toFixed(1)}ms` : `${us.toFixed(0)}µs`
  }
</script>

<Card cornerBrackets={false}>
  <CardHeader>
    <div class="flex items-center justify-between">
      <CardTitle class="text-base">Network</CardTitle>
      <Badge variant="outline">{fmtNum(totalFlows)} flow{totalFlows === 1 ? '' : 's'}</Badge>
    </div>
  </CardHeader>
  <CardContent class="pt-0 space-y-5">
    {#if roleGroups.length === 0 && stats.unresolvedFlows === 0}
      <p class="text-sm text-muted-foreground">No network flows tracked yet.</p>
    {/if}

    {#each roleGroups as group, i (group.role)}
      {#if i > 0}<div class="h-px bg-border/60"></div>{/if}
      <div class="space-y-2">
        <div class="flex items-center justify-between gap-2">
          <span class="text-sm font-mono text-muted-foreground tracking-wider uppercase">{group.label}</span>
          <span class="text-sm font-mono tabular-nums text-muted-foreground">
            {group.peers.length} peer{group.peers.length === 1 ? '' : 's'} · {group.flowCount} flow{group.flowCount === 1 ? '' : 's'}
          </span>
        </div>
        <div class="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-sm font-mono text-muted-foreground">
          <span>TX <span class="text-foreground tabular-nums">{formatBytes(group.txBytes)}</span></span>
          <span class="text-border">·</span>
          <span>RX <span class="text-foreground tabular-nums">{formatBytes(group.rxBytes)}</span></span>
          {#if group.retransPackets > 0}
            <span class="text-border">|</span>
            <span style="color: var(--warning)">Retrans <span class="tabular-nums">{fmtNum(group.retransPackets)}</span></span>
          {/if}
        </div>
        <div class="rounded-sm border border-border/60 divide-y divide-border/60 overflow-hidden">
          {#each group.peers as p (p.label)}
            <div class="flex items-center justify-between gap-3 px-3 py-1.5 text-sm font-mono">
              <span class="truncate" title={p.label}>{p.label}</span>
              <span class="flex items-center gap-3 text-muted-foreground shrink-0">
                <span><span class="tabular-nums text-foreground">{formatBytes(p.txBytes)}</span> tx</span>
                <span><span class="tabular-nums text-foreground">{formatBytes(p.rxBytes)}</span> rx</span>
                {#if p.retransPackets > 0}
                  <span style="color: var(--warning)"><span class="tabular-nums">{fmtNum(p.retransPackets)}</span> retrans</span>
                {/if}
                <span class="tabular-nums">{fmtRtt(p.maxRttMicros)} rtt</span>
              </span>
            </div>
          {/each}
        </div>
      </div>
    {/each}

    {#if stats.unresolvedFlows > 0}
      {#if roleGroups.length > 0}<div class="h-px bg-border/60"></div>{/if}
      <div class="space-y-1">
        <span class="text-sm font-mono text-muted-foreground tracking-wider uppercase">Unresolved</span>
        <p class="text-sm text-muted-foreground">
          {fmtNum(stats.unresolvedFlows)} flow{stats.unresolvedFlows === 1 ? '' : 's'} not matched to a known peer
          (<span class="tabular-nums text-foreground">{formatBytes(stats.unresolvedTxBytes)}</span> tx,
          <span class="tabular-nums text-foreground">{formatBytes(stats.unresolvedRxBytes)}</span> rx).
          These are connections this service does not label (e.g. an incoming client
          connection), not an error.
        </p>
      </div>
    {/if}
  </CardContent>
</Card>
