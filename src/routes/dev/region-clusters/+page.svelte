<script lang="ts">
  import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card'
  import { Badge } from '$lib/components/ui/badge'
  import Button from '$lib/components/ui/button/button.svelte'
  import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '$lib/components/ui/table'
  import { Popover, PopoverTrigger, PopoverContent } from '$lib/components/ui/popover'
  import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '$lib/components/ui/dialog'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import ArrowLeft from '@lucide/svelte/icons/arrow-left'
  import MoreVertical from '@lucide/svelte/icons/more-vertical'
  import Layers from '@lucide/svelte/icons/layers'
  import Pencil from '@lucide/svelte/icons/pencil'
  import PowerOff from '@lucide/svelte/icons/power-off'
  import Shield from '@lucide/svelte/icons/shield'
  import Database from '@lucide/svelte/icons/database'
  import HardDrive from '@lucide/svelte/icons/hard-drive'
  import Box from '@lucide/svelte/icons/box'
  import Cloud from '@lucide/svelte/icons/cloud'
  import Container from '@lucide/svelte/icons/container'
  import ChevronDown from '@lucide/svelte/icons/chevron-down'

  type Cluster = { id: number; name: string; isDefault: boolean; isReady: boolean; isActive: boolean }
  type MockNode = { nodeId: string; type: string; clusterId: number; status: 'healthy' | 'degraded' | 'unhealthy'; advertiseAddr: string }
  type MockLog = { id: string; subject: string; actor: string; clusterId: number | null; at: string }

  const region = { id: 42, name: 'us-east-1', dns: 'us-east-1.mountos.io', isActive: true }

  const multiClusters: Cluster[] = [
    { id: 1, name: 'uno', isDefault: true, isReady: true, isActive: true },
    { id: 2, name: 'tres', isDefault: false, isReady: true, isActive: true },
    { id: 3, name: 'experimental', isDefault: false, isReady: false, isActive: true },
  ]
  const singleCluster: Cluster[] = [
    { id: 1, name: 'uno', isDefault: true, isReady: true, isActive: true },
  ]
  const manyClusters: Cluster[] = [
    { id: 1, name: 'uno', isDefault: true, isReady: true, isActive: true },
    { id: 2, name: 'dos', isDefault: false, isReady: true, isActive: true },
    { id: 3, name: 'tres', isDefault: false, isReady: true, isActive: true },
    { id: 4, name: 'cuatro', isDefault: false, isReady: true, isActive: true },
    { id: 5, name: 'cinco', isDefault: false, isReady: true, isActive: true },
    { id: 6, name: 'seis', isDefault: false, isReady: false, isActive: true },
    { id: 7, name: 'siete', isDefault: false, isReady: true, isActive: true },
    { id: 8, name: 'ocho', isDefault: false, isReady: true, isActive: true },
    { id: 9, name: 'nueve', isDefault: false, isReady: true, isActive: true },
    { id: 10, name: 'experimental-canary', isDefault: false, isReady: false, isActive: true },
  ]
  const manyNodeCounts: Record<number, number> = {
    1: 12, 2: 8, 3: 6, 4: 5, 5: 4, 6: 2, 7: 3, 8: 7, 9: 5, 10: 1,
  }
  const PILL_LIMIT = 4 // pills shown before overflow (plus All + default + selected)

  const allNodes: MockNode[] = [
    // cluster 1 (uno)
    { nodeId: 'hub-1a',       type: 'hub',           clusterId: 1, status: 'healthy', advertiseAddr: '10.0.12.41:9090' },
    { nodeId: 'hub-1b',       type: 'hub',           clusterId: 1, status: 'healthy', advertiseAddr: '10.0.12.42:9090' },
    { nodeId: 'dataserv-1a',  type: 'dataserv',      clusterId: 1, status: 'healthy', advertiseAddr: '10.0.12.43:9091' },
    { nodeId: 'dataserv-1b',  type: 'dataserv',      clusterId: 1, status: 'healthy', advertiseAddr: '10.0.12.44:9091' },
    { nodeId: 'dataserv-1c',  type: 'dataserv',      clusterId: 1, status: 'healthy', advertiseAddr: '10.0.12.45:9091' },
    { nodeId: 'blockserv-1a', type: 'blockserv',     clusterId: 1, status: 'healthy', advertiseAddr: '10.0.12.46:9092' },
    { nodeId: 's3gw-1a',      type: 's3gatewayserv', clusterId: 1, status: 'healthy', advertiseAddr: '10.0.12.47:9093' },
    { nodeId: 'fuseserv-1a',  type: 'fuseserv',      clusterId: 1, status: 'degraded', advertiseAddr: '10.0.12.48:9094' },
    // cluster 2 (tres)
    { nodeId: 'hub-2a',       type: 'hub',           clusterId: 2, status: 'healthy', advertiseAddr: '10.0.13.41:9090' },
    { nodeId: 'dataserv-2a',  type: 'dataserv',      clusterId: 2, status: 'healthy', advertiseAddr: '10.0.13.42:9091' },
    { nodeId: 'dataserv-2b',  type: 'dataserv',      clusterId: 2, status: 'healthy', advertiseAddr: '10.0.13.43:9091' },
    { nodeId: 'blockserv-2a', type: 'blockserv',     clusterId: 2, status: 'healthy', advertiseAddr: '10.0.13.44:9092' },
    { nodeId: 'fuseserv-2a',  type: 'fuseserv',      clusterId: 2, status: 'healthy', advertiseAddr: '10.0.13.45:9094' },
    // cluster 3 (experimental)
    { nodeId: 'hub-3a',       type: 'hub',           clusterId: 3, status: 'degraded',  advertiseAddr: '10.0.14.41:9090' },
    { nodeId: 'dataserv-3a',  type: 'dataserv',      clusterId: 3, status: 'unhealthy', advertiseAddr: '10.0.14.42:9091' },
  ]

  const allLogs: MockLog[] = [
    { id: 'l1', subject: 'volume.create',          actor: 'jane@acme',  clusterId: 1,    at: '2m ago' },
    { id: 'l2', subject: 'node.heartbeat.missed',  actor: 'system',     clusterId: 3,    at: '5m ago' },
    { id: 'l3', subject: 'cluster.set-default',    actor: 'admin@acme', clusterId: 2,    at: '12m ago' },
    { id: 'l4', subject: 'region.edit',            actor: 'admin@acme', clusterId: null, at: '1h ago' },
    { id: 'l5', subject: 'volume.lock',            actor: 'jane@acme',  clusterId: 1,    at: '3h ago' },
    { id: 'l6', subject: 'cluster.create',         actor: 'admin@acme', clusterId: null, at: '1d ago' },
  ]

  // ---- design tokens mirroring RegionTopology ----
  const TIER_COLORS: Record<string, string> = {
    control: 'var(--pastel-region)',
    data:    'var(--pastel-user)',
    storage: 'var(--pastel-storage)',
    gateway: 'var(--pastel-license)',
    edge:    'var(--pastel-mount)',
  }
  const TIERS = [
    { id: 'control', label: 'CONTROL', types: ['hub'] },
    { id: 'data',    label: 'DATA',    types: ['dataserv', 'gcserv'] },
    { id: 'storage', label: 'STORAGE', types: ['blockserv'] },
    { id: 'gateway', label: 'GATEWAY', types: ['s3gatewayserv', 'hdfsserv'] },
    { id: 'edge',    label: 'CLIENT / EDGE', types: ['fuseserv', 'csiserv'] },
  ]
  const SERVICE_PALETTE: Record<string, { accent: string; label: string; icon: typeof Shield }> = {
    hub:           { accent: 'var(--pastel-region)',  label: 'Hub',           icon: Shield },
    dataserv:      { accent: 'var(--pastel-user)',    label: 'Metadata',      icon: Database },
    gcserv:        { accent: 'var(--pastel-role)',    label: 'GC',            icon: Box },
    fuseserv:      { accent: 'var(--pastel-mount)',   label: 'FUSE',          icon: HardDrive },
    blockserv:     { accent: 'var(--pastel-storage)', label: 'Block',         icon: Box },
    s3gatewayserv: { accent: 'var(--pastel-license)', label: 'S3 Gateway',    icon: Cloud },
    hdfsserv:      { accent: 'var(--pastel-license)', label: 'HDFS Gateway',  icon: Cloud },
    csiserv:       { accent: 'var(--pastel-session)', label: 'CSI',           icon: Container },
  }
  const STATUS_COLORS: Record<string, string> = {
    healthy:   'var(--success)',
    degraded:  'var(--warning)',
    unhealthy: 'var(--destructive)',
  }

  // ---- state ----
  let multiSelected = $state<number | null>(null) // null = All clusters
  let manySelected = $state<number | null>(null)
  let manyOverflowOpen = $state(false)
  let topoViewMulti = $state<'graphical' | 'list'>('graphical')
  let topoViewSingle = $state<'graphical' | 'list'>('graphical')
  let editOpen = $state(false)
  let deactivateOpen = $state(false)
  let menuOpen = $state(false)
  let editName = $state(region.name)
  let editDns = $state(region.dns)

  // Split clusters into priority-visible pills and overflow.
  // Priority: default cluster, currently-selected (if not already in visible), then by name.
  function partitionPills(clusters: Cluster[], selected: number | null, limit: number) {
    if (clusters.length <= limit + 1) return { visible: clusters, overflow: [] as Cluster[] }
    const visible: Cluster[] = []
    const seen = new Set<number>()
    const def = clusters.find(c => c.isDefault)
    if (def) { visible.push(def); seen.add(def.id) }
    if (selected != null && !seen.has(selected)) {
      const sel = clusters.find(c => c.id === selected)
      if (sel) { visible.push(sel); seen.add(sel.id) }
    }
    for (const c of clusters) {
      if (visible.length >= limit) break
      if (!seen.has(c.id)) { visible.push(c); seen.add(c.id) }
    }
    const overflow = clusters.filter(c => !seen.has(c.id))
    return { visible, overflow }
  }

  const manyPart = $derived(partitionPills(manyClusters, manySelected, PILL_LIMIT))

  // ---- helpers ----
  function nodesInScope(clusters: Cluster[], selected: number | null): MockNode[] {
    const ids = new Set(clusters.map(c => c.id))
    return allNodes
      .filter(n => ids.has(n.clusterId))
      .filter(n => selected == null || n.clusterId === selected)
  }
  function logsInScope(clusters: Cluster[], selected: number | null): MockLog[] {
    const ids = new Set(clusters.map(c => c.id))
    return allLogs
      .filter(l => l.clusterId == null || ids.has(l.clusterId))
      .filter(l => selected == null || l.clusterId === selected || l.clusterId == null)
  }
  function tiersFor(nodes: MockNode[]) {
    const isHubRegion = nodes.some(n => n.type === 'hub')
    const relevant = isHubRegion ? TIERS : TIERS.filter(t => t.id !== 'control')
    return relevant.map(tier => ({
      ...tier,
      groups: tier.types
        .map(type => ({ type, nodes: nodes.filter(n => n.type === type) }))
        .filter(g => g.nodes.length > 0),
      nodeCount: nodes.filter(n => tier.types.includes(n.type)).length,
    })).filter(t => t.nodeCount > 0)
  }
  function clusterById(clusters: Cluster[], id: number | null) {
    return id == null ? null : clusters.find(c => c.id === id) ?? null
  }
  function clusterName(id: number | null) {
    if (id == null) return '—'
    return multiClusters.find(c => c.id === id)?.name ?? `#${id}`
  }
  function statusDot(s: MockNode['status']) {
    return s === 'healthy' ? 'bg-success' : s === 'degraded' ? 'bg-warning' : 'bg-destructive'
  }
</script>

<div class="mx-auto max-w-7xl space-y-10 p-8">
  <header class="border-b border-border/40 pb-4">
    <h1 class="text-2xl font-bold tracking-tight">Region Clusters — design preview</h1>
    <p class="mt-1 text-sm text-muted-foreground">
      Mock data. Pills cluster picker + List/Graphical topology toggle from the current design, both cluster-aware.
    </p>
  </header>

  <!-- ============= MULTI-CLUSTER SCENARIO ============= -->
  <section class="space-y-3">
    <div class="flex items-center gap-2">
      <h2 class="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Scenario · multi-cluster</h2>
      <Badge variant="outline" class="font-mono text-[10px]">{multiClusters.length} clusters · {allNodes.length} nodes</Badge>
    </div>

    <div class="rounded-sm border bg-background p-6 space-y-6">
      <!-- Region header -->
      <div class="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" class="h-9 w-9 p-0"><ArrowLeft class="h-4 w-4" /></Button>
        <h3 class="text-2xl font-bold tracking-tight">{region.name}</h3>
        <Badge variant={region.isActive ? 'success' : 'secondary'}>{region.isActive ? 'Active' : 'Inactive'}</Badge>
        <span class="font-mono text-xs text-muted-foreground">{region.dns}</span>
        <div class="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm">Clusters</Button>
          <Popover bind:open={menuOpen}>
            <PopoverTrigger>
              {#snippet child({ props })}
                <button {...props} class="inline-flex h-9 w-9 items-center justify-center rounded-sm border border-border/60 text-muted-foreground hover:text-foreground hover:bg-accent" aria-label="Region actions">
                  <MoreVertical class="h-4 w-4" />
                </button>
              {/snippet}
            </PopoverTrigger>
            <PopoverContent class="w-56 p-1" align="end">
              <button class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent" onclick={() => { menuOpen = false; editOpen = true }}>
                <Pencil class="h-4 w-4" /> Edit region
              </button>
              <div class="my-1 h-px bg-border/50"></div>
              <button class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10" onclick={() => { menuOpen = false; deactivateOpen = true }}>
                <PowerOff class="h-4 w-4" /> Deactivate region
              </button>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <!-- Cluster picker — Pills -->
      <div class="flex flex-wrap items-center gap-1.5">
        <Layers class="h-3.5 w-3.5 text-muted-foreground" />
        <span class="mr-1 text-[10px] uppercase tracking-wider text-muted-foreground">cluster</span>
        <button
          class="rounded-full border px-3 py-1 text-xs font-medium transition-colors {multiSelected === null ? 'border-primary bg-primary/15 text-primary' : 'border-border/60 text-muted-foreground hover:text-foreground hover:border-border'}"
          onclick={() => (multiSelected = null)}>
          All <span class="ml-1 font-mono opacity-70">{allNodes.length}</span>
        </button>
        {#each multiClusters as c}
          {@const count = allNodes.filter(n => n.clusterId === c.id).length}
          <button
            class="rounded-full border px-3 py-1 text-xs font-medium transition-colors inline-flex items-center gap-1.5 {multiSelected === c.id ? 'border-primary bg-primary/15 text-primary' : 'border-border/60 text-muted-foreground hover:text-foreground hover:border-border'}"
            onclick={() => (multiSelected = c.id)}>
            <span>{c.name}</span>
            {#if c.isDefault}<span class="rounded-sm bg-muted px-1 text-[9px] uppercase tracking-wider opacity-80">default</span>{/if}
            {#if !c.isReady}<span class="rounded-sm bg-warning/15 px-1 text-[9px] uppercase tracking-wider text-warning">prep</span>{/if}
            <span class="font-mono opacity-70">{count}</span>
          </button>
        {/each}
      </div>

      <!-- Tab bar -->
      <div class="flex items-center rounded-md border border-border/50 p-0.5 w-fit">
        <button class="bg-primary text-primary-foreground px-4 py-2 text-sm font-medium rounded">Overview</button>
        <button class="text-muted-foreground hover:text-foreground px-4 py-2 text-sm font-medium rounded">Activity Logs</button>
        <button class="text-muted-foreground hover:text-foreground px-4 py-2 text-sm font-medium rounded inline-flex items-center gap-1.5">
          Alerts
          <Badge variant="destructive" class="h-5 min-w-5 px-1 text-[10px] leading-none">2</Badge>
        </button>
      </div>

      <!-- Stats HUD + view toggle -->
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div class="corner-brackets relative border border-border/30 rounded-sm p-5 w-fit max-w-full">
          <div class="tech-grid absolute inset-0 pointer-events-none opacity-20"></div>
          <div class="relative flex flex-wrap items-end gap-x-6 gap-y-3">
            <div class="flex items-baseline gap-1.5">
              <span class="text-2xl font-bold tabular-nums leading-none tracking-tight">{nodesInScope(multiClusters, multiSelected).length}</span>
              <span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">nodes</span>
            </div>
            <div class="h-7 w-px bg-border/40"></div>
            <div class="flex items-baseline gap-1.5">
              <span class="text-2xl font-bold tabular-nums leading-none tracking-tight text-success">
                {nodesInScope(multiClusters, multiSelected).filter(n => n.status === 'healthy').length}
              </span>
              <span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">healthy</span>
            </div>
            {#if multiSelected === null}
              <div class="h-7 w-px bg-border/40"></div>
              <div class="flex items-baseline gap-1.5">
                <span class="text-2xl font-bold tabular-nums leading-none tracking-tight">{multiClusters.length}</span>
                <span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">clusters</span>
              </div>
            {:else}
              <div class="h-7 w-px bg-border/40"></div>
              <div class="text-xs uppercase tracking-wider text-muted-foreground">
                scope · <span class="text-foreground font-medium">{clusterById(multiClusters, multiSelected)?.name}</span>
              </div>
            {/if}
          </div>
        </div>

        <div class="flex items-center rounded-md border border-border/50 p-0.5" role="tablist" aria-label="Topology view">
          <button
            class="px-3 py-1 text-sm font-medium rounded transition-colors {topoViewMulti === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}"
            onclick={() => (topoViewMulti = 'list')}>List</button>
          <button
            class="px-3 py-1 text-sm font-medium rounded transition-colors {topoViewMulti === 'graphical' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}"
            onclick={() => (topoViewMulti = 'graphical')}>Graphical</button>
        </div>
      </div>

      <!-- Topology -->
      {#if topoViewMulti === 'graphical'}
        {#if multiSelected === null}
          <!-- All clusters: one tier-grid per cluster -->
          <div class="space-y-6">
            {#each multiClusters as c}
              {@const cn = allNodes.filter(n => n.clusterId === c.id)}
              <div class="space-y-3">
                <div class="flex items-center gap-2 border-b border-border/40 pb-1.5">
                  <Layers class="h-3.5 w-3.5 text-muted-foreground" />
                  <span class="font-semibold text-sm">{c.name}</span>
                  {#if c.isDefault}<Badge variant="outline" class="h-4 text-[9px] uppercase tracking-wider">default</Badge>{/if}
                  {#if !c.isReady}<Badge variant="warning" class="h-4 text-[9px] uppercase tracking-wider">not ready</Badge>{/if}
                  <span class="ml-auto font-mono text-xs text-muted-foreground">{cn.length} nodes</span>
                </div>
                <div class="flex flex-wrap gap-5">
                  {#each tiersFor(cn) as tier}
                    {@const tierColor = TIER_COLORS[tier.id]}
                    <section class="corner-brackets flex flex-col gap-3 w-full md:w-auto border border-border/80 rounded-sm p-3">
                      <div class="flex items-center gap-2">
                        <span class="text-xs font-bold uppercase tracking-wider whitespace-nowrap" style:color={tierColor}>{tier.label}</span>
                        <span class="text-xs text-muted-foreground tabular-nums">{tier.nodeCount}</span>
                      </div>
                      {#each tier.groups as group}
                        {@const p = SERVICE_PALETTE[group.type]}
                        {@const Icon = p?.icon ?? Box}
                        <Card cornerBrackets class="overflow-hidden gap-0 py-0 w-full md:w-[320px]" style="--svc-accent: {p?.accent};">
                          <div class="flex items-center gap-2 px-3 pt-3 pb-2">
                            <span style:color={p?.accent} class="shrink-0"><Icon class="h-4 w-4" /></span>
                            <span class="text-sm font-semibold">{p?.label ?? group.type}</span>
                            <span class="ml-auto font-mono text-xs text-muted-foreground tabular-nums">{group.nodes.length}</span>
                          </div>
                          <div class="divide-y divide-border/20">
                            {#each group.nodes as node}
                              <div class="flex w-full items-center gap-2.5 px-3 py-2 text-left">
                                <span class="block h-2 w-2 shrink-0 rounded-full" style="background: {STATUS_COLORS[node.status]};" title={node.status}></span>
                                <span class="min-w-0 flex-1 truncate font-mono text-sm">{node.nodeId}</span>
                                <span class="shrink-0 font-mono text-xs text-muted-foreground">{node.advertiseAddr}</span>
                              </div>
                            {/each}
                          </div>
                          <div class="h-2"></div>
                        </Card>
                      {/each}
                    </section>
                  {/each}
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <!-- Single cluster scope -->
          {@const cn = nodesInScope(multiClusters, multiSelected)}
          <div class="flex flex-wrap gap-5">
            {#each tiersFor(cn) as tier}
              {@const tierColor = TIER_COLORS[tier.id]}
              <section class="corner-brackets flex flex-col gap-3 w-full md:w-auto border border-border/80 rounded-sm p-3">
                <div class="flex items-center gap-2">
                  <span class="text-xs font-bold uppercase tracking-wider whitespace-nowrap" style:color={tierColor}>{tier.label}</span>
                  <span class="text-xs text-muted-foreground tabular-nums">{tier.nodeCount}</span>
                </div>
                {#each tier.groups as group}
                  {@const p = SERVICE_PALETTE[group.type]}
                  {@const Icon = p?.icon ?? Box}
                  <Card cornerBrackets class="overflow-hidden gap-0 py-0 w-full md:w-[320px]" style="--svc-accent: {p?.accent};">
                    <div class="flex items-center gap-2 px-3 pt-3 pb-2">
                      <span style:color={p?.accent} class="shrink-0"><Icon class="h-4 w-4" /></span>
                      <span class="text-sm font-semibold">{p?.label ?? group.type}</span>
                      <span class="ml-auto font-mono text-xs text-muted-foreground tabular-nums">{group.nodes.length}</span>
                    </div>
                    <div class="divide-y divide-border/20">
                      {#each group.nodes as node}
                        <div class="flex w-full items-center gap-2.5 px-3 py-2 text-left">
                          <span class="block h-2 w-2 shrink-0 rounded-full" style="background: {STATUS_COLORS[node.status]};" title={node.status}></span>
                          <span class="min-w-0 flex-1 truncate font-mono text-sm">{node.nodeId}</span>
                          <span class="shrink-0 font-mono text-xs text-muted-foreground">{node.advertiseAddr}</span>
                        </div>
                      {/each}
                    </div>
                    <div class="h-2"></div>
                  </Card>
                {/each}
              </section>
            {/each}
          </div>
        {/if}
      {:else}
        <!-- List view -->
        <Card cornerBrackets>
          <CardContent class="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Node</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Address</TableHead>
                  {#if multiSelected === null}<TableHead>Cluster</TableHead>{/if}
                  <TableHead class="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {#each nodesInScope(multiClusters, multiSelected) as n}
                  <TableRow>
                    <TableCell class="font-mono text-xs">{n.nodeId}</TableCell>
                    <TableCell class="text-xs">{SERVICE_PALETTE[n.type]?.label ?? n.type}</TableCell>
                    <TableCell class="font-mono text-xs">{n.advertiseAddr}</TableCell>
                    {#if multiSelected === null}
                      <TableCell>
                        <Badge variant="outline" class="text-[10px]">{clusterName(n.clusterId)}</Badge>
                      </TableCell>
                    {/if}
                    <TableCell class="text-right">
                      <span class="inline-flex items-center gap-1.5">
                        <span class="h-1.5 w-1.5 rounded-full {statusDot(n.status)}"></span>
                        <span class="text-xs">{n.status}</span>
                      </span>
                    </TableCell>
                  </TableRow>
                {/each}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      {/if}

      <!-- Recent activity -->
      <Card cornerBrackets>
        <CardHeader>
          <CardTitle class="text-sm flex items-center justify-between">
            <span>Recent activity</span>
            {#if multiSelected !== null}
              <Badge variant="outline" class="text-[10px]">scope · {clusterById(multiClusters, multiSelected)?.name}</Badge>
            {/if}
          </CardTitle>
        </CardHeader>
        <CardContent class="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Cluster</TableHead>
                <TableHead class="text-right">When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {#each logsInScope(multiClusters, multiSelected) as l}
                <TableRow>
                  <TableCell class="font-mono text-xs">{l.subject}</TableCell>
                  <TableCell class="text-xs text-muted-foreground">{l.actor}</TableCell>
                  <TableCell>
                    {#if l.clusterId == null}
                      <span class="text-[10px] uppercase tracking-wider text-muted-foreground">region-wide</span>
                    {:else}
                      <Badge variant="outline" class="text-[10px]">{clusterName(l.clusterId)}</Badge>
                    {/if}
                  </TableCell>
                  <TableCell class="text-right text-xs text-muted-foreground">{l.at}</TableCell>
                </TableRow>
              {/each}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  </section>

  <!-- ============= MANY-CLUSTER OVERFLOW SCENARIO ============= -->
  <section class="space-y-3">
    <div class="flex items-center gap-2">
      <h2 class="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Scenario · many clusters (overflow)</h2>
      <Badge variant="outline" class="font-mono text-[10px]">{manyClusters.length} clusters · pills + overflow dropdown</Badge>
    </div>

    <div class="rounded-sm border bg-background p-6 space-y-6">
      <!-- Region header (compact) -->
      <div class="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" class="h-9 w-9 p-0"><ArrowLeft class="h-4 w-4" /></Button>
        <h3 class="text-2xl font-bold tracking-tight">{region.name}</h3>
        <Badge variant="success">Active</Badge>
        <div class="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm">Clusters</Button>
        </div>
      </div>

      <!-- Cluster picker — Pills with overflow -->
      <div class="flex flex-wrap items-center gap-1.5">
        <Layers class="h-3.5 w-3.5 text-muted-foreground" />
        <span class="mr-1 text-[10px] uppercase tracking-wider text-muted-foreground">cluster</span>

        <button
          class="rounded-full border px-3 py-1 text-xs font-medium transition-colors {manySelected === null ? 'border-primary bg-primary/15 text-primary' : 'border-border/60 text-muted-foreground hover:text-foreground hover:border-border'}"
          onclick={() => (manySelected = null)}>
          All <span class="ml-1 font-mono opacity-70">{Object.values(manyNodeCounts).reduce((a, b) => a + b, 0)}</span>
        </button>

        {#each manyPart.visible as c}
          {@const count = manyNodeCounts[c.id] ?? 0}
          <button
            class="rounded-full border px-3 py-1 text-xs font-medium transition-colors inline-flex items-center gap-1.5 {manySelected === c.id ? 'border-primary bg-primary/15 text-primary' : 'border-border/60 text-muted-foreground hover:text-foreground hover:border-border'}"
            onclick={() => (manySelected = c.id)}>
            <span>{c.name}</span>
            {#if c.isDefault}<span class="rounded-sm bg-muted px-1 text-[9px] uppercase tracking-wider opacity-80">default</span>{/if}
            {#if !c.isReady}<span class="rounded-sm bg-warning/15 px-1 text-[9px] uppercase tracking-wider text-warning">prep</span>{/if}
            <span class="font-mono opacity-70">{count}</span>
          </button>
        {/each}

        {#if manyPart.overflow.length > 0}
          <Popover bind:open={manyOverflowOpen}>
            <PopoverTrigger>
              {#snippet child({ props })}
                <button {...props}
                  class="rounded-full border border-dashed border-border/60 px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-border inline-flex items-center gap-1.5">
                  <span>+{manyPart.overflow.length} more</span>
                  <ChevronDown class="h-3 w-3 opacity-60" />
                </button>
              {/snippet}
            </PopoverTrigger>
            <PopoverContent class="w-64 p-1" align="start">
              <div class="px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">Other clusters</div>
              {#each manyPart.overflow as c}
                {@const count = manyNodeCounts[c.id] ?? 0}
                <button
                  class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent {manySelected === c.id ? 'bg-accent/50' : ''}"
                  onclick={() => { manySelected = c.id; manyOverflowOpen = false }}>
                  <span class="flex-1 truncate">{c.name}</span>
                  {#if !c.isReady}<Badge variant="warning" class="h-4 text-[9px] uppercase tracking-wider">prep</Badge>{/if}
                  <span class="font-mono text-xs text-muted-foreground tabular-nums">{count}</span>
                </button>
              {/each}
            </PopoverContent>
          </Popover>
        {/if}
      </div>

      <p class="text-xs text-muted-foreground italic">
        Pills always include: <span class="text-foreground font-medium">All</span>, the default cluster, the currently-selected cluster (if any), and the next few by name. The rest collapse into <span class="text-foreground font-medium">+N more</span>. Selecting from the dropdown promotes that cluster into the visible row.
      </p>
    </div>
  </section>

  <!-- ============= SINGLE-CLUSTER SCENARIO ============= -->
  <section class="space-y-3">
    <div class="flex items-center gap-2">
      <h2 class="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Scenario · single cluster (default 'uno' only)</h2>
      <Badge variant="outline" class="font-mono text-[10px]">picker hidden · view toggle still present</Badge>
    </div>

    <div class="rounded-sm border bg-background p-6 space-y-6">
      <div class="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" class="h-9 w-9 p-0"><ArrowLeft class="h-4 w-4" /></Button>
        <h3 class="text-2xl font-bold tracking-tight">{region.name}</h3>
        <Badge variant="success">Active</Badge>
        <span class="font-mono text-xs text-muted-foreground">{region.dns}</span>
        <div class="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm">Clusters</Button>
          <button class="inline-flex h-9 w-9 items-center justify-center rounded-sm border border-border/60 text-muted-foreground hover:text-foreground hover:bg-accent" aria-label="Region actions">
            <MoreVertical class="h-4 w-4" />
          </button>
        </div>
      </div>

      <p class="text-xs text-muted-foreground italic">
        Only the default cluster exists → no pills row rendered. Topology view toggle behaves identically to today.
      </p>

      <div class="flex justify-end">
        <div class="flex items-center rounded-md border border-border/50 p-0.5">
          <button
            class="px-3 py-1 text-sm font-medium rounded transition-colors {topoViewSingle === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}"
            onclick={() => (topoViewSingle = 'list')}>List</button>
          <button
            class="px-3 py-1 text-sm font-medium rounded transition-colors {topoViewSingle === 'graphical' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}"
            onclick={() => (topoViewSingle = 'graphical')}>Graphical</button>
        </div>
      </div>

      {#if topoViewSingle === 'graphical'}
        {@const cn = nodesInScope(singleCluster, null)}
        <div class="flex flex-wrap gap-5">
          {#each tiersFor(cn) as tier}
            {@const tierColor = TIER_COLORS[tier.id]}
            <section class="corner-brackets flex flex-col gap-3 w-full md:w-auto border border-border/80 rounded-sm p-3">
              <div class="flex items-center gap-2">
                <span class="text-xs font-bold uppercase tracking-wider whitespace-nowrap" style:color={tierColor}>{tier.label}</span>
                <span class="text-xs text-muted-foreground tabular-nums">{tier.nodeCount}</span>
              </div>
              {#each tier.groups as group}
                {@const p = SERVICE_PALETTE[group.type]}
                {@const Icon = p?.icon ?? Box}
                <Card cornerBrackets class="overflow-hidden gap-0 py-0 w-full md:w-[320px]" style="--svc-accent: {p?.accent};">
                  <div class="flex items-center gap-2 px-3 pt-3 pb-2">
                    <span style:color={p?.accent} class="shrink-0"><Icon class="h-4 w-4" /></span>
                    <span class="text-sm font-semibold">{p?.label ?? group.type}</span>
                    <span class="ml-auto font-mono text-xs text-muted-foreground tabular-nums">{group.nodes.length}</span>
                  </div>
                  <div class="divide-y divide-border/20">
                    {#each group.nodes as node}
                      <div class="flex w-full items-center gap-2.5 px-3 py-2 text-left">
                        <span class="block h-2 w-2 shrink-0 rounded-full" style="background: {STATUS_COLORS[node.status]};" title={node.status}></span>
                        <span class="min-w-0 flex-1 truncate font-mono text-sm">{node.nodeId}</span>
                        <span class="shrink-0 font-mono text-xs text-muted-foreground">{node.advertiseAddr}</span>
                      </div>
                    {/each}
                  </div>
                  <div class="h-2"></div>
                </Card>
              {/each}
            </section>
          {/each}
        </div>
      {:else}
        <Card cornerBrackets>
          <CardContent class="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Node</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead class="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {#each nodesInScope(singleCluster, null) as n}
                  <TableRow>
                    <TableCell class="font-mono text-xs">{n.nodeId}</TableCell>
                    <TableCell class="text-xs">{SERVICE_PALETTE[n.type]?.label ?? n.type}</TableCell>
                    <TableCell class="font-mono text-xs">{n.advertiseAddr}</TableCell>
                    <TableCell class="text-right">
                      <span class="inline-flex items-center gap-1.5">
                        <span class="h-1.5 w-1.5 rounded-full {statusDot(n.status)}"></span>
                        <span class="text-xs">{n.status}</span>
                      </span>
                    </TableCell>
                  </TableRow>
                {/each}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      {/if}
    </div>
  </section>

  <!-- ============= NOTES ============= -->
  <section class="space-y-3">
    <h2 class="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Design notes</h2>
    <Card cornerBrackets>
      <CardContent class="space-y-2 py-4 text-xs text-muted-foreground">
        <p><span class="text-foreground font-medium">Pills</span> render only when ≥2 clusters exist. Default cluster always first, then sorted; deactivated clusters dimmed (not shown here yet).</p>
        <p><span class="text-foreground font-medium">Graphical · All clusters</span> stacks one tier-grid per cluster (cluster header → tier columns). This preserves cluster cohesion; reading top-to-bottom = cluster-by-cluster.</p>
        <p><span class="text-foreground font-medium">Graphical · single cluster</span> renders just that cluster's tier grid, no per-cluster header.</p>
        <p><span class="text-foreground font-medium">List · All clusters</span> adds a Cluster column. List · single cluster drops the column.</p>
        <p><span class="text-foreground font-medium">Activity</span> always shows the Cluster column; region-wide entries (region.edit, cluster.create, etc.) are marked and stay visible across all scopes.</p>
        <p><span class="text-foreground font-medium">Region edit / Deactivate</span> live in a kebab next to the Clusters button. Edit currently shown as modal preview; you opted for a dedicated /regions/:regionId/edit route for the real implementation.</p>
      </CardContent>
    </Card>
  </section>
</div>

<Dialog bind:open={editOpen}>
  <DialogContent class="sm:max-w-md">
    <DialogHeader><DialogTitle>Edit region</DialogTitle></DialogHeader>
    <div class="space-y-4 py-2">
      <div class="space-y-1.5">
        <Label for="r-name">Name</Label>
        <Input id="r-name" bind:value={editName} />
        <p class="text-[11px] text-muted-foreground">Lowercase, hyphens, 3+ chars. Same rules as create.</p>
      </div>
      <div class="space-y-1.5">
        <Label for="r-dns">Base DNS</Label>
        <Input id="r-dns" bind:value={editDns} />
        <p class="text-[11px] text-muted-foreground">Drives S3 endpoint generation.</p>
      </div>
    </div>
    <DialogFooter>
      <Button variant="outline" onclick={() => (editOpen = false)}>Cancel</Button>
      <Button variant="primary" onclick={() => (editOpen = false)}>Save</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>

<Dialog bind:open={deactivateOpen}>
  <DialogContent class="sm:max-w-md">
    <DialogHeader><DialogTitle class="text-destructive">Deactivate region?</DialogTitle></DialogHeader>
    <div class="space-y-3 py-2 text-sm text-muted-foreground">
      <p>This will mark <span class="font-medium text-foreground">{region.name}</span> inactive. Existing volumes and instances stop accepting new traffic.</p>
      <p class="text-xs">Use sparingly. Re-activation requires backend support.</p>
    </div>
    <DialogFooter>
      <Button variant="outline" onclick={() => (deactivateOpen = false)}>Cancel</Button>
      <Button variant="destructive" onclick={() => (deactivateOpen = false)}>Deactivate</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
