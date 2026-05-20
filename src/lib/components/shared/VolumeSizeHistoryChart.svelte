<script lang="ts">
  import type { VolumeSizePoint } from '$lib/core/api/types'
  import { formatBytes } from '$lib/core/utils/format'

  let { points = [] }: { points: VolumeSizePoint[] } = $props()

  type SeriesKey = 'liveVolume' | 'totalVolume' | 'pendingVolume' | 'liveInactiveVolume'
  const seriesDefs: { key: SeriesKey; label: string; color: string }[] = [
    { key: 'totalVolume',        label: 'Total',    color: 'var(--fork-0, oklch(0.65 0.15 45))' },
    { key: 'liveVolume',         label: 'Live',     color: 'var(--fork-1, oklch(0.62 0.16 160))' },
    { key: 'liveInactiveVolume', label: 'Inactive', color: 'var(--fork-2, oklch(0.58 0.16 250))' },
    { key: 'pendingVolume',      label: 'Pending',  color: 'var(--fork-3, oklch(0.62 0.16 330))' },
  ]
  let disabled = $state<Set<SeriesKey>>(new Set())
  function toggle(k: SeriesKey) {
    const next = new Set(disabled)
    if (next.has(k)) next.delete(k); else next.add(k)
    disabled = next
  }

  const W = 800, H = 240, PAD_L = 64, PAD_R = 16, PAD_T = 16, PAD_B = 28
  const innerW = W - PAD_L - PAD_R
  const innerH = H - PAD_T - PAD_B

  const sorted = $derived([...points].sort((a, b) => +new Date(a.bucketEnd) - +new Date(b.bucketEnd)))

  const xExtent = $derived.by(() => {
    if (!sorted.length) return [0, 1]
    return [+new Date(sorted[0].bucketEnd), +new Date(sorted[sorted.length - 1].bucketEnd)]
  })
  const yMax = $derived.by(() => {
    if (!sorted.length) return 1
    let m = 0
    for (const p of sorted) {
      for (const s of seriesDefs) {
        if (disabled.has(s.key)) continue
        if (p[s.key] > m) m = p[s.key]
      }
    }
    return Math.max(m, 1)
  })

  function xScale(t: number) {
    const [a, b] = xExtent
    if (b === a) return PAD_L + innerW / 2
    return PAD_L + ((t - a) / (b - a)) * innerW
  }
  function yScale(v: number) {
    return PAD_T + innerH - (v / yMax) * innerH
  }

  function pathFor(key: SeriesKey): string {
    if (!sorted.length) return ''
    const parts: string[] = []
    for (let i = 0; i < sorted.length; i++) {
      const x = xScale(+new Date(sorted[i].bucketEnd))
      const y = yScale(sorted[i][key])
      parts.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
    }
    return parts.join(' ')
  }

  const xTicks = $derived.by(() => {
    if (!sorted.length) return []
    const [a, b] = xExtent
    const n = Math.min(6, sorted.length)
    if (n === 1) return [{ x: xScale(a), label: fmtDate(a) }]
    return Array.from({ length: n }, (_, i) => {
      const t = a + ((b - a) * i) / (n - 1)
      return { x: xScale(t), label: fmtDate(t) }
    })
  })
  const yTicks = $derived.by(() => {
    const n = 4
    return Array.from({ length: n + 1 }, (_, i) => {
      const v = (yMax * i) / n
      return { y: yScale(v), label: formatBytes(v) }
    })
  })

  function fmtDate(t: number): string {
    const d = new Date(t)
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }

  let hover = $state<{ idx: number; x: number } | null>(null)
  function onMove(e: MouseEvent) {
    if (!sorted.length) return
    const svg = e.currentTarget as SVGSVGElement
    const rect = svg.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * W
    let best = 0, bd = Infinity
    for (let i = 0; i < sorted.length; i++) {
      const sx = xScale(+new Date(sorted[i].bucketEnd))
      const d = Math.abs(sx - px)
      if (d < bd) { bd = d; best = i }
    }
    hover = { idx: best, x: xScale(+new Date(sorted[best].bucketEnd)) }
  }
  function onLeave() { hover = null }
</script>

<div class="space-y-3">
  {#if !points.length}
    <p class="text-sm text-muted-foreground">No data yet. Size samples are recorded in 6-hour windows.</p>
  {:else}
    <div class="relative border border-border rounded-sm overflow-hidden bg-background">
      <div class="tech-grid absolute inset-0 pointer-events-none opacity-20"></div>
      <svg viewBox="0 0 {W} {H}" class="w-full h-auto select-none" onmousemove={onMove} onmouseleave={onLeave} role="img" aria-label="Volume size over time">
        {#each yTicks as t}
          <line x1={PAD_L} y1={t.y} x2={W - PAD_R} y2={t.y} stroke="currentColor" opacity="0.25" stroke-dasharray="2 4" />
          <text x={PAD_L - 6} y={t.y} text-anchor="end" dominant-baseline="central" font-size="7" font-family="monospace" fill="currentColor" opacity="0.6">{t.label}</text>
        {/each}
        {#each xTicks as t}
          <text x={t.x} y={H - 8} text-anchor="middle" font-size="7" font-family="monospace" fill="currentColor" opacity="0.6">{t.label}</text>
        {/each}
        {#each seriesDefs as s}
          {#if !disabled.has(s.key)}
            <path d={pathFor(s.key)} fill="none" stroke={s.color} stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
          {/if}
        {/each}
        {#if hover}
          <line x1={hover.x} y1={PAD_T} x2={hover.x} y2={H - PAD_B} stroke="currentColor" opacity="0.25" stroke-dasharray="3 3" />
          {#each seriesDefs as s}
            {#if !disabled.has(s.key)}
              <circle cx={hover.x} cy={yScale(sorted[hover.idx][s.key])} r="3.5" fill={s.color} stroke="var(--background)" stroke-width="1.5" />
            {/if}
          {/each}
        {/if}
      </svg>
      {#if hover}
        {@const p = sorted[hover.idx]}
        {@const flip = hover.x / W > 0.65}
        <div class="absolute pointer-events-none rounded-sm border border-border bg-popover px-2.5 py-1.5 text-[12px] font-mono space-y-0.5 max-w-[16rem]"
          role="tooltip"
          style={flip
            ? `right: calc(${100 - (hover.x / W) * 100}% + 8px); top: 8px;`
            : `left: calc(${(hover.x / W) * 100}% + 8px); top: 8px;`}>
          <div class="text-muted-foreground">{new Date(p.bucketEnd).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
          {#each seriesDefs as s}
            {#if !disabled.has(s.key)}
              <div class="flex items-center gap-2">
                <span class="inline-block w-2 h-2 rounded-full" style="background: {s.color}"></span>
                <span class="text-muted-foreground">{s.label}</span>
                <span class="ml-auto">{formatBytes(p[s.key])}</span>
              </div>
            {/if}
          {/each}
        </div>
      {/if}
    </div>
    <div class="flex flex-wrap gap-2">
      {#each seriesDefs as s}
        <button type="button" class="series-chip" class:series-dimmed={disabled.has(s.key)}
          style="--chip-accent: {s.color}" onclick={() => toggle(s.key)} aria-pressed={!disabled.has(s.key)}>
          <span class="inline-block w-2.5 h-2.5 rounded-sm" style="background: {s.color}"></span>
          {s.label}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .series-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 10px;
    border: 1px solid var(--chip-accent, currentColor);
    border-radius: 4px;
    font-size: 0.8125rem;
    cursor: pointer;
    background: transparent;
    color: inherit;
    transition: opacity 0.15s;
  }
  .series-dimmed { opacity: 0.35; }
</style>
