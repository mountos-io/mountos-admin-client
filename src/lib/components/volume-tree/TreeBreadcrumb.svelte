<script lang="ts">
  import ChevronRight from '@lucide/svelte/icons/chevron-right'
  import HomeIcon from '@lucide/svelte/icons/home'

  let { path = '/', onselect }: { path?: string; onselect: (p: string) => void } = $props()

  const segments = $derived.by(() => {
    const parts = path.split('/').filter(Boolean)
    let acc = ''
    return parts.map(name => {
      acc = acc + '/' + name
      return { name, path: acc }
    })
  })
</script>

<nav aria-label="Tree path" class="flex items-center gap-1 text-sm font-mono min-w-0 flex-wrap">
  <button type="button" onclick={() => onselect('/')}
    class="inline-flex items-center justify-center gap-1 h-9 min-h-[44px] sm:min-h-9 px-2 rounded-sm hover:bg-accent text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring transition-colors"
    aria-label="Root">
    <HomeIcon class="h-3.5 w-3.5" aria-hidden="true" />
  </button>
  {#each segments as seg, i (seg.path)}
    <ChevronRight class="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" aria-hidden="true" />
    {#if i === segments.length - 1}
      <span class="px-2 h-9 min-h-[44px] sm:min-h-9 inline-flex items-center text-foreground truncate" aria-current="page">{seg.name}</span>
    {:else}
      <button type="button" onclick={() => onselect(seg.path)}
        class="inline-flex items-center h-9 min-h-[44px] sm:min-h-9 px-2 rounded-sm hover:bg-accent text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring transition-colors truncate">
        {seg.name}
      </button>
    {/if}
  {/each}
</nav>
