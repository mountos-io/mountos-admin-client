<script lang="ts">
  // At-a-glance copyset overview for the block-copysets area,
  // rendered above the unified ServersList, never in place of it. One cell per copyset, its
  // two members shown as a pill of health indicators. Two independent signals, two different
  // visual channels, deliberately not conflated:
  //   - per-node health (the two indicators inside the pill) from ServiceNode.status
  //   - copyset state (active/draining/synced_drained/retired) from Copyset.state, shown as
  //     the cell's own border/background tint, reusing CopysetStateBadge's color scheme
  //     (see $lib/core/utils/copyset-state) so the two components never drift onto different
  //     palettes for the same four states.
  // Clicking a cell scrolls to and flashes that copyset's row further down the page
  // (ServersList tags a copyset row's first member with id="copyset-<id>" for this). The small
  // corner link navigates instead to the copyset detail page (its own route, two members
  // side by side); the two are separate controls, not the same click, so the in-page scroll
  // stays available for someone already working through the servers list below. The corner
  // link's mobile touch-target enlargement only applies in expanded mode: compact-mode cells
  // (as narrow as 5.5rem) are too small to host a 44px corner overlay without covering most
  // of the cell's own primary button. ServersList's own copyset link is the equivalent,
  // full-size way to reach the same page on a narrow viewport in compact mode.
  import { onDestroy } from 'svelte'
  import Sparkline from '$lib/components/shared/Sparkline.svelte'
  import { CardTitle } from '$lib/components/ui/card'
  import { api } from '$lib/core/stores/client.svelte'
  import { formatBytes } from '$lib/core/utils/format'
  import { nodeHealthVariant, nodeHealthLabel, worstNodeHealthVariant, type NodeHealthVariant } from '$lib/core/utils/node-health'
  import { COPYSET_STATE_LABEL, COPYSET_STATE_VARIANT, COPYSET_STATE_TITLE } from '$lib/core/utils/copyset-state'
  import { isCopysetState } from '$lib/core/api/copyset-ui-types'
  import type { Copyset, BlockVolume, ServiceNode, NodeStatsSample } from '$lib/core/api/types'
  import CircleCheck from '@lucide/svelte/icons/circle-check'
  import CircleX from '@lucide/svelte/icons/circle-x'
  import CircleDashed from '@lucide/svelte/icons/circle-dashed'
  import ActivityIcon from '@lucide/svelte/icons/activity'
  import ArrowUpRight from '@lucide/svelte/icons/arrow-up-right'

  let { copysets, blockVolumesById, nodesByVolume, storageId }: {
    copysets: Copyset[]
    blockVolumesById: Map<string, BlockVolume>
    nodesByVolume: Map<string, ServiceNode[]>
    storageId: number
  } = $props()

  type CopysetStateVariant = 'success' | 'warning' | 'secondary' | 'outline'

  interface MemberSlot {
    label: 'A' | 'B'
    volume?: BlockVolume
    servers: ServiceNode[]
    primary?: ServiceNode
    variant: NodeHealthVariant
    title: string
  }

  interface GridCell {
    copyset: Copyset
    a: MemberSlot
    b: MemberSlot
    stateVariant: CopysetStateVariant
    accessibleLabel: string
  }

  function memberVolumeName(volume: BlockVolume | undefined, volumeId: string | undefined): string {
    return volume?.name || volumeId || 'unassigned'
  }

  function buildMemberSlot(label: 'A' | 'B', volumeId: string | undefined): MemberSlot {
    const volume = volumeId ? blockVolumesById.get(volumeId) : undefined
    const servers = volumeId ? nodesByVolume.get(volumeId) ?? [] : []
    const primary = servers[0]
    const variant = worstNodeHealthVariant(servers.map(s => nodeHealthVariant(s.status)))
    const name = memberVolumeName(volume, volumeId)
    let title: string
    if (!volumeId) {
      title = `Member ${label}: no member assigned`
    } else if (servers.length === 0) {
      title = `Member ${label} (${name}): no blockserv registered yet, uncertain`
    } else if (servers.length === 1) {
      title = `Member ${label} (${name}): ${nodeHealthLabel(servers[0].status)}, ${servers[0].nodeId}`
    } else {
      title = `Member ${label} (${name}): ${servers.length} blockserv registered, worst status ${nodeHealthLabel(worstStatusAmong(servers))}`
    }
    return { label, volume, servers, primary, variant, title }
  }

  function worstStatusAmong(servers: ServiceNode[]): string {
    const byVariant = new Map(servers.map(s => [s.nodeId, nodeHealthVariant(s.status)] as const))
    const worst = worstNodeHealthVariant([...byVariant.values()])
    return servers.find(s => nodeHealthVariant(s.status) === worst)?.status ?? 'unknown'
  }

  const cells = $derived.by((): GridCell[] => copysets.map((copyset): GridCell => {
    const a = buildMemberSlot('A', copyset.memberA)
    const b = buildMemberSlot('B', copyset.memberB)
    const stateKnown = isCopysetState(copyset.state)
    const stateVariant: CopysetStateVariant = stateKnown ? COPYSET_STATE_VARIANT[copyset.state] : 'outline'
    const stateLabel = stateKnown ? COPYSET_STATE_LABEL[copyset.state] : copyset.state
    const stateTitle = stateKnown ? COPYSET_STATE_TITLE[copyset.state] : 'Unrecognized copyset state, treat as unsafe to act on.'
    const accessibleLabel = `Copyset ${copyset.id}, ${stateLabel}. ${stateTitle} ${a.title}. ${b.title}. Activate to jump to full detail below.`
    return { copyset, a, b, stateVariant, accessibleLabel }
  }))

  function stateClasses(variant: CopysetStateVariant): string {
    switch (variant) {
      case 'success': return 'border-success/45 bg-success/5 hover:bg-success/10'
      case 'warning': return 'border-warning/45 bg-warning/5 hover:bg-warning/10'
      case 'secondary': return 'border-border bg-muted/25 hover:bg-muted/35'
      case 'outline': return 'border-border/60 bg-transparent hover:bg-muted/10'
    }
  }

  function healthIcon(variant: NodeHealthVariant) {
    if (variant === 'success') return CircleCheck
    if (variant === 'destructive') return CircleX
    return CircleDashed
  }

  // --success/--warning/--destructive tokens are named to match NodeHealthVariant exactly.
  function healthColorVar(variant: NodeHealthVariant): string {
    return `var(--${variant})`
  }

  // View mode: compact is the default and needs no extra data beyond what BlockCopysets
  // already loaded. Expanded adds a per-node traffic sparkline, fetched lazily (see below).
  let mode = $state<'compact' | 'expanded'>('compact')

  function setMode(next: 'compact' | 'expanded') {
    if (mode === next) return
    mode = next
    if (next === 'compact') {
      // Leaving expanded mode: nothing is in the viewport anymore as far as this
      // component is concerned, so drop every in-flight request outright.
      for (const ctrl of controllersByNodeKey.values()) ctrl.abort()
      controllersByNodeKey.clear()
    }
  }

  interface HistoryEntry { intervalMs: number; samples: NodeStatsSample[]; loading: boolean; error: boolean }

  let historyByNodeKey = $state<Map<string, HistoryEntry>>(new Map())
  // Plain (non-reactive) bookkeeping: which node keys have an in-flight statsHistory
  // request right now, so a cell that re-enters the viewport before a response lands
  // doesn't fire a duplicate, and a cell that leaves can cancel its own request.
  const controllersByNodeKey = new Map<string, AbortController>()

  function nodeKey(node: ServiceNode): string {
    return `${node.regionId}:${node.nodeId}`
  }

  async function ensureHistory(node: ServiceNode) {
    const key = nodeKey(node)
    if (historyByNodeKey.has(key) || controllersByNodeKey.has(key)) return
    const ctrl = new AbortController()
    controllersByNodeKey.set(key, ctrl)
    historyByNodeKey = new Map(historyByNodeKey).set(key, { intervalMs: 0, samples: [], loading: true, error: false })
    try {
      const resp = await api.serviceNodes.statsHistory(node.regionId, node.nodeId, ctrl.signal)
      if (ctrl.signal.aborted) return
      historyByNodeKey = new Map(historyByNodeKey).set(key, { intervalMs: resp.intervalMs, samples: resp.samples, loading: false, error: false })
    } catch {
      if (ctrl.signal.aborted) return
      historyByNodeKey = new Map(historyByNodeKey).set(key, { intervalMs: 0, samples: [], loading: false, error: true })
    } finally {
      if (controllersByNodeKey.get(key) === ctrl) controllersByNodeKey.delete(key)
    }
  }

  // Cancels a still-loading request for a cell that scrolled out of view before its
  // response landed. A response that already resolved stays cached (no refetch storm on
  // scrolling back and forth).
  function cancelHistory(node: ServiceNode) {
    const key = nodeKey(node)
    controllersByNodeKey.get(key)?.abort()
    controllersByNodeKey.delete(key)
    const existing = historyByNodeKey.get(key)
    if (existing?.loading) {
      const next = new Map(historyByNodeKey)
      next.delete(key)
      historyByNodeKey = next
    }
  }

  function onCellVisible(cell: GridCell) {
    if (cell.a.primary) ensureHistory(cell.a.primary)
    if (cell.b.primary) ensureHistory(cell.b.primary)
  }

  function onCellHidden(cell: GridCell) {
    if (cell.a.primary) cancelHistory(cell.a.primary)
    if (cell.b.primary) cancelHistory(cell.b.primary)
  }

  onDestroy(() => {
    for (const ctrl of controllersByNodeKey.values()) ctrl.abort()
    controllersByNodeKey.clear()
  })

  // rx + tx bytes/sec as one combined "traffic" line: legible at sparkline size (56x18px),
  // where a second overlaid IOPS series would just be visual noise. IOPS is available from
  // the same sample and could become a secondary metric/toggle later if operators ask for
  // it; the accessible label below still surfaces the latest rate as text, not just the line.
  function trafficSeries(hist: HistoryEntry | undefined): number[] {
    if (!hist) return []
    return hist.samples.map(s => s.netRxBytesPerSec + s.netTxBytesPerSec)
  }

  function sparklineLabel(slot: MemberSlot, hist: HistoryEntry | undefined): string {
    if (!slot.primary) return `Member ${slot.label}: no blockserv to chart.`
    if (!hist || hist.loading) return `Member ${slot.label} (${slot.primary.nodeId}): loading recent traffic…`
    if (hist.error) return `Member ${slot.label} (${slot.primary.nodeId}): traffic history unavailable.`
    if (hist.samples.length === 0) return `Member ${slot.label} (${slot.primary.nodeId}): no traffic samples yet.`
    const latest = hist.samples[hist.samples.length - 1]
    return `Member ${slot.label} (${slot.primary.nodeId}): latest traffic ${formatBytes(latest.netRxBytesPerSec + latest.netTxBytesPerSec)}/s (rx+tx), ${hist.samples.length} samples.`
  }

  // Scrolls to and flashes the matching row rendered by ServersList (id="copyset-<id>" on that
  // copyset's first member row); does not duplicate its detail here.
  function jumpToCopyset(copysetId: string) {
    const el = document.getElementById(`copyset-${copysetId}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.add('copyset-jump-highlight')
    window.setTimeout(() => el.classList.remove('copyset-jump-highlight'), 1600)
  }

  // Gates expanded-mode history fetching to copyset cells actually in (or near) the
  // viewport, so a large storage (up to ~200 copysets / ~400 nodes) doesn't fire
  // hundreds of statsHistory requests the instant expanded mode is toggled on.
  interface ViewportParams { enabled: boolean; onEnter: () => void; onLeave: () => void }

  function observeInViewport(node: HTMLElement, params: ViewportParams) {
    let observer: IntersectionObserver | undefined
    let current = params

    function connect() {
      if (observer || typeof IntersectionObserver === 'undefined') return
      observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) current.onEnter()
          else current.onLeave()
        }
      }, { rootMargin: '200px 0px' })
      observer.observe(node)
    }

    function disconnect() {
      observer?.disconnect()
      observer = undefined
    }

    if (params.enabled) connect()

    return {
      update(next: ViewportParams) {
        const wasEnabled = !!observer
        current = next
        if (next.enabled && !wasEnabled) connect()
        else if (!next.enabled && wasEnabled) { disconnect(); next.onLeave() }
      },
      destroy() { disconnect() },
    }
  }
</script>

{#snippet memberIndicator(cell: GridCell, slot: MemberSlot)}
  {@const Icon = healthIcon(slot.variant)}
  {@const hist = slot.primary ? historyByNodeKey.get(nodeKey(slot.primary)) : undefined}
  <span class="inline-flex items-center gap-1">
    <Icon class="size-3.5 shrink-0" style="color: {healthColorVar(slot.variant)}" aria-hidden="true" />
    {#if mode === 'expanded'}
      <Sparkline values={trafficSeries(hist)} color={healthColorVar(slot.variant)} ariaLabel={sparklineLabel(slot, hist)} />
    {/if}
  </span>
{/snippet}

{#if copysets.length > 0}
  <div class="space-y-3">
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <CardTitle class="text-base">Copyset Overview</CardTitle>
      <div class="flex items-center gap-1" role="group" aria-label="Node grid view mode">
        <button type="button" class="ng-mode-chip" class:ng-mode-chip--active={mode === 'compact'}
          aria-pressed={mode === 'compact'} onclick={() => setMode('compact')}>Compact</button>
        <button type="button" class="ng-mode-chip" class:ng-mode-chip--active={mode === 'expanded'}
          aria-pressed={mode === 'expanded'} onclick={() => setMode('expanded')}>
          <ActivityIcon class="size-3 mr-1 inline" aria-hidden="true" />Traffic
        </button>
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span class="flex items-center gap-1"><CircleCheck class="size-3 text-success" aria-hidden="true" />Healthy</span>
      <span class="flex items-center gap-1"><CircleDashed class="size-3 text-warning" aria-hidden="true" />Uncertain</span>
      <span class="flex items-center gap-1"><CircleX class="size-3 text-destructive" aria-hidden="true" />Unhealthy</span>
      <span class="pl-3 border-l border-border/40">Card color shows the copyset's own state</span>
    </div>

    <div class={`grid gap-2 ${mode === 'expanded' ? 'grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))]' : 'grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))]'}`}>
      {#each cells as cell, i (cell.copyset.id)}
        <div class="relative">
          <button type="button"
            class={`ng-cell flex w-full flex-col items-center gap-1.5 rounded-md border px-2 py-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 min-h-[44px] ${stateClasses(cell.stateVariant)}`}
            title={cell.accessibleLabel}
            aria-label={cell.accessibleLabel}
            onclick={() => jumpToCopyset(cell.copyset.id)}
            use:observeInViewport={{ enabled: mode === 'expanded', onEnter: () => onCellVisible(cell), onLeave: () => onCellHidden(cell) }}
          >
            <span class="text-xs leading-none text-muted-foreground" aria-hidden="true">{i + 1}</span>
            <span class="ng-copyset flex items-center gap-2.5 rounded-md border border-border/60 bg-background/50 px-2.5 py-1" aria-hidden="true">
              {@render memberIndicator(cell, cell.a)}
              <span class="ng-copyset-link"></span>
              {@render memberIndicator(cell, cell.b)}
            </span>
          </button>
          <a href={`/storages/${storageId}/copysets/${cell.copyset.id}`}
            class={`ng-detail-link absolute top-1 right-1 inline-flex items-center justify-center rounded-sm bg-background/70 p-0.5 text-muted-foreground opacity-60 transition-opacity hover:text-primary hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${mode === 'expanded' ? 'min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0' : ''}`}
            title="Open copyset detail page"
            aria-label={`Open detail page for copyset ${i + 1}`}
            onclick={(e) => e.stopPropagation()}
          >
            <ArrowUpRight class="size-3" aria-hidden="true" />
          </a>
        </div>
      {/each}
    </div>
  </div>
{/if}

<style>
  .ng-mode-chip {
    display: inline-flex;
    align-items: center;
    padding: 4px 10px;
    min-height: 44px;
    border: 1px solid var(--border);
    border-radius: 4px;
    font-size: 1rem;
    line-height: 1;
    cursor: pointer;
    background: transparent;
    color: var(--muted-foreground);
    transition: opacity 0.15s, background 0.15s, color 0.15s, border-color 0.15s;
  }
  @media (min-width: 640px) {
    .ng-mode-chip { min-height: 0; }
  }
  .ng-mode-chip:hover {
    background: color-mix(in oklch, var(--muted-foreground) 8%, transparent);
    color: var(--foreground);
  }
  .ng-mode-chip--active {
    border-color: var(--primary);
    color: var(--primary);
    background: color-mix(in oklch, var(--primary) 8%, transparent);
  }

  .ng-cell {
    cursor: pointer;
  }

  :global(.copyset-jump-highlight) {
    animation: copyset-jump-flash 1600ms ease-out;
  }
  @keyframes copyset-jump-flash {
    0% { box-shadow: 0 0 0 3px color-mix(in oklch, var(--primary) 55%, transparent); }
    100% { box-shadow: 0 0 0 3px transparent; }
  }
  @media (prefers-reduced-motion: reduce) {
    :global(.copyset-jump-highlight) {
      animation: none;
      outline: 2px solid var(--primary);
      outline-offset: 2px;
    }
  }
</style>
