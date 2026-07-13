<script lang="ts">
  import type { GCWorkerEvent } from '$lib/core/api/types'
  import { createDragRangeSelect } from '$lib/components/shared/chart/dragRangeSelect.svelte'
  import ZoomOutIcon from '@lucide/svelte/icons/zoom-out'

  let { events = [] }: { events: GCWorkerEvent[] } = $props()

  const MIN_SPAN_MS = 60_000 // 1 minute minimum zoom span

  interface PlottedEvent extends GCWorkerEvent {
    x: number
    y: number
    _t: number
  }

  // Deterministic goal -> OKLCH hue, so the same goal always renders the same
  // color across renders/sessions without a curated lookup table (there's no
  // fixed goal list the way ActivityChart has a fixed subject list -- gcserv
  // goals are an open set).
  function hueFor(goal: string): number {
    let h = 0
    for (let i = 0; i < goal.length; i++) h = (h * 31 + goal.charCodeAt(i)) >>> 0
    return h % 360
  }
  function colorFor(goal: string): string {
    return `oklch(0.62 0.15 ${hueFor(goal)})`
  }

  const enriched = $derived.by(() => {
    let tMin = Infinity, tMax = -Infinity
    const goals: string[] = []
    const seen = new Set<string>()
    for (const e of events) {
      const t = new Date(e.eventTime).getTime()
      if (t < tMin) tMin = t
      if (t > tMax) tMax = t
      if (!seen.has(e.goal)) { seen.add(e.goal); goals.push(e.goal) }
    }
    goals.sort()
    if (!events.length) { tMin = Date.now() - 3600_000; tMax = Date.now() }
    if (tMax === tMin) tMax = tMin + 1
    return { tMin, tMax, goals }
  })

  // extentMin/extentMax read enriched.tMin/tMax LIVE (not captured once) --
  // the event set's real time range changes across fetches/filters, and
  // view()/setZoom() call these on every computation rather than working
  // off a value frozen at construction time.
  const drag = createDragRangeSelect(
    { minSpan: MIN_SPAN_MS, extentMin: () => enriched.tMin, extentMax: () => enriched.tMax },
    (v) => new Date(v).toLocaleString(),
  )
  // bind:this needs a plain local binding target; sync it into the drag
  // helper (whose plotEl is a get/set pair, not $bindable) via an effect.
  let plotEl: HTMLDivElement | undefined = $state()
  $effect(() => {
    drag.setPlotEl(plotEl)
  })
  // Reset an active zoom whenever the underlying event set changes (a fresh
  // filter/page fetch) -- a zoomed absolute time window from a previous
  // fetch could otherwise land on a completely different dataset. `events`
  // must be read here to give this effect a tracked dependency; a body that
  // only writes state (as this did before) runs once at mount and never again.
  $effect(() => {
    void events
    drag.resetZoom()
  })

  const plotted = $derived.by((): PlottedEvent[] => {
    const { goals } = enriched
    if (!goals.length) return []
    const v = drag.view
    const span = v.max - v.min || 1
    const rowSpan = 100 / goals.length
    const out: PlottedEvent[] = []
    for (const e of events) {
      const t = new Date(e.eventTime).getTime()
      if (t < v.min || t > v.max) continue
      const row = goals.indexOf(e.goal)
      out.push({
        ...e,
        _t: t,
        x: ((t - v.min) / span) * 100,
        y: row * rowSpan + rowSpan / 2,
      })
    }
    return out
  })

  const timeLabels = $derived.by(() => {
    const v = drag.view
    return Array.from({ length: 5 }, (_, i) => {
      const t = v.min + (i / 4) * (v.max - v.min)
      return { label: new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), x: (i / 4) * 100 }
    })
  })

  function opsSummary(e: GCWorkerEvent): string {
    return Object.entries(e.ops).map(([k, v]) => `${k}=${v}`).join(', ')
  }
</script>

{#if enriched.goals.length === 0}
  <p class="text-sm text-muted-foreground py-4 text-center">No worker events to plot.</p>
{:else}
  <div class="relative w-full">
    <div class="relative border border-border rounded-sm bg-background overflow-hidden" style="padding: 0.5rem 1rem 2rem 8rem; height: min({Math.max(160, enriched.goals.length * 36 + 48)}px, 60vh); contain: layout;">
      <div class="tech-grid absolute inset-0 pointer-events-none opacity-20"></div>
      <!-- Y-axis labels: one row per distinct goal -->
      <div class="absolute left-2 top-2 bottom-8 w-28 flex flex-col text-[1rem] font-mono text-muted-foreground">
        {#each enriched.goals as goal, i}
          <div class="flex-1 flex items-center gap-1.5 truncate" title={goal}>
            <span class="inline-block w-2 h-2 rounded-full shrink-0" style="background: {colorFor(goal)};"></span>
            <span class="truncate">{goal}</span>
          </div>
        {/each}
      </div>

      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div
        bind:this={plotEl}
        class="absolute left-32 right-2 top-2 bottom-8 border-l border-b border-border/50 overflow-visible select-none touch-none cursor-crosshair focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
        role="application"
        aria-label="Worker event timeline. Drag to zoom into a time range, or use arrow keys to pan, +/- to zoom, 0 to reset."
        aria-keyshortcuts="ArrowLeft ArrowRight Plus Minus 0 Escape"
        tabindex="0"
        onpointerdown={drag.onPointerDown}
        onpointermove={drag.onPointerMove}
        onpointerup={drag.onPointerUp}
        onpointercancel={drag.onPointerUp}
        onkeydown={drag.onKeyDown}>
        {#each enriched.goals as _, i}
          <div class="absolute left-0 right-0 border-t border-border/20 pointer-events-none" style="top: {(i / enriched.goals.length) * 100}%"></div>
        {/each}

        {#each plotted as e (e.id)}
          <div
            class="absolute -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full pointer-events-auto"
            style="left: {e.x}%; top: {e.y}%; background: {colorFor(e.goal)};"
            title="{e.goal}{e.subject ? ` (${e.subject})` : ''} - {new Date(e.eventTime).toLocaleString()} - {opsSummary(e)}, {e.durationMs}ms">
          </div>
        {/each}

        {#if drag.selRectStyle}
          <div class="absolute top-0 bottom-0 pointer-events-none border-x border-primary bg-primary/15" style={drag.selRectStyle}></div>
        {/if}
      </div>

      <div class="sr-only" aria-live="polite">{drag.zoomStatus}</div>

      {#if drag.isZoomed}
        <button type="button"
          class="absolute top-1 right-1 z-10 inline-flex items-center gap-1.5 rounded-sm border border-border bg-card h-7 min-h-[44px] sm:min-h-0 px-2.5 text-[1rem] font-mono text-muted-foreground hover:text-foreground hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 transition-colors"
          onclick={() => drag.resetZoom()}
          title="Reset zoom (0)">
          <ZoomOutIcon class="w-3.5 h-3.5" />
          <span>Reset</span>
        </button>
      {/if}

      <div class="absolute left-32 right-2 bottom-1 flex justify-between text-[1rem] font-mono text-muted-foreground">
        {#each timeLabels as { label }}
          <div>{label}</div>
        {/each}
      </div>
    </div>
  </div>
{/if}
