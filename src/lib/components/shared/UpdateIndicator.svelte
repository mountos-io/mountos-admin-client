<script lang="ts">
  // Marks a running version as behind the latest published one. Renders NOTHING when the
  // release index is unavailable, disabled, or has no entry for this unit: an absent
  // indicator must never be read as "up to date".
  import { Popover, PopoverTrigger, PopoverContent } from '$lib/components/ui/popover'
  import { Badge } from '$lib/components/ui/badge'
  import ArrowUpCircle from '@lucide/svelte/icons/arrow-up-circle'
  import { cn } from '$lib/utils'
  import { severityClass, severityLabel, type UpdateStatus } from '$lib/core/stores/releases.svelte'

  interface Props {
    status: UpdateStatus | null
    /** The version actually running, shown alongside the available one. */
    running: string
    class?: string
  }

  let { status, running, class: className = '' }: Props = $props()

  let open = $state(false)
</script>

{#if status?.behind}
  <Popover bind:open>
    <PopoverTrigger>
      {#snippet child({ props })}
        <button
          {...props}
          type="button"
          onmouseenter={() => (open = true)}
          onmouseleave={() => (open = false)}
          class={cn('relative z-10 inline-flex items-center', severityClass(status.severity), className)}
          aria-label={`${severityLabel(status.severity)}: ${running} to ${status.latest}`}
        >
          <ArrowUpCircle class="h-3.5 w-3.5" />
        </button>
      {/snippet}
    </PopoverTrigger>
    <PopoverContent class="w-80 text-sm" side="top" align="start">
      <div class="space-y-2">
        <div class="flex items-baseline justify-between gap-2">
          <span class={cn('font-medium', severityClass(status.severity))}>{severityLabel(status.severity)}</span>
          <Badge variant="outline" class="font-mono text-xs">{status.unit}</Badge>
        </div>
        <p class="font-mono text-xs text-muted-foreground">
          running {running} &rarr; <span class="text-foreground">{status.latest}</span>
        </p>
        {#if status.summary}
          <p class="text-muted-foreground">{status.summary}</p>
        {/if}
        {#if status.actionRequired}
          <p class="rounded bg-muted px-2 py-1 text-xs">{status.actionRequired}</p>
        {/if}
        {#if status.breaking || status.requiresSchema || status.requiresProtocol}
          <ul class="space-y-0.5 text-xs text-muted-foreground">
            {#if status.breaking}<li>Contains breaking changes.</li>{/if}
            {#if status.requiresSchema}<li>Needs DB schema level {status.requiresSchema}.</li>{/if}
            {#if status.requiresProtocol}<li>Speaks wire protocol {status.requiresProtocol}.</li>{/if}
          </ul>
        {/if}
      </div>
    </PopoverContent>
  </Popover>
{/if}
