<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";
  import { cn, type WithElementRef } from "$lib/utils.js";

  type CardProps = WithElementRef<HTMLAttributes<HTMLDivElement>> & {
    cornerBrackets?: boolean;
    cornerPlus?: boolean;
    fixedBrackets?: boolean;
  };

  let {
    ref = $bindable(null), class: className,
    cornerBrackets = false, cornerPlus = false, fixedBrackets = false,
    children, ...restProps
  }: CardProps = $props();
</script>

<div bind:this={ref} data-slot="card"
  class={cn(
    "bg-card text-card-foreground flex flex-col gap-6 rounded-sm border py-6 shadow-none",
    cornerBrackets && !fixedBrackets && "corner-brackets-lg",
    cornerBrackets && fixedBrackets && "corner-brackets-lg-fixed",
    cornerPlus && "corner-plus",
    className
  )} {...restProps}>
  {@render children?.()}
</div>
