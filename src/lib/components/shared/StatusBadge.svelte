<script lang="ts">
  import { Badge } from '$lib/components/ui/badge'
  import Lock from '@lucide/svelte/icons/lock'
  import CheckCircle2 from '@lucide/svelte/icons/check-circle-2'
  import CircleDashed from '@lucide/svelte/icons/circle-dashed'
  let { active, locked }: { active: boolean; locked?: boolean } = $props()
</script>

<span>
  {#if locked}
    <Badge variant="warning"><Lock class="size-3 mr-1" aria-hidden="true" />Locked</Badge>
  {:else if active}
    <Badge variant="success"><CheckCircle2 class="size-3 mr-1" aria-hidden="true" />Active</Badge>
  {:else}
    <Badge variant="secondary"><CircleDashed class="size-3 mr-1" aria-hidden="true" />Inactive</Badge>
  {/if}
</span>
