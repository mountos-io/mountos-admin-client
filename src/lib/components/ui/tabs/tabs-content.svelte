<script lang="ts">
  import { Tabs as TabsPrimitive } from "bits-ui";
  import { cn } from "$lib/utils.js";

  let {
    ref = $bindable(null), class: className, children, ...restProps
  }: TabsPrimitive.ContentProps & { ref?: HTMLDivElement | null } = $props();
</script>

<TabsPrimitive.Content bind:ref data-slot="tabs-content"
  class={cn("outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-sm", className)}
  {...restProps}>
  {#if children}{@render children()}{/if}
</TabsPrimitive.Content>
