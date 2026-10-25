<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { useAuth } from '#lib/core/stores/auth.svelte.js';
  import { showErrorToast } from '#lib/core/utils/toast.js';
  import RegionTopology from '#lib/components/shared/RegionTopology.svelte';

  const auth = useAuth();
  const regionId = $derived(Number(page.params.regionId));
  const tab = $derived(page.url.searchParams.get('tab') as 'overview' | 'activity' | 'alerts' | null);

  $effect(() => {
    if (!auth.loading && !auth.can('serviceNodes', 'read')) {
      showErrorToast('Access denied')
      goto('/', { replaceState: true })
    }
  })
</script>

<svelte:head><title>Region Nodes · mountOS Admin</title></svelte:head>

{#if auth.can('serviceNodes', 'read')}
  <RegionTopology
    regionId={regionId}
    basePath="/nodes"
    initialTab={tab ?? undefined}
  />
{/if}
