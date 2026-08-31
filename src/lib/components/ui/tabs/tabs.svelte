<script lang="ts">
  import { Tabs as TabsPrimitive } from "bits-ui";
  import { cn } from "$lib/utils.js";

  let {
    ref = $bindable(null), value = $bindable(undefined), class: className, children, ...restProps
  }: TabsPrimitive.RootProps & { ref?: HTMLDivElement | null } = $props();
</script>

<TabsPrimitive.Root bind:ref bind:value data-slot="tabs"
  class={cn("flex flex-col gap-3", className)}
  {...restProps}>
  {#if children}{@render children()}{/if}
</TabsPrimitive.Root>
