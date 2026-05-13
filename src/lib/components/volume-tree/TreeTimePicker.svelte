<script lang="ts">
  import { onMount } from 'svelte'
  import type { Fork, Volume } from '$lib/core/api/types'
  import { Input } from '$lib/components/ui/input'
  import { Button } from '$lib/components/ui/button'
  import {
    forkAsOfMin, forkAsOfMax, toDatetimeTz, parseDatetimeTz, gcFloorMs, forkAnchorFloorMs,
  } from '$lib/core/utils/forkRetention'
  import { tz } from '$lib/core/stores/tz.svelte'
  import { formatTzShort } from '$lib/core/utils/format'
  import { showWarningToast } from '$lib/core/utils/toast'

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

  // Picker shows wall-clock in `tz.value`; the value rendered in the input
  // changes immediately when the operator switches timezone.
  let value = $state('')

  // Wall-clock tick: `forkAsOfMax` and the preset enabled-state depend on
  // Date.now(); without this, an operator holding the picker open across a
  // minute boundary sees a max-bound and preset disabled-states that lag
  // reality. Aligning to the next minute boundary keeps every consumer in
  // sync with what the server will accept at request time.
  let nowTick = $state(Date.now())
  onMount(() => {
    // Close the drift between $state instantiation and post-mount: between
    // those two, up to a full minute can pass (HMR warm-up, slow hydrate),
    // leaving maxBound a minute behind reality on first render.
    nowTick = Date.now()
    const tickToNextMinute = () => {
      nowTick = Date.now()
      const msToNext = 60_000 - (Date.now() % 60_000) + 50
      timeout = setTimeout(tickToNextMinute, msToNext)
    }
    let timeout = setTimeout(tickToNextMinute, 60_000 - (Date.now() % 60_000) + 50)
    return () => clearTimeout(timeout)
  })

  const minBound = $derived(forkAsOfMin(volume, forks, forkName, tz.value))
  const maxBound = $derived.by(() => {
    // `void nowTick` is a deliberate dependency marker — Svelte 5 tracks
    // every $state read inside $derived.by, including those discarded by
    // the void operator. Re-derives on minute tick.
    void nowTick
    return forkAsOfMax(tz.value)
  })

  // Floor of valid range (ms) — for clamping preset selections so we never
  // fall outside the retention window.
  const minMs = $derived(volume ? Math.max(gcFloorMs(volume, forks), forkAnchorFloorMs(forks, forkName)) : 0)
  const maxMs = $derived(Math.floor(nowTick / 60_000) * 60_000)

  $effect(() => {
    if (asOf == null) value = ''
    else value = toDatetimeTz(new Date(asOf), tz.value)
  })

  function setLive() { onchange(null) }
  function setAtTime() {
    const seed = value || maxBound
    value = seed
    const parsed = parseDatetimeTz(seed, tz.value)
    if (Number.isFinite(parsed)) onchange(parsed)
    else warnInvalidWallClock()
  }
  function apply(v: string) {
    if (!v) { value = v; return }
    const parsed = parseDatetimeTz(v, tz.value)
    if (Number.isFinite(parsed)) {
      value = v
      onchange(parsed)
    } else {
      warnInvalidWallClock()
      // Revert input to the last valid asOf so the picker doesn't pretend it
      // accepted a non-existent wall-clock.
      if (asOf != null) value = toDatetimeTz(new Date(asOf), tz.value)
    }
  }
  function warnInvalidWallClock() {
    showWarningToast(
      `That wall-clock time does not exist in ${tz.value} (DST spring-forward gap). Pick the adjacent minute.`
    )
  }
  function applyOffset(offsetMs: number) {
    const target = Math.floor((nowTick - offsetMs) / 60_000) * 60_000
    const clamped = Math.min(Math.max(target, minMs), maxMs)
    onchange(clamped)
  }

  const isLive = $derived(asOf == null)

  // Compact echo: full tz-stamped wall clock so the operator never has to
  // mentally translate the input. Always shows even when the input mirrors
  // the same zone — keeps the affordance consistent across zones.
  const tzEcho = $derived(asOf == null ? '' : formatTzShort(asOf / 1000, tz.value))

  // Quick presets (most-recent first). Labelled with a leading "-" so the
  // chip reads "now minus N". Disabled when they would fall outside the
  // volume's retention window — surfaces the bound without a 4xx round-trip.
  const PRESETS: { label: string; offsetMs: number }[] = [
    { label: '-5m', offsetMs: 5  * 60_000 },
    { label: '-1h', offsetMs: 60 * 60_000 },
    { label: '-6h', offsetMs: 6  * 3600_000 },
    { label: '-1d', offsetMs: 24 * 3600_000 },
    { label: '-7d', offsetMs: 7  * 86400_000 },
  ]
  function presetDisabled(offsetMs: number): boolean {
    return nowTick - offsetMs < minMs
  }
  function presetActive(offsetMs: number): boolean {
    if (asOf == null) return false
    const target = Math.floor((nowTick - offsetMs) / 60_000) * 60_000
    return Math.abs(asOf - target) < 60_000
  }
</script>

<div class="flex flex-col items-end gap-1" role="group" aria-label="View mode">
  <div class="flex items-center gap-2 flex-wrap justify-end">
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
      <Input
        type="datetime-local"
        class="h-9 min-h-[44px] sm:min-h-9 w-fit font-mono text-sm [color-scheme:light] dark:[color-scheme:dark]"
        {value}
        min={minBound}
        max={maxBound}
        onchange={(e) => apply((e.currentTarget as HTMLInputElement).value)}
        title={`Snapshot of the selected fork at this wall-clock time, read in ${tz.value}. Reachable back to (now − retention).`}
        aria-label="As-of timestamp" />
    {/if}
  </div>

  <!-- Quick presets: visible whether you're in Live or At-time so an operator
       can jump straight into the snapshot view with one click. -->
  <div class="flex items-center gap-1 flex-wrap justify-end" role="group" aria-label="Quick presets — offsets from now">
    {#each PRESETS as p (p.label)}
      {@const disabled = presetDisabled(p.offsetMs)}
      {@const active = presetActive(p.offsetMs)}
      <button type="button"
        onclick={() => applyOffset(p.offsetMs)}
        {disabled}
        aria-pressed={active}
        title={disabled ? `${p.label} from now: outside retention window` : `Snapshot at ${p.label} from now`}
        class="h-7 px-3 min-h-[44px] sm:min-h-7 min-w-[44px] sm:min-w-0 rounded-sm border text-sm font-mono tabular-nums transition-colors
          {active ? 'border-primary bg-primary/15 text-primary'
          : disabled ? 'border-border/30 text-muted-foreground/40 cursor-not-allowed'
          : 'border-border/40 text-muted-foreground hover:text-foreground hover:border-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'}">
        {p.label}
      </button>
    {/each}
  </div>

  {#if !isLive && tzEcho}
    <span class="text-sm font-mono text-foreground tabular-nums leading-tight">
      = {tzEcho}
    </span>
  {/if}
</div>
