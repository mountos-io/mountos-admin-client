<script lang="ts">
  import * as Dialog from '$lib/components/ui/dialog'
  import { Button } from '$lib/components/ui/button'
  import BlockStorageHaDiagram from '$lib/components/diagrams/BlockStorageHaDiagram.svelte'
  import BookOpen from '@lucide/svelte/icons/book-open'

  // "How it works" explainer for block storage: a client discovers its members
  // via appserv (no DNS) and connects to any node; each member is a blockserv
  // node with its own block volume, active-active across clusters.
  let { class: className = '' }: { class?: string } = $props()
</script>

<Dialog.Root>
  <Dialog.Trigger>
    {#snippet child({ props })}
      <Button {...props} variant="outline" size="sm" type="button"
        class={`gap-1.5 shrink-0 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 ${className}`}>
        <BookOpen class="size-4" aria-hidden="true" /> How it works
      </Button>
    {/snippet}
  </Dialog.Trigger>
  <Dialog.Content class="sm:max-w-5xl w-full">
    <Dialog.Title class="text-base font-semibold">How block storage works</Dialog.Title>
    <Dialog.Description class="text-sm text-muted-foreground">
      A block storage is up to three active-active members, each a blockserv node with its own block volume, for high availability.
    </Dialog.Description>

    <!-- Wide diagram: scroll horizontally on narrow viewports rather than
         shrinking the labels into illegibility. The scroll container is
         keyboard-focusable so it can be panned without a pointer. -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div class="overflow-x-auto rounded-lg border bg-card p-3 sm:p-4"
      tabindex="0" role="group" aria-label="Block storage topology diagram, scrollable">
      <div class="min-w-[640px]">
        <BlockStorageHaDiagram />
      </div>
    </div>

    <ul class="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
      <li><span class="font-medium text-foreground">Member = node + volume.</span> Each member is one blockserv node you run with <code class="font-mono text-xs">BLOCK_VOLUME_ID</code> and <code class="font-mono text-xs">REGION_CLUSTER_ID</code>, with its own block volume, caching object-storage parts on a raw block device.</li>
      <li><span class="font-medium text-foreground">Clients connect via appserv.</span> The client discovers its members at appserv (the discovery endpoint, no DNS), then connects directly to any member node.</li>
      <li><span class="font-medium text-foreground">Active-active across clusters.</span> Members replicate peer-to-peer; place them in different clusters so one cluster failing doesn't take the storage offline. 2 HA members means 3 volumes.</li>
      <li><span class="font-medium text-foreground">Object storage is the source of truth.</span> Every member is backed by the region's object storage behind its cache.</li>
    </ul>
  </Dialog.Content>
</Dialog.Root>
