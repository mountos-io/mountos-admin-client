<script lang="ts">
  import { page } from '$app/stores'
  import NodeDetail from '$lib/components/shared/NodeDetail.svelte'

  const regionId = $derived(Number($page.params.regionId))
  const nodeId = $derived($page.params.nodeId ?? '')
</script>

<svelte:head><title>Node Detail — mountOS Admin</title></svelte:head>

<NodeDetail {regionId} {nodeId} basePath="/nodes" />
