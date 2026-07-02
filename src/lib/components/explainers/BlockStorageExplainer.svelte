<script lang="ts">
  import DiagramViewer from '$lib/components/shared/DiagramViewer.svelte'
  import BlockStorageHaDiagram from '$lib/components/diagrams/BlockStorageHaDiagram.svelte'
</script>

<div class="space-y-4">
  <DiagramViewer ariaLabel="Block storage HA mesh diagram">
    <BlockStorageHaDiagram />
  </DiagramViewer>

  <ul class="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
    <li><span class="font-medium text-foreground">Member = node + volume.</span> Each member is one blockserv node you run with <code class="font-mono text-xs">BLOCK_VOLUME_ID</code> and <code class="font-mono text-xs">REGION_CLUSTER_ID</code>, with its own block volume, caching object-storage parts on a raw block device.</li>
    <li><span class="font-medium text-foreground">Clients connect via appserv.</span> The client discovers its members at appserv (the discovery endpoint, no DNS), then connects directly to any member node.</li>
    <li><span class="font-medium text-foreground">Active-active across clusters.</span> Members replicate peer-to-peer. Place them in different clusters so one cluster failing doesn't take the storage offline. 2 HA members means 3 volumes.</li>
    <li><span class="font-medium text-foreground">blockserv tolerates one instance failure.</span> With HA members writes still commit while one instance is down; the survivor falls back to the object-storage floor, and reads redirect to a sibling.</li>
    <li><span class="font-medium text-foreground">Direct access for maintenance.</span> Turn on direct access and the block storage temporarily acts like an object storage: clients bypass blockserv and read/write the backing object store directly, so you can stop, upgrade, and restart blockserv with no data-plane downtime.</li>
    <li><span class="font-medium text-foreground">Object storage is the source of truth.</span> Every member is backed by the region's object storage behind its cache.</li>
  </ul>
</div>
