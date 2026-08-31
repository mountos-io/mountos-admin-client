<script lang="ts">
  import DiagramViewer from '$lib/components/shared/DiagramViewer.svelte'
  import BlockStorageHaDiagram from '$lib/components/diagrams/BlockStorageHaDiagram.svelte'
</script>

<div class="space-y-4">
  <p class="text-sm text-muted-foreground">A copyset provides High Availability (HA): two nodes holding identical copies.</p>

  <DiagramViewer ariaLabel="Block storage copysets diagram">
    <BlockStorageHaDiagram />
  </DiagramViewer>

  <ul class="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
    <li><span class="font-medium text-foreground">Member = node + volume.</span> Each member is one blockserv node you run with <code class="font-mono text-xs">BLOCK_VOLUME_ID</code> and <code class="font-mono text-xs">REGION_CLUSTER_ID</code>, with its own block volume, caching object-storage parts on a raw block device.</li>
    <li><span class="font-medium text-foreground">Members form a shared copyset pool.</span> Every copyset has exactly two members, always in different clusters. A storage's pool holds K copysets, admin-adjustable after creation.</li>
    <li><span class="font-medium text-foreground">A volume draws its own working set from that pool.</span> Each volume sets its own copyset count (3 by default, editable), separate from the storage's pool size. Volumes on the same storage can and do share physical copysets.</li>
    <li><span class="font-medium text-foreground">Writes resolve to one copyset, client-side.</span> The client caches a placement snapshot from appserv, refreshed periodically, and hashes each write deterministically to exactly one copyset in its volume's working set: no server round trip per write.</li>
    <li><span class="font-medium text-foreground">A copyset replicates peer-to-peer, only within itself.</span> One copyset's members never replicate with another copyset's members, even two copysets in the same volume's working set. Placing them in different clusters means one cluster failing takes down at most half of one copyset, not the whole storage.</li>
    <li><span class="font-medium text-foreground">A copyset's write path pauses if a member goes down.</span> The surviving member keeps serving reads, falling back to the object-storage floor for anything not yet synced, but the copyset stops accepting new writes until its peer recovers or the copyset is drained.</li>
    <li><span class="font-medium text-foreground">Direct access for maintenance.</span> Turn on direct access and the block storage temporarily acts like an object storage: clients bypass blockserv and read/write the backing object store directly, so you can stop, upgrade, and restart blockserv with no data-plane downtime.</li>
    <li><span class="font-medium text-foreground">Object storage is the source of truth.</span> Every copyset is backed by the region's object storage behind its cache.</li>
  </ul>
</div>
