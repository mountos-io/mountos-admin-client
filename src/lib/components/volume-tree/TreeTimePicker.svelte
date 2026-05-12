<script lang="ts">
  import type { Fork, Volume } from '$lib/core/api/types'
  import { Input } from '$lib/components/ui/input'
  import { Button } from '$lib/components/ui/button'
  import { forkAsOfMin, forkAsOfMax, toDatetimeUTC, parseDatetimeUTC } from '$lib/core/utils/forkRetention'
  import InfoTip from '$lib/components/shared/InfoTip.svelte'

  let {
    volume,
    forks,
    forkName,
    asOf,
    onchange,
  }: {
    volume: Volume | null
    forks: Fork[]
    forkName: string
    asOf: number | null
    onchange: (asOf: number | null) => void
  } = $props()

  // Picker displays UTC components in a datetime-local input. The browser
  // shows the formatted string as-is (the user reads it as UTC, not local).
  let value = $state('')

  const minBound = $derived(forkAsOfMin(volume, forks, forkName))
  const maxBound = $derived(forkAsOfMax())

  $effect(() => {
    if (asOf == null) value = ''
    else value = toDatetimeUTC(new Date(asOf))
  })

  function setLive() { onchange(null) }
  function setAtTime() {
    const seed = value || maxBound
    value = seed
    const parsed = parseDatetimeUTC(seed)
    if (Number.isFinite(parsed)) onchange(parsed)
  }
  function apply(v: string) {
    value = v
    if (!v) return
    const parsed = parseDatetimeUTC(v)
    if (Number.isFinite(parsed)) onchange(parsed)
  }

  const isLive = $derived(asOf == null)

  // Echo the picker value as an unambiguous UTC date-time so the operator
  // is never confused by the browser rendering the local zone.
  const utcEcho = $derived.by(() => {
    if (asOf == null || !value) return ''
    const d = new Date(asOf)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`
  })

  // Pre-commit hint so operators near the retention edge can validate before
  // typing. Browser min/max enforce the same bounds; this just surfaces them.
  const rangeHint = $derived.by(() => {
    if (!minBound || !maxBound) return ''
    return `${minBound.replace('T', ' ')} → ${maxBound.replace('T', ' ')}`
  })
</script>

<div class="flex items-center gap-2 flex-wrap" role="group" aria-label="View mode">
  <div class="relative border border-border/30 rounded-sm px-2 py-1 w-fit">
    <div class="tech-grid absolute inset-0 pointer-events-none opacity-20"></div>
    <div class="relative flex items-center gap-1">
      <Button variant={isLive ? 'primary' : 'ghost'} size="sm"
        class="h-7 min-h-[44px] sm:min-h-7 px-3 text-xs font-mono justify-center"
        aria-pressed={isLive}
        onclick={setLive}>Live</Button>
      <Button variant={!isLive ? 'primary' : 'ghost'} size="sm"
        class="h-7 min-h-[44px] sm:min-h-7 px-3 text-xs font-mono justify-center"
        aria-pressed={!isLive}
        onclick={setAtTime}>At time</Button>
    </div>
  </div>

  {#if !isLive}
    <div class="flex flex-col gap-0.5">
      <div class="flex items-center gap-1.5">
        <Input
          type="datetime-local"
          class="h-9 min-h-[44px] sm:min-h-9 w-fit font-mono text-xs"
          {value}
          min={minBound}
          max={maxBound}
          onchange={(e) => apply((e.currentTarget as HTMLInputElement).value)}
          aria-label="As-of timestamp (UTC)" />
        <InfoTip text={"Snapshot of the selected fork at this UTC timestamp.\nThe field is read as UTC even though the browser may display your local clock — see the echo below.\nReachable back to (now − retention), extended further if a fork's snapshot pins older data."} />
      </div>
      {#if utcEcho}
        <span class="text-[11px] font-mono text-muted-foreground tabular-nums leading-none" aria-live="polite">
          = {utcEcho}
        </span>
      {:else if rangeHint}
        <span class="text-[11px] font-mono text-muted-foreground/70 tabular-nums leading-none">
          retention: {rangeHint} UTC
        </span>
      {/if}
    </div>
  {/if}
</div>
