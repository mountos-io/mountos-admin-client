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

<div class="space-y-6">
  <!-- Header -->
  <div class="flex items-center gap-3">
    <Button variant="ghost" size="sm" onclick={() => goto('/nodes')}>
      <ArrowLeft class="h-4 w-4" />
    </Button>
    <h1 class="text-2xl font-bold tracking-tight">{region?.name ?? 'Region'}</h1>
    {#if region}
      <Badge variant={region.isActive ? 'success' : 'secondary'}>
        {region.isActive ? 'Active' : 'Inactive'}
      </Badge>
    {/if}
  </div>

  <!-- Stats + Filters -->
  <div class="flex flex-wrap items-end justify-between gap-4 border-b border-border/40 pb-5">
    <div class="flex items-baseline gap-6">
      <div class="flex items-baseline gap-1.5">
        <span class="text-[28px] font-bold tabular-nums leading-none tracking-tight">{topoStats.total}</span>
        <span class="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">nodes</span>
      </div>
      <div class="h-5 w-px bg-border/60"></div>
      <div class="flex items-baseline gap-1.5">
        <span class="text-[28px] font-bold tabular-nums leading-none tracking-tight" style:color={STATUS_COLORS.healthy}>{topoStats.healthy}</span>
        <span class="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">healthy</span>
      </div>
      <div class="h-5 w-px bg-border/60"></div>
      <div class="flex items-baseline gap-1.5">
        <span class="text-[28px] font-bold tabular-nums leading-none tracking-tight">{topoStats.types}</span>
        <span class="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">types</span>
      </div>
    </div>
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
  </div>

  {#if nodeStore.loading}
    <LoadingSpinner />
  {:else if nodeStore.nodes.length === 0}
    <EmptyState title="No nodes" description="No nodes registered in this region." />
  {:else}
    <div class="topo-stack">
      {#each tierData as tier, ti}
        <!-- Tier connector -->
        {#if ti > 0}
          <div class="flex justify-center py-0.5">
            <div
              class="h-6 w-px opacity-50"
              style="background: linear-gradient(to bottom, {TIER_COLORS[tierData[ti-1].id]}, {TIER_COLORS[tier.id]});"
            ></div>
          </div>
        {/if}

        <section aria-label="{tier.label} tier">
          <!-- Tier header -->
          <div class="flex items-center gap-3 mb-3">
            <span
              class="text-[10px] font-bold uppercase tracking-[0.2em] whitespace-nowrap"
              style:color={TIER_COLORS[tier.id]}
            >{tier.label}</span>
            <div class="h-px flex-1" style="background: {TIER_COLORS[tier.id]}; opacity: 0.25;"></div>
            <span class="text-[10px] text-muted-foreground tabular-nums whitespace-nowrap">
              {tier.nodeCount} {tier.nodeCount === 1 ? 'node' : 'nodes'}
            </span>
          </div>

          <!-- Service cards -->
          <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
                class="svc-card relative overflow-hidden gap-0 py-0"
                style="--svc-accent: {p.accent}; --svc-bg: {p.bg};"
              >
                <div class="svc-accent-bar"></div>
                <div class="svc-glow pointer-events-none"></div>
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
                    <div class="ml-auto flex items-center gap-1.5">
                      {#if isDataserv}
                        <Badge variant="secondary" class="text-[10px]">RAFT</Badge>
                      {/if}
                      <Badge variant="outline" class="text-[10px] tabular-nums">{group.nodes.length}</Badge>
                    </div>
                  </div>

                  <!-- Node list -->
                  <div class="divide-y divide-border/20">
                    {#each visibleNodes as node}
                      {@const navigable = isNavigable(node)}
                      {#if navigable}
                        <button
                          class="node-row flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors cursor-pointer hover:bg-foreground/[0.04]"
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
                          role="listitem"
                          class="node-row flex items-center gap-2.5 px-3 py-2"
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
                      class="flex w-full items-center justify-center gap-1 border-t border-border/20 px-3 py-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground hover:bg-foreground/[0.03]"
                      onclick={() => toggleExpand(group.type)}
                    >
                      <ChevronDown class="h-3 w-3 transition-transform" style="transform: rotate({expanded ? 180 : 0}deg);" />
                      {expanded ? 'Show less' : `+${hiddenCount} more`}
                    </button>
                  {:else}
                    <div class="h-2"></div>
                  {/if}
                </div>
              </Card>
            {/each}
          </div>
        </section>
      {/each}
    </div>
  {/if}
</div>

<!-- Tooltip -->
{#if hoveredNode}
  <div
    class="tooltip-card fixed z-50 pointer-events-none rounded-sm border bg-card px-3 py-2.5 shadow-lg"
    style:left="{hoveredNode.x + 16}px"
    style:top="{hoveredNode.y - 12}px"
  >
    <div class="font-mono text-xs font-semibold">{hoveredNode.node.nodeId}</div>
    <div class="mt-1.5 space-y-0.5 text-[10px] text-muted-foreground">
      <div class="flex justify-between gap-4">
        <span>Service</span>
        <span class="text-foreground">{hoveredNode.node.serviceType}</span>
      </div>
      <div class="flex justify-between gap-4">
        <span>Status</span>
        <span style:color={statusColor(hoveredNode.node.status)}>{hoveredNode.node.status}</span>
      </div>
      <div class="flex justify-between gap-4">
        <span>Address</span>
        <span class="text-foreground font-mono">{hoveredNode.node.advertiseAddr}</span>
      </div>
      {#if hoveredNode.node.lastHeartbeat}
        <div class="flex justify-between gap-4">
          <span>Heartbeat</span>
          <span class="text-foreground">{formatRelative(hoveredNode.node.lastHeartbeat)}</span>
        </div>
      {/if}
      {#if isNavigable(hoveredNode.node)}
        <div class="text-foreground/50 mt-1.5 text-center border-t border-border/30 pt-1.5">click to view details</div>
      {/if}
    </div>
  </div>
{/if}

<style>
  /* Service card structure */
  .svc-accent-bar {
    height: 3px;
    background: var(--svc-accent);
    flex-shrink: 0;
  }

  .svc-glow {
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, var(--svc-bg) 0%, transparent 50%);
  }

  /* Tooltip */
  .tooltip-card {
    backdrop-filter: blur(8px);
    max-width: 280px;
  }

  /* LED status dots */
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

  /* Tech grid for dataserv */
  .tech-grid-bg {
    background-image:
      linear-gradient(oklch(0.60 0.14 260 / 0.04) 1px, transparent 1px),
      linear-gradient(90deg, oklch(0.60 0.14 260 / 0.04) 1px, transparent 1px);
    background-size: 20px 20px;
  }

  /* Node row hover accent */
  button.node-row {
    position: relative;
  }

  button.node-row::before {
    content: '';
    position: absolute;
    left: 0;
    top: 25%;
    bottom: 25%;
    width: 2px;
    background: var(--svc-accent, var(--color-primary));
    opacity: 0;
    transition: opacity 0.15s;
  }

  button.node-row:hover::before {
    opacity: 1;
  }

  @media (prefers-reduced-motion: reduce) {
    .led-ping {
      animation: none !important;
    }
  }
</style>
