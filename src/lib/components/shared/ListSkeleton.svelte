<script lang="ts">
  import { Skeleton } from '$lib/components/ui/skeleton'

  let {
    rows = 5,
    showMeta = true,
    avatarSize = 'h-6 w-6',
    class: className,
  }: {
    rows?: number
    showMeta?: boolean
    avatarSize?: string
    class?: string
  } = $props()
</script>

<div class="space-y-3 {className ?? ''}" role="status" aria-busy="true" aria-label="Loading">
  {#each { length: rows } as _, i (i)}
    <div class="flex items-start gap-3">
      <Skeleton class="{avatarSize} rounded-full shrink-0" />
      <div class="flex-1 min-w-0 space-y-2">
        <Skeleton class="h-4 w-3/4" />
        {#if showMeta}
          <Skeleton class="h-3 w-1/3" />
        {/if}
      </div>
    </div>
  {/each}
</div>
