<script lang="ts">
  import { Skeleton } from '$lib/components/ui/skeleton'
  let { titleWidth = 'w-40', action = false }: { titleWidth?: string; action?: boolean } = $props()
</script>

<div class="flex items-center justify-between">
  <Skeleton class="h-8 {titleWidth}" />
  {#if action}
    <Skeleton class="h-9 w-32" />
  {/if}
</div>
