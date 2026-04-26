<script lang="ts">
  import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card'
  import { Badge } from '$lib/components/ui/badge'
  import { Button } from '$lib/components/ui/button'
  import { Separator } from '$lib/components/ui/separator'
  import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '$lib/components/ui/table'

  type NodeStatus = 'active' | 'draining' | 'inactive'
  type ViewMode = 'rack' | 'matrix' | 'raft'

  interface DemoNode {
    nodeId: string
    serviceType: string
    advertiseAddr: string
    httpAddr: string
    status: NodeStatus
    lastHeartbeat: string
    isActive: boolean
    raftGroup?: string
    isRaftLeader?: boolean
  }

  interface RaftStyle { color: string; bgColor: string; label: string }

  let viewMode = $state<ViewMode>('rack')
  let selectedRaft = $state<string | null>(null)
  let hoverRaft = $state<string | null>(null)
  let svgTip = $state<{ node: DemoNode; x: number; y: number } | null>(null)

  function toggleRaft(name: string) {
    selectedRaft = selectedRaft === name ? null : name
  }

  const RAFT_STYLES: Record<string, RaftStyle> = {
    'meta-raft': { color: 'var(--pastel-user)', bgColor: 'color-mix(in oklch, var(--pastel-user) 8%, transparent)', label: 'Meta' },
    'blob-raft': { color: 'var(--pastel-mount)', bgColor: 'color-mix(in oklch, var(--pastel-mount) 8%, transparent)', label: 'Blob' },
    'coord-raft': { color: 'var(--pastel-session)', bgColor: 'color-mix(in oklch, var(--pastel-session) 8%, transparent)', label: 'Coordinator' },
  }

  const STATUS_COLORS: Record<NodeStatus, string> = {
    active: 'var(--success)',
    draining: 'var(--warning)',
    inactive: 'var(--muted-foreground)',
  }

  const region = { name: 'us-east-1', isActive: true }

  const nodes: DemoNode[] = [
    { nodeId: 'meta-node-1', serviceType: 'meta', advertiseAddr: '10.0.1.1:9000', httpAddr: '10.0.1.1:8080', status: 'active', lastHeartbeat: '2026-03-13T10:25:00Z', isActive: true, raftGroup: 'meta-raft', isRaftLeader: true },
    { nodeId: 'blob-node-1', serviceType: 'blob', advertiseAddr: '10.0.1.1:9000', httpAddr: '10.0.1.1:8081', status: 'active', lastHeartbeat: '2026-03-13T10:25:12Z', isActive: true, raftGroup: 'blob-raft' },
    { nodeId: 'coord-node-1', serviceType: 'coordinator', advertiseAddr: '10.0.1.1:9000', httpAddr: '10.0.1.1:8082', status: 'active', lastHeartbeat: '2026-03-13T10:24:50Z', isActive: true, raftGroup: 'coord-raft', isRaftLeader: true },
    { nodeId: 'gw-node-1', serviceType: 'gateway', advertiseAddr: '10.0.1.1:9000', httpAddr: '10.0.1.1:8083', status: 'active', lastHeartbeat: '2026-03-13T10:25:30Z', isActive: true },
    { nodeId: 'meta-node-2', serviceType: 'meta', advertiseAddr: '10.0.1.2:9000', httpAddr: '10.0.1.2:8080', status: 'active', lastHeartbeat: '2026-03-13T10:25:05Z', isActive: true, raftGroup: 'meta-raft' },
    { nodeId: 'blob-node-2', serviceType: 'blob', advertiseAddr: '10.0.1.2:9000', httpAddr: '10.0.1.2:8081', status: 'active', lastHeartbeat: '2026-03-13T10:25:18Z', isActive: true, raftGroup: 'blob-raft', isRaftLeader: true },
    { nodeId: 'coord-node-2', serviceType: 'coordinator', advertiseAddr: '10.0.1.2:9000', httpAddr: '10.0.1.2:8082', status: 'active', lastHeartbeat: '2026-03-13T10:25:02Z', isActive: true, raftGroup: 'coord-raft' },
    { nodeId: 'gw-node-2', serviceType: 'gateway', advertiseAddr: '10.0.1.2:9000', httpAddr: '10.0.1.2:8083', status: 'active', lastHeartbeat: '2026-03-13T10:25:28Z', isActive: true },
    { nodeId: 'meta-node-3', serviceType: 'meta', advertiseAddr: '10.0.1.3:9000', httpAddr: '10.0.1.3:8080', status: 'active', lastHeartbeat: '2026-03-13T10:24:45Z', isActive: true, raftGroup: 'meta-raft' },
    { nodeId: 'blob-node-3', serviceType: 'blob', advertiseAddr: '10.0.1.3:9000', httpAddr: '10.0.1.3:8081', status: 'active', lastHeartbeat: '2026-03-13T10:25:08Z', isActive: true, raftGroup: 'blob-raft' },
    { nodeId: 'coord-node-3', serviceType: 'coordinator', advertiseAddr: '10.0.1.3:9000', httpAddr: '10.0.1.3:8082', status: 'active', lastHeartbeat: '2026-03-13T10:24:55Z', isActive: true, raftGroup: 'coord-raft' },
    { nodeId: 'meta-node-4', serviceType: 'meta', advertiseAddr: '10.0.2.1:9000', httpAddr: '10.0.2.1:8080', status: 'draining', lastHeartbeat: '2026-03-13T10:20:00Z', isActive: true, raftGroup: 'meta-raft' },
    { nodeId: 'blob-node-4', serviceType: 'blob', advertiseAddr: '10.0.2.1:9000', httpAddr: '10.0.2.1:8081', status: 'active', lastHeartbeat: '2026-03-13T10:25:15Z', isActive: true, raftGroup: 'blob-raft' },
    { nodeId: 'gw-node-3', serviceType: 'gateway', advertiseAddr: '10.0.2.1:9000', httpAddr: '10.0.2.1:8083', status: 'inactive', lastHeartbeat: '2026-03-13T08:30:00Z', isActive: false },
  ]

  const racks = $derived.by(() => {
    const map = new Map<string, DemoNode[]>()
    for (const node of nodes) {
      const list = map.get(node.advertiseAddr) ?? []
      list.push(node)
      map.set(node.advertiseAddr, list)
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([addr, rackNodes], i) => {
        const sorted = rackNodes.sort((a, b) => a.serviceType.localeCompare(b.serviceType))
        return {
          name: `rack-${i + 1}`,
          address: addr,
          nodes: sorted,
          total: sorted.length,
          active: sorted.filter(n => n.status === 'active').length,
          draining: sorted.filter(n => n.status === 'draining').length,
          inactive: sorted.filter(n => !n.isActive).length,
        }
      })
  })

  const serviceTypes = $derived([...new Set(nodes.map(n => n.serviceType))].sort())

  const raftGroups = $derived.by(() => {
    const groups = new Map<string, DemoNode[]>()
    for (const node of nodes) {
      if (!node.raftGroup) continue
      const list = groups.get(node.raftGroup) ?? []
      list.push(node)
      groups.set(node.raftGroup, list)
    }
    return [...groups.entries()].map(([name, members]) => ({
      name, ...RAFT_STYLES[name], members,
      leader: members.find(m => m.isRaftLeader),
      count: members.length,
    }))
  })

  const statelessNodes = $derived(nodes.filter(n => !n.raftGroup))

  // SVG topology layout
  const topo = $derived.by(() => {
    const padL = 105, padT = 65, padR = 45, padB = 50
    const colGap = 175, rowGap = 85
    const rc = racks.length, sc = serviceTypes.length
    const w = padL + (rc - 1) * colGap + padR
    const h = padT + (sc - 1) * rowGap + padB
    const rx = racks.map((_, i) => padL + i * colGap)
    const svcRows = serviceTypes.map((st, i) => ({ type: st, y: padT + i * rowGap }))
    const sy: Record<string, number> = Object.fromEntries(svcRows.map(r => [r.type, r.y]))

    const npos = nodes
      .map(node => {
        const ri = racks.findIndex(r => r.address === node.advertiseAddr)
        return ri >= 0 && sy[node.serviceType] != null
          ? { node, x: rx[ri], y: sy[node.serviceType] }
          : null
      })
      .filter((p): p is { node: DemoNode; x: number; y: number } => p !== null)

    const conns: Array<{ path: string; color: string; group: string }> = []
    for (const g of raftGroups) {
      if (!g.leader) continue
      const lp = npos.find(p => p.node.nodeId === g.leader!.nodeId)
      if (!lp) continue
      for (const m of g.members) {
        if (m.nodeId === g.leader!.nodeId) continue
        const mp = npos.find(p => p.node.nodeId === m.nodeId)
        if (!mp) continue
        const dx = Math.abs(mp.x - lp.x)
        const arc = -Math.min(dx * 0.2, 40)
        const mx = (mp.x + lp.x) / 2
        conns.push({ path: `M${mp.x},${mp.y} Q${mx},${mp.y + arc} ${lp.x},${lp.y}`, color: g.color, group: g.name })
      }
    }
    return { w, h, rx, svcRows, npos, conns }
  })

  const activeFilter = $derived(selectedRaft ?? hoverRaft)

  function nodeOpacity(node?: DemoNode): number {
    if (!node || !activeFilter) return 1
    if (node.raftGroup === activeFilter) return 1
    return selectedRaft ? 0.08 : 0.25
  }

  function nodeGlow(node: DemoNode): string {
    if (!node.raftGroup) return 'none'
    const s = RAFT_STYLES[node.raftGroup]
    if (node.isRaftLeader) return `0 0 10px ${s.color}, 0 0 3px ${s.color}`
    if (activeFilter === node.raftGroup) return `0 0 6px ${s.color}`
    return 'none'
  }

  function matrixNode(svc: string, addr: string) {
    return nodes.find(n => n.serviceType === svc && n.advertiseAddr === addr)
  }

  function rackForAddr(addr: string) {
    return racks.find(r => r.address === addr)?.name ?? addr
  }

  function enterNode(node: DemoNode) { if (node.raftGroup) hoverRaft = node.raftGroup }
  function leaveNode() { hoverRaft = null }

  const stats = {
    total: nodes.length,
    active: nodes.filter(n => n.status === 'active').length,
    draining: nodes.filter(n => n.status === 'draining').length,
    inactive: nodes.filter(n => !n.isActive).length,
  }
</script>

<svelte:head><title>Topology · mountOS Admin</title></svelte:head>

<div class="space-y-5">
  <!-- Header -->
  <div class="flex items-start justify-between gap-4">
    <div>
      <div class="flex items-center gap-3">
        <h1 class="text-2xl font-bold tracking-tight">Region Topology</h1>
        <Badge variant="secondary" class="text-xs tracking-widest">DEMO</Badge>
      </div>
      <div class="mt-1 flex items-center gap-2 text-sm">
        <span class="font-mono text-muted-foreground">{region.name}</span>
        <Badge variant={region.isActive ? 'success' : 'secondary'}>
          {region.isActive ? 'Active' : 'Inactive'}
        </Badge>
      </div>
    </div>
    <div class="flex gap-1">
      {#each [['rack', 'Rack'], ['matrix', 'Matrix'], ['raft', 'RAFT']] as [mode, label]}
        <Button variant={viewMode === mode ? 'default' : 'outline'} size="sm"
          onclick={() => viewMode = mode as ViewMode}>{label}</Button>
      {/each}
    </div>
  </div>

  <!-- Stats -->
  <div class="flex flex-wrap gap-x-6 gap-y-1 text-sm">
    <div><span class="text-muted-foreground">Racks</span> <span class="ml-1 font-medium">{racks.length}</span></div>
    <div><span class="text-muted-foreground">Nodes</span> <span class="ml-1 font-medium">{stats.total}</span></div>
    <div><span class="text-muted-foreground">Active</span> <span class="ml-1 font-medium" style:color={STATUS_COLORS.active}>{stats.active}</span></div>
    {#if stats.draining > 0}
      <div><span class="text-muted-foreground">Draining</span> <span class="ml-1 font-medium" style:color={STATUS_COLORS.draining}>{stats.draining}</span></div>
    {/if}
    {#if stats.inactive > 0}
      <div><span class="text-muted-foreground">Inactive</span> <span class="ml-1 font-medium" style:color={STATUS_COLORS.inactive}>{stats.inactive}</span></div>
    {/if}
    <div><span class="text-muted-foreground">RAFT Groups</span> <span class="ml-1 font-medium">{raftGroups.length}</span></div>
  </div>

  <!-- RAFT Legend -->
  <div class="flex flex-wrap items-center gap-2">
    {#each raftGroups as group}
      <button
        type="button"
        class="raft-pill flex items-center gap-2 rounded-sm border px-3 py-1.5 text-sm transition-[background-color,border-color,outline-color,opacity] cursor-pointer"
        style:border-color={selectedRaft === group.name ? group.color : undefined}
        style:background={selectedRaft === group.name ? group.bgColor : undefined}
        style:outline={selectedRaft === group.name ? `2px solid ${group.color}` : 'none'}
        style:outline-offset="1px"
        aria-pressed={selectedRaft === group.name}
        onclick={() => toggleRaft(group.name)}
        onmouseenter={() => hoverRaft = group.name}
        onmouseleave={() => hoverRaft = null}
      >
        <span class="led-indicator h-2.5 w-2.5 rounded-sm shrink-0" style:background={group.color} style:--led={group.color}></span>
        <span class="font-medium">{group.label}</span>
        <span class="text-muted-foreground">{group.count}</span>
        {#if group.leader}
          <span class="text-muted-foreground">·</span>
          <span class="font-mono text-muted-foreground">{group.leader.nodeId}</span>
        {/if}
      </button>
    {/each}
    {#if selectedRaft}
      <button type="button" class="text-sm text-muted-foreground underline cursor-pointer" onclick={() => selectedRaft = null}>clear</button>
    {/if}
  </div>

  <Separator />

  <!-- ==================== RACK VIEW ==================== -->
  {#if viewMode === 'rack'}
    <div class="grid gap-6 md:grid-cols-2">
      {#each racks as rack}
        <Card cornerBrackets class="overflow-hidden">
          <CardHeader>
            <div class="flex items-center justify-between">
              <CardTitle class="text-base">{rack.name}</CardTitle>
              <Badge variant="outline" class="font-mono text-sm">{rack.address}</Badge>
            </div>
            <div class="flex items-center gap-3 text-sm text-muted-foreground">
              <span>{rack.total} nodes</span>
              <span style:color={STATUS_COLORS.active}>{rack.active} active</span>
              {#if rack.draining > 0}
                <span style:color={STATUS_COLORS.draining}>{rack.draining} draining</span>
              {/if}
              {#if rack.inactive > 0}
                <span style:color={STATUS_COLORS.inactive}>{rack.inactive} inactive</span>
              {/if}
            </div>
            <div class="flex h-1 w-full overflow-hidden rounded-sm bg-muted">
              {#if rack.active > 0}<div style="width: {(rack.active / rack.total) * 100}%; background: {STATUS_COLORS.active}"></div>{/if}
              {#if rack.draining > 0}<div style="width: {(rack.draining / rack.total) * 100}%; background: {STATUS_COLORS.draining}"></div>{/if}
              {#if rack.inactive > 0}<div style="width: {(rack.inactive / rack.total) * 100}%; background: {STATUS_COLORS.inactive}"></div>{/if}
            </div>
          </CardHeader>
          <CardContent class="pt-0">
            {#each rack.nodes as node, ni}
              <div role="listitem"
                class="node-slot flex items-center gap-2.5 px-3 py-2.5 transition-[opacity,box-shadow] duration-200"
                class:node-slot-last={ni === rack.nodes.length - 1}
                style:opacity={nodeOpacity(node)}
                style:box-shadow={nodeGlow(node)}
                onmouseenter={() => enterNode(node)}
                onmouseleave={leaveNode}
              >
                <!-- Raft group indicator dot -->
                <span class="h-2.5 w-2.5 rounded-sm shrink-0"
                  class:opacity-25={!node.raftGroup}
                  style:background={node.raftGroup ? RAFT_STYLES[node.raftGroup].color : 'var(--color-border)'}></span>
                <!-- Status LED -->
                <span class="relative flex h-2.5 w-2.5 shrink-0">
                  <span class="absolute inset-0 rounded-full" style:background={STATUS_COLORS[node.status]}></span>
                  {#if node.status === 'active'}
                    <span class="absolute inset-0 rounded-full ping-led" style:background={STATUS_COLORS[node.status]}></span>
                  {/if}
                </span>
                <span class="font-mono text-sm flex-1 truncate tracking-tight" title={node.nodeId}>{node.nodeId}</span>
                <Badge variant="outline" class="text-xs px-1.5 py-0 shrink-0">{node.serviceType}</Badge>
                {#if node.isRaftLeader}
                  <Badge variant="primary" class="text-xs px-1.5 py-0 shrink-0 leader-badge">LEADER</Badge>
                {/if}
                {#if node.status === 'draining'}
                  <Badge variant="warning" class="text-xs px-1.5 py-0 shrink-0">DRAINING</Badge>
                {/if}
                {#if !node.isActive}
                  <Badge variant="secondary" class="text-xs px-1.5 py-0 shrink-0">DOWN</Badge>
                {/if}
              </div>
            {/each}
          </CardContent>
        </Card>
      {/each}
    </div>

  <!-- ==================== MATRIX VIEW ==================== -->
  {:else if viewMode === 'matrix'}
    <div class="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead class="th-cyber w-32">Service</TableHead>
            {#each racks as rack}
              <TableHead class="th-cyber">
                <div class="text-sm">{rack.name}</div>
                <div class="font-mono text-xs font-normal text-muted-foreground">{rack.address}</div>
              </TableHead>
            {/each}
          </TableRow>
        </TableHeader>
        <TableBody>
          {#each serviceTypes as serviceType}
            <TableRow>
              <TableCell><Badge variant="outline">{serviceType}</Badge></TableCell>
              {#each racks as rack}
                {@const node = matrixNode(serviceType, rack.address)}
                {@const cellBg = node?.raftGroup
                  ? RAFT_STYLES[node.raftGroup].bgColor
                  : !node ? 'repeating-linear-gradient(45deg,transparent,transparent 4px,var(--border) 4px,var(--border) 5px)' : 'transparent'}
                <TableCell
                  class="transition-[background-color,opacity] duration-200"
                  style="background: {cellBg}; opacity: {nodeOpacity(node)}"
                  onmouseenter={() => { if (node) enterNode(node) }}
                  onmouseleave={leaveNode}
                >
                  {#if node}
                    <div class="flex items-center gap-1.5">
                      <span class="relative flex h-2 w-2 shrink-0">
                        <span class="absolute inset-0 rounded-full" style:background={STATUS_COLORS[node.status]}></span>
                        {#if node.status === 'active'}
                          <span class="absolute inset-0 rounded-full ping-led" style:background={STATUS_COLORS[node.status]}></span>
                        {/if}
                      </span>
                      <span class="font-mono text-sm">{node.nodeId}</span>
                    </div>
                    <div class="flex gap-1 mt-1">
                      {#if node.isRaftLeader}
                        <Badge variant="primary" class="text-xs px-1 py-0 leader-badge">LEADER</Badge>
                      {/if}
                      {#if node.status === 'draining'}
                        <Badge variant="warning" class="text-xs px-1 py-0">DRAINING</Badge>
                      {/if}
                      {#if !node.isActive}
                        <Badge variant="secondary" class="text-xs px-1 py-0">DOWN</Badge>
                      {/if}
                    </div>
                  {:else}
                    <span class="text-muted-foreground/30 text-sm">--</span>
                  {/if}
                </TableCell>
              {/each}
            </TableRow>
          {/each}
        </TableBody>
      </Table>
    </div>

  <!-- ==================== RAFT TOPOLOGY SVG ==================== -->
  {:else}
    <div class="topo-container overflow-x-auto rounded-sm p-3">
      <svg
        viewBox="0 0 {topo.w} {topo.h}"
        class="w-full"
        role="img" aria-label="RAFT topology diagram"
        style="min-width: min(620px, 100%); max-height: 500px;"
      >
        <defs>
          <!-- Tech grid -->
          <pattern id="tgrid" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M 24 0 L 0 0 0 24" fill="none" stroke="var(--color-foreground)" stroke-width="0.3" stroke-opacity="0.05" />
          </pattern>
          <!-- Glow filter -->
          <filter id="glow">
            <feGaussianBlur stdDeviation="5" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="glow-soft">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        <!-- Background grid pattern -->
        <rect width="100%" height="100%" fill="url(#tgrid)" />

        <!-- Dashed guide lines -->
        {#each topo.svcRows as row}
          <line x1="70" y1={row.y} x2={topo.w - 20} y2={row.y}
            stroke="var(--color-border)" stroke-opacity="0.25" stroke-dasharray="3 6" />
        {/each}
        {#each topo.rx as x}
          <line x1={x} y1="52" x2={x} y2={topo.h - 15}
            stroke="var(--color-border)" stroke-opacity="0.25" stroke-dasharray="3 6" />
        {/each}

        <!-- Rack column pillars -->
        {#each racks as rack, i}
          <rect
            x={topo.rx[i] - 68} y="8" width="136" height={topo.h - 16}
            rx="3" fill="var(--color-foreground)" fill-opacity="0.02"
            stroke="var(--color-border)" stroke-opacity="0.12" stroke-width="0.5"
          />
          <text x={topo.rx[i]} y="28" text-anchor="middle"
            font-size="11" font-weight="600" fill="var(--color-foreground)">{rack.name}</text>
          <text x={topo.rx[i]} y="43" text-anchor="middle"
            font-size="8.5" font-family="ui-monospace, monospace" fill="var(--color-muted-foreground)">{rack.address}</text>
        {/each}

        <!-- Service row labels -->
        {#each topo.svcRows as row}
          <text x="10" y={row.y + 4} font-size="10" fill="var(--color-muted-foreground)">{row.type}</text>
        {/each}

        <!-- RAFT connections (glow + animated dash) -->
        {#each topo.conns as conn}
          {@const dim = activeFilter !== null && activeFilter !== conn.group}
          <path d={conn.path} fill="none"
            stroke={conn.color} stroke-width="8" opacity={dim ? 0.01 : 0.1}
            filter={dim ? undefined : 'url(#glow-soft)'} />
          <path d={conn.path} fill="none"
            stroke={conn.color} stroke-width={dim ? 0.7 : 1.5}
            stroke-dasharray="6 3" opacity={dim ? 0.08 : 0.75}
            class="conn-flow" />
        {/each}

        <!-- Nodes -->
        {#each topo.npos as { x, y, node }}
          {@const dim = activeFilter !== null && node.raftGroup !== activeFilter}
          {@const r = node.isRaftLeader ? 14 : 10}
          {@const rstyle = node.raftGroup ? RAFT_STYLES[node.raftGroup] : null}
          <g class="topo-node" role="button" tabindex="0"
            aria-label="Node {node.nodeId}, {node.serviceType}, status: {node.status}{node.isRaftLeader ? ', RAFT leader' : ''}"
            style="opacity: {dim ? 0.1 : 1}; transition: opacity 0.3s ease;"
            onpointerenter={(e: PointerEvent) => { enterNode(node); svgTip = { node, x: e.clientX, y: e.clientY } }}
            onpointermove={(e: PointerEvent) => { if (svgTip) svgTip = { node, x: e.clientX, y: e.clientY } }}
            onpointerleave={() => { leaveNode(); svgTip = null }}
            onclick={() => { if (node.raftGroup) toggleRaft(node.raftGroup) }}
            onkeydown={(e: KeyboardEvent) => { if ((e.key === 'Enter' || e.key === ' ') && node.raftGroup) { e.preventDefault(); toggleRaft(node.raftGroup) } }}
          >
            <!-- Outer RAFT ring -->
            {#if rstyle}
              <circle cx={x} cy={y} r={r + 7} fill="none"
                stroke={rstyle.color} stroke-width={node.isRaftLeader ? 2.5 : 1}
                opacity={node.isRaftLeader ? 0.8 : 0.2} />
            {/if}

            <!-- Leader outer glow -->
            {#if node.isRaftLeader && rstyle && !dim}
              <circle cx={x} cy={y} r={r + 3} fill={rstyle.color} opacity="0.15"
                filter="url(#glow)" class="leader-glow-svg" />
            {/if}

            <!-- Main status circle -->
            <circle cx={x} cy={y} r={r} fill={STATUS_COLORS[node.status]} />

            <!-- Active heartbeat ping -->
            {#if node.status === 'active' && !dim}
              <circle cx={x} cy={y} r={r} fill="none"
                stroke={STATUS_COLORS.active} stroke-width="1">
                <animate attributeName="r" from="{r}" to="{r + 14}" dur="2.5s" repeatCount="indefinite" />
                <animate attributeName="opacity" from="0.45" to="0" dur="2.5s" repeatCount="indefinite" />
              </circle>
            {/if}

            <!-- Leader "L" marker -->
            {#if node.isRaftLeader}
              <text x={x} y={y + 4} text-anchor="middle"
                font-size="11" font-weight="700" fill="var(--foreground)"
                style="text-shadow: 0 1px 2px oklch(0 0 0 / 0.5);">L</text>
            {/if}

            <!-- Node ID label -->
            <text x={x} y={y + r + 15} text-anchor="middle"
              font-size="7.5" font-family="ui-monospace, monospace"
              fill="var(--color-muted-foreground)">{node.nodeId}</text>

            <!-- Status label for non-active -->
            {#if node.status !== 'active'}
              <text x={x} y={y + r + 24} text-anchor="middle"
                font-size="7" font-weight="600"
                fill={STATUS_COLORS[node.status]}>{node.status.toUpperCase()}</text>
            {/if}

            <!-- Invisible hover target -->
            <circle cx={x} cy={y} r="24" fill="transparent" class="cursor-pointer" />
          </g>
        {/each}
      </svg>
    </div>

    <!-- Stateless nodes (below SVG) -->
    {#if statelessNodes.length > 0}
      <Card class="mt-4">
        <CardHeader>
          <div class="flex items-center gap-3">
            <span class="h-3 w-3 rounded-sm shrink-0 bg-muted-foreground/30"></span>
            <CardTitle class="text-base">Stateless Services</CardTitle>
            <span class="text-sm text-muted-foreground">{statelessNodes.length} nodes, no RAFT</span>
          </div>
        </CardHeader>
        <CardContent>
          <div class="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {#each statelessNodes as node}
              <div role="listitem"
                class="node-slot-card rounded-sm border p-3 transition-[opacity] duration-200"
                style:opacity={activeFilter !== null ? 0.2 : 1}
                onmouseenter={() => enterNode(node)}
                onmouseleave={leaveNode}
              >
                <div class="flex items-center gap-2 mb-2">
                  <span class="relative flex h-2 w-2 shrink-0">
                    <span class="absolute inset-0 rounded-full" style:background={STATUS_COLORS[node.status]}></span>
                    {#if node.status === 'active'}
                      <span class="absolute inset-0 rounded-full ping-led" style:background={STATUS_COLORS[node.status]}></span>
                    {/if}
                  </span>
                  <span class="font-mono text-sm font-medium truncate" title={node.nodeId}>{node.nodeId}</span>
                </div>
                <div class="space-y-1 text-sm text-muted-foreground">
                  <div><Badge variant="outline" class="text-xs px-1.5 py-0">{node.serviceType}</Badge></div>
                  <div class="font-mono">{rackForAddr(node.advertiseAddr)}</div>
                  <div class="font-mono text-xs">{node.advertiseAddr}</div>
                </div>
                {#if !node.isActive}
                  <div class="mt-2"><Badge variant="secondary" class="text-xs px-1.5 py-0">DOWN</Badge></div>
                {/if}
              </div>
            {/each}
          </div>
        </CardContent>
      </Card>
    {/if}
  {/if}
</div>

<!-- SVG Tooltip -->
{#if svgTip}
  <div
    class="fixed z-50 pointer-events-none rounded-sm border bg-card px-3 py-2 shadow-lg"
    style:left="{svgTip.x + 16}px"
    style:top="{svgTip.y - 12}px"
  >
    <div class="font-mono text-sm font-semibold">{svgTip.node.nodeId}</div>
    <div class="mt-1 space-y-0.5 text-xs text-muted-foreground">
      <div>Service: <span class="text-foreground">{svgTip.node.serviceType}</span></div>
      <div>Status: <span style:color={STATUS_COLORS[svgTip.node.status]}>{svgTip.node.status}</span></div>
      <div>Rack: <span class="text-foreground font-mono">{rackForAddr(svgTip.node.advertiseAddr)}</span></div>
      {#if svgTip.node.raftGroup}
        <div>RAFT: <span class="text-foreground">{svgTip.node.raftGroup}</span>
          {#if svgTip.node.isRaftLeader}<span class="font-semibold text-foreground ml-1">LEADER</span>{/if}
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  /* Connection flow animation */
  .conn-flow {
    animation: dash-flow 0.9s linear infinite;
  }
  @keyframes dash-flow {
    to { stroke-dashoffset: -9; }
  }

  /* Status LED ping; GPU-composited (transform + opacity only) */
  .ping-led {
    will-change: transform, opacity;
    animation: ping-slow 2.5s cubic-bezier(0, 0, 0.2, 1) infinite;
  }
  @keyframes ping-slow {
    0% { opacity: 0.5; transform: scale(1); }
    75%, 100% { opacity: 0; transform: scale(2.8); }
  }

  /* RAFT legend LED glow; use opacity instead of box-shadow */
  .led-indicator {
    box-shadow: 0 0 6px var(--led);
    animation: led-pulse 3s ease-in-out infinite;
    will-change: opacity;
  }
  @keyframes led-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }

  /* Leader badge shimmer; use opacity instead of filter: brightness */
  :global(.leader-badge) {
    animation: badge-glow 2.5s ease-in-out infinite;
    will-change: opacity;
  }
  @keyframes badge-glow {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.75; }
  }

  /* SVG leader glow pulse; already GPU-friendly */
  .leader-glow-svg {
    animation: svg-glow 2.5s ease-in-out infinite;
    will-change: opacity;
  }
  @keyframes svg-glow {
    0%, 100% { opacity: 0.12; }
    50% { opacity: 0.3; }
  }

  /* Disable animations for reduced-motion preference */
  @media (prefers-reduced-motion: reduce) {
    .conn-flow, .ping-led, .led-indicator,
    :global(.leader-badge), .leader-glow-svg, .topo-container {
      animation: none !important;
    }
  }

  /* Node slot styling */
  .node-slot {
    border-bottom: 1px dashed oklch(0.5 0 0 / 0.1);
    cursor: default;
  }
  :global(.dark) .node-slot {
    border-bottom-color: oklch(0.5 0 0 / 0.2);
  }
  .node-slot-last {
    border-bottom: none;
  }
  .node-slot:hover {
    background: oklch(0.5 0 0 / 0.03);
  }
  :global(.dark) .node-slot:hover {
    background: oklch(0.5 0 0 / 0.08);
  }

  .node-slot-card:hover {
    background: oklch(0.5 0 0 / 0.03);
  }

  .topo-node:focus-visible {
    outline: 2px solid var(--color-ring);
    outline-offset: 3px;
    border-radius: 2px;
  }

  /* Topo SVG container with animated gradient border */
  .topo-container {
    background:
      linear-gradient(var(--color-card), var(--color-card)) padding-box,
      linear-gradient(135deg, oklch(0.55 0.18 260), oklch(0.65 0.18 55), oklch(0.55 0.15 175), oklch(0.55 0.18 260)) border-box;
    border: 1.5px solid transparent;
    background-size: 100% 100%, 400% 400%;
    animation: border-shift 6s ease-in-out infinite;
  }
  @keyframes border-shift {
    0%, 100% { background-position: 0 0, 0% 0%; }
    33% { background-position: 0 0, 100% 0%; }
    66% { background-position: 0 0, 100% 100%; }
  }

  /* Topology node cursor */
  .topo-node { cursor: pointer; }
</style>
