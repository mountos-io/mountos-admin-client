<script lang="ts">
  import { cn } from '$lib/utils.js'
  let { class: className }: { class?: string } = $props()
</script>
<div class={cn('flex items-center justify-center py-8', className)} role="status" aria-label="Loading">
  <div class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" aria-hidden="true"></div>
  <span class="sr-only">Loading...</span>
</div>
