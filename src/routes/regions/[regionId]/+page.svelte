<script lang="ts">
  import { page } from '$app/stores'
  import RegionTopology from '$lib/components/shared/RegionTopology.svelte'

  const regionId = $derived(Number($page.params.regionId))
</script>

<svelte:head><title>Region — mountOS Admin</title></svelte:head>

<RegionTopology {regionId} basePath="/regions" />
