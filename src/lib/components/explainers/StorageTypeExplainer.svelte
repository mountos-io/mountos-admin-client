<script lang="ts">
  import DiagramViewer from '$lib/components/shared/DiagramViewer.svelte'
  import StorageTypeDiagram from '$lib/components/diagrams/StorageTypeDiagram.svelte'
</script>

<div class="space-y-4">
  <DiagramViewer ariaLabel="Object vs block storage diagram">
    <StorageTypeDiagram />
  </DiagramViewer>

  <ul class="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
    <li><span class="font-medium text-foreground">Object.</span> The client reads and writes objects directly against an S3-compatible object store (AWS S3, GCS, B2, Azure, MinIO, on-prem).</li>
    <li><span class="font-medium text-foreground">Block.</span> The client does block I/O against a block-volume facade (blockserv copysets) that hides the same object store behind it and caches parts on a raw block device.</li>
  </ul>
</div>
