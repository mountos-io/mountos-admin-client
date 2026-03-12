<script lang="ts">
  let { title, description }: { title: string; description?: string } = $props()
</script>
<div class="flex flex-col items-center justify-center py-12 text-center">
  <h3 class="text-lg font-medium text-muted-foreground">{title}</h3>
  {#if description}
    <p class="mt-1 text-sm text-muted-foreground/70">{description}</p>
  {/if}
</div>
