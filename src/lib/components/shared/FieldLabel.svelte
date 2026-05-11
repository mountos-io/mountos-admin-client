<script lang="ts">
  import Label from '$lib/components/ui/label/label.svelte'
  import InfoTip from '$lib/components/shared/InfoTip.svelte'
  import type { Snippet } from 'svelte'

  let {
    for: forId, tooltip, class: className, children,
  }: {
    for?: string
    tooltip?: string
    class?: string
    children: Snippet
  } = $props()
</script>

<Label for={forId} class={className}>
  {#if tooltip}
    <span class="inline-flex items-center gap-1">
      {@render children()}
      <InfoTip text={tooltip} />
    </span>
  {:else}
    {@render children()}
  {/if}
</Label>
