<script lang="ts">
  import type { HTMLSelectAttributes } from "svelte/elements";
  import { cn, type WithElementRef } from "$lib/utils.js";

  type Props = WithElementRef<HTMLSelectAttributes, HTMLSelectElement> & {
    options: { value: string; label: string }[];
    placeholder?: string;
  };

  let {
    ref = $bindable(null), value = $bindable(''),
    options, placeholder, class: className, ...restProps
  }: Props = $props();
</script>

<select bind:this={ref} data-slot="select"
  class={cn(
    "border-input bg-background selection:bg-primary/20 dark:bg-input/20 selection:text-foreground ring-offset-background shadow-none flex h-9 w-full min-w-0 appearance-none rounded-sm border px-3 py-1 text-base outline-none transition-[border-color] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
    "focus-visible:border-foreground/40 focus-visible:ring-0",
    "bg-[length:16px_16px] bg-[right_8px_center] bg-no-repeat",
    "bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxwYXRoIGQ9Im02IDkgNiA2IDYtNiIvPjwvc3ZnPg==')]",
    !value && "text-muted-foreground",
    className
  )}
  bind:value {...restProps}>
  {#if placeholder}
    <option value="" disabled>{placeholder}</option>
  {/if}
  {#each options as opt}
    <option value={opt.value}>{opt.label}</option>
  {/each}
</select>
