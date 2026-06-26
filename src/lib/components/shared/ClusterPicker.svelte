<script lang="ts">
  import type { RegionCluster } from '$lib/core/api/types'
  import * as Dialog from '$lib/components/ui/dialog'
  import { Input } from '$lib/components/ui/input'
  import { Badge } from '$lib/components/ui/badge'
  import Layers from '@lucide/svelte/icons/layers'
  import ChevronDown from '@lucide/svelte/icons/chevron-down'
  import Check from '@lucide/svelte/icons/check'

  type Props = {
    clusters: RegionCluster[]
    value: number | null
    onchange: (v: number | null) => void
    pillLimit?: number
  }

  let { clusters, value, onchange, pillLimit = 5 }: Props = $props()

  let overflowOpen = $state(false)
  let modalQuery = $state('')

  // Modal lists every cluster (not just the overflow pills) so any cluster is
  // reachable regardless of which are pinned as pills.
  const modalClusters = $derived.by(() => {
    const q = modalQuery.trim().toLowerCase()
    return q ? sorted.filter(c => c.name.toLowerCase().includes(q)) : sorted
  })

  $effect(() => { if (!overflowOpen) modalQuery = '' })

  // Active clusters first (default → name), then deactivated (name) at the end.
  const sorted = $derived.by(() => {
    const active = clusters.filter(c => c.isActive)
    const inactive = clusters.filter(c => !c.isActive)
    active.sort((a, b) => {
      if (a.defaultCluster !== b.defaultCluster) return a.defaultCluster ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    inactive.sort((a, b) => a.name.localeCompare(b.name))
    return [...active, ...inactive]
  })

  // Priority pills: default, currently-selected (if not already in), then in sort order up to limit.
  const partitioned = $derived.by(() => {
    if (sorted.length <= pillLimit + 1) return { visible: sorted, overflow: [] as RegionCluster[] }
    const seen = new Set<number>()
    const visible: RegionCluster[] = []
    const def = sorted.find(c => c.defaultCluster)
    if (def) { visible.push(def); seen.add(def.id) }
    if (value != null && !seen.has(value)) {
      const sel = sorted.find(c => c.id === value)
      if (sel) { visible.push(sel); seen.add(sel.id) }
    }
    for (const c of sorted) {
      if (visible.length >= pillLimit) break
      if (!seen.has(c.id)) { visible.push(c); seen.add(c.id) }
    }
    const overflow = sorted.filter(c => !seen.has(c.id))
    return { visible, overflow }
  })

  function select(v: number | null) {
    overflowOpen = false
    onchange(v)
  }

  function pillAria(c: RegionCluster): string {
    const tags: string[] = []
    if (c.defaultCluster) tags.push('default')
    if (!c.isReady && c.isActive) tags.push('preparing')
    if (!c.isActive) tags.push('deactivated')
    return `Filter to cluster ${c.name}${tags.length ? ', ' + tags.join(', ') : ''}`
  }
</script>

{#if clusters.length >= 2}
  <div class="flex flex-wrap items-center gap-1.5" role="group" aria-label="Cluster filter">
    <Layers class="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
    <span class="mr-1 text-[10px] uppercase tracking-wider text-muted-foreground" aria-hidden="true">cluster</span>

    <button
      type="button"
      aria-pressed={value === null}
      aria-label="Show all clusters"
      class="min-h-[44px] sm:min-h-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring {value === null ? 'border-primary bg-primary/15 text-foreground' : 'border-border/60 text-muted-foreground hover:text-foreground hover:border-border'}"
      onclick={() => select(null)}
    >All</button>

    {#each partitioned.visible as c (c.id)}
      {@const unselectable = !c.isReady || !c.isActive}
      <button
        type="button"
        aria-pressed={value === c.id}
        aria-label={pillAria(c)}
        aria-disabled={unselectable}
        title={unselectable ? (c.isActive ? 'Cluster is not ready; no nodes heartbeat here yet' : 'Cluster is deactivated') : undefined}
        disabled={unselectable}
        class="min-h-[44px] sm:min-h-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors inline-flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 {value === c.id ? 'border-primary bg-primary/15 text-foreground' : unselectable ? 'border-border/40 text-muted-foreground/60' : 'border-border/60 text-muted-foreground hover:text-foreground hover:border-border'}"
        onclick={() => select(c.id)}
      >
        <span class="truncate max-w-[160px]">{c.name}</span>
        {#if c.defaultCluster}<span aria-hidden="true" class="rounded-sm bg-muted px-1 text-[11px] uppercase tracking-wider opacity-80">default</span>{/if}
        {#if !c.isReady && c.isActive}<span aria-hidden="true" class="rounded-sm bg-warning/15 px-1 text-[11px] uppercase tracking-wider text-warning">prep</span>{/if}
        {#if !c.isActive}<span aria-hidden="true" class="rounded-sm bg-destructive/10 px-1 text-[11px] uppercase tracking-wider text-destructive">off</span>{/if}
      </button>
    {/each}

    {#if partitioned.overflow.length > 0}
      <button
        type="button"
        class="min-h-[44px] sm:min-h-0 rounded-full border border-dashed border-border/60 px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-border inline-flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Show {partitioned.overflow.length} more clusters"
        aria-haspopup="dialog"
        aria-expanded={overflowOpen}
        onclick={() => overflowOpen = true}
      >
        <span>+{partitioned.overflow.length} more</span>
        <ChevronDown class="h-3 w-3 opacity-60" aria-hidden="true" />
      </button>

      <Dialog.Root bind:open={overflowOpen}>
        <Dialog.Content class="sm:max-w-md">
          <Dialog.Header>
            <Dialog.Title>Select cluster</Dialog.Title>
            <Dialog.Description>Filter to a single cluster, or choose All to see every cluster.</Dialog.Description>
          </Dialog.Header>
          <Input bind:value={modalQuery} placeholder="Search clusters…" aria-label="Search clusters" autocomplete="off" />
          <div class="max-h-[60vh] overflow-y-auto -mx-1 px-1" role="listbox" aria-label="Clusters">
            <button
              type="button"
              role="option"
              aria-selected={value === null}
              class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 min-h-[44px] sm:min-h-0 text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none {value === null ? 'bg-accent/50' : ''}"
              onclick={() => select(null)}
            >
              <Check class="h-3.5 w-3.5 shrink-0 {value === null ? 'opacity-100' : 'opacity-0'}" aria-hidden="true" />
              <span class="flex-1 truncate text-left">All clusters</span>
            </button>
            {#each modalClusters as c (c.id)}
              {@const unselectable = !c.isReady || !c.isActive}
              <button
                type="button"
                role="option"
                aria-selected={value === c.id}
                aria-label={pillAria(c)}
                aria-disabled={unselectable}
                title={unselectable ? (c.isActive ? 'Cluster is not ready; no nodes heartbeat here yet' : 'Cluster is deactivated') : undefined}
                disabled={unselectable}
                class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 min-h-[44px] sm:min-h-0 text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 {value === c.id ? 'bg-accent/50' : ''}"
                onclick={() => select(c.id)}
              >
                <Check class="h-3.5 w-3.5 shrink-0 {value === c.id ? 'opacity-100' : 'opacity-0'}" aria-hidden="true" />
                <span class="flex-1 truncate text-left">{c.name}</span>
                {#if c.defaultCluster}<Badge variant="secondary" class="h-4 text-[11px] uppercase tracking-wider" aria-hidden="true">default</Badge>{/if}
                {#if !c.isReady && c.isActive}<Badge variant="warning" class="h-4 text-[11px] uppercase tracking-wider" aria-hidden="true">prep</Badge>{/if}
                {#if !c.isActive}<Badge variant="destructive" class="h-4 text-[11px] uppercase tracking-wider" aria-hidden="true">off</Badge>{/if}
              </button>
            {:else}
              <p class="px-2 py-6 text-center text-sm text-muted-foreground">No clusters match “{modalQuery}”</p>
            {/each}
          </div>
        </Dialog.Content>
      </Dialog.Root>
    {/if}
  </div>
{/if}
