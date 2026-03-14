<script lang="ts">
  import type { HTMLInputAttributes } from "svelte/elements";
  import { cn, type WithElementRef } from "$lib/utils.js";

  type Props = WithElementRef<Omit<HTMLInputAttributes, "type">, HTMLInputElement> & {
    checked?: boolean;
    label?: string;
  };

  let {
    ref = $bindable(null), checked = $bindable(false),
    label, disabled, class: className, ...restProps
  }: Props = $props();
</script>

<label class={cn(
  "inline-flex items-center gap-2.5 select-none group",
  disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
  className
)}>
  <span class={cn(
    "relative inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[2px] border border-input bg-transparent transition-[border-color,background-color]",
    !disabled && "group-hover:border-foreground/40",
    "has-[:focus-visible]:border-foreground/40",
    checked && "border-primary bg-primary/10",
  )}>
    <input bind:this={ref} type="checkbox" data-slot="checkbox"
      class="absolute inset-0 h-full w-full opacity-0"
      class:cursor-pointer={!disabled}
      class:cursor-not-allowed={disabled}
      {disabled} bind:checked {...restProps} />
    {#if checked}
      <svg aria-hidden="true" class="h-3 w-3 text-primary pointer-events-none" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M2.5 6L5 8.5L9.5 3.5" />
      </svg>
    {/if}
  </span>
  {#if label}
    <span class="text-sm">{label}</span>
  {/if}
</label>
