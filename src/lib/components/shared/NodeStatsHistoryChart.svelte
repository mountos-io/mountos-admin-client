<script lang="ts">
  import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card'
  import { Skeleton } from '$lib/components/ui/skeleton'
  import { formatBytes } from '$lib/core/utils/format'
  import type { NodeStatsSample } from '$lib/core/api/types'

  let { samples, intervalMs, loading = false, error = '' }: {
    samples: NodeStatsSample[]
    intervalMs: number
    loading?: boolean
    error?: string
  } = $props()

  const hasDiskUsage = $derived(samples.some(s => (s.diskTotalBytes ?? 0) > 0))
  const intervalLabel = $derived(intervalMs > 0 ? `${Math.round(intervalMs / 1000)}s` : '')

  // Matches VolumeSizeHistoryChart's sparkline geometry conventions.
  const W = 280
  const H = 64
  const PAD = 4

  function bounds(...serieses: number[][]): [number, number] {
    const all = serieses.flat()
    if (all.length === 0) return [0, 1]
    let min = Math.min(...all, 0)
    let max = Math.max(...all, 1)
    if (min === max) max = min + 1
    return [min, max]
  }

  function pathFor(values: number[], min: number, max: number): string {
    if (values.length === 0) return ''
    const span = max - min
    const stepX = values.length > 1 ? (W - PAD * 2) / (values.length - 1) : 0
    return values.map((v, i) => {
      const x = PAD + i * stepX
      const y = H - PAD - ((v - min) / span) * (H - PAD * 2)
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    }).join(' ')
  }

  function xFor(i: number, len: number): number {
    const stepX = len > 1 ? (W - PAD * 2) / (len - 1) : 0
    return PAD + i * stepX
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

  // sharedIndex drives the crosshair on EVERY tile at once (so a spike lines
  // up visually across metrics); activeTile gates which tile also shows the
  // detailed value tooltip, so hovering one tile doesn't pop six tooltips.
  let activeTile = $state<string | null>(null)
  let sharedIndex = $state<number | null>(null)
  let touchDismissTimer: ReturnType<typeof setTimeout> | undefined

  function indexFromClientX(e: { clientX: number; currentTarget: EventTarget | null }, len: number): number {
    const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    return Math.round(ratio * (len - 1))
  }
  function onMove(tile: string, e: MouseEvent, len: number) {
    if (len === 0) return
    activeTile = tile
    sharedIndex = indexFromClientX(e, len)
  }
  function onLeave() {
    activeTile = null
    sharedIndex = null
  }
  // Touch: same crosshair, kept visible briefly after lift-off so a tap
  // (rather than hover) still gives the reader time to see the values.
  // preventDefault stops the page from scrolling while dragging across a tile.
  function onTouch(tile: string, e: TouchEvent, len: number) {
    if (len === 0 || e.touches.length === 0) return
    e.preventDefault()
    clearTimeout(touchDismissTimer)
    const touch = e.touches[0]
    activeTile = tile
    sharedIndex = indexFromClientX({ clientX: touch.clientX, currentTarget: e.currentTarget }, len)
  }
  function onTouchEnd() {
    clearTimeout(touchDismissTimer)
    touchDismissTimer = setTimeout(onLeave, 1500)
  }

  function timeLabel(ms: number): string {
    return new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

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
    return `${title} from ${timeLabel(first.timestampMs)} to ${timeLabel(last.timestampMs)}, ${samples.length} samples. ${parts.join('. ')}.`
  }
</script>

{#snippet chartTile(
  tile: string,
  title: string,
  series: { label: string; color: string; values: number[] }[],
  fmt: (v: number) => string,
)}
  {@const disabled = disabledByTile.get(tile) ?? new Set<string>()}
  {@const visible = series.filter(s => !disabled.has(s.label))}
  {@const len = samples.length}
  {@const [min, max] = bounds(...visible.map(s => s.values))}
  {@const latest = visible.map(s => s.values[s.values.length - 1] ?? 0)}
  <div class="space-y-1.5">
    <div class="flex items-baseline justify-between">
      <span class="text-[0.7rem] font-mono text-muted-foreground tracking-wider uppercase">{title}</span>
      <span class="text-[0.7rem] font-mono tabular-nums">{latest.map(fmt).join(' / ')}</span>
    </div>
    <div class="relative border border-border rounded-sm overflow-hidden bg-background">
      <svg viewBox="0 0 {W} {H}" class="w-full h-16 block select-none touch-none" role="img" aria-label={srSummary(title, visible, fmt)}
        onmousemove={(e) => onMove(tile, e, len)} onmouseleave={onLeave}
        ontouchstart={(e) => onTouch(tile, e, len)} ontouchmove={(e) => onTouch(tile, e, len)} ontouchend={onTouchEnd}>
        {#each visible as s, si (si)}
          <path d={pathFor(s.values, min, max)} fill="none" stroke={s.color} stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
        {/each}
        {#if visible.length > 0}
          <text x={PAD} y={PAD + 6} text-anchor="start" font-size="7" font-family="monospace" fill="currentColor" opacity="0.5">{fmt(max)}</text>
          <text x={PAD} y={H - PAD - 1} text-anchor="start" font-size="7" font-family="monospace" fill="currentColor" opacity="0.5">{fmt(min)}</text>
        {/if}
        {#if sharedIndex !== null && len > 0}
          {@const x = xFor(sharedIndex, len)}
          <line x1={x} y1={PAD} x2={x} y2={H - PAD} stroke="currentColor" opacity="0.25" stroke-dasharray="3 3" />
          {#if activeTile === tile}
            {#each visible as s, si (si)}
              {@const span = max - min}
              {@const y = H - PAD - ((s.values[sharedIndex] - min) / span) * (H - PAD * 2)}
              <circle cx={x} cy={y} r="2.5" fill={s.color} stroke="var(--background)" stroke-width="1.5" />
            {/each}
          {/if}
        {/if}
      </svg>
      {#if activeTile === tile && sharedIndex !== null && len > 0}
        {@const sample = samples[sharedIndex]}
        {@const flip = xFor(sharedIndex, len) / W > 0.65}
        <div class="absolute top-1 pointer-events-none rounded-sm border border-border bg-popover px-2 py-1.5 text-[12px] font-mono space-y-0.5 whitespace-nowrap"
          role="tooltip"
          style={flip ? `right: calc(${100 - (xFor(sharedIndex, len) / W) * 100}% + 6px);` : `left: calc(${(xFor(sharedIndex, len) / W) * 100}% + 6px);`}>
          <div class="text-muted-foreground">{timeLabel(sample.timestampMs)}</div>
          {#each visible as s, si (si)}
            <div class="flex items-center gap-1.5">
              <span class="h-1.5 w-1.5 rounded-full" style="background: {s.color}"></span>
              <span class="text-muted-foreground">{s.label}</span>
              <span class="ml-auto">{fmt(s.values[sharedIndex])}</span>
            </div>
          {/each}
        </div>
      {/if}
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
  <div class="space-y-1.5">
    <div class="flex items-baseline justify-between">
      <Skeleton class="h-3 w-24" />
      <Skeleton class="h-3 w-16" />
    </div>
    <Skeleton class="h-16 w-full" />
  </div>
{/snippet}

<Card>
  <CardHeader>
    <div class="flex items-center justify-between">
      <CardTitle class="text-base">Resource History</CardTitle>
      {#if intervalLabel}
        <span class="text-[0.7rem] font-mono text-muted-foreground">every {intervalLabel}, last {samples.length} samples</span>
      {/if}
    </div>
  </CardHeader>
  <CardContent class="pt-0">
    {#if error}
      <p class="text-sm text-destructive">{error}</p>
    {:else if loading && samples.length === 0}
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" role="status" aria-busy="true" aria-label="Loading resource history">
        {#each { length: 3 } as _, i (i)}
          {@render chartTileSkeleton()}
        {/each}
      </div>
    {:else if samples.length === 0}
      <p class="text-sm text-muted-foreground">No history yet. Check back in a few sample intervals.</p>
    {:else}
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {@render chartTile('cpu', 'CPU Load Avg', [
          { label: '1m', color: 'var(--fork-0)', values: samples.map(s => s.loadAvg1) },
          { label: '5m', color: 'var(--fork-1)', values: samples.map(s => s.loadAvg5) },
          { label: '15m', color: 'var(--fork-2)', values: samples.map(s => s.loadAvg15) },
        ], v => v.toFixed(2))}

        {@render chartTile('mem', 'Memory Usage', [
          { label: 'used', color: 'var(--fork-0)', values: samples.map(s => s.memUsage * 100) },
        ], v => `${v.toFixed(1)}%`)}

        {@render chartTile('procs', 'Process Count', [
          { label: 'processes', color: 'var(--fork-0)', values: samples.map(s => s.processCount) },
        ], v => Math.round(v).toString())}

        {@render chartTile('iops', 'Disk IOPS', [
          { label: 'read', color: 'var(--fork-0)', values: samples.map(s => s.readIops) },
          { label: 'write', color: 'var(--fork-1)', values: samples.map(s => s.writeIops) },
        ], v => v.toFixed(1))}

        {@render chartTile('net', 'Network Throughput', [
          { label: 'rx', color: 'var(--fork-0)', values: samples.map(s => s.netRxBytesPerSec) },
          { label: 'tx', color: 'var(--fork-1)', values: samples.map(s => s.netTxBytesPerSec) },
        ], v => `${formatBytes(v)}/s`)}

        {#if hasDiskUsage}
          {@render chartTile('disk', 'Disk Usage', [
            { label: 'used', color: 'var(--fork-0)', values: samples.map(s => (s.diskTotalBytes ?? 0) > 0 ? (100 * (s.diskUsedBytes ?? 0)) / (s.diskTotalBytes ?? 1) : 0) },
          ], v => `${v.toFixed(1)}%`)}
        {/if}
      </div>
    {/if}
  </CardContent>
</Card>

<style>
  .series-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 2px 8px;
    border: 1px solid var(--chip-accent, currentColor);
    border-radius: 4px;
    font-size: 0.75rem;
    cursor: pointer;
    background: transparent;
    color: inherit;
    transition: opacity 0.15s;
  }
  .series-dimmed { opacity: 0.35; }
</style>
