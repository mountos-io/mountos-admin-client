<script lang="ts">
  import type { SessionSummaryData } from '$lib/core/stores/sessions.svelte'
  import { Badge } from '$lib/components/ui/badge'
  import { formatSessionStatus } from '$lib/core/utils/format'
  import Activity from '@lucide/svelte/icons/activity'
  import MapPin from '@lucide/svelte/icons/map-pin'
  import HardDrive from '@lucide/svelte/icons/hard-drive'
  import Monitor from '@lucide/svelte/icons/monitor'

  let { summary, loading = false }: { summary: SessionSummaryData; loading?: boolean } = $props()

  function statusVariant(s: string) { return formatSessionStatus(s).variant }
</script>

{#if loading && summary.total === 0}
  <span class="text-sm text-muted-foreground" role="status">Loading...</span>
{:else}
  <div class="summary-stats">
    <div class="summary-stat">
      <Activity class="h-6 w-6 text-success" />
      <span class="summary-val">{summary.activeCount}<span class="summary-sub">/{summary.total}</span></span>
      <span class="summary-label">Active</span>
    </div>
    <span class="summary-divider hidden sm:block" aria-hidden="true"></span>
    {#each summary.byStatus as [status, count]}
      <div class="summary-stat">
        <Badge variant={statusVariant(status)}>{status}</Badge>
        <span class="summary-val">{count}</span>
      </div>
    {/each}
    <span class="summary-divider hidden sm:block" aria-hidden="true"></span>
    <div class="summary-stat">
      <MapPin class="h-5 w-5 text-primary" />
      <span class="summary-val">{summary.regionCount}</span>
      <span class="summary-label">Regions</span>
    </div>
    <div class="summary-stat">
      <HardDrive class="h-5 w-5 text-warning" />
      <span class="summary-val">{summary.volumeCount}</span>
      <span class="summary-label">Volumes</span>
    </div>
    <div class="summary-stat">
      <Monitor class="h-5 w-5 text-muted-foreground" />
      <span class="summary-val">{summary.hostCount}</span>
      <span class="summary-label">Hosts</span>
    </div>
  </div>
{/if}

<style>
  .summary-stats { display: flex; align-items: center; gap: 1.25rem; flex-wrap: wrap; }
  .summary-stat { display: flex; align-items: center; gap: 0.5rem; }
  .summary-val { font-size: 2rem; font-weight: 700; line-height: 1; font-variant-numeric: tabular-nums; }
  .summary-sub { font-size: 1rem; font-weight: 400; color: var(--muted-foreground); }
  .summary-label { font-size: 0.875rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted-foreground); }
  .summary-divider { width: 1px; height: 2.5rem; background: var(--border); flex-shrink: 0; }
</style>
