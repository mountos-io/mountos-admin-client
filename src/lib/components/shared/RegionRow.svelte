<script lang="ts">
  import type { RegionVolumeMetrics } from '$lib/core/api/types'
  import { formatBytes } from '$lib/core/utils/format'
  import { cn } from '$lib/utils.js'
  import QuotaBar from './QuotaBar.svelte'

  let { region, class: className }: {
    region: RegionVolumeMetrics
    class?: string
  } = $props()
</script>

<div class={cn('flex items-center gap-4 py-2 border-b border-border last:border-0', className)}>
  <div class="min-w-0 max-w-[10rem] shrink-0">
    <p class="text-sm font-medium truncate" title={region.regionName}>{region.regionName}</p>
    <p class="text-sm text-muted-foreground">{region.volumeCount} volume{region.volumeCount !== 1 ? 's' : ''}</p>
  </div>
  <div class="flex-1">
    {#if region.totalQuotaLimit > 0}
      <QuotaBar used={region.totalVolumeUsed} limit={region.totalQuotaLimit} />
    {:else}
      <p class="text-sm text-right font-medium">{formatBytes(region.totalVolumeUsed)}</p>
    {/if}
  </div>
</div>
