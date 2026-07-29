<script lang="ts">
  import { Button } from '$lib/components/ui/button'
  import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card'
  import { Skeleton } from '$lib/components/ui/skeleton'
  import { formatBytes } from '$lib/core/utils/format'
  import type { NodeStatsSample } from '$lib/core/api/types'

  let { samples, intervalMs, cpuCores = 0, loading = false, error = '' }: {
    samples: NodeStatsSample[]
    intervalMs: number
    cpuCores?: number
    loading?: boolean
    error?: string
  } = $props()

  const hasDiskUsage = $derived(samples.some(s => (s.diskTotalBytes ?? 0) > 0))
  // DB metrics only arrive from DB-backed services.
  const hasDB = $derived(samples.some(s => (s.dbConnsMax ?? 0) > 0))
  const dbConnsMax = $derived(Math.max(0, ...samples.map(s => s.dbConnsMax ?? 0)))
  const latestSample = $derived(samples.length > 0 ? samples[samples.length - 1] : null)
  const intervalLabel = $derived(intervalMs > 0 ? `${Math.round(intervalMs / 1000)}s` : '')

  function fmtLatencyUs(v: number): string {
    return v >= 1000 ? `${(v / 1000).toFixed(2)}ms` : `${Math.round(v)}µs`
  }

  // Load average normalized to core count reads as % of CPU capacity, which
  // is comparable across nodes; raw load is only a fallback when the core
  // count is not reported.
  const normalizeLoad = $derived(cpuCores > 0)
  function loadVal(v: number): number {
    return normalizeLoad ? (v / cpuCores) * 100 : v
  }

  // Plot-only viewBox; axis labels render as HTML around the SVG so they
  // keep a fixed pixel size at every viewport width.
  const W = 560
  const H = 150
  const PX = 4
  const PY = 5
  const PW = W - PX * 2
  const PH = H - PY * 2

  function bounds(...serieses: number[][]): [number, number] {
    const all = serieses.flat()
    if (all.length === 0) return [0, 1]
    let min = Math.min(...all, 0)
    let max = Math.max(...all, 1)
    if (min === max) max = min + 1
    return [min, max]
  }

  function xFor(i: number, len: number): number {
    const stepX = len > 1 ? PW / (len - 1) : 0
    return PX + i * stepX
  }

  function yFor(v: number, min: number, max: number): number {
    return PY + PH - ((v - min) / (max - min)) * PH
  }

  function pathFor(values: number[], min: number, max: number): string {
    if (values.length === 0) return ''
    return values
      .map((v, i) => `${i === 0 ? 'M' : 'L'}${xFor(i, values.length).toFixed(1)},${yFor(v, min, max).toFixed(1)}`)
      .join(' ')
  }

  // Closes an already-built line path down to the plot base, so the line
  // path string is only constructed once per series.
  function areaFor(line: string, len: number): string {
    if (!line) return ''
    const base = (PY + PH).toFixed(1)
    return `${line} L${xFor(len - 1, len).toFixed(1)},${base} L${PX},${base} Z`
  }

  function xTickIndexes(len: number): number[] {
    if (len === 0) return []
    const count = Math.min(4, len)
    const idxs = Array.from({ length: count }, (_, k) => Math.round((k * (len - 1)) / Math.max(1, count - 1)))
    return [...new Set(idxs)]
  }

  // Per-tile disabled-series sets, keyed by tile id, same show/hide-by-legend
  // interaction as VolumeSizeHistoryChart's series chips.
  let disabledByTile = $state<Map<string, Set<string>>>(new Map())
  function toggleSeries(tile: string, label: string) {
    const next = new Map(disabledByTile)
    const set = new Set(next.get(tile) ?? [])
    if (set.has(label)) set.delete(label); else set.add(label)
    next.set(tile, set)
    disabledByTile = next
  }

  // Whole-tile focus filter: hiding down to one or two metrics fills the
  // grid with just those for easier at-a-glance debugging. Hiding the last
  // remaining tile would leave an empty grid, so that action resets back to
  // "all visible" instead.
  let hiddenTiles = $state<Set<string>>(new Set())
  function toggleTile(tile: string) {
    const next = new Set(hiddenTiles)
    if (next.has(tile)) {
      next.delete(tile)
    } else {
      next.add(tile)
      if (next.size >= tiles.length) next.clear()
    }
    hiddenTiles = next
  }
  function selectAllTiles() {
    hiddenTiles = new Set()
  }
  // Inverts the current focus: whatever's visible hides, whatever's hidden
  // shows. Only reachable once something is already hidden (see disabled
  // state below), so it can never invert down to "everything hidden" and
  // trip the reset-to-all-visible safety net in toggleTile.
  function invertTiles() {
    const next = new Set<string>()
    for (const t of tiles) {
      if (!hiddenTiles.has(t.tile)) next.add(t.tile)
    }
    hiddenTiles = next
  }

  // Portal the summary panel to document.body so `position: fixed` resolves
  // to the viewport (scroll-safe) instead of any positioned ancestor.
  function portal(node: HTMLElement) {
    document.body.appendChild(node)
    return {
      destroy() {
        if (node.parentNode) node.parentNode.removeChild(node)
      },
    }
  }

  // sharedIndex drives the crosshair AND the value tooltip on EVERY tile at
  // once, so hovering any chart lines the same instant up across all metrics.
  let sharedIndex = $state<number | null>(null)
  let touchDismissTimer: ReturnType<typeof setTimeout> | undefined

  function indexFromClientX(e: { clientX: number; currentTarget: EventTarget | null }): number {
    const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * W
    const ratio = Math.min(1, Math.max(0, (px - PX) / PW))
    return Math.round(ratio * (samples.length - 1))
  }
  function onMove(e: MouseEvent) {
    if (samples.length === 0) return
    sharedIndex = indexFromClientX(e)
  }
  function onLeave() {
    sharedIndex = null
  }
  // Touch: same crosshair, kept visible briefly after lift-off so a tap
  // (rather than hover) still gives the reader time to see the values.
  // touch-action: pan-y on the SVG keeps vertical swipes scrolling the page
  // while horizontal drags drive the crosshair (Svelte's delegated touch
  // handlers are passive, so preventDefault is not an option here).
  function onTouch(e: TouchEvent) {
    if (samples.length === 0 || e.touches.length === 0) return
    clearTimeout(touchDismissTimer)
    const touch = e.touches[0]
    sharedIndex = indexFromClientX({ clientX: touch.clientX, currentTarget: e.currentTarget })
  }
  function onTouchEnd() {
    clearTimeout(touchDismissTimer)
    touchDismissTimer = setTimeout(onLeave, 1500)
  }
  // Keyboard: focused charts step the shared crosshair through samples, so
  // the same cross-tile correlation works without a pointer.
  function onKey(e: KeyboardEvent) {
    if (samples.length === 0) return
    if (e.key === 'Escape') {
      onLeave()
      return
    }
    const last = samples.length - 1
    let idx = sharedIndex ?? last
    if (e.key === 'ArrowLeft') idx = Math.max(0, idx - 1)
    else if (e.key === 'ArrowRight') idx = Math.min(last, idx + 1)
    else if (e.key === 'Home') idx = 0
    else if (e.key === 'End') idx = last
    else return
    e.preventDefault()
    sharedIndex = idx
  }

  const timeFmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  function timeLabel(ms: number): string {
    return timeFmt.format(ms)
  }
  // Formatted once per samples arrival; tooltips on every tile re-read these
  // at pointer-move frequency while hovering.
  const timeLabels = $derived(samples.map(s => timeLabel(s.timestampMs)))

  // Screen-reader text alternative: the SVG paths are invisible to AT, so
  // summarise the visible series' range up front (matches VolumeSizeHistoryChart).
  function srSummary(
    title: string,
    series: { label: string; values: number[] }[],
    fmt: (v: number) => string,
  ): string {
    if (samples.length === 0) return `${title}: no data yet.`
    if (series.length === 0) return `${title}: all series hidden.`
    const first = samples[0], last = samples[samples.length - 1]
    const parts = series.map(s => {
      const vals = s.values
      const lo = Math.min(...vals), hi = Math.max(...vals)
      return `${s.label} ranges from ${fmt(lo)} to ${fmt(hi)}, latest ${fmt(vals[vals.length - 1])}`
    })
    return `${title} from ${timeLabel(first.timestampMs)} to ${timeLabel(last.timestampMs)}, ${samples.length} samples. ${parts.join('. ')}. Use the left and right arrow keys to step through samples.`
  }

  type TileSeries = { label: string; color: string; values: number[] }
  type TileDef = {
    tile: string
    title: string
    unit: string
    series: TileSeries[]
    fmt: (v: number) => string
    ceiling?: { label: string; value: number } | null
    extra?: { label: string; value: string }[]
  }

  // Single source of truth for the 8-9 metric tiles: drives both the grid
  // (chartTile calls below) and the all-metrics summary panel, so the two
  // views can never drift out of sync.
  const tiles = $derived<TileDef[]>([
    {
      tile: 'cpu', title: 'CPU Load', unit: normalizeLoad ? `% of ${cpuCores} cores` : 'load avg',
      series: [
        { label: '1m', color: 'var(--fork-0)', values: samples.map(s => loadVal(s.loadAvg1)) },
        { label: '5m', color: 'var(--fork-1)', values: samples.map(s => loadVal(s.loadAvg5)) },
        { label: '15m', color: 'var(--fork-2)', values: samples.map(s => loadVal(s.loadAvg15)) },
      ],
      fmt: normalizeLoad ? (v: number) => `${v.toFixed(1)}%` : (v: number) => v.toFixed(2),
    },
    {
      tile: 'mem', title: 'Memory Usage', unit: '% used',
      series: [{ label: 'used', color: 'var(--fork-0)', values: samples.map(s => s.memUsage * 100) }],
      fmt: (v: number) => `${v.toFixed(1)}%`,
    },
    {
      tile: 'net', title: 'Network Throughput', unit: 'bytes/s',
      series: [
        { label: 'rx', color: 'var(--fork-0)', values: samples.map(s => s.netRxBytesPerSec) },
        { label: 'tx', color: 'var(--fork-1)', values: samples.map(s => s.netTxBytesPerSec) },
      ],
      fmt: (v: number) => `${formatBytes(v)}/s`,
    },
    {
      tile: 'iops', title: 'Disk IOPS', unit: 'ops/s',
      series: [
        { label: 'read', color: 'var(--fork-0)', values: samples.map(s => s.readIops) },
        { label: 'write', color: 'var(--fork-1)', values: samples.map(s => s.writeIops) },
      ],
      fmt: (v: number) => Math.ceil(v).toString(),
    },
    ...(hasDiskUsage ? [{
      tile: 'disk', title: 'Disk Usage', unit: '% used',
      series: [{
        label: 'used', color: 'var(--fork-0)',
        values: samples.map(s => (s.diskTotalBytes ?? 0) > 0 ? (100 * (s.diskUsedBytes ?? 0)) / (s.diskTotalBytes ?? 1) : 0),
      }],
      fmt: (v: number) => `${v.toFixed(1)}%`,
    }] : []),
    {
      tile: 'procs', title: 'Process Count', unit: 'count',
      series: [{ label: 'processes', color: 'var(--fork-0)', values: samples.map(s => s.processCount) }],
      fmt: (v: number) => Math.round(v).toString(),
    },
    ...(hasDB ? [
      {
        tile: 'db-latency', title: 'DB Latency', unit: 'decayed avg',
        series: [
          { label: '1m', color: 'var(--fork-0)', values: samples.map(s => s.dbLatency1mUs ?? 0) },
          { label: '5m', color: 'var(--fork-1)', values: samples.map(s => s.dbLatency5mUs ?? 0) },
          { label: '15m', color: 'var(--fork-2)', values: samples.map(s => s.dbLatency15mUs ?? 0) },
        ],
        fmt: fmtLatencyUs,
      },
      {
        tile: 'db-qps', title: 'DB Throughput', unit: 'queries/s',
        series: [{ label: 'queries', color: 'var(--fork-0)', values: samples.map(s => s.dbQueriesPerSec ?? 0) }],
        fmt: (v: number) => v >= 100 ? Math.round(v).toString() : v.toFixed(1),
      },
      {
        tile: 'db-conns', title: 'DB Connections', unit: 'decayed avg',
        series: [
          { label: '1m', color: 'var(--fork-0)', values: samples.map(s => s.dbConnsInUse1m ?? 0) },
          { label: '5m', color: 'var(--fork-1)', values: samples.map(s => s.dbConnsInUse5m ?? 0) },
          { label: '15m', color: 'var(--fork-2)', values: samples.map(s => s.dbConnsInUse15m ?? 0) },
        ],
        fmt: (v: number) => Math.round(v).toString(),
        ceiling: { label: 'max', value: dbConnsMax },
        extra: [
          { label: 'in use', value: String(latestSample?.dbConnsInUse ?? 0) },
          { label: 'idle', value: String(latestSample?.dbConnsIdle ?? 0) },
          { label: 'free', value: String(latestSample?.dbConnsFree ?? 0) },
        ],
      },
    ] : []),
  ])

  // Clamped shared index for the all-metrics summary panel, mirroring each
  // tile's own validIndex so both stay in lockstep while scrubbing.
  const masterIndex = $derived(sharedIndex !== null && sharedIndex < samples.length ? sharedIndex : null)
</script>

{#snippet chartTile(
  tile: string,
  title: string,
  unit: string,
  series: { label: string; color: string; values: number[] }[],
  fmt: (v: number) => string,
  ceiling: { label: string; value: number } | null = null,
  extra: { label: string; value: string }[] = [],
)}
  {@const disabled = disabledByTile.get(tile) ?? new Set<string>()}
  {@const visible = series.filter(s => !disabled.has(s.label))}
  {@const len = samples.length}
  <!-- The ceiling joins the bounds so a reference line above the data max
       is never clipped off the top of the auto-scaled plot. -->
  {@const [min, max] = bounds(...visible.map(s => s.values), ceiling ? [ceiling.value] : [])}
  {@const validIndex = sharedIndex !== null && sharedIndex < len ? sharedIndex : null}
  {@const crosshairX = validIndex !== null && visible.length > 0 ? xFor(validIndex, len) : null}
  {@const vi = validIndex ?? len - 1}
  <div class="space-y-2">
    <div class="flex items-baseline justify-between gap-3 flex-wrap">
      <span class="text-xs font-mono text-muted-foreground tracking-[0.15em] uppercase">{title} <span class="tracking-normal">({unit})</span></span>
      <span class="flex items-center gap-3 font-mono tabular-nums text-base font-semibold">
        {#each visible as s, si (si)}
          <span class="flex items-center gap-1.5">
            {#if visible.length > 1}
              <span class="inline-block h-2 w-2 rounded-sm shrink-0" style="background: {s.color}"></span>
            {/if}
            {fmt(s.values[s.values.length - 1] ?? 0)}
          </span>
        {/each}
        {#if extra.length > 0}
          <!-- Current point-in-time stats, not plotted as lines (e.g. DB
               connections' idle/free alongside the decayed in-use series). -->
          <span class="flex items-center gap-2.5 text-xs font-normal text-muted-foreground border-l border-border pl-3">
            {#each extra as e, ei (ei)}
              <span>{e.label} <span class="text-foreground font-semibold">{e.value}</span></span>
            {/each}
          </span>
        {/if}
      </span>
    </div>
    <div class="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-2 gap-y-1">
      <!-- y axis: tick values centered on their gridlines; column widened
           to fit the 16px floor (e.g. "123.4 MB/s") without clipping. -->
      <div class="relative text-right text-xs leading-none font-mono tabular-nums text-muted-foreground">
        {#if visible.length > 0}
          <span class="absolute inset-x-0 -translate-y-1/2" style="top: {(PY / H) * 100}%">{fmt(max)}</span>
          <span class="absolute inset-x-0 top-1/2 -translate-y-1/2">{fmt((min + max) / 2)}</span>
          <span class="absolute inset-x-0 -translate-y-1/2" style="top: {((PY + PH) / H) * 100}%">{fmt(min)}</span>
        {/if}
      </div>
      <div class="relative border border-border rounded-sm overflow-hidden bg-background">
        <!-- The crosshair scrubs a sample index, so the chart is a slider to
             AT: arrowing announces the sample's time and values via valuetext. -->
        <svg viewBox="0 0 {W} {H}" tabindex="0" role="slider" aria-label={srSummary(title, visible, fmt)}
          aria-orientation="horizontal" aria-valuemin={0} aria-valuemax={len - 1} aria-valuenow={vi}
          aria-valuetext={visible.length > 0
            ? `${timeLabels[vi]}: ${visible.map(s => `${s.label} ${fmt(s.values[vi])}`).join(', ')}`
            : 'all series hidden'}
          class="w-full h-auto block select-none [touch-action:pan-y] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onmousemove={onMove} onmouseleave={onLeave} onkeydown={onKey} onblur={onLeave}
          ontouchstart={onTouch} ontouchmove={onTouch} ontouchend={onTouchEnd}>
          {#each [PY, H / 2, PY + PH] as gy (gy)}
            <line x1="0" y1={gy} x2={W} y2={gy} stroke="currentColor" opacity="0.08" />
          {/each}
          {#each xTickIndexes(len) as ti (ti)}
            <line x1={xFor(ti, len)} y1={PY + PH} x2={xFor(ti, len)} y2={H} stroke="currentColor" opacity="0.25" />
          {/each}
          {#if ceiling && visible.length > 0}
            {@const cy = yFor(ceiling.value, min, max)}
            <!-- Label sits below the line when the ceiling defines the plot
                 top (its usual position, since it joins bounds()); above-line
                 placement there would clip out of the viewBox. -->
            {@const labelY = cy < PY + 14 ? cy + 12 : cy - 4}
            <line x1={PX} y1={cy} x2={PX + PW} y2={cy} stroke="currentColor" opacity="0.45" stroke-dasharray="6 4" />
            <text x={PX + PW - 4} y={labelY} text-anchor="end" fill="currentColor" opacity="0.6" font-size="13" font-family="var(--font-mono, monospace)">{ceiling.label} {fmt(ceiling.value)}</text>
          {/if}
          {#each visible as s, si (si)}
            {@const d = pathFor(s.values, min, max)}
            <path d={areaFor(d, s.values.length)} fill={s.color} opacity="0.06" />
            <path {d} fill="none" stroke={s.color} stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
          {/each}
          {#if validIndex !== null && crosshairX !== null}
            <line x1={crosshairX} y1={PY} x2={crosshairX} y2={PY + PH} stroke="currentColor" opacity="0.3" stroke-dasharray="3 3" />
            {#each visible as s, si (si)}
              <circle cx={crosshairX} cy={yFor(s.values[validIndex], min, max)} r="3" fill={s.color} stroke="var(--background)" stroke-width="1.5" />
            {/each}
          {/if}
        </svg>
        {#if visible.length === 0}
          <div class="absolute inset-0 flex items-center justify-center text-xs font-mono text-muted-foreground">all series hidden</div>
        {/if}
        {#if validIndex !== null && crosshairX !== null}
          <!-- Pinned to the corner away from the crosshair: never clipped by
               overflow-hidden and keeps the hovered region visible on every tile. -->
          {@const pinLeft = crosshairX / W > 0.55}
          <div class="absolute top-2 {pinLeft ? 'left-2' : 'right-2'} pointer-events-none z-10 rounded-sm border border-border bg-popover px-2.5 py-1.5 text-xs font-mono space-y-0.5 whitespace-nowrap shadow-sm"
            role="tooltip">
            <div class="text-muted-foreground">{timeLabels[validIndex]}</div>
            {#each visible as s, si (si)}
              <div class="flex items-center gap-2">
                <span class="h-1.5 w-1.5 rounded-full shrink-0" style="background: {s.color}"></span>
                <span class="text-muted-foreground">{s.label}</span>
                <span class="ml-auto pl-3 tabular-nums">{fmt(s.values[validIndex])}</span>
              </div>
            {/each}
          </div>
        {/if}
      </div>
      <!-- x axis: time ticks + name, aligned under the plot -->
      <div></div>
      <div class="space-y-1">
        <div class="relative h-5 text-xs leading-none font-mono tabular-nums text-muted-foreground">
          {#each xTickIndexes(len) as ti (ti)}
            {@const pct = (xFor(ti, len) / W) * 100}
            <span class="absolute top-0 whitespace-nowrap {ti === 0 ? '' : ti === len - 1 ? '-translate-x-full' : '-translate-x-1/2'}"
              style="left: {pct}%">{timeLabels[ti]}</span>
          {/each}
        </div>
        <div class="text-center text-xs font-mono uppercase tracking-[0.12em] text-muted-foreground">time</div>
      </div>
    </div>
    {#if series.length > 1}
      <div class="flex flex-wrap gap-2">
        {#each series as s, si (si)}
          <button type="button" class="series-chip min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0" class:series-dimmed={disabled.has(s.label)}
            style="--chip-accent: {s.color}" onclick={() => toggleSeries(tile, s.label)} aria-pressed={!disabled.has(s.label)}>
            <span class="inline-block h-2 w-2 rounded-sm" style="background: {s.color}"></span>
            {s.label}
          </button>
        {/each}
      </div>
    {/if}
  </div>
{/snippet}

{#snippet chartTileSkeleton()}
  <div class="space-y-2">
    <div class="flex items-baseline justify-between">
      <Skeleton class="h-3.5 w-28" />
      <Skeleton class="h-4 w-20" />
    </div>
    <Skeleton class="w-full" style="aspect-ratio: {W} / {H}" />
  </div>
{/snippet}

<Card>
  <CardHeader>
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <CardTitle class="text-base">Resource History</CardTitle>
      {#if intervalLabel}
        <span class="text-xs font-mono text-muted-foreground">every {intervalLabel} &middot; last {samples.length} samples &middot; hover, touch, or arrow keys correlate all charts</span>
      {/if}
    </div>
    {#if samples.length > 0 && tiles.length > 1}
      <!-- Focus filter: hides whole tiles (not series within one) so a
           reader debugging 2-3 metrics can shrink the grid down to just
           those; deselecting the last one resets back to all-visible.
           Each chip borders in its own tile accent (cycling the app's
           fork-N palette by tile index, decoupled from the per-series
           colors inside each tile) instead of a filled background. A
           hairline divider separates this from the title above rather
           than a second bordered panel: this already sits inside Card,
           and cards don't nest in this design system. -->
      <div class="mt-2 pt-2.5 border-t border-border flex flex-wrap items-center gap-2">
        <div class="flex flex-wrap items-center gap-2" role="group" aria-label="Visible metrics">
          {#each tiles as t, i (t.tile)}
            {@const active = !hiddenTiles.has(t.tile)}
            <button type="button" class="series-chip min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0" class:series-dimmed={!active}
              style="--chip-accent: var(--fork-{i % 8})"
              onclick={() => toggleTile(t.tile)} aria-pressed={active}>
              {t.title}
            </button>
          {/each}
        </div>
        <div class="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="sm" disabled={hiddenTiles.size === 0} onclick={invertTiles}>Toggle</Button>
          <Button variant="ghost" size="sm" disabled={hiddenTiles.size === 0} onclick={selectAllTiles}>Reset</Button>
        </div>
      </div>
    {/if}
  </CardHeader>
  <CardContent class="pt-0">
    {#if error}
      <p class="text-sm text-destructive">{error}</p>
    {:else if loading && samples.length === 0}
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-6" role="status" aria-busy="true" aria-label="Loading resource history">
        {#each { length: 4 } as _, i (i)}
          {@render chartTileSkeleton()}
        {/each}
      </div>
    {:else if samples.length === 0}
      <p class="text-sm text-muted-foreground">No history yet. Check back in a few sample intervals.</p>
    {:else}
      {@const visibleTiles = tiles.filter(t => !hiddenTiles.has(t.tile))}
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-6">
        {#each visibleTiles as t (t.tile)}
          {@render chartTile(t.tile, t.title, t.unit, t.series, t.fmt, t.ceiling ?? null, t.extra ?? [])}
        {/each}
      </div>
      {#if masterIndex !== null}
        <!-- All-metrics summary: consolidates every tile's value at the
             scrubbed instant into one panel instead of the 9 scattered
             per-tile boxes, so the full reading is visible at a glance.
             Always lists every tile regardless of the focus filter above —
             hiding a tile from the grid declutters the view, it doesn't
             mean the reader wants that metric missing from the full
             reading. Fixed to the viewport (not the grid) and portaled to
             body so it stays put while the page scrolls; desktop-only
             (matches the lg: two-column grid), clearing the sticky app
             header's 3.5rem height. Per-tile boxes still cover the
             single-column layout. -->
        <div use:portal role="tooltip"
          class="hidden lg:block fixed top-16 right-4 z-50 w-96 max-w-[85vw] pointer-events-none rounded-sm border border-border bg-popover shadow-sm font-mono text-xs">
          <div class="px-3 py-2 border-b border-border text-muted-foreground">{timeLabels[masterIndex]}</div>
          <div class="max-h-[calc(100vh-6rem)] overflow-y-auto px-3 py-2 space-y-2.5">
            {#each tiles as t (t.tile)}
              {@const disabled = disabledByTile.get(t.tile) ?? new Set<string>()}
              {@const visible = t.series.filter(s => !disabled.has(s.label))}
              {#if visible.length > 0}
                <div>
                  <div class="text-muted-foreground tracking-[0.1em] uppercase text-xs">{t.title}</div>
                  <div class="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                    {#each visible as s (s.label)}
                      <span class="flex items-center gap-1.5">
                        <span class="h-1.5 w-1.5 rounded-full shrink-0" style="background: {s.color}"></span>
                        {#if visible.length > 1}<span class="text-muted-foreground">{s.label}</span>{/if}
                        <span class="tabular-nums">{t.fmt(s.values[masterIndex])}</span>
                      </span>
                    {/each}
                  </div>
                </div>
              {/if}
            {/each}
          </div>
        </div>
      {/if}
    {/if}
  </CardContent>
</Card>

<style>
  .series-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 10px;
    border: 2px solid var(--chip-accent, currentColor);
    border-radius: 0;
    font-size: 1rem;
    cursor: pointer;
    background: transparent;
    color: inherit;
    transition: opacity 0.15s;
  }
  .series-dimmed { opacity: 0.35; }
</style>
