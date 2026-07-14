<script lang="ts">
  import type { AuditLog } from '$lib/core/api/types'
  import { getSubjectMeta, allSubjects as allSubjectKeys } from '$lib/core/utils/subjects'
  import { copyText } from '$lib/core/utils/clipboard'
  import CopyIcon from '@lucide/svelte/icons/copy'
  import CheckIcon from '@lucide/svelte/icons/check'
  import ZoomOutIcon from '@lucide/svelte/icons/zoom-out'

  let { logs = [] }: { logs: AuditLog[] } = $props()

  interface PlottedLog extends AuditLog {
    x: number; y: number; date: Date; timeMinutes: number
  }

  // Zoom constraints
  const MIN_Y_SPAN = 30          // minutes (time-of-day)
  const MIN_X_SPAN = 86_400_000  // 1 day (ms)
  const DRAG_THRESHOLD = 4       // px before drag counts as zoom selection

  let hoveredLog = $state<PlottedLog | null>(null)
  let popupPosition = $state({ left: '0px', top: '0px', transform: 'translate(-50%, -100%)' })
  let copiedId = $state<number | null>(null)
  let copyTimer: ReturnType<typeof setTimeout> | undefined
  let disabledSubjects = $state<Set<string>>(new Set())

  // Zoom view: null = full extent
  let zoom = $state<{ xMin: number; xMax: number; yMin: number; yMax: number } | null>(null)
  // Active drag selection in plot-local % (0..100)
  let dragSel = $state<{ x0: number; y0: number; x1: number; y1: number; started: boolean } | null>(null)
  let plotEl: HTMLDivElement | undefined = $state()

  async function handleCopy(log: PlottedLog) {
    const obj: Record<string, unknown> = { title: log.title }
    if (log.description) obj.description = log.description
    if (log.subject) obj.subject = log.subject
    obj.success = log.success
    obj.date = log.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    obj.time = fmtTime(log.timeMinutes)
    if (log.createdBy) obj.createdBy = log.createdBy
    if (log.data) obj.data = log.data
    await copyText(JSON.stringify(obj, null, 2))
    copiedId = log.id
    if (copyTimer) clearTimeout(copyTimer)
    copyTimer = setTimeout(() => { copiedId = null }, 2000)
  }

  $effect(() => () => { if (copyTimer) clearTimeout(copyTimer) })

  function meta(subject?: string) { return getSubjectMeta(subject) }

  // Precompute timestamps once per logs change (single pass, no spread-arg risk at scale)
  const enrichedLogs = $derived.by(() => {
    let xMin = Infinity, xMax = -Infinity
    const rows = new Array<PlottedLog & { _t: number }>(logs.length)
    for (let i = 0; i < logs.length; i++) {
      const log = logs[i]
      const date = new Date(log.createdAt ?? '')
      const t = date.getTime()
      if (t < xMin) xMin = t
      if (t > xMax) xMax = t
      rows[i] = { ...log, x: 0, y: 0, date, timeMinutes: date.getHours() * 60 + date.getMinutes(), _t: t }
    }
    if (!logs.length) { xMin = 0; xMax = 1 }
    if (xMax === xMin) xMax = xMin + 1
    return { rows, xMin, xMax }
  })

  // Full data extent (epoch ms for X; minutes-of-day for Y stays 0..1440)
  const dataExtent = $derived({ xMin: enrichedLogs.xMin, xMax: enrichedLogs.xMax, yMin: 0, yMax: 1440 })

  // Effective viewing window
  const view = $derived(zoom ?? dataExtent)

  const plottedLogs = $derived.by((): PlottedLog[] => {
    const v = view
    const xSpan = v.xMax - v.xMin || 1
    const ySpan = v.yMax - v.yMin || 1
    const out: PlottedLog[] = []
    for (const l of enrichedLogs.rows) {
      if (l._t < v.xMin || l._t > v.xMax) continue
      if (l.timeMinutes < v.yMin || l.timeMinutes > v.yMax) continue
      out.push({
        ...l,
        x: ((l._t - v.xMin) / xSpan) * 100,
        y: 100 - ((l.timeMinutes - v.yMin) / ySpan) * 100,
      })
    }
    return out
  })

  const allSubjects = allSubjectKeys

  const presentSubjects = $derived(
    new Set(logs.map(l => l.subject).filter(Boolean))
  )

  function hasData(subject: string) {
    return presentSubjects.has(subject)
  }

  function isActive(subject?: string) {
    return hasData(subject ?? '') && !disabledSubjects.has(subject ?? '')
  }

  // Partition plotted logs once instead of filtering twice in the template.
  const split = $derived.by(() => {
    const active: PlottedLog[] = []
    const inactive: PlottedLog[] = []
    for (const p of plottedLogs) (isActive(p.subject) ? active : inactive).push(p)
    return { active, inactive }
  })

  function toggleSubject(s: string) {
    if (!hasData(s)) return
    const next = new Set(disabledSubjects)
    if (next.has(s)) next.delete(s)
    else next.add(s)
    disabledSubjects = next
  }

  const dateLabels = $derived.by(() => {
    if (!logs.length) return []
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
    let xMin = v.xMin + xLo * xSpan
    let xMax = v.xMin + xHi * xSpan
    let yMin = v.yMax - yLoPct * ySpan
    let yMax = v.yMax - yHiPct * ySpan
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

  function handleEnter(log: PlottedLog, event: MouseEvent) {
    hoveredLog = log
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    const vw = window.innerWidth, vh = window.innerHeight
    let left = rect.left + rect.width / 2
    let top = rect.top - 14
    let transform = 'translate(-50%, -100%)'
    const pw = 448, ph = 360, pad = 16
    if (left - pw / 2 < pad) left = pad + pw / 2
    else if (left + pw / 2 > vw - pad) left = vw - pad - pw / 2
    if (top - ph < pad) { top = rect.bottom + 14; transform = 'translate(-50%, 0)' }
    if (top + ph > vh - pad) top = vh - pad - ph
    popupPosition = { left: `${left}px`, top: `${top}px`, transform }
  }

  function fmtTime(mins: number) {
    return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`
  }

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
</script>

<div class="relative w-full">
  <!-- Chart -->
  <!-- No overflow-hidden: points near the plot edges (near the y-extremes of
  a day, or the x-extremes of the date range) center a 44px hit-area within
  a couple px of the border, and clipping would silently cut off hover/focus
  for the clipped portion -- unlike the visible bubble itself, which stays
  inset from the edge. -->
  <div class="relative border border-border rounded-sm bg-background" style="padding: 1.5rem 1.5rem 3rem 4rem; height: min(400px, 50vh); contain: layout;">
    <div class="tech-grid absolute inset-0 pointer-events-none opacity-20"></div>
    <!-- Y-axis labels -->
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
      class="plot-surface absolute left-[4.5rem] right-4 top-6 bottom-10 border-l border-b border-border/50 overflow-visible select-none touch-none cursor-crosshair focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
      role="application"
      aria-label="Audit log scatter plot. Drag, or use arrow keys to pan, +/- to zoom, 0 to reset."
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

      <!-- Inactive points (rendered first, behind) -->
      {#each split.inactive as log}
        {@const m = meta(log.subject)}
        {@const Icon = m.icon}
        <div class="absolute pointer-events-none -translate-x-1/2 -translate-y-1/2 flex items-center justify-center w-7 h-7 rounded-sm"
          style="left: {log.x}%; top: {log.y}%; background: {m.color}; color: var(--background); opacity: 0.35;"
          aria-hidden="true">
          <Icon class="w-3.5 h-3.5" />
        </div>
      {/each}
      <!-- Active points: 44x44 transparent hit area, 28x28 visible bubble inside -->
      {#each split.active as log}
        {@const m = meta(log.subject)}
        {@const Icon = m.icon}
        <button type="button"
          class="log-point absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center w-11 h-11 cursor-pointer bg-transparent focus-visible:outline-none rounded-sm"
          style="left: {log.x}%; top: {log.y}%;"
          onpointerdown={(e) => e.stopPropagation()}
          onmouseenter={(e) => handleEnter(log, e)}
          onmouseleave={() => hoveredLog = null}
          onfocus={(e) => handleEnter(log, e as unknown as MouseEvent)}
          onblur={() => hoveredLog = null}
          onclick={() => handleCopy(log)}
          aria-label="{log.title}{log.subject ? `; ${log.subject}` : ''}, {log.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} {fmtTime(log.timeMinutes)}">
          <span class="log-point-bubble flex items-center justify-center w-7 h-7 rounded-sm"
            style="background: {m.color}; color: var(--background);">
            <Icon class="w-3.5 h-3.5" />
          </span>
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

    <!-- X-axis labels -->
    <div class="absolute left-[4.5rem] right-4 bottom-2 flex justify-between text-[1rem] font-mono text-muted-foreground">
      {#each dateLabels as { label }}
        <div class="text-center">{label}</div>
      {/each}
    </div>
  </div>

  <!-- Hover popup -->
  {#if hoveredLog}
    {@const m = meta(hoveredLog.subject)}
    <div use:portal class="fixed z-50 w-[min(100vw-1.5rem,28rem)] rounded-sm border border-border bg-background p-4 space-y-2.5"
      style="left: {popupPosition.left}; top: {popupPosition.top}; transform: {popupPosition.transform};">
      <h4 class="text-[1rem] font-medium leading-snug break-words">{hoveredLog.title}</h4>
      <div class="flex items-center flex-wrap gap-2">
        {#if hoveredLog.subject}
          <span class="rounded-sm border px-2 py-0.5 text-[1rem] font-mono uppercase tracking-wider whitespace-nowrap"
            style="border-color: {m.color}; color: {m.color};">{hoveredLog.subject}</span>
        {/if}
        {#if !hoveredLog.success}
          <span class="rounded-sm border border-destructive text-destructive px-2 py-0.5 text-[1rem] font-mono uppercase whitespace-nowrap">fail</span>
        {/if}
        <span class="rounded-sm border px-2 py-0.5 text-[1rem] font-mono uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap
          {copiedId === hoveredLog.id ? 'border-primary text-primary bg-primary/10' : 'border-muted-foreground/30 text-muted-foreground'}">
          {#if copiedId === hoveredLog.id}
            <CheckIcon class="w-4 h-4" />Copied
          {:else}
            <CopyIcon class="w-4 h-4" />Click to copy
          {/if}
        </span>
      </div>
      {#if hoveredLog.description}
        <p class="text-[1rem] text-muted-foreground leading-snug">{hoveredLog.description}</p>
      {/if}
      <div class="flex items-center flex-wrap gap-x-3 gap-y-1 text-[1rem] text-muted-foreground font-mono">
        <span class="whitespace-nowrap">{hoveredLog.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
        <span class="whitespace-nowrap">{fmtTime(hoveredLog.timeMinutes)}</span>
        {#if hoveredLog.createdBy}
          <span class="break-all">&middot; {hoveredLog.createdBy}</span>
        {/if}
      </div>
      {#if hoveredLog.data}
        <pre class="overflow-x-auto rounded-sm border border-border bg-muted/30 p-2 text-[1rem] font-mono leading-relaxed max-h-52">{JSON.stringify(hoveredLog.data, null, 2)}</pre>
      {/if}
    </div>
  {/if}

  <!-- Legend -->
  <div class="relative border border-border/30 rounded-sm px-5 py-3 mt-3 mx-auto w-fit max-w-full">
    <div class="tech-grid absolute inset-0 pointer-events-none opacity-20"></div>
    <div class="relative flex flex-wrap items-center justify-center gap-3">
      {#each allSubjects as s}
        {@const m = meta(s)}
        {@const Icon = m.icon}
        {@const has = hasData(s)}
        {@const on = isActive(s)}
        {#if has}
          <button
            class="legend-chip"
            class:legend-dimmed={!on}
            style="--chip-accent: {m.color};"
            onclick={() => toggleSubject(s)}
            aria-pressed={on}
            title={s}
          >
            <span class="legend-swatch inline-flex items-center justify-center w-5 h-5" style="background: {m.color}; color: var(--background); border-color: {m.color};">
              <Icon class="w-3 h-3" />
            </span>
            <span class="legend-label">{s}</span>
          </button>
        {:else}
          <span class="legend-chip legend-inert" title="{s}; no data">
            <span class="legend-swatch legend-swatch-inert inline-flex items-center justify-center w-5 h-5">
              <Icon class="w-3 h-3" />
            </span>
            <span class="legend-label">{s}</span>
          </span>
        {/if}
      {/each}
    </div>
  </div>
</div>

<style>
  .log-point .log-point-bubble {
    transform: scale(1);
    transition: transform 180ms cubic-bezier(0.22, 1, 0.36, 1);
  }
  .log-point:hover .log-point-bubble,
  .log-point:focus-visible .log-point-bubble {
    transform: scale(1.6);
  }
  .log-point:focus-visible .log-point-bubble {
    box-shadow: 0 0 0 2px var(--ring);
  }
  .plot-surface:focus-visible {
    border-color: var(--ring);
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

  .legend-swatch {
    border-radius: 4px;
    border-width: 2px;
    border-style: solid;
  }

  .legend-swatch-inert {
    background: color-mix(in oklch, var(--muted-foreground) 30%, transparent);
    border-color: color-mix(in oklch, var(--muted-foreground) 30%, transparent);
    color: color-mix(in oklch, var(--background) 60%, var(--muted-foreground));
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

  .legend-inert {
    cursor: default;
    opacity: 0.25;
    border-color: color-mix(in oklch, var(--muted-foreground) 10%, transparent);
  }

</style>
