<script lang="ts">
  import type { GCWorkerEvent } from '$lib/core/api/types'
  import { copyText } from '$lib/core/utils/clipboard'
  import ZoomOutIcon from '@lucide/svelte/icons/zoom-out'
  import CopyIcon from '@lucide/svelte/icons/copy'
  import CheckIcon from '@lucide/svelte/icons/check'

  let { events = [] }: { events: GCWorkerEvent[] } = $props()

  // Same date (x) x time-of-day (y) scatter as ActivityChart, so operators
  // read both charts the same way: date tells you which day, y tells you
  // when in the day. Each dot is one event; goal is a toggleable legend
  // dimension (an open set, unlike ActivityChart's fixed curated subject
  // list) rather than a row -- that's what "recent activity"-style charts
  // use legends for.
  const MIN_Y_SPAN = 30          // minutes (time-of-day)
  const MIN_X_SPAN = 86_400_000  // 1 day (ms)
  const DRAG_THRESHOLD = 4       // px before drag counts as zoom selection

  interface PlottedEvent extends GCWorkerEvent {
    x: number; y: number; date: Date; timeMinutes: number
  }

  // Deterministic goal -> color, so the same goal always renders the same
  // color across renders/sessions without a curated lookup table (there's no
  // fixed goal list the way ActivityChart has a fixed subject list -- gcserv
  // goals are an open set).
  function hashStr(s: string, seed: number): number {
    let h = seed
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
    return h
  }
  function hueFor(goal: string): number {
    return hashStr(goal, 0) % 360
  }
  function colorFor(goal: string): string {
    return `oklch(0.62 0.15 ${hueFor(goal)})`
  }
  const MARKER_SHAPES = ['circle', 'triangle', 'square', 'diamond'] as const

  let disabledGoals = $state<Set<string>>(new Set())
  let zoom = $state<{ xMin: number; xMax: number; yMin: number; yMax: number } | null>(null)
  let dragSel = $state<{ x0: number; y0: number; x1: number; y1: number; started: boolean } | null>(null)
  let plotEl: HTMLDivElement | undefined = $state()

  // Precompute timestamps once per events change (single pass, no spread-arg risk at scale)
  const enrichedEvents = $derived.by(() => {
    let xMin = Infinity, xMax = -Infinity
    const rows = new Array<PlottedEvent>(events.length)
    for (let i = 0; i < events.length; i++) {
      const e = events[i]
      const date = new Date(e.eventTime)
      const t = date.getTime()
      if (t < xMin) xMin = t
      if (t > xMax) xMax = t
      rows[i] = { ...e, x: 0, y: 0, date, timeMinutes: date.getHours() * 60 + date.getMinutes() }
    }
    if (!events.length) { xMin = 0; xMax = 1 }
    if (xMax === xMin) xMax = xMin + 1
    return { rows, xMin, xMax }
  })

  // Full data extent (epoch ms for X; minutes-of-day for Y stays 0..1440)
  const dataExtent = $derived({ xMin: enrichedEvents.xMin, xMax: enrichedEvents.xMax, yMin: 0, yMax: 1440 })

  // Effective viewing window
  const view = $derived(zoom ?? dataExtent)

  const plottedEvents = $derived.by((): PlottedEvent[] => {
    const v = view
    const xSpan = v.xMax - v.xMin || 1
    const ySpan = v.yMax - v.yMin || 1
    const out: PlottedEvent[] = []
    for (const e of enrichedEvents.rows) {
      const t = e.date.getTime()
      if (t < v.xMin || t > v.xMax) continue
      if (e.timeMinutes < v.yMin || e.timeMinutes > v.yMax) continue
      out.push({
        ...e,
        x: ((t - v.xMin) / xSpan) * 100,
        y: 100 - ((e.timeMinutes - v.yMin) / ySpan) * 100,
      })
    }
    return out
  })

  // Legend membership is drawn from ALL events regardless of current zoom
  // (matching ActivityChart's presentSubjects), so toggling a goal off/on
  // doesn't itself change which chips are offered.
  const allGoals = $derived.by(() => {
    const seen = new Set<string>()
    const out: string[] = []
    for (const e of events) if (!seen.has(e.goal)) { seen.add(e.goal); out.push(e.goal) }
    out.sort()
    return out
  })

  // Shape assigned by position among the goals actually on screen, not by
  // hashing the goal name: a hash over only 4 buckets collides constantly at
  // the small goal counts this chart usually has (2 goals -> 1-in-4 chance
  // of an identical shape), silently defeating the point of a second visual
  // channel. Position guarantees every goal is shape-distinct whenever
  // there are <= 4 of them, and still repeats deterministically past that
  // -- color (360 hues) carries the rest of the distinguishing load then.
  const goalShapes = $derived.by(() => {
    const m = new Map<string, (typeof MARKER_SHAPES)[number]>()
    allGoals.forEach((goal, i) => m.set(goal, MARKER_SHAPES[i % MARKER_SHAPES.length]))
    return m
  })
  function markerClassFor(goal: string): string {
    return `marker-${goalShapes.get(goal) ?? MARKER_SHAPES[0]}`
  }

  function isActive(goal: string) {
    return !disabledGoals.has(goal)
  }

  function toggleGoal(goal: string) {
    const next = new Set(disabledGoals)
    if (next.has(goal)) next.delete(goal)
    else next.add(goal)
    disabledGoals = next
  }

  // Partition plotted events once instead of filtering twice in the template.
  const split = $derived.by(() => {
    const active: PlottedEvent[] = []
    const inactive: PlottedEvent[] = []
    for (const p of plottedEvents) (isActive(p.goal) ? active : inactive).push(p)
    return { active, inactive }
  })

  // Reset an active zoom whenever the underlying event set changes (a fresh
  // filter/page fetch) -- a zoomed absolute date window from a previous
  // fetch could otherwise land on a completely different dataset.
  $effect(() => {
    void events
    zoom = null
  })

  const dateLabels = $derived.by(() => {
    if (!events.length) return []
    const v = view
    const minD = new Date(v.xMin), maxD = new Date(v.xMax)
    const days = Math.ceil((v.xMax - v.xMin) / 86400000)
    if (days <= 1) {
      const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      const sameDay = minD.toDateString() === maxD.toDateString()
      if (sameDay) return [{ label: fmt(minD), x: 50 }]
      return [{ label: fmt(minD), x: 0 }, { label: fmt(maxD), x: 100 }]
    }
    const n = Math.min(days + 1, 7)
    return Array.from({ length: n }, (_, i) => {
      const d = new Date(v.xMin + (i / (n - 1)) * (v.xMax - v.xMin))
      return { label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), x: (i / (n - 1)) * 100 }
    })
  })

  const timeLabels = $derived.by(() => {
    const v = view
    const span = v.yMax - v.yMin
    return Array.from({ length: 5 }, (_, i) => {
      const ri = 4 - i
      const mins = v.yMin + (ri / 4) * span
      const h = Math.floor(mins / 60), m = Math.round(mins % 60)
      const hh = m === 60 ? h + 1 : h
      const mm = m === 60 ? 0 : m
      return { label: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, y: 100 - (ri / 4) * 100 }
    })
  })

  function pctFromEvent(e: PointerEvent): { x: number; y: number } | null {
    if (!plotEl) return null
    const r = plotEl.getBoundingClientRect()
    if (r.width <= 0 || r.height <= 0) return null
    return {
      x: Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100)),
      y: Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100)),
    }
  }

  function onPlotPointerDown(e: PointerEvent) {
    if (e.button !== 0) return
    const p = pctFromEvent(e); if (!p) return
    dragSel = { x0: p.x, y0: p.y, x1: p.x, y1: p.y, started: false }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    plotEl?.focus({ preventScroll: true })
  }

  function onPlotPointerMove(e: PointerEvent) {
    if (!dragSel || !plotEl) return
    const p = pctFromEvent(e); if (!p) return
    if (!dragSel.started) {
      const r = plotEl.getBoundingClientRect()
      const dx = Math.abs((p.x - dragSel.x0) * r.width / 100)
      const dy = Math.abs((p.y - dragSel.y0) * r.height / 100)
      if (Math.hypot(dx, dy) >= DRAG_THRESHOLD) dragSel = { ...dragSel, x1: p.x, y1: p.y, started: true }
      return
    }
    dragSel = { ...dragSel, x1: p.x, y1: p.y }
  }

  function onPlotPointerUp(e: PointerEvent) {
    const sel = dragSel
    dragSel = null
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId) } catch { /* noop */ }
    if (!sel || !sel.started) return
    applyZoomFromPct(sel.x0, sel.y0, sel.x1, sel.y1)
  }

  function onPlotKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      if (dragSel) { dragSel = null; e.preventDefault(); return }
      if (zoom) { zoom = null; e.preventDefault(); return }
    }
    if (e.key === '0' && zoom) { zoom = null; e.preventDefault(); return }
    const step = e.shiftKey ? 0.25 : 0.1
    switch (e.key) {
      case 'ArrowLeft':  panView(-step, 0); e.preventDefault(); break
      case 'ArrowRight': panView( step, 0); e.preventDefault(); break
      case 'ArrowUp':    panView(0,  step); e.preventDefault(); break
      case 'ArrowDown':  panView(0, -step); e.preventDefault(); break
      case '+': case '=': zoomBy(0.8); e.preventDefault(); break
      case '-': case '_': zoomBy(1.25); e.preventDefault(); break
    }
  }

  function applyZoomFromPct(ax: number, ay: number, bx: number, by: number) {
    const v = view
    const xSpan = v.xMax - v.xMin, ySpan = v.yMax - v.yMin
    const xLo = Math.min(ax, bx) / 100, xHi = Math.max(ax, bx) / 100
    // y is inverted in screen space (top = yMax)
    const yHiPct = Math.min(ay, by) / 100, yLoPct = Math.max(ay, by) / 100
    const xMin = v.xMin + xLo * xSpan
    const xMax = v.xMin + xHi * xSpan
    const yMin = v.yMax - yLoPct * ySpan
    const yMax = v.yMax - yHiPct * ySpan
    setZoom(xMin, xMax, yMin, yMax)
  }

  function panView(dx: number, dy: number) {
    const v = view
    const xSpan = v.xMax - v.xMin, ySpan = v.yMax - v.yMin
    const px = clampPan(v.xMin + dx * xSpan, v.xMax + dx * xSpan, dataExtent.xMin, dataExtent.xMax)
    const py = clampPan(v.yMin + dy * ySpan, v.yMax + dy * ySpan, 0, 1440)
    zoom = { xMin: px.min, xMax: px.max, yMin: py.min, yMax: py.max }
  }

  function zoomBy(factor: number) {
    const v = view
    const xc = (v.xMin + v.xMax) / 2, yc = (v.yMin + v.yMax) / 2
    const xH = (v.xMax - v.xMin) * factor / 2, yH = (v.yMax - v.yMin) * factor / 2
    setZoom(xc - xH, xc + xH, yc - yH, yc + yH)
  }

  function setZoom(xMin: number, xMax: number, yMin: number, yMax: number) {
    ;({ min: xMin, max: xMax } = enforceMinSpan(xMin, xMax, MIN_X_SPAN, dataExtent.xMin, dataExtent.xMax))
    ;({ min: yMin, max: yMax } = enforceMinSpan(yMin, yMax, MIN_Y_SPAN, 0, 1440))
    zoom = { xMin, xMax, yMin, yMax }
  }

  function enforceMinSpan(min: number, max: number, minSpan: number, lo: number, hi: number) {
    let span = max - min
    if (span < minSpan) {
      const center = (min + max) / 2
      min = center - minSpan / 2
      max = center + minSpan / 2
      span = minSpan
    }
    if (min < lo) { max += lo - min; min = lo }
    if (max > hi) { min -= max - hi; max = hi }
    if (min < lo) min = lo
    return { min, max }
  }

  function clampPan(min: number, max: number, lo: number, hi: number) {
    if (min < lo) { const d = lo - min; min += d; max += d }
    if (max > hi) { const d = max - hi; min -= d; max -= d }
    if (min < lo) min = lo
    return { min, max }
  }

  function resetZoom() { zoom = null }

  const zoomStatus = $derived.by(() => {
    if (!zoom) return ''
    const fmtDay = (t: number) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    const fmtMin = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.round(m % 60)).padStart(2, '0')}`
    return `Zoomed to ${fmtDay(zoom.xMin)} ${fmtMin(zoom.yMin)} through ${fmtDay(zoom.xMax)} ${fmtMin(zoom.yMax)}`
  })

  const selRectStyle = $derived.by(() => {
    if (!dragSel || !dragSel.started) return ''
    const left = Math.min(dragSel.x0, dragSel.x1)
    const top = Math.min(dragSel.y0, dragSel.y1)
    const width = Math.abs(dragSel.x1 - dragSel.x0)
    const height = Math.abs(dragSel.y1 - dragSel.y0)
    return `left: ${left}%; top: ${top}%; width: ${width}%; height: ${height}%;`
  })

  // Hover/click popup for a plotted point, matching ActivityChart's
  // click-to-copy card instead of a native `title` tooltip (no keyboard
  // access, slow to appear, and visually inconsistent with the rest of the
  // app's charts).
  let hoveredEvent = $state<PlottedEvent | null>(null)
  let popupPosition = $state({ left: '0px', top: '0px', transform: 'translate(-50%, -100%)' })
  let copiedId = $state<number | null>(null)
  let copyTimer: ReturnType<typeof setTimeout> | undefined

  function handleEnter(e: PlottedEvent, event: MouseEvent) {
    hoveredEvent = e
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    const vw = window.innerWidth, vh = window.innerHeight
    let left = rect.left + rect.width / 2
    let top = rect.top - 14
    let transform = 'translate(-50%, -100%)'
    const pw = 384, ph = 220, pad = 16
    if (left - pw / 2 < pad) left = pad + pw / 2
    else if (left + pw / 2 > vw - pad) left = vw - pad - pw / 2
    if (top - ph < pad) { top = rect.bottom + 14; transform = 'translate(-50%, 0)' }
    if (top + ph > vh - pad) top = vh - pad - ph
    popupPosition = { left: `${left}px`, top: `${top}px`, transform }
  }

  async function handleCopy(e: PlottedEvent) {
    const obj: Record<string, unknown> = { goal: e.goal }
    if (e.subject) obj.subject = e.subject
    if (e.sid) obj.volumeId = e.sid
    obj.eventTime = e.date.toLocaleString()
    obj.ops = e.ops
    obj.durationMs = e.durationMs
    await copyText(JSON.stringify(obj, null, 2))
    copiedId = e.id
    if (copyTimer) clearTimeout(copyTimer)
    copyTimer = setTimeout(() => { copiedId = null }, 2000)
  }

  $effect(() => () => { if (copyTimer) clearTimeout(copyTimer) })

  // Portal the hover popup to document.body so `position: fixed` resolves to
  // the viewport even when an ancestor has a transform.
  function portal(node: HTMLElement) {
    document.body.appendChild(node)
    return {
      destroy() {
        if (node.parentNode) node.parentNode.removeChild(node)
      },
    }
  }

  function opsSummary(e: GCWorkerEvent): string {
    return Object.entries(e.ops).map(([k, v]) => `${k}=${v}`).join(', ')
  }
</script>

{#if events.length === 0}
  <p class="text-sm text-muted-foreground py-4 text-center">No worker events to plot.</p>
{:else}
  <div class="relative w-full">
    <!-- No overflow-hidden: points near the plot edges (a date/time near the
    view's extremes) center a 44px hit-area within a couple px of the border,
    and clipping would silently cut off hover/focus for the clipped portion
    -- unlike the visible dot itself, which is always inset from the edge. -->
    <div class="relative border border-border rounded-sm bg-background" style="padding: 1.5rem 1.5rem 3rem 4rem; height: min(400px, 50vh); contain: layout;">
      <div class="tech-grid absolute inset-0 pointer-events-none opacity-20"></div>
      <!-- Y-axis labels: time of day -->
      <div class="absolute left-2 top-6 bottom-10 w-14 flex flex-col justify-between text-[1rem] font-mono text-muted-foreground">
        {#each timeLabels as { label }}
          <div class="text-right pr-1">{label}</div>
        {/each}
      </div>

      <!-- Plot area: focusable for keyboard zoom (arrows pan, +/- zoom, 0/Esc reset) -->
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div
        bind:this={plotEl}
        class="absolute left-[4.5rem] right-4 top-6 bottom-10 border-l border-b border-border/50 overflow-visible select-none touch-none cursor-crosshair focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
        role="application"
        aria-label="Worker event scatter plot. Drag, or use arrow keys to pan, +/- to zoom, 0 to reset."
        aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Plus Minus 0 Escape"
        tabindex="0"
        onpointerdown={onPlotPointerDown}
        onpointermove={onPlotPointerMove}
        onpointerup={onPlotPointerUp}
        onpointercancel={onPlotPointerUp}
        onkeydown={onPlotKey}>
        <!-- Grid -->
        {#each timeLabels as { y }}
          <div class="absolute left-0 right-0 border-t border-border/20 pointer-events-none" style="top: {y}%"></div>
        {/each}
        {#each dateLabels as { x }}
          <div class="absolute top-0 bottom-0 border-l border-border/20 pointer-events-none" style="left: {x}%"></div>
        {/each}

        <!-- Inactive (legend-toggled-off) points: rendered dimmed, behind, non-interactive -->
        {#each split.inactive as e (e.id)}
          <div class="{markerClassFor(e.goal)} absolute pointer-events-none -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 opacity-30"
            style="left: {e.x}%; top: {e.y}%; background: {colorFor(e.goal)};"
            aria-hidden="true">
          </div>
        {/each}

        <!-- Active points: 44x44 transparent hit area, small visible dot inside -->
        {#each split.active as e (e.id)}
          <button type="button"
            class="event-point absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center w-11 h-11 cursor-pointer bg-transparent focus-visible:outline-none rounded-full"
            style="left: {e.x}%; top: {e.y}%;"
            onpointerdown={(ev) => ev.stopPropagation()}
            onmouseenter={(ev) => handleEnter(e, ev)}
            onmouseleave={() => hoveredEvent = null}
            onfocus={(ev) => handleEnter(e, ev as unknown as MouseEvent)}
            onblur={() => hoveredEvent = null}
            onclick={() => handleCopy(e)}
            aria-label="{e.goal}{e.subject ? `, ${e.subject}` : ''}, {e.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} {String(Math.floor(e.timeMinutes / 60)).padStart(2, '0')}:{String(e.timeMinutes % 60).padStart(2, '0')}">
            <span class="event-point-bubble {markerClassFor(e.goal)} block w-3.5 h-3.5" style="background: {colorFor(e.goal)};"></span>
          </button>
        {/each}

        <!-- Drag selection rectangle -->
        {#if dragSel?.started}
          <div class="absolute pointer-events-none border border-primary bg-primary/15" style={selRectStyle}></div>
        {/if}
      </div>

      <!-- Live region: announces zoom changes for screen readers -->
      <div class="sr-only" aria-live="polite">{zoomStatus}</div>

      <!-- Zoom-out reset (visible only when zoomed) -->
      {#if zoom}
        <button type="button"
          class="absolute top-2 right-2 z-10 inline-flex items-center gap-1.5 rounded-sm border border-border bg-card h-7 min-h-[44px] sm:min-h-0 px-2.5 text-[1rem] font-mono text-muted-foreground hover:text-foreground hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 transition-colors"
          onclick={resetZoom}
          title="Reset zoom (0)">
          <ZoomOutIcon class="w-3.5 h-3.5" />
          <span>Reset</span>
        </button>
      {/if}

      <!-- X-axis labels: date -->
      <div class="absolute left-[4.5rem] right-4 bottom-2 flex justify-between text-[1rem] font-mono text-muted-foreground">
        {#each dateLabels as { label }}
          <div class="text-center">{label}</div>
        {/each}
      </div>
    </div>

    <!-- Hover/focus popup -->
    {#if hoveredEvent}
      <div use:portal class="fixed z-50 w-[min(100vw-1.5rem,24rem)] rounded-sm border border-border bg-background p-4 space-y-2.5"
        style="left: {popupPosition.left}; top: {popupPosition.top}; transform: {popupPosition.transform};">
        <h4 class="text-[1rem] font-medium leading-snug break-words" style="color: {colorFor(hoveredEvent.goal)};">{hoveredEvent.goal}</h4>
        <div class="flex items-center flex-wrap gap-2">
          {#if hoveredEvent.subject}
            <span class="rounded-sm border px-2 py-0.5 text-[1rem] font-mono uppercase tracking-wider whitespace-nowrap"
              style="border-color: {colorFor(hoveredEvent.goal)}; color: {colorFor(hoveredEvent.goal)};">{hoveredEvent.subject}</span>
          {:else if hoveredEvent.sid}
            <span class="rounded-sm border border-muted-foreground/30 text-muted-foreground px-2 py-0.5 text-[1rem] font-mono tracking-wider whitespace-nowrap">volume #{hoveredEvent.sid}</span>
          {/if}
          <span class="rounded-sm border px-2 py-0.5 text-[1rem] font-mono uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap
            {copiedId === hoveredEvent.id ? 'border-primary text-primary bg-primary/10' : 'border-muted-foreground/30 text-muted-foreground'}">
            {#if copiedId === hoveredEvent.id}
              <CheckIcon class="w-4 h-4" />Copied
            {:else}
              <CopyIcon class="w-4 h-4" />Click to copy
            {/if}
          </span>
        </div>
        <div class="flex items-center flex-wrap gap-x-3 gap-y-1 text-[1rem] text-muted-foreground font-mono">
          <span class="whitespace-nowrap">{hoveredEvent.date.toLocaleString()}</span>
          <span class="whitespace-nowrap">{hoveredEvent.durationMs}ms</span>
        </div>
        {#if Object.keys(hoveredEvent.ops).length}
          <p class="text-[1rem] text-muted-foreground font-mono leading-relaxed break-words">{opsSummary(hoveredEvent)}</p>
        {/if}
      </div>
    {/if}

    <!-- Legend: click a goal to toggle it, same interaction as ActivityChart's subject legend -->
    <div class="relative border border-border/30 rounded-sm px-5 py-3 mt-3 mx-auto w-fit max-w-full">
      <div class="tech-grid absolute inset-0 pointer-events-none opacity-20"></div>
      <div class="relative flex flex-wrap items-center justify-center gap-3">
        {#each allGoals as goal}
          {@const on = isActive(goal)}
          <button
            class="legend-chip"
            class:legend-dimmed={!on}
            style="--chip-accent: {colorFor(goal)};"
            onclick={() => toggleGoal(goal)}
            aria-pressed={on}
            title={goal}
          >
            <span class="legend-swatch {markerClassFor(goal)} inline-block w-3.5 h-3.5 shrink-0" style="background: {colorFor(goal)};"></span>
            <span class="legend-label truncate max-w-[14rem]">{goal}</span>
          </button>
        {/each}
      </div>
    </div>
  </div>
{/if}

<style>
  .event-point .event-point-bubble {
    transform: scale(1);
    transition: transform 180ms cubic-bezier(0.22, 1, 0.36, 1);
  }
  .event-point:hover .event-point-bubble,
  .event-point:focus-visible .event-point-bubble {
    transform: scale(1.6);
  }
  .event-point:focus-visible .event-point-bubble {
    box-shadow: 0 0 0 2px var(--ring);
  }

  /* Marker shapes: a second, independent channel alongside color so goals
  stay distinguishable for colorblind operators and at a glance. */
  .marker-circle {
    border-radius: 50%;
  }
  .marker-square {
    border-radius: 0;
  }
  .marker-triangle {
    border-radius: 0;
    clip-path: polygon(50% 0%, 0% 100%, 100% 100%);
  }
  .marker-diamond {
    border-radius: 0;
    clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
  }

  .legend-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border: 1px solid var(--chip-accent, color-mix(in oklch, var(--muted-foreground) 20%, transparent));
    border-radius: 4px;
    font-size: 1rem;
    cursor: pointer;
    transition: opacity 0.2s, filter 0.2s, border-color 0.2s;
    user-select: none;
    background: transparent;
    color: inherit;
  }

  .legend-chip:hover {
    background: color-mix(in oklch, var(--chip-accent, var(--muted-foreground)) 6%, transparent);
  }

  .legend-label {
    font-weight: 500;
    letter-spacing: 0.02em;
  }

  .legend-dimmed {
    opacity: 0.35;
    filter: saturate(0.2);
    border-color: color-mix(in oklch, var(--muted-foreground) 15%, transparent);
  }
</style>
