<script lang="ts">
  // Test-only stand-in for the real NodeDetail.svelte, which owns a lot of its own
  // store/API wiring unrelated to what this route's own tests need to verify: that the
  // active tab's member resolves to the right (regionId, nodeId) and gets handed off.
  let { regionId, nodeId, basePath }: { regionId: number; nodeId: string; basePath: string } = $props()
</script>

<div data-testid="node-detail-stub" data-region-id={regionId} data-node-id={nodeId} data-base-path={basePath}>
  NodeDetail stub for {nodeId}
</div>
