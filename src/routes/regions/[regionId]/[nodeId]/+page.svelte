<script lang="ts">
  import { page } from '$app/stores'
  import NodeDetail from '$lib/components/shared/NodeDetail.svelte'

  const regionId = $derived(Number($page.params.regionId))
  const nodeId = $derived($page.params.nodeId ?? '')
</script>

<NodeDetail {regionId} {nodeId} basePath="/regions" />
