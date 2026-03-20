<script lang="ts">
  import { cn } from '$lib/utils.js'
  import { formatBytes, quotaPercent } from '$lib/core/utils/format'

  let { used, limit, class: className }: {
    used: number
    limit: number
    class?: string
  } = $props()

  const pct = $derived(quotaPercent(used, limit))
</script>

<div class={cn('space-y-2', className)}>
  <div class="flex justify-between text-sm">
    <span class="text-muted-foreground">{formatBytes(used)} used</span>
    <span class="text-muted-foreground">{limit > 0 ? `${formatBytes(limit)} total` : 'Unlimited'}</span>
  </div>
  <div class="h-2 rounded-full bg-muted overflow-hidden" role="progressbar"
    aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}
    aria-label="Quota usage {pct}%">
    <div
      class="h-full rounded-full transition-transform origin-left {pct > 90 ? 'bg-destructive' : pct > 70 ? 'bg-warning' : 'bg-primary'}"
      style="transform: scaleX({pct / 100})"
    ></div>
  </div>
  <p class="text-sm text-muted-foreground text-right">{pct}%</p>
</div>
