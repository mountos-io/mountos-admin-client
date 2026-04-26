<script lang="ts">
  import { page } from '$app/stores'
  import RegionTopology from '$lib/components/shared/RegionTopology.svelte'

  const regionId = $derived(Number($page.params.regionId))
  const tab = $derived($page.url.searchParams.get('tab') as 'overview' | 'activity' | 'alerts' | null)
</script>

<svelte:head><title>Region · mountOS Admin</title></svelte:head>

<RegionTopology {regionId} basePath="/regions" initialTab={tab ?? undefined} />
