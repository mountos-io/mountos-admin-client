<script lang="ts">
  import { Badge } from '$lib/components/ui/badge'
  import { COPYSET_STATE_LABEL, COPYSET_STATE_VARIANT, COPYSET_STATE_TITLE } from '$lib/core/utils/copyset-state'
  import type { CopysetState } from '$lib/core/api/types'

  let { state }: { state: CopysetState } = $props()
</script>

<Badge variant={COPYSET_STATE_VARIANT[state]} title={COPYSET_STATE_TITLE[state]}>{COPYSET_STATE_LABEL[state]}</Badge>
