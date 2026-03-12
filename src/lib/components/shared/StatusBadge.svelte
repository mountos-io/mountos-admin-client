<script lang="ts">
  import { Badge } from '$lib/components/ui/badge'
  let { active, locked }: { active: boolean; locked?: boolean } = $props()
</script>

{#if locked}
  <Badge variant="warning">Locked</Badge>
{:else if active}
  <Badge variant="success">Active</Badge>
{:else}
  <Badge variant="secondary">Inactive</Badge>
{/if}
