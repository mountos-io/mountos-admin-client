<script lang="ts">
  import DiagramViewer from '$lib/components/shared/DiagramViewer.svelte'
  import RegionClusterDiagram from '$lib/components/diagrams/RegionClusterDiagram.svelte'
</script>

<div class="space-y-4">
  <DiagramViewer ariaLabel="HUB, region, and clusters topology diagram">
    <RegionClusterDiagram />
  </DiagramViewer>

  <ul class="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
    <li><span class="font-medium text-foreground">HUB (appserv).</span> One logical instance per deployment, replicated for HA. It owns the admin database and answers discovery, resolving which cluster serves a volume. It belongs to no account, region, or cluster.</li>
    <li><span class="font-medium text-foreground">Region.</span> Belongs to one account and owns its own database and vault. Its storages point at S3-compatible or Azure object stores, one or many per region.</li>
    <li><span class="font-medium text-foreground">Cluster.</span> A volume-load partition inside a region. It runs the cluster-scoped services (dataserv, gcserv) and owns a slice of the region's volumes. Every cluster shares the region database and vault.</li>
    <li><span class="font-medium text-foreground">Block storage.</span> A region runs block storage as a shared pool of 2-node copysets, admin-adjustable in count, each copyset's members in distinct clusters. Each volume on that storage draws its own working set from the pool, so volumes can share physical copysets, all backed by the region's object storage.</li>
  </ul>
</div>
