<script lang="ts">
  import DiagramViewer from '$lib/components/shared/DiagramViewer.svelte'
  import SystemMotion from '$lib/components/diagrams/SystemMotion.svelte'
</script>

<div class="space-y-4">
  <DiagramViewer ariaLabel="Animated mountOS system diagram">
    <SystemMotion />
  </DiagramViewer>

  <ul class="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
    <li><span class="font-medium text-foreground">Control plane.</span> Partner systems and the admin system drive the HUB through the SDK. The HUB owns the admin database and answers discovery. Clients resolve their volume there once per session.</li>
    <li><span class="font-medium text-foreground">Data plane.</span> Metadata flows to the dataserv raft cluster, block reads and writes to the block storage members, and content chunks go directly to object storage.</li>
    <li><span class="font-medium text-foreground">Gateways.</span> Apps without a mount reach the same data over S3 or WebHDFS, through the optional region gateways or the gateway embedded in every client.</li>
    <li><span class="font-medium text-foreground">Durability.</span> Object storage is the source of truth. Databases and vaults run highly available, and block storage members replicate as an active-active mesh.</li>
  </ul>
</div>
