// Reusable 1D horizontal drag-to-zoom range selector, extracted from
// ActivityChart.svelte's pointer-capture + percent-space + clamped-viewport
// mechanism (that component's version is 2-axis; this is the 1-axis subset
// any single-domain timeline chart needs). Pointer events (not mouse events)
// with pointer capture so a drag tracks correctly even if the cursor leaves
// the plot element mid-drag.

const DRAG_THRESHOLD = 4 // px of real movement before a drag counts as a selection, not a click

export interface DragRangeSelectOptions {
  /** Smallest allowed zoomed span, in domain units (e.g. ms for a time axis). */
  minSpan: number
  /**
   * Full data extent; zoom/pan are clamped to this range. Functions, not
   * fixed numbers: the caller's real extent (e.g. min/max event timestamp)
   * typically changes across fetches/filters, and these are read live on
   * every view/zoom computation rather than captured once at construction --
   * a fixed-number extent silently goes stale the moment the underlying
   * data changes.
   */
  extentMin: () => number
  extentMax: () => number
}

export interface DragRangeSelect {
  readonly plotEl: HTMLElement | undefined
  setPlotEl(el: HTMLElement | undefined): void
  /** Current view window (zoomed range, or the full extent when not zoomed). */
  readonly view: { min: number; max: number }
  readonly isZoomed: boolean
  /** CSS left/width (%) for the in-progress drag-selection overlay; '' when not dragging. */
  readonly selRectStyle: string
  /** Human-readable zoom state for an aria-live region. */
  readonly zoomStatus: string
  onPointerDown(e: PointerEvent): void
  onPointerMove(e: PointerEvent): void
  onPointerUp(e: PointerEvent): void
  onKeyDown(e: KeyboardEvent): void
  resetZoom(): void
}

/** formatValue is used only for the aria-live zoomStatus announcement. */
export function createDragRangeSelect(opts: DragRangeSelectOptions, formatValue: (v: number) => string): DragRangeSelect {
  let plotEl: HTMLElement | undefined = $state()
  let zoom = $state<{ min: number; max: number } | null>(null)
  let dragSel = $state<{ x0: number; x1: number; started: boolean } | null>(null)

  // Re-validates the persisted zoom against the LIVE extent on every read,
  // rather than trusting the snapshot taken when it was set: the extent can
  // narrow/shift between renders (e.g. a filter change fetches a tighter
  // dataset), and a stale zoom window outside the new extent would otherwise
  // stay pinned there until some external caller happens to call
  // resetZoom() -- the primitive's own correctness should not depend on
  // that. Also treats a window that clamps out to (at least) the full
  // extent -- e.g. a minSpan wider than the domain forces this every time --
  // as "not zoomed", so callers never see a zoomed state visually identical
  // to the unzoomed view.
  function clampedZoomView(): { min: number; max: number } | null {
    if (!zoom) return null
    const extentMin = opts.extentMin()
    const extentMax = opts.extentMax()
    const min = Math.max(zoom.min, extentMin)
    const max = Math.min(zoom.max, extentMax)
    if (min >= max || (min <= extentMin && max >= extentMax)) return null
    return { min, max }
  }

  function view() {
    return clampedZoomView() ?? { min: opts.extentMin(), max: opts.extentMax() }
  }

  function pctFromEvent(e: PointerEvent): number | null {
    if (!plotEl) return null
    const r = plotEl.getBoundingClientRect()
    if (r.width <= 0) return null
    return Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100))
  }

  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0) return
    const x = pctFromEvent(e)
    if (x === null) return
    dragSel = { x0: x, x1: x, started: false }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    plotEl?.focus({ preventScroll: true })
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragSel || !plotEl) return
    const x = pctFromEvent(e)
    if (x === null) return
    if (!dragSel.started) {
      const r = plotEl.getBoundingClientRect()
      const dx = Math.abs((x - dragSel.x0) * r.width / 100)
      if (dx >= DRAG_THRESHOLD) dragSel = { ...dragSel, x1: x, started: true }
      return
    }
    dragSel = { ...dragSel, x1: x }
  }

  function onPointerUp(e: PointerEvent) {
    const sel = dragSel
    dragSel = null
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      // noop: capture may already have been released (e.g. pointercancel)
    }
    if (!sel || !sel.started) return
    applyZoomFromPct(sel.x0, sel.x1)
  }

  function applyZoomFromPct(a: number, b: number) {
    const v = view()
    const span = v.max - v.min
    const lo = Math.min(a, b) / 100
    const hi = Math.max(a, b) / 100
    setZoom(v.min + lo * span, v.min + hi * span)
  }

  function setZoom(min: number, max: number) {
    const extentMin = opts.extentMin()
    const extentMax = opts.extentMax()
    let span = max - min
    if (span < opts.minSpan) {
      const center = (min + max) / 2
      min = center - opts.minSpan / 2
      max = center + opts.minSpan / 2
      span = opts.minSpan
    }
    if (min < extentMin) {
      max += extentMin - min
      min = extentMin
    }
    if (max > extentMax) {
      min -= max - extentMax
      max = extentMax
    }
    min = Math.max(min, extentMin)
    zoom = { min, max }
  }

  function panView(dx: number) {
    const v = view()
    const extentMin = opts.extentMin()
    const extentMax = opts.extentMax()
    const span = v.max - v.min
    let min = v.min + dx * span
    let max = v.max + dx * span
    if (min < extentMin) {
      const d = extentMin - min
      min += d
      max += d
    }
    if (max > extentMax) {
      const d = max - extentMax
      min -= d
      max -= d
    }
    zoom = { min: Math.max(min, extentMin), max }
  }

  function zoomBy(factor: number) {
    const v = view()
    const center = (v.min + v.max) / 2
    const half = (v.max - v.min) * factor / 2
    setZoom(center - half, center + half)
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      if (dragSel) {
        dragSel = null
        e.preventDefault()
        return
      }
      if (zoom) {
        zoom = null
        e.preventDefault()
        return
      }
    }
    if (e.key === '0' && zoom) {
      zoom = null
      e.preventDefault()
      return
    }
    const step = e.shiftKey ? 0.25 : 0.1
    switch (e.key) {
      case 'ArrowLeft':
        panView(-step)
        e.preventDefault()
        break
      case 'ArrowRight':
        panView(step)
        e.preventDefault()
        break
      case '+':
      case '=':
        zoomBy(0.8)
        e.preventDefault()
        break
      case '-':
      case '_':
        zoomBy(1.25)
        e.preventDefault()
        break
    }
  }

  function resetZoom() {
    zoom = null
  }

  const selRectStyle = $derived.by(() => {
    if (!dragSel || !dragSel.started) return ''
    const left = Math.min(dragSel.x0, dragSel.x1)
    const width = Math.abs(dragSel.x1 - dragSel.x0)
    return `left: ${left}%; width: ${width}%;`
  })

  const zoomStatus = $derived.by(() => {
    const v = clampedZoomView()
    if (!v) return ''
    return `Zoomed to ${formatValue(v.min)} through ${formatValue(v.max)}`
  })

  return {
    get plotEl() {
      return plotEl
    },
    setPlotEl(el) {
      plotEl = el
    },
    get view() {
      return view()
    },
    get isZoomed() {
      return clampedZoomView() !== null
    },
    get selRectStyle() {
      return selRectStyle
    },
    get zoomStatus() {
      return zoomStatus
    },
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onKeyDown,
    resetZoom,
  }
}
