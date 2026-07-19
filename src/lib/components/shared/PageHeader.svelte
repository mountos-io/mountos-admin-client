<script lang="ts">
  import { Button } from '$lib/components/ui/button'
  import type { Component, Snippet } from 'svelte'

  // `children` renders in the right-hand action cluster, before the primary
  // action button (e.g. a "How it works" trigger next to "Create").
  let { title, action, children }: {
    title: string
    action?: { label: string; href: string; icon?: Component<{ class?: string }> }
    children?: Snippet
  } = $props()
</script>

<div class="flex items-center justify-between gap-3">
  <h1 class="text-2xl font-bold tracking-tight">{title}</h1>
  {#if children || action}
    <div class="flex flex-wrap items-center justify-end gap-2">
      {@render children?.()}
      {#if action}
        <Button href={action.href} variant="primary" size="sm" class="gap-1.5 cyberpunk-skewed-sm">
          {#if action.icon}
            {@const Icon = action.icon}
            <Icon class="h-4 w-4" />
          {/if}
          {action.label}
        </Button>
      {/if}
    </div>
  {/if}
</div>
