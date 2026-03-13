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

  function toggleRaft(name: string) {
    selectedRaft = selectedRaft === name ? null : name
  }

  const RAFT_STYLES: Record<string, RaftStyle> = {
    'meta-raft': { color: 'oklch(0.55 0.18 260)', bgColor: 'oklch(0.55 0.18 260 / 0.08)', label: 'Meta' },
    'blob-raft': { color: 'oklch(0.65 0.18 55)', bgColor: 'oklch(0.65 0.18 55 / 0.08)', label: 'Blob' },
    'coord-raft': { color: 'oklch(0.55 0.15 175)', bgColor: 'oklch(0.55 0.15 175 / 0.08)', label: 'Coordinator' },
  }

  const STATUS_COLORS: Record<NodeStatus, string> = {
    active: 'oklch(0.6 0.18 145)',
    draining: 'oklch(0.7 0.15 80)',
    inactive: 'oklch(0.5 0 0)',
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
      name,
      ...RAFT_STYLES[name],
      members,
      leader: members.find(m => m.isRaftLeader),
      count: members.length,
    }))
  })

  const statelessNodes = $derived(nodes.filter(n => !n.raftGroup))

  function isDimmed(node: DemoNode): boolean {
    return selectedRaft !== null && node.raftGroup !== selectedRaft
  }

  function matrixNode(serviceType: string, addr: string): DemoNode | undefined {
    return nodes.find(n => n.serviceType === serviceType && n.advertiseAddr === addr)
  }

  function rackForAddr(addr: string): string {
    return racks.find(r => r.address === addr)?.name ?? addr
  }

  const stats = {
    total: nodes.length,
    active: nodes.filter(n => n.status === 'active').length,
    draining: nodes.filter(n => n.status === 'draining').length,
    inactive: nodes.filter(n => !n.isActive).length,
  }
</script>

<div class="space-y-5">
  <!-- Header -->
  <div class="flex items-start justify-between gap-4">
    <div>
      <div class="flex items-center gap-3">
        <h2 class="text-2xl font-bold tracking-tight">Region Topology</h2>
        <Badge variant="secondary" class="text-[10px]">DEMO</Badge>
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
        <Button
          variant={viewMode === mode ? 'default' : 'outline'}
          size="sm"
          onclick={() => viewMode = mode as ViewMode}
        >{label}</Button>
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
        class="flex items-center gap-2 rounded-sm border px-3 py-1.5 text-xs transition-all cursor-pointer"
        style:border-color={selectedRaft === group.name ? group.color : undefined}
        style:background={selectedRaft === group.name ? group.bgColor : undefined}
        style:outline={selectedRaft === group.name ? `2px solid ${group.color}` : 'none'}
        style:outline-offset="1px"
        onclick={() => toggleRaft(group.name)}
      >
        <span class="h-2.5 w-2.5 rounded-sm shrink-0" style:background={group.color}></span>
        <span class="font-medium">{group.label}</span>
        <span class="text-muted-foreground">{group.count}</span>
        {#if group.leader}
          <span class="text-muted-foreground">·</span>
          <span class="font-mono text-muted-foreground">{group.leader.nodeId}</span>
        {/if}
      </button>
    {/each}
    {#if selectedRaft}
      <button class="text-xs text-muted-foreground underline cursor-pointer" onclick={() => selectedRaft = null}>clear</button>
    {/if}
  </div>

  <Separator />

  <!-- Rack View -->
  {#if viewMode === 'rack'}
    <div class="grid gap-6 md:grid-cols-2">
      {#each racks as rack}
        <Card cornerBrackets>
          <CardHeader>
            <div class="flex items-center justify-between">
              <CardTitle class="text-base">{rack.name}</CardTitle>
              <Badge variant="outline" class="font-mono text-xs">{rack.address}</Badge>
            </div>
            <div class="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{rack.total} nodes</span>
              <span style:color={STATUS_COLORS.active}>{rack.active} active</span>
              {#if rack.draining > 0}
                <span style:color={STATUS_COLORS.draining}>{rack.draining} draining</span>
              {/if}
              {#if rack.inactive > 0}
                <span style:color={STATUS_COLORS.inactive}>{rack.inactive} inactive</span>
              {/if}
            </div>
            <!-- Health bar -->
            <div class="flex h-1 w-full overflow-hidden rounded-full bg-muted">
              {#if rack.active > 0}
                <div style="width: {(rack.active / rack.total) * 100}%; background: {STATUS_COLORS.active}"></div>
              {/if}
              {#if rack.draining > 0}
                <div style="width: {(rack.draining / rack.total) * 100}%; background: {STATUS_COLORS.draining}"></div>
              {/if}
              {#if rack.inactive > 0}
                <div style="width: {(rack.inactive / rack.total) * 100}%; background: {STATUS_COLORS.inactive}"></div>
              {/if}
            </div>
          </CardHeader>
          <CardContent class="space-y-1">
            {#each rack.nodes as node}
              <div
                class="flex items-center gap-2 rounded-sm px-2 py-1.5 transition-opacity duration-200"
                style:border-left="3px solid {node.raftGroup ? RAFT_STYLES[node.raftGroup].color : 'transparent'}"
                style:background={node.raftGroup ? RAFT_STYLES[node.raftGroup].bgColor : undefined}
                style:opacity={isDimmed(node) ? 0.15 : 1}
              >
                <span class="h-2 w-2 rounded-full shrink-0" style:background={STATUS_COLORS[node.status]}></span>
                <span class="font-mono text-xs flex-1 truncate">{node.nodeId}</span>
                <Badge variant="outline" class="text-[10px] px-1.5 py-0 shrink-0">{node.serviceType}</Badge>
                {#if node.isRaftLeader}
                  <Badge variant="primary" class="text-[10px] px-1.5 py-0 shrink-0">LEADER</Badge>
                {/if}
                {#if node.status === 'draining'}
                  <Badge variant="warning" class="text-[10px] px-1.5 py-0 shrink-0">DRAINING</Badge>
                {/if}
                {#if !node.isActive}
                  <Badge variant="secondary" class="text-[10px] px-1.5 py-0 shrink-0">DOWN</Badge>
                {/if}
              </div>
            {/each}
          </CardContent>
        </Card>
      {/each}
    </div>

  <!-- Matrix View -->
  {:else if viewMode === 'matrix'}
    <div class="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead class="w-32">Service</TableHead>
            {#each racks as rack}
              <TableHead>
                <div class="text-xs">{rack.name}</div>
                <div class="font-mono text-[10px] font-normal text-muted-foreground">{rack.address}</div>
              </TableHead>
            {/each}
          </TableRow>
        </TableHeader>
        <TableBody>
          {#each serviceTypes as serviceType}
            <TableRow>
              <TableCell>
                <Badge variant="outline">{serviceType}</Badge>
              </TableCell>
              {#each racks as rack}
                {@const node = matrixNode(serviceType, rack.address)}
                <TableCell
                  class="transition-opacity duration-200"
                  style="background: {node?.raftGroup ? RAFT_STYLES[node.raftGroup].bgColor : 'transparent'}; opacity: {node && isDimmed(node) ? 0.15 : 1}"
                >
                  {#if node}
                    <div class="flex items-center gap-1.5">
                      <span class="h-2 w-2 rounded-full shrink-0" style:background={STATUS_COLORS[node.status]}></span>
                      <span class="font-mono text-xs">{node.nodeId}</span>
                    </div>
                    <div class="flex gap-1 mt-1">
                      {#if node.isRaftLeader}
                        <Badge variant="primary" class="text-[10px] px-1 py-0">LEADER</Badge>
                      {/if}
                      {#if node.status === 'draining'}
                        <Badge variant="warning" class="text-[10px] px-1 py-0">DRAINING</Badge>
                      {/if}
                      {#if !node.isActive}
                        <Badge variant="secondary" class="text-[10px] px-1 py-0">DOWN</Badge>
                      {/if}
                    </div>
                  {:else}
                    <span class="text-muted-foreground/40 text-xs">--</span>
                  {/if}
                </TableCell>
              {/each}
            </TableRow>
          {/each}
        </TableBody>
      </Table>
    </div>

  <!-- RAFT View -->
  {:else}
    <div class="space-y-6">
      {#each raftGroups as group}
        <Card
          cornerBrackets
          class="transition-opacity duration-200"
          style="opacity: {selectedRaft !== null && selectedRaft !== group.name ? 0.3 : 1}"
        >
          <CardHeader>
            <div class="flex items-center gap-3">
              <span class="h-3 w-3 rounded-sm shrink-0" style:background={group.color}></span>
              <CardTitle class="text-base">{group.label} RAFT Group</CardTitle>
              <Badge variant="outline" class="font-mono text-xs">{group.name}</Badge>
            </div>
            <div class="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{group.count} members</span>
              {#if group.leader}
                <span>Leader: <span class="font-mono font-medium text-foreground">{group.leader.nodeId}</span></span>
                <span>@ {rackForAddr(group.leader.advertiseAddr)}</span>
              {/if}
            </div>
          </CardHeader>
          <CardContent>
            <div class="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {#each group.members as node}
                <div
                  class="rounded-sm border p-3 transition-all"
                  style:border-color={node.isRaftLeader ? group.color : undefined}
                  style:background={group.bgColor}
                  style:border-left="3px solid {group.color}"
                >
                  <div class="flex items-center gap-2 mb-2">
                    <span class="h-2 w-2 rounded-full shrink-0" style:background={STATUS_COLORS[node.status]}></span>
                    <span class="font-mono text-xs font-medium truncate">{node.nodeId}</span>
                  </div>
                  <div class="space-y-1 text-xs text-muted-foreground">
                    <div class="font-mono">{rackForAddr(node.advertiseAddr)}</div>
                    <div class="font-mono text-[10px]">{node.advertiseAddr}</div>
                  </div>
                  <div class="flex gap-1 mt-2">
                    {#if node.isRaftLeader}
                      <Badge variant="primary" class="text-[10px] px-1.5 py-0">LEADER</Badge>
                    {/if}
                    {#if node.status === 'draining'}
                      <Badge variant="warning" class="text-[10px] px-1.5 py-0">DRAINING</Badge>
                    {/if}
                    {#if !node.isActive}
                      <Badge variant="secondary" class="text-[10px] px-1.5 py-0">DOWN</Badge>
                    {/if}
                    {#if node.status === 'active' && !node.isRaftLeader}
                      <Badge variant="success" class="text-[10px] px-1.5 py-0">FOLLOWER</Badge>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          </CardContent>
        </Card>
      {/each}

      <!-- Stateless nodes -->
      {#if statelessNodes.length > 0}
        <Card>
          <CardHeader>
            <div class="flex items-center gap-3">
              <span class="h-3 w-3 rounded-sm shrink-0 bg-muted-foreground/30"></span>
              <CardTitle class="text-base">Stateless Services</CardTitle>
            </div>
            <p class="text-xs text-muted-foreground">{statelessNodes.length} nodes not participating in RAFT consensus</p>
          </CardHeader>
          <CardContent>
            <div class="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {#each statelessNodes as node}
                <div
                  class="rounded-sm border p-3"
                  style:opacity={selectedRaft !== null ? 0.3 : 1}
                >
                  <div class="flex items-center gap-2 mb-2">
                    <span class="h-2 w-2 rounded-full shrink-0" style:background={STATUS_COLORS[node.status]}></span>
                    <span class="font-mono text-xs font-medium truncate">{node.nodeId}</span>
                  </div>
                  <div class="space-y-1 text-xs text-muted-foreground">
                    <div><Badge variant="outline" class="text-[10px] px-1.5 py-0">{node.serviceType}</Badge></div>
                    <div class="font-mono">{rackForAddr(node.advertiseAddr)}</div>
                    <div class="font-mono text-[10px]">{node.advertiseAddr}</div>
                  </div>
                  {#if !node.isActive}
                    <div class="mt-2">
                      <Badge variant="secondary" class="text-[10px] px-1.5 py-0">DOWN</Badge>
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          </CardContent>
        </Card>
      {/if}
    </div>
  {/if}
</div>
