<script lang="ts">
  import { Button } from '$lib/components/ui/button'
  import type { Component } from 'svelte'

  let { title, action }: {
    title: string
    action?: { label: string; href: string; icon?: Component<{ class?: string }> }
  } = $props()
</script>

<div class="flex items-center justify-between">
  <h1 class="text-2xl font-bold tracking-tight">{title}</h1>
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
