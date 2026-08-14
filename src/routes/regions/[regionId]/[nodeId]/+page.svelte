<script lang="ts">
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { useAuth } from '$lib/core/stores/auth.svelte'
  import { showErrorToast } from '$lib/core/utils/toast'
  import NodeDetail from '$lib/components/shared/NodeDetail.svelte'

  const auth = useAuth()
  const regionId = $derived(Number($page.params.regionId))
  const nodeId = $derived($page.params.nodeId ?? '')

  $effect(() => {
    if (!auth.loading && !auth.can('serviceNodes', 'read')) {
      showErrorToast('Access denied')
      goto('/', { replaceState: true })
    }
  })
</script>

{#if auth.can('serviceNodes', 'read')}
  <NodeDetail {regionId} {nodeId} basePath="/regions" />
{/if}
