<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";
  import { cn, type WithElementRef } from "$lib/utils.js";

  let {
    ref = $bindable(null), class: className, level = "h2", children, ...restProps
  }: WithElementRef<HTMLAttributes<HTMLHeadingElement>> & { level?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" } = $props();
</script>

<svelte:element this={level} bind:this={ref} data-slot="card-title" class={cn("font-semibold leading-none", className)} {...restProps}>
  {@render children?.()}
</svelte:element>
