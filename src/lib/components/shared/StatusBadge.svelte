<script lang="ts">
  import { Badge } from '$lib/components/ui/badge'
  let { active, locked }: { active: boolean; locked?: boolean } = $props()
  const label = $derived(locked ? 'Locked' : active ? 'Active' : 'Inactive')
</script>

<span>
  {#if locked}
    <Badge variant="warning">Locked</Badge>
  {:else if active}
    <Badge variant="success">Active</Badge>
  {:else}
    <Badge variant="secondary">Inactive</Badge>
  {/if}
</span>
