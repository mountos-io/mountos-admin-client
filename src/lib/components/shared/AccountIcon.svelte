<script lang="ts">
  import type { Account } from '#lib/core/api/types.js'
  import { generateIdenticon } from '#lib/core/utils/identicon.js'

  let { account, size = 32 }: { account: Account; size?: number } = $props()

  const src = $derived(account.iconUrl || generateIdenticon(account.id, size))
</script>

<img
  {src}
  alt={account.name}
  width={size}
  height={size}
  loading="lazy"
  decoding="async"
  class="rounded-full shrink-0"
/>
