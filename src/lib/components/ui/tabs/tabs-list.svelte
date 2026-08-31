<script lang="ts">
  import { Tabs as TabsPrimitive } from "bits-ui";
  import { cn } from "$lib/utils.js";

  let {
    ref = $bindable(null), class: className, children, ...restProps
  }: TabsPrimitive.ListProps & { ref?: HTMLDivElement | null } = $props();
</script>

<TabsPrimitive.List bind:ref data-slot="tabs-list"
  class={cn(
    "bg-muted/50 text-muted-foreground inline-flex items-center justify-center gap-1 rounded-md border border-border/40 p-1 w-fit",
    className
  )}
  {...restProps}>
  {#if children}{@render children()}{/if}
</TabsPrimitive.List>
