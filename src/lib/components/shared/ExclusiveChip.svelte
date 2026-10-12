<script lang="ts">
  import { Badge } from '$lib/components/ui/badge'
  import type { ExclusiveGrant } from '$lib/core/api/types'
  import { grantRoleLabel, grantStateVariant, scopeLabel } from '$lib/core/utils/exclusive'

  let { grant }: { grant: ExclusiveGrant } = $props()
</script>

<span class="inline-flex flex-col items-start gap-0.5 min-w-0 max-w-[10rem]" title="{grantRoleLabel(grant)} on {scopeLabel(grant)}, {grant.state}">
  <Badge variant={grantStateVariant(grant.state)}>{grantRoleLabel(grant)} · {grant.state}</Badge>
  <span class="text-sm font-mono text-muted-foreground truncate max-w-full">{grant.path || '/'}</span>
</span>
