<script lang="ts">
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import { useNodes } from '$lib/core/stores/nodes.svelte'
  import { useRegions } from '$lib/core/stores/regions.svelte'
  import { useAuth } from '$lib/core/stores/auth.svelte'
  import { Badge } from '$lib/components/ui/badge'
  import { Button } from '$lib/components/ui/button'
  import LoadingSpinner from '$lib/components/shared/LoadingSpinner.svelte'
  import EmptyState from '$lib/components/shared/EmptyState.svelte'
  import { showErrorToast } from '$lib/core/utils/toast'
  import FilterSelect from '$lib/components/shared/FilterSelect.svelte'
  import type { Region, ServiceNode } from '$lib/core/api/types'
  import ArrowLeft from '@lucide/svelte/icons/arrow-left'

  const nodeStore = useNodes()
  const regionStore = useRegions()
  const auth = useAuth()

  let region = $state<Region | null>(null)
  let svgTip = $state<{ node: ServiceNode; x: number; y: number } | null>(null)

  const regionId = $derived(Number($page.params.regionId))

  const SERVICE_STYLES: Record<string, { color: string; label: string }> = {
    appserv:       { color: 'oklch(0.65 0.15 310)', label: 'Hub (appserv)' },
    dataserv:      { color: 'oklch(0.55 0.18 260)', label: 'Data' },
    gcserv:        { color: 'oklch(0.55 0.12 140)', label: 'GC' },
    fuseserv:      { color: 'oklch(0.65 0.18 55)',  label: 'FUSE' },
    blockserv:     { color: 'oklch(0.60 0.14 200)', label: 'Block' },
    s3gatewayserv: { color: 'oklch(0.60 0.14 30)',  label: 'S3 Gateway' },
    csiserv:       { color: 'oklch(0.55 0.12 170)', label: 'CSI' },
  }

  const STATUS_COLORS: Record<string, string> = {
    healthy: 'oklch(0.6 0.18 145)',
    registered: 'oklch(0.55 0.10 250)',
    unhealthy: 'oklch(0.55 0.20 25)',
    draining: 'oklch(0.7 0.15 80)',
  }

  const NAVIGABLE_TYPES = new Set(['appserv', 'dataserv', 'fuseserv', 'hub', 'mfuse'])

  function statusColor(s: string) { return STATUS_COLORS[s] ?? 'oklch(0.5 0 0)' }
  function serviceColor(type: string) {
    const key = type === 'hub' ? 'appserv' : type === 'mfuse' ? 'fuseserv' : type
    return SERVICE_STYLES[key]?.color ?? 'oklch(0.5 0.08 0)'
  }
  function serviceLabel(type: string) {
    const key = type === 'hub' ? 'appserv' : type === 'mfuse' ? 'fuseserv' : type
    return SERVICE_STYLES[key]?.label ?? type
  }
  function normalizeType(type: string) {
    return type === 'hub' ? 'appserv' : type === 'mfuse' ? 'fuseserv' : type
  }
  function isNavigable(node: ServiceNode) {
    return NAVIGABLE_TYPES.has(node.serviceType)
  }

  // Layout ordering
  const SERVICE_TYPE_OPTIONS = [
    { value: '', label: 'All Types' },
    { value: 'dataserv', label: 'dataserv' },
    { value: 'blockserv', label: 'blockserv' },
    { value: 'gcserv', label: 'gcserv' },
    { value: 'fuseserv', label: 'fuseserv' },
    { value: 's3gatewayserv', label: 's3gatewayserv' },
    { value: 'csiserv', label: 'csiserv' },
    { value: 'mfuse', label: 'mfuse' },
    { value: 'appserv', label: 'appserv' },
    { value: 'hub', label: 'hub' },
  ] as const

  const STATUS_OPTIONS = [
    { value: '', label: 'All Statuses' },
    { value: 'healthy', label: 'Healthy' },
    { value: 'registered', label: 'Registered' },
    { value: 'unhealthy', label: 'Unhealthy' },
    { value: 'draining', label: 'Draining' },
  ] as const

  const SERVICE_ORDER = ['appserv', 'dataserv', 'gcserv', 'fuseserv', 'blockserv', 's3gatewayserv', 'csiserv']

  const sortedGroups = $derived.by(() => {
    const byType = nodeStore.nodesByType
    const ordered: [string, ServiceNode[]][] = []
    for (const svc of SERVICE_ORDER) {
      const list = byType.get(svc)
      if (list?.length) ordered.push([svc, list])
    }
    for (const [svc, list] of byType) {
      if (!SERVICE_ORDER.includes(svc)) ordered.push([svc, list])
    }
    return ordered
  })

  const topoStats = $derived.by(() => {
    const n = nodeStore.nodes
    return {
      total: n.length,
      active: n.filter(x => x.status === 'healthy').length,
      types: nodeStore.nodesByType.size,
    }
  })

  // SVG layout computation
  const topo = $derived.by(() => {
    const padX = 60, padTop = 30, padBot = 40
    const groupGapY = 110, nodeGap = 100
    const groups = sortedGroups
    if (!groups.length) return null

    const maxNodesInGroup = Math.max(...groups.map(([, list]) => list.length))
    const w = Math.max(500, padX * 2 + maxNodesInGroup * nodeGap)
    const h = padTop + groups.length * groupGapY + padBot

    const clusterPositions = groups.map(([svc, list], gi) => {
      const cy = padTop + gi * groupGapY + 45
      const totalW = (list.length - 1) * nodeGap
      const startX = (w - totalW) / 2
      const nodePositions = list.map((node, ni) => ({
        node,
        x: startX + ni * nodeGap,
        y: cy,
      }))
      return { svc, cy, nodePositions }
    })

    return { w, h, clusterPositions }
  })

  // Decorative connecting lines between clusters
  const connectors = $derived.by(() => {
    if (!topo || topo.clusterPositions.length < 2) return []
    const lines: { x: number; y1: number; y2: number }[] = []
    const cx = topo.w / 2
    for (let i = 0; i < topo.clusterPositions.length - 1; i++) {
      lines.push({
        x: cx,
        y1: topo.clusterPositions[i].cy + 30,
        y2: topo.clusterPositions[i + 1].cy - 30,
      })
    }
    return lines
  })

  $effect(() => {
    if (!auth.loading && !auth.can('serviceNodes', 'read')) {
      showErrorToast('Access denied')
      goto('/', { replaceState: true })
      return
    }
    if (regionId) {
      regionStore.getRegion(regionId).then(r => region = r)
      nodeStore.resetFilters()
      nodeStore.fetchNodes(regionId)
    }
  })
</script>

<div class="space-y-5">
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

  <!-- Stats strip -->
  <div class="flex flex-wrap gap-x-6 gap-y-1 text-sm">
    <div><span class="text-muted-foreground">Nodes</span> <span class="ml-1 font-medium">{topoStats.total}</span></div>
    <div><span class="text-muted-foreground">Healthy</span> <span class="ml-1 font-medium" style:color={STATUS_COLORS.healthy}>{topoStats.active}</span></div>
    <div><span class="text-muted-foreground">Types</span> <span class="ml-1 font-medium">{topoStats.types}</span></div>
    {#each sortedGroups as [svc, list]}
      <div>
        <span class="text-muted-foreground">{serviceLabel(svc)}</span>
        <span class="ml-1 font-medium" style:color={serviceColor(svc)}>{list.length}</span>
      </div>
    {/each}
  </div>

  {#if nodeStore.loading}
    <LoadingSpinner />
  {:else if nodeStore.nodes.length === 0}
    <EmptyState title="No nodes" description="No nodes registered in this region." />
  {:else if topo}
    <!-- Service type legend -->
    <div class="flex flex-wrap items-center gap-2">
      {#each sortedGroups as [svc]}
        <div class="flex items-center gap-2 rounded-sm border px-3 py-1.5 text-xs">
          <span class="led-indicator h-2.5 w-2.5 rounded-sm shrink-0" style:background={serviceColor(svc)} style:--led={serviceColor(svc)}></span>
          <span class="font-medium">{serviceLabel(svc)}</span>
        </div>
      {/each}
    </div>

    <!-- Topology SVG -->
    <div class="topo-container overflow-x-auto rounded-sm p-3">
      <svg
        viewBox="0 0 {topo.w} {topo.h}"
        class="w-full"
        role="img" aria-label="Region node topology"
        style="min-width: min(500px, 100%); max-height: 700px;"
      >
        <defs>
          <pattern id="tgrid" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M 24 0 L 0 0 0 24" fill="none" stroke="var(--color-foreground)" stroke-width="0.3" stroke-opacity="0.05" />
          </pattern>
          <filter id="glow">
            <feGaussianBlur stdDeviation="5" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="glow-soft">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        <rect width="100%" height="100%" fill="url(#tgrid)" />

        <!-- Dashed connector lines between clusters -->
        {#each connectors as conn}
          <line x1={conn.x} y1={conn.y1} x2={conn.x} y2={conn.y2}
            stroke="var(--color-border)" stroke-opacity="0.3" stroke-dasharray="4 6"
            class="conn-flow" />
        {/each}

        <!-- Clusters -->
        {#each topo.clusterPositions as cluster}
          {@const svcColor = serviceColor(cluster.svc)}
          {@const isDataserv = cluster.svc === 'dataserv'}

          <!-- Group label -->
          <text
            x={topo.w / 2} y={cluster.cy - 30}
            text-anchor="middle" font-size="11" font-weight="600"
            fill={svcColor}
          >{serviceLabel(cluster.svc)}</text>

          <!-- Dataserv raft decorative ring -->
          {#if isDataserv && cluster.nodePositions.length > 1}
            {@const minX = Math.min(...cluster.nodePositions.map(p => p.x))}
            {@const maxX = Math.max(...cluster.nodePositions.map(p => p.x))}
            <ellipse
              cx={(minX + maxX) / 2} cy={cluster.cy}
              rx={(maxX - minX) / 2 + 28} ry="24"
              fill="none" stroke={svcColor} stroke-width="1"
              stroke-dasharray="6 4" opacity="0.25"
            />
          {/if}

          <!-- Nodes -->
          {#each cluster.nodePositions as { node, x, y }}
            {@const navigable = isNavigable(node)}
            {@const nodeR = 12}
            <g
              class="topo-node" class:cursor-pointer={navigable}
              role="button" tabindex="0"
              onclick={() => { if (navigable) goto(`/nodes/${regionId}/${node.nodeId}`) }}
              onkeydown={(e: KeyboardEvent) => { if (e.key === 'Enter' && navigable) goto(`/nodes/${regionId}/${node.nodeId}`) }}
              onpointerenter={(e: PointerEvent) => svgTip = { node, x: e.clientX, y: e.clientY }}
              onpointermove={(e: PointerEvent) => { if (svgTip) svgTip = { node, x: e.clientX, y: e.clientY } }}
              onpointerleave={() => svgTip = null}
            >
              <!-- Dataserv raft outer ring per node -->
              {#if isDataserv}
                <circle cx={x} cy={y} r={nodeR + 6} fill="none"
                  stroke={svcColor} stroke-width="1.5" opacity="0.35" />
              {/if}

              <!-- Main status circle -->
              <circle cx={x} cy={y} r={nodeR} fill={statusColor(node.status)} />

              <!-- Active heartbeat ping -->
              {#if node.status === 'healthy'}
                <circle cx={x} cy={y} r={nodeR} fill="none"
                  stroke={statusColor('healthy')} stroke-width="1">
                  <animate attributeName="r" from="{nodeR}" to="{nodeR + 14}" dur="2.5s" repeatCount="indefinite" />
                  <animate attributeName="opacity" from="0.45" to="0" dur="2.5s" repeatCount="indefinite" />
                </circle>
              {/if}

              <!-- Service color ring -->
              <circle cx={x} cy={y} r={nodeR + 2} fill="none"
                stroke={svcColor} stroke-width="0.8" opacity="0.4" />

              <!-- Node ID label -->
              <text x={x} y={y + nodeR + 15} text-anchor="middle"
                font-size="7.5" font-family="ui-monospace, monospace"
                fill="var(--color-muted-foreground)">{node.nodeId}</text>

              <!-- Status label for non-healthy -->
              {#if node.status !== 'healthy'}
                <text x={x} y={y + nodeR + 24} text-anchor="middle"
                  font-size="7" font-weight="600"
                  fill={statusColor(node.status)}>{node.status.toUpperCase()}</text>
              {/if}

              <circle cx={x} cy={y} r="24" fill="transparent" />
            </g>
          {/each}
        {/each}

        <!-- Decorative vault icon above appserv -->
        {#if topo.clusterPositions[0]?.svc === 'appserv'}
          {@const vy = topo.clusterPositions[0].cy - 50}
          <g transform="translate({topo.w / 2},{vy})" opacity="0.15">
            <polygon points="0,-12 10.4,-6 10.4,6 0,12 -10.4,6 -10.4,-6" fill="none"
              stroke={serviceColor('appserv')} stroke-width="1.5" />
          </g>
        {/if}

        <!-- Decorative DB cylinder between dataserv and gcserv -->
        {#if sortedGroups.some(([s]) => s === 'dataserv') && sortedGroups.some(([s]) => s === 'gcserv')}
          {@const diIdx = topo.clusterPositions.findIndex(c => c.svc === 'dataserv')}
          {@const giIdx = topo.clusterPositions.findIndex(c => c.svc === 'gcserv')}
          {#if diIdx >= 0 && giIdx >= 0}
            {@const midY = (topo.clusterPositions[diIdx].cy + topo.clusterPositions[giIdx].cy) / 2}
            <g transform="translate({topo.w / 2},{midY})" opacity="0.15">
              <ellipse cx="0" cy="-8" rx="10" ry="4" fill="none" stroke="var(--color-foreground)" stroke-width="1" />
              <line x1="-10" y1="-8" x2="-10" y2="8" stroke="var(--color-foreground)" stroke-width="1" />
              <line x1="10" y1="-8" x2="10" y2="8" stroke="var(--color-foreground)" stroke-width="1" />
              <ellipse cx="0" cy="8" rx="10" ry="4" fill="none" stroke="var(--color-foreground)" stroke-width="1" />
            </g>
          {/if}
        {/if}
      </svg>
    </div>
  {/if}
</div>

<!-- SVG Tooltip -->
{#if svgTip}
  <div
    class="fixed z-50 pointer-events-none rounded-sm border bg-card px-3 py-2 shadow-lg"
    style:left="{svgTip.x + 16}px"
    style:top="{svgTip.y - 12}px"
  >
    <div class="font-mono text-xs font-semibold">{svgTip.node.nodeId}</div>
    <div class="mt-1 space-y-0.5 text-[10px] text-muted-foreground">
      <div>Service: <span class="text-foreground">{svgTip.node.serviceType}</span></div>
      <div>Status: <span style:color={statusColor(svgTip.node.status)}>{svgTip.node.status}</span></div>
      <div>Address: <span class="text-foreground font-mono">{svgTip.node.advertiseAddr}</span></div>
      {#if isNavigable(svgTip.node)}
        <div class="text-foreground/60 mt-1">Click for details</div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .conn-flow {
    animation: dash-flow 0.9s linear infinite;
  }
  @keyframes dash-flow {
    to { stroke-dashoffset: -10; }
  }

  .led-indicator {
    box-shadow: 0 0 6px var(--led);
    animation: led-pulse 3s ease-in-out infinite;
    will-change: opacity;
  }
  @keyframes led-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }

  @media (prefers-reduced-motion: reduce) {
    .conn-flow, .led-indicator, .topo-container {
      animation: none !important;
    }
  }

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

  .topo-node { cursor: default; }
  .topo-node.cursor-pointer { cursor: pointer; }
</style>
