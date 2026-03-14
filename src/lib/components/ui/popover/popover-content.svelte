<script lang="ts">
  import { Popover as PopoverPrimitive } from "bits-ui";
  import type { Snippet } from "svelte";
  import { cn } from "$lib/utils.js";

  let {
    ref = $bindable(null), class: className, sideOffset = 4, children, ...restProps
  }: PopoverPrimitive.ContentProps & { children?: Snippet } = $props();
</script>

<PopoverPrimitive.Portal>
  <PopoverPrimitive.Content bind:ref data-slot="popover-content"
    {sideOffset}
    class={cn(
      "bg-popover text-popover-foreground z-50 w-72 rounded-md border p-0 shadow-md outline-none",
      "data-[state=open]:animate-in data-[state=closed]:animate-out",
      "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
      "data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2",
      className
    )}
    {...restProps}>
    {@render children?.()}
  </PopoverPrimitive.Content>
</PopoverPrimitive.Portal>
