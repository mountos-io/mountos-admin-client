<script lang="ts">
  import { cn } from '$lib/utils.js'
  import type { Snippet } from 'svelte'
  let { children, class: className }: { children: Snippet; class?: string } = $props()
</script>

<div class={cn('corner-brackets relative border border-border/30 rounded-sm p-4', className)}>
  <div class="tech-grid absolute inset-0 pointer-events-none" aria-hidden="true"></div>
  <div class="relative flex flex-wrap items-center gap-3">
    {@render children()}
  </div>
</div>
