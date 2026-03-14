<script lang="ts">
  import type { HTMLInputAttributes } from "svelte/elements";
  import { cn, type WithElementRef } from "$lib/utils.js";

  type Props = WithElementRef<Omit<HTMLInputAttributes, "type">> & {
    checked?: boolean;
    label?: string;
  };

  let {
    ref = $bindable(null), checked = $bindable(false),
    label, class: className, ...restProps
  }: Props = $props();
</script>

<label class={cn("inline-flex items-center gap-2.5 cursor-pointer select-none group", className)}>
  <span class={cn(
    "relative inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[2px] border border-input bg-transparent transition-[border-color,background-color]",
    "group-hover:border-foreground/40",
    checked && "border-primary bg-primary/10",
  )}>
    <input bind:this={ref} type="checkbox" data-slot="checkbox"
      class="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
      bind:checked {...restProps} />
    {#if checked}
      <svg class="h-3 w-3 text-primary pointer-events-none" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M2.5 6L5 8.5L9.5 3.5" />
      </svg>
    {/if}
  </span>
  {#if label}
    <span class="text-sm">{label}</span>
  {/if}
</label>
