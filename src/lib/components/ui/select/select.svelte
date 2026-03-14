<script lang="ts">
  import type { HTMLSelectAttributes } from "svelte/elements";
  import { cn, type WithElementRef } from "$lib/utils.js";
  import ChevronDown from '@lucide/svelte/icons/chevron-down'

  type Props = WithElementRef<HTMLSelectAttributes, HTMLSelectElement> & {
    options: { value: string; label: string }[];
    placeholder?: string;
  };

  let {
    ref = $bindable(null), value = $bindable(''),
    options, placeholder, class: className, ...restProps
  }: Props = $props();
</script>

<div class="relative w-full">
  <select bind:this={ref} data-slot="select"
    class={cn(
      "border-input bg-background selection:bg-primary/20 dark:bg-input/20 selection:text-foreground ring-offset-background shadow-none flex h-9 w-full min-w-0 appearance-none rounded-sm border px-3 py-1 pr-8 text-base outline-none transition-[border-color] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
      "focus-visible:border-foreground/40 focus-visible:ring-0",
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
  <ChevronDown class="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50 pointer-events-none" />
</div>
