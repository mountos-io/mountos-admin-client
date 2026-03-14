<script lang="ts">
  import { Popover as PopoverPrimitive } from "bits-ui";
  import type { Snippet } from "svelte";

  let {
    ref = $bindable(null), children, child, ...restProps
  }: PopoverPrimitive.TriggerProps & { children?: Snippet; child?: Snippet<[any]> } = $props();
</script>

<PopoverPrimitive.Trigger bind:ref data-slot="popover-trigger" {...restProps} {child}>
  {#if children}{@render children()}{/if}
</PopoverPrimitive.Trigger>
