<script lang="ts" module>
  import { type VariantProps, tv } from "tailwind-variants";

  export const badgeVariants = tv({
    base: "focus-visible:border-ring focus-visible:ring-ring/50 inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-sm border px-2 py-0.5 text-xs font-medium transition-colors focus-visible:ring-[2px] [&>svg]:pointer-events-none [&>svg]:size-3.5",
    variants: {
      variant: {
        default: "bg-transparent text-foreground border-border [a&]:hover:bg-accent/20",
        primary: "bg-primary/10 text-primary border-primary/30 [a&]:hover:bg-primary/20",
        secondary: "bg-transparent text-muted-foreground border-border [a&]:hover:bg-muted",
        destructive: "bg-transparent text-destructive border-destructive [a&]:hover:bg-destructive/10",
        outline: "text-foreground border-border [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        success: "bg-success/15 text-success border-success/30 [a&]:hover:bg-success/25",
        warning: "bg-warning/15 text-warning border-warning/30 [a&]:hover:bg-warning/25",
      },
    },
    defaultVariants: { variant: "default" },
  });

  export type BadgeVariant = VariantProps<typeof badgeVariants>["variant"];
</script>

<script lang="ts">
  import type { HTMLAnchorAttributes } from "svelte/elements";
  import { cn, type WithElementRef } from "$lib/utils.js";

  let {
    ref = $bindable(null), href, class: className, variant = "default", children, ...restProps
  }: WithElementRef<HTMLAnchorAttributes> & { variant?: BadgeVariant } = $props();
</script>

<svelte:element this={href ? "a" : "span"} bind:this={ref} data-slot="badge" {href}
  class={cn(badgeVariants({ variant }), className)} {...restProps}>
  {@render children?.()}
</svelte:element>
