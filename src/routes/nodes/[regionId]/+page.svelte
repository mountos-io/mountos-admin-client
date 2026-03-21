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
  let dimmedServices = $state(new Set<string>())

  const regionId = $derived(Number($page.params.regionId))
  const COLLAPSE_THRESHOLD = 8
  const NAVIGABLE_TYPES = new Set(['hub', 'dataserv', 'fuseserv'])

  const STATUS_COLORS: Record<string, string> = {
    healthy: 'oklch(0.6 0.18 145)',
    registered: 'oklch(0.55 0.10 250)',
    unhealthy: 'oklch(0.55 0.20 25)',
    draining: 'oklch(0.7 0.15 80)',
  }

  const SERVICE_PALETTE: Record<string, { accent: string; bg: string; label: string; icon: typeof Shield }> = {
    hub:           { accent: 'oklch(0.70 0.12 310)', bg: 'oklch(0.70 0.12 310 / 0.06)', label: 'Hub', icon: Shield },
    dataserv:      { accent: 'oklch(0.60 0.14 260)', bg: 'oklch(0.60 0.14 260 / 0.06)', label: 'Metadata', icon: Database },
    gcserv:        { accent: 'oklch(0.55 0.18 25)',  bg: 'oklch(0.55 0.18 25 / 0.06)',  label: 'Garbage Collection', icon: Trash2 },
    fuseserv:      { accent: 'oklch(0.70 0.14 55)',  bg: 'oklch(0.70 0.14 55 / 0.06)',  label: 'FUSE', icon: HardDrive },
    blockserv:     { accent: 'oklch(0.65 0.12 200)', bg: 'oklch(0.65 0.12 200 / 0.06)', label: 'Block', icon: Box },
    s3gatewayserv: { accent: 'oklch(0.65 0.12 30)',  bg: 'oklch(0.65 0.12 30 / 0.06)',  label: 'S3 Gateway', icon: Cloud },
    csiserv:       { accent: 'oklch(0.60 0.10 170)', bg: 'oklch(0.60 0.10 170 / 0.06)', label: 'CSI', icon: Container },
  }

  const TIER_COLORS: Record<string, string> = {
    control: 'oklch(0.70 0.12 310)',
    data: 'oklch(0.60 0.14 260)',
    storage: 'oklch(0.65 0.12 200)',
    gateway: 'oklch(0.65 0.12 30)',
    edge: 'oklch(0.70 0.14 55)',
  }

  const TIERS = [
    { id: 'control', label: 'CONTROL', types: ['hub'] },
    { id: 'data', label: 'DATA', types: ['dataserv', 'gcserv'] },
    { id: 'storage', label: 'STORAGE', types: ['blockserv'] },
    { id: 'gateway', label: 'GATEWAY', types: ['s3gatewayserv'] },
    { id: 'edge', label: 'CLIENT / EDGE', types: ['fuseserv', 'csiserv'] },
  ]

  const isHubRegion = $derived(nodeStore.nodesByType.has('hub'))

  const tierData = $derived.by(() => {
    const byType = nodeStore.nodesByType
    const relevant = isHubRegion
      ? TIERS.filter(t => t.id === 'control')
      : TIERS.filter(t => t.id !== 'control')
    return relevant.map(tier => ({
      ...tier,
      groups: tier.types
        .map(type => ({ type, nodes: byType.get(type) ?? [] }))
        .filter(g => g.nodes.length > 0),
      nodeCount: tier.types.reduce((sum, t) => sum + (byType.get(t)?.length ?? 0), 0),
    }))
  })

  const legendEntries = $derived.by(() => {
    const byType = nodeStore.nodesByType
    const types = isHubRegion
      ? TIERS.filter(t => t.id === 'control').flatMap(t => t.types)
      : TIERS.filter(t => t.id !== 'control').flatMap(t => t.types)
    return types.map(type => {
      const p = palette(type)
      const count = byType.get(type)?.length ?? 0
      return { type, label: p.label, accent: p.accent, icon: p.icon, count, hasNodes: count > 0 }
    })
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
    const t = node.serviceType === 'mfuse' ? 'fuseserv' : node.serviceType
    return NAVIGABLE_TYPES.has(t)
  }

  function palette(type: string) {
    return SERVICE_PALETTE[type] ?? { accent: 'oklch(0.5 0.08 0)', bg: 'oklch(0.5 0.08 0 / 0.06)', label: type, icon: Box }
  }

  function toggleDim(type: string) {
    const next = new Set(dimmedServices)
    next.has(type) ? next.delete(type) : next.add(type)
    dimmedServices = next
  }

  function isDimmed(type: string) {
    return dimmedServices.has(type)
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

  <!-- HUD Readout -->
  <div class="corner-brackets relative border border-border/30 rounded-sm p-5 w-fit max-w-full">
    <div class="tech-grid absolute inset-0 pointer-events-none opacity-20"></div>
    <div class="relative flex flex-wrap items-end gap-x-6 gap-y-3">
      <div class="flex items-baseline gap-6">
        <div class="flex items-baseline gap-1.5">
          <span class="hud-value text-[28px] font-bold tabular-nums leading-none tracking-tight">{topoStats.total}</span>
          <span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">nodes</span>
        </div>
        <div class="h-7 w-px bg-border/40"></div>
        <div class="flex items-baseline gap-1.5">
          <span class="hud-value text-[28px] font-bold tabular-nums leading-none tracking-tight" style="color: {STATUS_COLORS.healthy}; --hud-glow: {STATUS_COLORS.healthy};">{topoStats.healthy}</span>
          <span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">healthy</span>
        </div>
        <div class="h-7 w-px bg-border/40"></div>
        <div class="flex items-baseline gap-1.5">
          <span class="hud-value text-[28px] font-bold tabular-nums leading-none tracking-tight">{topoStats.types}</span>
          <span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">types</span>
        </div>
      </div>
      {#if !nodeStore.loading && nodeStore.nodes.length > 0}
        <div class="hud-divider"></div>
        <div class="flex flex-wrap items-center gap-1.5">
          {#each legendEntries as entry}
            {#if entry.hasNodes}
              <button
                class="legend-chip"
                class:legend-dimmed={isDimmed(entry.type)}
                style="--chip-accent: {entry.accent};"
                onclick={() => toggleDim(entry.type)}
                title="{entry.label} ({entry.count})"
              >
                <span class="legend-dot" style="background: {entry.accent};"></span>
                <span class="legend-label">{entry.label}</span>
                <span class="legend-count">{entry.count}</span>
              </button>
            {:else}
              <span class="legend-chip legend-inert" title="{entry.label} — no nodes">
                <span class="legend-dot" style="background: oklch(0.5 0 0 / 0.3);"></span>
                <span class="legend-label">{entry.label}</span>
              </span>
            {/if}
          {/each}
        </div>
      {/if}
    </div>
  </div>

  {#if nodeStore.loading}
    <LoadingSpinner />
  {:else if nodeStore.nodes.length === 0}
    <EmptyState title="No nodes" description="No nodes registered in this region." />
  {:else}
    <div class="topo-grid scanlines relative flex flex-wrap gap-5">
      {#each tierData as tier}
        {@const tierColor = TIER_COLORS[tier.id]}
        <div class="monitor-frame flex flex-col items-center w-full md:w-auto">
        <section class="tier-column corner-brackets flex flex-col gap-3 w-full border border-border/80 rounded-sm p-3" aria-label="{tier.label} tier">
          <!-- Tier header -->
          <div class="flex items-center gap-2">
            <span
              class="tier-label-glow text-xs font-bold uppercase tracking-wider whitespace-nowrap"
              style:color={tierColor}
            >{tier.label}</span>
            {#if tier.nodeCount > 0}
              <span class="text-xs text-muted-foreground tabular-nums">{tier.nodeCount}</span>
            {/if}
            <div class="ml-auto flex items-center gap-1.5">
              {#if tier.id === 'data' || tier.id === 'control'}
                <span class="tier-infra-icon" style="color: oklch(0.60 0.14 260);" title="Regional DB Access">
                  <Database class="h-3.5 w-3.5" />
                </span>
              {/if}
              <span class="tier-infra-icon" style="color: oklch(0.65 0.18 45);" title="Regional Vault Access">
                <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                  <polygon points="12,2 22,8 22,16 12,22 2,16 2,8" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </span>
            </div>
          </div>

          {#if tier.groups.length === 0}
            <div class="flex items-center justify-center rounded-sm border border-dashed border-border/30 px-6 py-8 md:w-[420px]">
              <span class="text-xs uppercase tracking-wider text-muted-foreground/40">no nodes</span>
            </div>
          {/if}
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
                class="svc-card corner-plus-bl relative overflow-hidden gap-0 py-0 w-full md:w-[420px] {isDimmed(group.type) ? 'svc-dimmed' : ''}"
                style="--svc-accent: {p.accent}; --svc-bg: {p.bg};"
              >
                <!-- inset glow at top edge -->
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
                        <span class="svc-tag font-mono" style="--tag-color: {p.accent};">RAFT</span>
                      {/if}
                      <span class="svc-count font-mono" style="--tag-color: {p.accent};">{group.nodes.length}</span>
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
                          <span class="min-w-0 flex-1 truncate font-mono text-sm">{node.nodeId}</span>
                          <span class="shrink-0 font-mono text-xs text-muted-foreground">{node.advertiseAddr}</span>
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
                          <span class="min-w-0 flex-1 truncate font-mono text-sm">{node.nodeId}</span>
                          <span class="shrink-0 font-mono text-xs text-muted-foreground">{node.advertiseAddr}</span>
                        </div>
                      {/if}
                    {/each}
                  </div>

                  <!-- Expand / collapse -->
                  {#if needsCollapse}
                    <button
                      class="flex w-full items-center justify-center gap-1 border-t border-border/20 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground hover:bg-foreground/[0.03]"
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
        </section>
        <div class="monitor-stand" style="--stand-color: {tierColor};"></div>
        </div>
      {/each}
    </div>

  {/if}
</div>

<!-- Tooltip -->
{#if hoveredNode}
  <div
    class="tooltip-card fixed z-50 pointer-events-none rounded-sm border bg-card shadow-lg"
    style:left="{hoveredNode.x + 16}px"
    style:top="{hoveredNode.y - 12}px"
  >
    <!-- Accent bar -->
    <div class="h-[2px] rounded-t-sm" style="background: {statusColor(hoveredNode.node.status)};"></div>
    <div class="px-3 py-2.5">
      <div class="font-mono text-sm font-semibold">{hoveredNode.node.nodeId}</div>
      <div class="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
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
  </div>
{/if}

<style>
  /* HUD readout value glow */
  .hud-value {
    text-shadow: 0 0 12px var(--hud-glow, oklch(0.5 0 0 / 0.15));
  }

  /* Ceremonial divider between stats and legend */
  .hud-divider {
    position: relative;
    top: 8px;
    width: 1px;
    height: 40px;
    background: linear-gradient(
      180deg,
      transparent 0%,
      oklch(0.6 0.08 250 / 0.5) 30%,
      oklch(0.6 0.08 250 / 0.25) 70%,
      transparent 100%
    );
  }

  /* Service card tag / count badges */
  .svc-tag {
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.1em;
    padding: 1px 6px;
    border: 1px solid var(--tag-color);
    color: var(--tag-color);
    text-shadow: 0 0 8px var(--tag-color);
  }

  .svc-count {
    font-size: 11px;
    font-weight: 700;
    padding: 0 6px;
    color: var(--tag-color);
    text-shadow: 0 0 8px var(--tag-color);
  }

  /* Inset glow at top edge */
  :global(.svc-card[data-slot="card"]) {
    box-shadow: inset 0 3px 12px -4px var(--svc-accent);
  }

  .svc-glow {
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, var(--svc-bg) 0%, transparent 50%);
  }

  /* Monitor stand */
  .monitor-stand {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .monitor-stand::before {
    content: '';
    width: 2px;
    height: 14px;
    background: var(--stand-color, var(--color-border));
    opacity: 0.5;
  }

  .monitor-stand::after {
    content: '';
    width: 48px;
    height: 3px;
    border-radius: 0 0 2px 2px;
    background: var(--stand-color, var(--color-border));
    opacity: 0.4;
  }

  /* Tier header infra icons */
  .tier-infra-icon {
    opacity: 0.4;
    transition: opacity 0.2s;
    cursor: default;
  }

  .tier-infra-icon:hover {
    opacity: 0.8;
  }

  /* Tier label glow */
  .tier-label-glow {
    text-shadow: 0 0 10px currentColor;
  }

  /* Scanline overlay on topology area */
  .scanlines::after {
    content: '';
    position: absolute;
    inset: 0;
    background: repeating-linear-gradient(
      0deg,
      transparent,
      transparent 3px,
      oklch(0 0 0 / 0.012) 3px,
      oklch(0 0 0 / 0.012) 4px
    );
    pointer-events: none;
    z-index: 0;
  }

  .scanlines > * {
    position: relative;
    z-index: 1;
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

  /* Service legend filter bar */
  .legend-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border: 1px solid var(--chip-accent, oklch(0.5 0 0 / 0.2));
    border-radius: 2px;
    font-size: 11px;
    cursor: pointer;
    transition: opacity 0.2s, filter 0.2s, border-color 0.2s;
    user-select: none;
    background: transparent;
    color: inherit;
  }

  .legend-chip:hover:not(.legend-inert) {
    background: var(--chip-accent, oklch(0.5 0 0)) / 0.06;
  }

  .legend-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
    box-shadow: 0 0 5px currentColor;
  }

  .legend-label {
    font-weight: 500;
    letter-spacing: 0.02em;
  }

  .legend-count {
    font-family: var(--font-mono, monospace);
    font-size: 10px;
    opacity: 0.6;
  }

  .legend-dimmed {
    opacity: 0.35;
    filter: saturate(0.2);
    border-color: oklch(0.5 0 0 / 0.15);
  }

  .legend-dimmed .legend-dot {
    box-shadow: none;
  }

  .legend-inert {
    cursor: default;
    opacity: 0.25;
    border-color: oklch(0.5 0 0 / 0.1);
  }

  /* Dimmed service card */
  :global(.svc-dimmed[data-slot="card"]) {
    opacity: 0.25;
    filter: saturate(0.15);
    transition: opacity 0.3s, filter 0.3s;
  }

  :global(.svc-dimmed[data-slot="card"]:hover) {
    opacity: 0.4;
    filter: saturate(0.3);
  }

  @media (prefers-reduced-motion: reduce) {
    .led-ping {
      animation: none !important;
    }
  }
</style>
