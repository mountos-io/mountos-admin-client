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

<label class={cn("inline-flex items-center gap-2 cursor-pointer select-none", className)}>
  <input bind:this={ref} type="checkbox" data-slot="checkbox"
    class="accent-primary h-4 w-4 rounded border-input cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
    bind:checked {...restProps} />
  {#if label}
    <span class="text-sm">{label}</span>
  {/if}
</label>
