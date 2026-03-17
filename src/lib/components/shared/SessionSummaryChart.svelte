<script lang="ts">
  import type { SessionSummary } from '$lib/core/api/types'
  import { formatClientType } from '$lib/core/utils/format'
  import { Badge } from '$lib/components/ui/badge'
  import LoadingSpinner from './LoadingSpinner.svelte'

  let { summary, loading = false }: {
    summary: SessionSummary[]
    loading?: boolean
  } = $props()

  const grouped = $derived(
    summary.reduce((map, s) => {
      const entry = map.get(s.clientType) ?? { connected: 0, total: 0 }
      entry.total += s.count
      if (s.status === 'connected') entry.connected += s.count
      map.set(s.clientType, entry)
      return map
    }, new Map<string, { connected: number; total: number }>())
  )

  const maxTotal = $derived(
    Math.max(1, ...Array.from(grouped.values()).map(v => v.total))
  )
</script>

{#if loading}
  <div class="flex justify-center py-4">
    <LoadingSpinner />
  </div>
{:else if grouped.size === 0}
  <p class="text-sm text-muted-foreground text-center py-4">No session data</p>
{:else}
  <div class="space-y-3">
    {#each grouped.entries() as [clientType, counts] (clientType)}
      {@const pct = Math.round((counts.total / maxTotal) * 100)}
      <div class="space-y-1">
        <div class="flex items-center justify-between text-sm">
          <span class="font-medium">{formatClientType(clientType)}</span>
          <div class="flex items-center gap-2">
            <Badge variant="success">{counts.connected}</Badge>
            <span class="text-muted-foreground">/ {counts.total}</span>
          </div>
        </div>
        <div class="h-2 rounded-full bg-muted overflow-hidden" role="progressbar"
          aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}
          aria-label="{formatClientType(clientType)} sessions {pct}%">
          <div
            class="h-full rounded-full bg-primary transition-all"
            style="width: {pct}%"
          ></div>
        </div>
      </div>
    {/each}
  </div>
{/if}
