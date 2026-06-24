<script lang="ts">
  import * as Dialog from '$lib/components/ui/dialog'
  import { Button } from '$lib/components/ui/button'
  import StorageTypeDiagram from '$lib/components/diagrams/StorageTypeDiagram.svelte'
  import BookOpen from '@lucide/svelte/icons/book-open'

  // Explains the object vs block storage-type choice: object reaches S3-compatible
  // object storage directly. Block puts a block-volume facade in front of the object store.
  let { class: className = '' }: { class?: string } = $props()
</script>

<Dialog.Root>
  <Dialog.Trigger>
    {#snippet child({ props })}
      <Button {...props} variant="ghost" size="sm" type="button"
        class={`gap-1.5 shrink-0 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 ${className}`}>
        <BookOpen class="size-4" aria-hidden="true" /> How it works
      </Button>
    {/snippet}
  </Dialog.Trigger>
  <Dialog.Content class="sm:max-w-4xl w-full">
    <Dialog.Title class="text-base font-semibold">Object vs block storage</Dialog.Title>
    <Dialog.Description class="text-sm text-muted-foreground">
      Both use the same S3-compatible object store. Block hides it behind a caching facade.
    </Dialog.Description>

    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div class="overflow-x-auto rounded-lg border bg-card p-3 sm:p-4"
      tabindex="0" role="group" aria-label="Object vs block storage diagram, scrollable">
      <div class="min-w-[640px]">
        <StorageTypeDiagram />
      </div>
    </div>

    <ul class="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
      <li><span class="font-medium text-foreground">Object.</span> The client reads and writes objects directly against an S3-compatible object store (AWS S3, GCS, B2, Azure, MinIO, on-prem).</li>
      <li><span class="font-medium text-foreground">Block.</span> The client does block I/O against a block-volume facade (the blockserv members, active-active) that hides the same object store behind it and caches parts on a raw block device.</li>
    </ul>
  </Dialog.Content>
</Dialog.Root>
