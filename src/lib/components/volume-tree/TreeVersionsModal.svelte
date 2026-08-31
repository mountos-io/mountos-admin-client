<script lang="ts">
  import type { ForkEntryVersion } from '$lib/core/api/types'
  import * as Dialog from '$lib/components/ui/dialog'
  import { Button } from '$lib/components/ui/button'
  import { formatBytes, formatRelative, formatTzFull } from '$lib/core/utils/format'
  import { tz } from '$lib/core/stores/tz.svelte'
  import { userCache } from '$lib/core/stores/user-cache.svelte'
  import LoadingSpinner from '$lib/components/shared/LoadingSpinner.svelte'
  import CopyIcon from '@lucide/svelte/icons/copy'
  import CheckIcon from '@lucide/svelte/icons/check'
  import { showErrorToast } from '$lib/core/utils/toast'
  import { copyText } from '$lib/core/utils/clipboard'

  let {
    open = $bindable(false),
    path,
    versions,
    loading,
    hasMore,
    loadingMore,
    error,
    onloadMore,
    onretry,
  }: {
    open: boolean
    path: string
    versions: ForkEntryVersion[]
    loading: boolean
    hasMore: boolean
    loadingMore: boolean
    error: string | null
    onloadMore: () => void
    onretry: () => void
  } = $props()

  const fileName = $derived.by(() => {
    const tail = path.split('/').filter(Boolean).pop()
    return tail && tail.length > 0 ? tail : 'file'
  })

  let copiedHash = $state<string | null>(null)
  let copiedTimer: ReturnType<typeof setTimeout> | null = null
  async function copyHash(hash: string) {
    if (await copyText(hash)) {
      copiedHash = hash
      if (copiedTimer) clearTimeout(copiedTimer)
      copiedTimer = setTimeout(() => { copiedHash = null }, 1400)
    } else {
      showErrorToast('Copy failed: clipboard access blocked')
    }
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="sm:max-w-2xl">
    <Dialog.Header>
      <Dialog.Title>Versions of {fileName}</Dialog.Title>
      <Dialog.Description class="font-mono text-xs truncate" title={path}>{path}</Dialog.Description>
    </Dialog.Header>

    <div class="min-h-[200px] max-h-[60vh] overflow-y-auto">
      {#if loading && versions.length === 0}
        <div class="flex justify-center py-8"><LoadingSpinner /></div>
      {:else if error}
        <div class="rounded-sm border border-destructive/40 bg-destructive/10 px-3 py-2 flex items-start justify-between gap-2">
          <p class="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onclick={onretry} class="min-h-[44px] sm:min-h-9 shrink-0">Retry</Button>
        </div>
      {:else if versions.length === 0}
        <p class="text-sm text-muted-foreground py-4 text-center">No prior versions.</p>
      {:else}
        <ul class="divide-y divide-border/30 border border-border/40 rounded-sm">
          {#each versions as v, i (v.generation)}
            <li class="grid grid-cols-[max-content_1fr_max-content] gap-3 px-3 py-2 items-center">
              <span class="font-mono text-xs text-muted-foreground tabular-nums">v{versions.length - i}</span>
              <div class="min-w-0">
                {#if v.mtime}
                  <p class="text-xs tabular-nums">{formatTzFull(v.mtime / 1_000_000, tz.value)}</p>
                  <p class="text-xs text-muted-foreground tabular-nums">{formatRelative(v.mtime / 1_000_000)}</p>
                {/if}
                {#if v.updaterId}
                  <p class="text-xs text-muted-foreground" title={`user#${v.updaterId}`}>
                    by {void userCache.rev, userCache.display(v.updaterId)}
                  </p>
                {/if}
                {#if v.contentHash}
                  <div class="flex items-center gap-1 min-w-0">
                    <p class="font-mono text-xs text-muted-foreground truncate" title={v.contentHash}>
                      {v.contentHash}
                    </p>
                    <button type="button" onclick={() => copyHash(v.contentHash!)} aria-label="Copy hash"
                      class="inline-flex items-center justify-center min-h-[44px] sm:min-h-6 min-w-[44px] sm:min-w-6 rounded-sm text-muted-foreground hover:text-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                      {#if copiedHash === v.contentHash}<CheckIcon class="h-3 w-3 text-success" aria-hidden="true" />
                      {:else}<CopyIcon class="h-3 w-3" aria-hidden="true" />{/if}
                    </button>
                  </div>
                {/if}
              </div>
              <span class="text-xs tabular-nums">{formatBytes(v.size)}</span>
            </li>
          {/each}
        </ul>
        {#if hasMore}
          <div class="flex justify-center py-2">
            <Button variant="outline" size="sm" onclick={onloadMore} disabled={loadingMore} class="min-h-[44px] sm:min-h-9">
              {loadingMore ? 'Loading…' : 'Load more'}
            </Button>
          </div>
        {/if}
      {/if}
    </div>
  </Dialog.Content>
</Dialog.Root>
