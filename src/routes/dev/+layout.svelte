<script lang="ts">
  import { goto } from '$app/navigation'

  let { children } = $props()

  if (!import.meta.env.DEV) goto('/', { replaceState: true })
</script>

{#if import.meta.env.DEV}
  <div class="min-h-screen bg-background text-foreground">
    {@render children?.()}
  </div>
{/if}
