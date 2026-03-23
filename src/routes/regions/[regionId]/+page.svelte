<script lang="ts">
  import { page } from '$app/stores'
  import RegionTopology from '$lib/components/shared/RegionTopology.svelte'

  const regionId = $derived(Number($page.params.regionId))
</script>

<RegionTopology {regionId} basePath="/regions" />
