<script lang="ts">
  // Compact inline trend line for a per-cell grid (NodeGrid's expanded mode). Same visual
  // recipe as NodeStatsHistoryChart's tiles (thin stroke, faint area fill under the line,
  // currentColor-friendly) scaled down to a sparkline, not a scrubbable chart: no axes, no
  // crosshair, no tooltip of its own: the caller supplies an accessible label via title/
  // ariaLabel since the SVG path carries no text. A caller that forgets ariaLabel gets a
  // decorative, aria-hidden sparkline rather than an svg with an empty accessible name.
  let { values, width = 56, height = 18, color = 'var(--muted-foreground)', ariaLabel = '' }: {
    values: number[]
    width?: number
    height?: number
    color?: string
    ariaLabel?: string
  } = $props()

  const PAD = 1.5

  const path = $derived.by(() => {
    if (values.length === 0) return ''
    const max = Math.max(...values, 0)
    const min = Math.min(...values, 0)
    const span = max - min || 1
    const innerW = width - PAD * 2
    const innerH = height - PAD * 2
    const stepX = values.length > 1 ? innerW / (values.length - 1) : 0
    return values
      .map((v, i) => {
        const x = PAD + i * stepX
        const y = PAD + innerH - ((v - min) / span) * innerH
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
      })
      .join(' ')
  })

  const areaPath = $derived(path ? `${path} L${(width - PAD).toFixed(1)},${(height - PAD).toFixed(1)} L${PAD.toFixed(1)},${(height - PAD).toFixed(1)} Z` : '')
</script>

<svg {width} {height} viewBox="0 0 {width} {height}" class="block shrink-0"
  role={ariaLabel ? 'img' : undefined} aria-label={ariaLabel || undefined} aria-hidden={ariaLabel ? undefined : 'true'}>
  {#if path}
    <path d={areaPath} fill={color} opacity="0.12" />
    <path d={path} fill="none" stroke={color} stroke-width="1.25" stroke-linejoin="round" stroke-linecap="round" />
  {:else}
    <line x1={PAD} y1={height / 2} x2={width - PAD} y2={height / 2} stroke={color} stroke-width="1" stroke-dasharray="2 2" opacity="0.4" />
  {/if}
</svg>
