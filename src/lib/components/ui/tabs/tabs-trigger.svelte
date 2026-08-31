<script lang="ts">
  import { Tabs as TabsPrimitive } from "bits-ui";
  import { cn } from "$lib/utils.js";

  let {
    ref = $bindable(null), class: className, children, ...restProps
  }: TabsPrimitive.TriggerProps & { ref?: HTMLButtonElement | null } = $props();
</script>

<TabsPrimitive.Trigger bind:ref data-slot="tabs-trigger"
  class={cn(
    "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-sm px-3 py-1.5",
    "min-h-[44px] sm:min-h-0 text-sm font-medium text-muted-foreground transition-colors",
    "hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
    "disabled:pointer-events-none disabled:opacity-50",
    "data-[state=active]:bg-background data-[state=active]:text-foreground",
    className
  )}
  {...restProps}>
  {#if children}{@render children()}{/if}
</TabsPrimitive.Trigger>
