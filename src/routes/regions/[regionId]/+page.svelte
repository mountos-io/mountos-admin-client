<script lang="ts">
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { useAuth } from '$lib/core/stores/auth.svelte'
  import { showErrorToast } from '$lib/core/utils/toast'
  import RegionTopology from '$lib/components/shared/RegionTopology.svelte'

  const auth = useAuth()
  const regionId = $derived(Number($page.params.regionId))
  const tab = $derived($page.url.searchParams.get('tab') as 'overview' | 'activity' | 'alerts' | null)

  $effect(() => {
    if (!auth.loading && !auth.can('regions', 'read')) {
      showErrorToast('Access denied')
      goto('/', { replaceState: true })
    }
  })
</script>

<svelte:head><title>Region · mountOS Admin</title></svelte:head>

{#if auth.can('regions', 'read')}
  <RegionTopology {regionId} basePath="/regions" initialTab={tab ?? undefined} />
{/if}
