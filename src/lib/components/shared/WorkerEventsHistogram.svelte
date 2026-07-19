<script lang="ts">
  import type { GCWorkerEventBucket } from '$lib/core/api/types'
  import { colorFor } from '$lib/core/utils/goalColor'
  import { Input } from '$lib/components/ui/input'

  let { buckets = [], bucketSeconds = 900, rangeMs }: { buckets: GCWorkerEventBucket[]; bucketSeconds?: number; rangeMs?: number } = $props()

  let legendFilter = $state('')

  // Matches ActivityChart's floor so worker/audit charts share the same
  // minimum readable window.
  const MIN_X_SPAN = 86_400_000 // 1 day (ms)

  let disabledGoals = $state<Set<string>>(new Set())

  // X domain anchored to the caller's selected window, not the buckets'
  // own extent: a stacked bar chart is especially sensitive to a
  // data-derived domain, since a narrow accidental domain would stretch a
  // handful of buckets across the full width.
  const domain = $derived.by(() => {
    const xMax = Date.now()
    if (rangeMs != null) return { xMin: xMax - Math.max(rangeMs, MIN_X_SPAN), xMax }
    if (!buckets.length) return { xMin: xMax - MIN_X_SPAN, xMax }
    let xMin = Infinity
    for (const b of buckets) {
      const t = new Date(b.bucketStart).getTime()
      if (t < xMin) xMin = t
    }
    return { xMin, xMax }
  })

  const allGoals = $derived.by(() => {
    const seen = new Set<string>()
    const out: string[] = []
    for (const b of buckets) if (!seen.has(b.goal)) { seen.add(b.goal); out.push(b.goal) }
    out.sort()
    return out
  })

  // Filters which legend rows are shown, not which goals are plotted -- a
  // goal stays selected/deselected across a search even while hidden from
  // the list, so clearing the search doesn't silently reset your picks.
  const filteredGoals = $derived.by(() => {
    const q = legendFilter.trim().toLowerCase()
    if (!q) return allGoals
    return allGoals.filter(g => g.toLowerCase().includes(q))
  })

  function isActive(goal: string) {
    return !disabledGoals.has(goal)
  }

  function toggleGoal(goal: string) {
    const next = new Set(disabledGoals)
    if (next.has(goal)) next.delete(goal)
    else next.add(goal)
    disabledGoals = next
  }

  function selectAllGoals() {
    disabledGoals = new Set()
  }

  // Inverts the active/inactive set over allGoals (not just filteredGoals --
  // toggling shouldn't silently drop goals hidden by the current search).
  // Reproduces "unselect all" as the special case of toggling from a full
  // selection, and also inverts any custom hand-picked selection.
  function toggleAllGoals() {
    const next = new Set<string>()
    for (const g of allGoals) {
      if (!disabledGoals.has(g)) next.add(g)
    }
    disabledGoals = next
  }

  interface Bar { t: number; total: number; segments: { goal: string; count: number }[] }

  const bars = $derived.by((): Bar[] => {
    const byTime = new Map<number, Map<string, number>>()
    for (const b of buckets) {
      if (!isActive(b.goal)) continue
      const t = new Date(b.bucketStart).getTime()
      if (t < domain.xMin || t > domain.xMax) continue
      let m = byTime.get(t)
      if (!m) { m = new Map(); byTime.set(t, m) }
      m.set(b.goal, (m.get(b.goal) ?? 0) + b.count)
    }
    const out: Bar[] = []
    for (const [t, m] of byTime) {
      let total = 0
      const segments = [...m.entries()].map(([goal, count]) => { total += count; return { goal, count } })
      segments.sort((a, c) => a.goal.localeCompare(c.goal))
      out.push({ t, total, segments })
    }
    out.sort((a, b) => a.t - b.t)
    return out
  })

  const maxTotal = $derived(bars.reduce((m, b) => Math.max(m, b.total), 1))

  const barWidthPct = $derived(Math.max(0.3, (bucketSeconds * 1000 / (domain.xMax - domain.xMin)) * 100))

  const dateLabels = $derived.by(() => {
    const span = domain.xMax - domain.xMin
    const days = Math.ceil(span / 86400000)
    const n = days <= 1 ? 2 : Math.min(days + 1, 7)
    return Array.from({ length: n }, (_, i) => {
      const t = domain.xMin + (i / (n - 1)) * span
      return { label: new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), x: (i / (n - 1)) * 100 }
    })
  })

  const yLabels = $derived.by(() => {
    return Array.from({ length: 5 }, (_, i) => {
      const ri = 4 - i
      const v = Math.round((ri / 4) * maxTotal)
      return { label: String(v), y: 100 - (ri / 4) * 100 }
    })
  })

  let hovered = $state<{ bar: Bar; segment: { goal: string; count: number } } | null>(null)
  let popupPosition = $state({ left: '0px', top: '0px', transform: 'translate(-50%, -100%)' })

  function handleEnter(bar: Bar, segment: { goal: string; count: number }, event: MouseEvent) {
    hovered = { bar, segment }
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    const vw = window.innerWidth, vh = window.innerHeight
    let left = rect.left + rect.width / 2
    let top = rect.top - 14
    let transform = 'translate(-50%, -100%)'
    const pw = 320, ph = 140, pad = 16
    if (left - pw / 2 < pad) left = pad + pw / 2
    else if (left + pw / 2 > vw - pad) left = vw - pad - pw / 2
    if (top - ph < pad) { top = rect.bottom + 14; transform = 'translate(-50%, 0)' }
    popupPosition = { left: `${left}px`, top: `${top}px`, transform }
  }

  function fmtRange(t: number): string {
    const start = new Date(t)
    const end = new Date(t + bucketSeconds * 1000)
    const sameDay = start.toDateString() === end.toDateString()
    const df = (d: Date) => d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    const ef = (d: Date) => sameDay ? d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : df(d)
    return `${df(start)} – ${ef(end)}`
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

{#if buckets.length === 0}
  <p class="text-sm text-muted-foreground py-4 text-center">No worker events to plot.</p>
{:else}
  <div class="relative w-full flex flex-col sm:flex-row gap-3">
    <!-- Legend: vertical, scrollable sidebar so it stays usable at goal counts
    that would otherwise wrap into an unreadable multi-row block. Comes first
    so it reads as the controls for the graph beside it, not an afterthought
    below it. -->
    <div class="relative flex flex-col border border-border/30 rounded-sm sm:w-1/5 sm:min-w-[11rem] sm:max-w-[316px]" style="height: min(400px, 56vh);">
      <div class="tech-grid absolute inset-0 pointer-events-none"></div>
      <div class="relative flex items-center gap-1 p-2 border-b border-border/30">
        <Input
          bind:value={legendFilter}
          placeholder="Filter goals..."
          aria-label="Filter legend by goal"
          class="h-8 min-h-[44px] sm:min-h-0 text-xs flex-1 min-w-0"
        />
      </div>
      <div class="relative flex items-center gap-1.5 px-2 py-1.5 border-b border-border/30">
        <button type="button" class="legend-action min-h-[44px] sm:min-h-0" onclick={selectAllGoals}>Select all</button>
        <span class="text-muted-foreground/40">/</span>
        <button type="button" class="legend-action min-h-[44px] sm:min-h-0" onclick={toggleAllGoals}>Toggle</button>
      </div>
      <div class="relative flex-1 overflow-y-auto py-1.5 pl-1.5 pr-3 space-y-1">
        {#each filteredGoals as goal (goal)}
          {@const on = isActive(goal)}
          <button
            class="legend-chip min-h-[44px] sm:min-h-0"
            class:legend-dimmed={!on}
            style="--chip-accent: {colorFor(goal)};"
            onclick={() => toggleGoal(goal)}
            aria-pressed={on}
            title={goal}
          >
            <span class="legend-swatch inline-block w-3.5 h-3.5 shrink-0 rounded-sm" style="background: {colorFor(goal)};"></span>
            <span class="legend-label truncate">{goal}</span>
          </button>
        {:else}
          <p class="text-xs text-muted-foreground text-center py-3">No goals match "{legendFilter}"</p>
        {/each}
      </div>
    </div>

    <div class="relative flex-1 min-w-0 border border-border rounded-sm bg-background" style="padding: 1.5rem 1.5rem 3rem 3rem; height: min(400px, 56vh); contain: layout;">
      <div class="tech-grid absolute inset-0 pointer-events-none"></div>
      <!-- Y-axis labels: event count -->
      <div class="absolute left-1 top-6 bottom-10 w-10 flex flex-col justify-between text-[1rem] font-mono text-muted-foreground">
        {#each yLabels as { label }}
          <div class="text-right pr-1">{label}</div>
        {/each}
      </div>

      <div class="absolute left-12 right-4 top-6 bottom-10 border-l border-b border-border/50 overflow-visible">
        <!-- Grid -->
        {#each yLabels as { y }}
          <div class="absolute left-0 right-0 border-t border-border/20 pointer-events-none" style="top: {y}%"></div>
        {/each}
        {#each dateLabels as { x }}
          <div class="absolute top-0 bottom-0 border-l border-border/20 pointer-events-none" style="left: {x}%"></div>
        {/each}

        <!-- Stacked bars: one per bucket, one segment per goal present in that bucket -->
        {#each bars as bar (bar.t)}
          {@const leftPct = ((bar.t - domain.xMin) / (domain.xMax - domain.xMin)) * 100}
          {#if bar.total > 0}
            <div class="absolute bottom-0 flex flex-col-reverse" style="left: {leftPct}%; width: {barWidthPct}%; height: 100%;">
              {#each bar.segments as seg (seg.goal)}
                <button type="button"
                  class="w-full cursor-pointer border-0 p-0 transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  style="height: {(seg.count / maxTotal) * 100}%; background: {colorFor(seg.goal)}; min-height: 2px;"
                  onmouseenter={(e) => handleEnter(bar, seg, e)}
                  onmouseleave={() => hovered = null}
                  onfocus={(e) => handleEnter(bar, seg, e as unknown as MouseEvent)}
                  onblur={() => hovered = null}
                  aria-label="{seg.goal}: {seg.count} event{seg.count === 1 ? '' : 's'}, {fmtRange(bar.t)}">
                </button>
              {/each}
            </div>
          {/if}
        {/each}
      </div>

      <!-- X-axis labels: date -->
      <div class="absolute left-12 right-4 bottom-2 flex justify-between text-[1rem] font-mono text-muted-foreground">
        {#each dateLabels as { label }}
          <div class="text-center">{label}</div>
        {/each}
      </div>
    </div>

    <!-- Hover/focus popup -->
    {#if hovered}
      <div use:portal class="fixed z-50 w-[min(100vw-1.5rem,20rem)] rounded-sm border border-border bg-background p-3 space-y-1.5"
        style="left: {popupPosition.left}; top: {popupPosition.top}; transform: {popupPosition.transform};">
        <h4 class="text-[1rem] font-medium leading-snug break-words" style="color: {colorFor(hovered.segment.goal)};">{hovered.segment.goal}</h4>
        <p class="text-[1rem] text-muted-foreground font-mono">{hovered.segment.count} event{hovered.segment.count === 1 ? '' : 's'}</p>
        <p class="text-[1rem] text-muted-foreground font-mono">{fmtRange(hovered.bar.t)}</p>
      </div>
    {/if}
  </div>
{/if}

<style>
  .legend-chip {
    display: flex;
    width: 100%;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    border: 1px solid var(--chip-accent, color-mix(in oklch, var(--muted-foreground) 20%, transparent));
    border-radius: 4px;
    font-size: 1rem;
    cursor: pointer;
    transition: opacity 0.2s, filter 0.2s, border-color 0.2s;
    user-select: none;
    background: transparent;
    color: inherit;
    text-align: left;
  }

  .legend-chip:hover {
    background: color-mix(in oklch, var(--chip-accent, var(--muted-foreground)) 6%, transparent);
  }

  .legend-label {
    font-weight: 500;
    letter-spacing: 0.02em;
    min-width: 0;
  }

  .legend-dimmed {
    opacity: 0.35;
    filter: saturate(0.2);
    border-color: color-mix(in oklch, var(--muted-foreground) 15%, transparent);
  }

  .legend-action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 1rem;
    color: var(--muted-foreground);
    cursor: pointer;
    background: transparent;
    border: none;
    padding: 2px 6px;
    border-radius: 3px;
    transition: color 0.15s, background 0.15s;
  }

  .legend-action:hover {
    color: var(--foreground);
    background: color-mix(in oklch, var(--muted-foreground) 8%, transparent);
  }
</style>
