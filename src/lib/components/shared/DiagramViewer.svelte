<script lang="ts">
  import { Button } from '$lib/components/ui/button'
  import ZoomIn from '@lucide/svelte/icons/zoom-in'
  import ZoomOut from '@lucide/svelte/icons/zoom-out'
  import Maximize2 from '@lucide/svelte/icons/maximize-2'
  import type { Snippet } from 'svelte'

  // Shared zoom frame for the "How it works" diagrams. Fits to width at 100%,
  // zooms in for detail (scroll to pan), keyboard +/- to zoom and 0 to reset.
  let { ariaLabel, children }: { ariaLabel: string; children: Snippet } = $props()

  // Floor at 1 (fit-to-width). Below fit serves no purpose and would leave
  // whitespace; zoom only goes up, from the fitted default.
  const MIN = 1, MAX = 2.6, STEP = 0.2
  let scale = $state(1)
  const set = (v: number) => { scale = Math.min(MAX, Math.max(MIN, Math.round(v * 100) / 100)) }
</script>

<div class="space-y-2">
  <div class="flex items-center justify-end gap-1">
    <Button variant="ghost" size="icon" type="button"
      class="size-8 min-h-[44px] min-w-[44px] sm:min-h-8 sm:min-w-8"
      aria-label="Zoom out" disabled={scale <= MIN} onclick={() => set(scale - STEP)}>
      <ZoomOut class="size-4" aria-hidden="true" />
    </Button>
    <span class="w-12 text-center text-xs tabular-nums text-muted-foreground" aria-live="polite">{Math.round(scale * 100)}%</span>
    <Button variant="ghost" size="icon" type="button"
      class="size-8 min-h-[44px] min-w-[44px] sm:min-h-8 sm:min-w-8"
      aria-label="Zoom in" disabled={scale >= MAX} onclick={() => set(scale + STEP)}>
      <ZoomIn class="size-4" aria-hidden="true" />
    </Button>
    <Button variant="ghost" size="icon" type="button"
      class="size-8 min-h-[44px] min-w-[44px] sm:min-h-8 sm:min-w-8"
      aria-label="Reset zoom to fit" disabled={scale === 1} onclick={() => scale = 1}>
      <Maximize2 class="size-4" aria-hidden="true" />
    </Button>
  </div>
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div class="overflow-auto rounded-lg border bg-card p-3 sm:p-4"
    style="max-height: min(60vh, 560px)"
    tabindex="0" role="group" aria-label={`${ariaLabel}, scrollable`}>
    <div style="width: {scale * 100}%">
      {@render children()}
    </div>
  </div>
</div>
