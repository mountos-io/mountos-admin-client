<script lang="ts">
  import { toDatetimeUTC } from '$lib/core/utils/forkRetention'
  import GitFork from '@lucide/svelte/icons/git-fork'
  import LockIcon from '@lucide/svelte/icons/lock'
  import Clock from '@lucide/svelte/icons/clock'
  import Zap from '@lucide/svelte/icons/zap'

  let {
    forkName,
    asOf,
    size = 'md',
  }: {
    forkName: string
    asOf: number | null
    size?: 'sm' | 'md'
  } = $props()

  const utcLabel = $derived(asOf == null ? '' : toDatetimeUTC(new Date(asOf)).replace('T', ' '))
</script>

<div
  class="inline-flex items-center gap-2 border rounded-sm
    {asOf == null ? 'border-border/40 bg-background/60' : 'border-warning/40 bg-warning/10'}
    {size === 'sm' ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-1 text-xs'}"
  aria-label={asOf == null ? 'Live state of fork' : 'Read-only point-in-time view'}>

  {#if asOf != null}
    <span class="inline-flex items-center gap-1 text-warning uppercase tracking-wider font-semibold">
      <LockIcon class="h-3 w-3" aria-hidden="true" />
      <span>Snapshot</span>
    </span>
    <span aria-hidden="true" class="text-border">·</span>
  {/if}

  <span class="inline-flex items-center gap-1 text-muted-foreground">
    <GitFork class="h-3 w-3" aria-hidden="true" />
    <span class="font-semibold text-foreground">{forkName}</span>
  </span>

  <span aria-hidden="true" class="text-border">·</span>

  <span class="inline-flex items-center gap-1 text-muted-foreground">
    {#if asOf == null}
      <Zap class="h-3 w-3 text-success" aria-hidden="true" />
      <span class="text-foreground">live</span>
    {:else}
      <Clock class="h-3 w-3" aria-hidden="true" />
      <span class="font-mono tabular-nums text-foreground">{utcLabel}</span>
      <span class="text-muted-foreground/70">UTC</span>
    {/if}
  </span>
</div>
