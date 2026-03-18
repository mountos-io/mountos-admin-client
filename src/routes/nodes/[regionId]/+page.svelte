<script lang="ts">
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import { useNodes } from '$lib/core/stores/nodes.svelte'
  import { useRegions } from '$lib/core/stores/regions.svelte'
  import { useAuth } from '$lib/core/stores/auth.svelte'
  import { Badge } from '$lib/components/ui/badge'
  import { Button } from '$lib/components/ui/button'
  import { Card } from '$lib/components/ui/card'
  import LoadingSpinner from '$lib/components/shared/LoadingSpinner.svelte'
  import EmptyState from '$lib/components/shared/EmptyState.svelte'
  import FilterSelect from '$lib/components/shared/FilterSelect.svelte'
  import { showErrorToast } from '$lib/core/utils/toast'
  import { formatRelative } from '$lib/core/utils/format'
  import type { Region, ServiceNode } from '$lib/core/api/types'
  import ArrowLeft from '@lucide/svelte/icons/arrow-left'
  import ChevronDown from '@lucide/svelte/icons/chevron-down'
  import Shield from '@lucide/svelte/icons/shield'
  import Database from '@lucide/svelte/icons/database'
  import Trash2 from '@lucide/svelte/icons/trash-2'
  import HardDrive from '@lucide/svelte/icons/hard-drive'
  import Box from '@lucide/svelte/icons/box'
  import Cloud from '@lucide/svelte/icons/cloud'
  import Container from '@lucide/svelte/icons/container'

  const nodeStore = useNodes()
  const regionStore = useRegions()
  const auth = useAuth()

  let region = $state<Region | null>(null)
  let hoveredNode = $state<{ node: ServiceNode; x: number; y: number } | null>(null)
  let expandedGroups = $state(new Set<string>())

  const regionId = $derived(Number($page.params.regionId))
  const COLLAPSE_THRESHOLD = 8
  const NAVIGABLE_TYPES = new Set(['appserv', 'dataserv', 'fuseserv'])

  const STATUS_COLORS: Record<string, string> = {
    healthy: 'oklch(0.6 0.18 145)',
    registered: 'oklch(0.55 0.10 250)',
    unhealthy: 'oklch(0.55 0.20 25)',
    draining: 'oklch(0.7 0.15 80)',
  }

  const SERVICE_PALETTE: Record<string, { accent: string; bg: string; label: string; icon: typeof Shield }> = {
    appserv:       { accent: 'oklch(0.70 0.12 310)', bg: 'oklch(0.70 0.12 310 / 0.06)', label: 'Hub', icon: Shield },
    dataserv:      { accent: 'oklch(0.60 0.14 260)', bg: 'oklch(0.60 0.14 260 / 0.06)', label: 'Data', icon: Database },
    gcserv:        { accent: 'oklch(0.62 0.10 140)', bg: 'oklch(0.62 0.10 140 / 0.06)', label: 'GC', icon: Trash2 },
    fuseserv:      { accent: 'oklch(0.70 0.14 55)',  bg: 'oklch(0.70 0.14 55 / 0.06)',  label: 'FUSE', icon: HardDrive },
    blockserv:     { accent: 'oklch(0.65 0.12 200)', bg: 'oklch(0.65 0.12 200 / 0.06)', label: 'Block', icon: Box },
    s3gatewayserv: { accent: 'oklch(0.65 0.12 30)',  bg: 'oklch(0.65 0.12 30 / 0.06)',  label: 'S3 Gateway', icon: Cloud },
    csiserv:       { accent: 'oklch(0.60 0.10 170)', bg: 'oklch(0.60 0.10 170 / 0.06)', label: 'CSI', icon: Container },
  }

  const TIER_COLORS: Record<string, string> = {
    control: 'oklch(0.70 0.12 310)',
    data: 'oklch(0.60 0.14 260)',
    edge: 'oklch(0.70 0.14 55)',
  }

  const TIERS = [
    { id: 'control', label: 'CONTROL', types: ['appserv'], deco: 'vault' as const },
    { id: 'data', label: 'DATA', types: ['dataserv', 'gcserv'], deco: 'database' as const },
    { id: 'edge', label: 'CLIENT / EDGE', types: ['fuseserv', 'blockserv', 's3gatewayserv', 'csiserv'], deco: undefined },
  ]

  const SERVICE_TYPE_OPTIONS = [
    { value: '', label: 'All Types' },
    { value: 'appserv', label: 'appserv' },
    { value: 'dataserv', label: 'dataserv' },
    { value: 'gcserv', label: 'gcserv' },
    { value: 'fuseserv', label: 'fuseserv' },
    { value: 'blockserv', label: 'blockserv' },
    { value: 's3gatewayserv', label: 's3gatewayserv' },
    { value: 'csiserv', label: 'csiserv' },
    { value: 'mfuse', label: 'mfuse' },
    { value: 'hub', label: 'hub' },
  ] as const

  const STATUS_OPTIONS = [
    { value: '', label: 'All Statuses' },
    { value: 'healthy', label: 'Healthy' },
    { value: 'registered', label: 'Registered' },
    { value: 'unhealthy', label: 'Unhealthy' },
    { value: 'draining', label: 'Draining' },
  ] as const

  const tierData = $derived.by(() => {
    const byType = nodeStore.nodesByType
    return TIERS.map(tier => ({
      ...tier,
      groups: tier.types
        .map(type => ({ type, nodes: byType.get(type) ?? [] }))
        .filter(g => g.nodes.length > 0),
      nodeCount: tier.types.reduce((sum, t) => sum + (byType.get(t)?.length ?? 0), 0),
    })).filter(t => t.groups.length > 0)
  })

  const topoStats = $derived.by(() => {
    const n = nodeStore.nodes
    return {
      total: n.length,
      healthy: n.filter(x => x.status === 'healthy').length,
      types: nodeStore.nodesByType.size,
    }
  })

  function statusColor(s: string) { return STATUS_COLORS[s] ?? 'oklch(0.5 0 0)' }

  function isNavigable(node: ServiceNode) {
    const t = node.serviceType === 'hub' ? 'appserv' : node.serviceType === 'mfuse' ? 'fuseserv' : node.serviceType
    return NAVIGABLE_TYPES.has(t)
  }

  function palette(type: string) {
    return SERVICE_PALETTE[type] ?? { accent: 'oklch(0.5 0.08 0)', bg: 'oklch(0.5 0.08 0 / 0.06)', label: type, icon: Box }
  }

  function toggleExpand(type: string) {
    const next = new Set(expandedGroups)
    next.has(type) ? next.delete(type) : next.add(type)
    expandedGroups = next
  }

  $effect(() => {
    if (!auth.loading && !auth.can('serviceNodes', 'read')) {
      showErrorToast('Access denied')
      goto('/', { replaceState: true })
      return
    }
  })

  $effect(() => {
    if (regionId) {
      regionStore.getRegion(regionId).then(r => region = r).catch(() => {})
      nodeStore.clearFilters()
      nodeStore.fetchNodes(regionId)
    }
  })
</script>

<div class="space-y-5">
  <!-- Header -->
  <div class="flex items-center gap-3">
    <Button variant="ghost" size="sm" onclick={() => goto('/nodes')}>
      <ArrowLeft class="h-4 w-4" />
    </Button>
    <div class="flex items-center gap-3">
      <h1 class="text-2xl font-bold tracking-tight">{region?.name ?? 'Region'}</h1>
      {#if region}
        <Badge variant={region.isActive ? 'success' : 'secondary'}>
          {region.isActive ? 'Active' : 'Inactive'}
        </Badge>
      {/if}
    </div>
  </div>

  <!-- Filters -->
  <div class="flex items-center gap-2">
    <FilterSelect
      options={SERVICE_TYPE_OPTIONS}
      value={nodeStore.serviceType}
      placeholder="All Types"
      onchange={(v) => nodeStore.setServiceType(v)}
    />
    <FilterSelect
      options={STATUS_OPTIONS}
      value={nodeStore.status}
      placeholder="All Statuses"
      onchange={(v) => nodeStore.setStatus(v)}
    />
  </div>

  <!-- Stats -->
  <div class="flex flex-wrap gap-x-6 gap-y-1 text-sm">
    <div><span class="text-muted-foreground">Nodes</span> <span class="ml-1 font-medium">{topoStats.total}</span></div>
    <div><span class="text-muted-foreground">Healthy</span> <span class="ml-1 font-medium" style:color={STATUS_COLORS.healthy}>{topoStats.healthy}</span></div>
    <div><span class="text-muted-foreground">Types</span> <span class="ml-1 font-medium">{topoStats.types}</span></div>
  </div>

  {#if nodeStore.loading}
    <LoadingSpinner />
  {:else if nodeStore.nodes.length === 0}
    <EmptyState title="No nodes" description="No nodes registered in this region." />
  {:else}
    <!-- Tiered topology -->
    <div class="space-y-0">
      {#each tierData as tier, ti}
        {#if ti > 0}
          <div class="mx-auto my-1 h-5 w-px border-l border-dashed border-border/30"></div>
        {/if}
        <section
          class="rounded-sm border-l-2 bg-card/30 p-4"
          style:border-color={TIER_COLORS[tier.id]}
          aria-label="{tier.label} tier"
        >
          <div class="mb-3 flex items-center gap-2">
            <span
              class="text-[10px] font-semibold uppercase tracking-widest"
              style:color={TIER_COLORS[tier.id]}
            >{tier.label}</span>
            <span class="text-[10px] text-muted-foreground">{tier.nodeCount} nodes</span>
          </div>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {#each tier.groups as group}
              {@const p = palette(group.type)}
              {@const Icon = p.icon}
              {@const isDataserv = group.type === 'dataserv'}
              {@const expanded = expandedGroups.has(group.type)}
              {@const needsCollapse = group.nodes.length > COLLAPSE_THRESHOLD}
              {@const visibleNodes = expanded || !needsCollapse ? group.nodes : group.nodes.slice(0, COLLAPSE_THRESHOLD)}
              {@const hiddenCount = group.nodes.length - visibleNodes.length}
              <Card
                cornerBrackets
                class="relative overflow-hidden"
                style="border-left: 4px solid {p.accent}; background: {p.bg};"
              >
                {#if isDataserv}
                  <div class="tech-grid-bg absolute inset-0 pointer-events-none"></div>
                {/if}
                <div class="relative">
                  <!-- Card header -->
                  <div class="flex items-center gap-2 px-3 pt-3 pb-2">
                    <span style:color={p.accent} class="shrink-0">
                      <Icon class="h-4 w-4" />
                    </span>
                    <span class="text-sm font-semibold">{p.label}</span>
                    <Badge variant="outline" class="ml-auto text-[10px]">{group.nodes.length}</Badge>
                    {#if isDataserv}
                      <Badge variant="secondary" class="text-[10px]">RAFT</Badge>
                    {/if}
                  </div>

                  <!-- Node list -->
                  <div class="divide-y divide-border/30">
                    {#each visibleNodes as node}
                      {@const navigable = isNavigable(node)}
                      {#if navigable}
                        <button
                          class="node-row flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors cursor-pointer hover:bg-foreground/[0.03]"
                          aria-label="View node {node.nodeId}"
                          onclick={() => goto(`/nodes/${regionId}/${node.nodeId}`)}
                          onpointerenter={(e: PointerEvent) => hoveredNode = { node, x: e.clientX, y: e.clientY }}
                          onpointermove={(e: PointerEvent) => { if (hoveredNode) hoveredNode = { node, x: e.clientX, y: e.clientY } }}
                          onpointerleave={() => hoveredNode = null}
                        >
                          <span
                            class="led-dot block h-2 w-2 shrink-0 rounded-full"
                            class:led-ping={node.status === 'healthy'}
                            class:led-raft={isDataserv}
                            style="background: {statusColor(node.status)}; --led: {statusColor(node.status)};"
                          ></span>
                          <span class="min-w-0 flex-1 truncate font-mono text-xs">{node.nodeId}</span>
                          <span class="shrink-0 font-mono text-[10px] text-muted-foreground">{node.advertiseAddr}</span>
                        </button>
                      {:else}
                        <div
                          role="img" aria-label="{node.nodeId}"
                          class="node-row flex items-center gap-2 px-3 py-1.5"
                          onpointerenter={(e: PointerEvent) => hoveredNode = { node, x: e.clientX, y: e.clientY }}
                          onpointermove={(e: PointerEvent) => { if (hoveredNode) hoveredNode = { node, x: e.clientX, y: e.clientY } }}
                          onpointerleave={() => hoveredNode = null}
                        >
                          <span
                            class="led-dot block h-2 w-2 shrink-0 rounded-full"
                            class:led-ping={node.status === 'healthy'}
                            class:led-raft={isDataserv}
                            style="background: {statusColor(node.status)}; --led: {statusColor(node.status)};"
                          ></span>
                          <span class="min-w-0 flex-1 truncate font-mono text-xs">{node.nodeId}</span>
                          <span class="shrink-0 font-mono text-[10px] text-muted-foreground">{node.advertiseAddr}</span>
                        </div>
                      {/if}
                    {/each}
                  </div>

                  <!-- Expand / collapse -->
                  {#if needsCollapse}
                    <button
                      class="flex w-full items-center justify-center gap-1 border-t border-border/30 px-3 py-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground hover:bg-foreground/[0.03]"
                      onclick={() => toggleExpand(group.type)}
                    >
                      <ChevronDown class="h-3 w-3 transition-transform" style="transform: rotate({expanded ? 180 : 0}deg);" />
                      {expanded ? 'Show less' : `+${hiddenCount} more`}
                    </button>
                  {:else}
                    <div class="h-1.5"></div>
                  {/if}
                </div>
              </Card>
            {/each}

            <!-- Decorative element -->
            {#if tier.deco === 'vault'}
              <div class="flex items-center justify-center self-stretch rounded-sm border border-dashed border-border/20 p-4 opacity-20">
                <div class="flex flex-col items-center gap-1.5 text-muted-foreground">
                  <svg class="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                    <polygon points="12,2 22,8 22,16 12,22 2,16 2,8" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  <span class="text-[9px] font-semibold uppercase tracking-widest">Vault</span>
                </div>
              </div>
            {:else if tier.deco === 'database'}
              <div class="flex items-center justify-center self-stretch rounded-sm border border-dashed border-border/20 p-4 opacity-20">
                <div class="flex flex-col items-center gap-1.5 text-muted-foreground">
                  <Database class="h-8 w-8" />
                  <span class="text-[9px] font-semibold uppercase tracking-widest">Database</span>
                </div>
              </div>
            {/if}
          </div>
        </section>
      {/each}
    </div>
  {/if}
</div>

<!-- Tooltip -->
{#if hoveredNode}
  <div
    class="fixed z-50 pointer-events-none rounded-sm border bg-card px-3 py-2 shadow-lg"
    style:left="{hoveredNode.x + 16}px"
    style:top="{hoveredNode.y - 12}px"
  >
    <div class="font-mono text-xs font-semibold">{hoveredNode.node.nodeId}</div>
    <div class="mt-1 space-y-0.5 text-[10px] text-muted-foreground">
      <div>Service: <span class="text-foreground">{hoveredNode.node.serviceType}</span></div>
      <div>Status: <span style:color={statusColor(hoveredNode.node.status)}>{hoveredNode.node.status}</span></div>
      <div>Address: <span class="text-foreground font-mono">{hoveredNode.node.advertiseAddr}</span></div>
      {#if hoveredNode.node.lastHeartbeat}
        <div>Heartbeat: <span class="text-foreground">{formatRelative(hoveredNode.node.lastHeartbeat)}</span></div>
      {/if}
      {#if isNavigable(hoveredNode.node)}
        <div class="text-foreground/60 mt-1">Click for details</div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .led-dot {
    box-shadow: 0 0 6px var(--led);
  }

  .led-ping {
    animation: led-pulse 2.5s ease-in-out infinite;
  }

  .led-raft {
    box-shadow: 0 0 0 2px var(--color-card), 0 0 0 3.5px var(--led), 0 0 6px var(--led);
  }

  @keyframes led-pulse {
    0%, 100% { opacity: 1; box-shadow: 0 0 6px var(--led); }
    50% { opacity: 0.6; box-shadow: 0 0 3px var(--led); }
  }

  .tech-grid-bg {
    background-image:
      linear-gradient(oklch(0.60 0.14 260 / 0.04) 1px, transparent 1px),
      linear-gradient(90deg, oklch(0.60 0.14 260 / 0.04) 1px, transparent 1px);
    background-size: 20px 20px;
  }

  @media (prefers-reduced-motion: reduce) {
    .led-ping {
      animation: none !important;
    }
  }
</style>
