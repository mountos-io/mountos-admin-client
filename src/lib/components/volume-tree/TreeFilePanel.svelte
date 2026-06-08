<script lang="ts">
  // Side-drawer dialog. Uses bits-ui DialogPrimitive directly (not the
  // project's $lib/components/ui/dialog wrapper) because the wrapper centers
  // its Content and we need a right-side drawer. Focus trap, Esc, portal,
  // and inert are still delegated to bits-ui; the divergence is positioning
  // only. The Versions modal (centered) uses the wrapper.
  import type { ForkEntryDetail } from '$lib/core/api/types'
  import { Dialog as DialogPrimitive } from 'bits-ui'
  import { Button } from '$lib/components/ui/button'
  import { Badge } from '$lib/components/ui/badge'
  import { formatBytes, formatRelative, formatTzShort } from '$lib/core/utils/format'
  import { tz } from '$lib/core/stores/tz.svelte'
  import { userCache } from '$lib/core/stores/user-cache.svelte'
  import XIcon from '@lucide/svelte/icons/x'
  import HistoryIcon from '@lucide/svelte/icons/history'
  import CopyIcon from '@lucide/svelte/icons/copy'
  import CheckIcon from '@lucide/svelte/icons/check'
  import LoadingSpinner from '$lib/components/shared/LoadingSpinner.svelte'
  import TreeContextChip from './TreeContextChip.svelte'
  import { showErrorToast } from '$lib/core/utils/toast'
  import { copyText } from '$lib/core/utils/clipboard'

  let {
    open = $bindable(false),
    detail,
    loading,
    error,
    forkName,
    asOf,
    onclose,
    onretry,
    onversions,
  }: {
    open: boolean
    detail: ForkEntryDetail | null
    loading: boolean
    error: string | null
    forkName: string
    asOf: number | null
    onclose: () => void
    onretry: () => void
    onversions: () => void
  } = $props()

  function fmtMode(mode: number | undefined): string {
    if (mode == null) return ''
    return '0' + (mode & 0o7777).toString(8)
  }

  function isFile(kind: string | undefined): boolean {
    return kind != null && kind !== 'dir' && kind !== 'directory'
  }

  function normaliseKind(kind: string | undefined): string {
    if (!kind) return ''
    if (kind === 'directory') return 'dir'
    return kind
  }

  const xattrEntries = $derived.by(() => {
    if (!detail?.xattrs) return []
    const out: { key: string; value: string }[] = []
    for (const [k, v] of Object.entries(detail.xattrs)) {
      out.push({ key: k, value: typeof v === 'string' ? v : JSON.stringify(v) })
    }
    return out
  })

  let copiedKey = $state<string | null>(null)
  let copiedTimer: ReturnType<typeof setTimeout> | null = null
  async function copyValue(key: string, value: string | number | undefined | null) {
    if (value == null || value === '') return
    if (await copyText(String(value))) {
      copiedKey = key
      if (copiedTimer) clearTimeout(copiedTimer)
      copiedTimer = setTimeout(() => { copiedKey = null }, 1400)
    } else {
      showErrorToast('Copy failed: clipboard access blocked')
    }
  }

  function handleOpenChange(next: boolean) {
    open = next
    if (!next) onclose()
  }
</script>

<DialogPrimitive.Root bind:open onOpenChange={handleOpenChange}>
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay
      class="fixed inset-0 z-40 bg-background/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 motion-reduce:animate-none" />

    <DialogPrimitive.Content
      class="fixed right-0 top-0 z-50 h-full w-full sm:w-[420px] bg-background border-l border-border flex flex-col data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right motion-reduce:animate-none"
      aria-label="Entry detail">

      <header class="cyberpunk-lskewed-sm relative flex items-start justify-between gap-2 border-b border-border/40 px-4 py-3 shrink-0">
        <div class="min-w-0 flex-1 space-y-1">
          <DialogPrimitive.Title class="text-sm font-semibold truncate" title={detail?.path ?? ''}>
            {detail?.name ?? 'Entry'}
          </DialogPrimitive.Title>
          <TreeContextChip {forkName} {asOf} size="sm" />
        </div>
        <DialogPrimitive.Close
          class="inline-flex items-center justify-center min-h-[44px] min-w-[44px] sm:h-9 sm:w-9 rounded-sm text-muted-foreground hover:text-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          aria-label="Close">
          <XIcon class="h-4 w-4" aria-hidden="true" />
        </DialogPrimitive.Close>
      </header>

      <div class="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {#if loading}
          <div class="flex justify-center py-8"><LoadingSpinner /></div>
        {:else if error}
          <div class="rounded-sm border border-destructive/40 bg-destructive/10 px-3 py-2 flex items-start justify-between gap-2">
            <p class="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onclick={onretry} class="min-h-[44px] sm:min-h-9 shrink-0">Retry</Button>
          </div>
        {:else if detail}
          <section class="space-y-1">
            <div class="text-xs uppercase tracking-wider font-semibold text-muted-foreground flex items-center justify-between">
              <span>Path</span>
              <button type="button" onclick={() => copyValue('path', detail.path)} aria-label="Copy path"
                class="inline-flex items-center gap-1 px-1.5 py-1 min-h-[44px] sm:min-h-7 rounded-sm text-muted-foreground hover:text-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                {#if copiedKey === 'path'}<CheckIcon class="h-3.5 w-3.5 text-success" aria-hidden="true" />
                {:else}<CopyIcon class="h-3.5 w-3.5" aria-hidden="true" />{/if}
              </button>
            </div>
            <p class="text-sm font-mono break-all">{detail.path}</p>
          </section>

          <section class="grid grid-cols-2 gap-3">
            <div>
              <div class="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Kind</div>
              <Badge variant="outline" class="mt-1">{normaliseKind(detail.kind)}</Badge>
            </div>
            <div>
              <div class="text-xs uppercase tracking-wider font-semibold text-muted-foreground flex items-center justify-between">
                <span>Inode</span>
                <button type="button" onclick={() => copyValue('inode', detail.inode)} aria-label="Copy inode"
                  class="inline-flex items-center px-1 py-1 min-h-[44px] sm:min-h-7 min-w-[44px] sm:min-w-7 justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                  {#if copiedKey === 'inode'}<CheckIcon class="h-3.5 w-3.5 text-success" aria-hidden="true" />
                  {:else}<CopyIcon class="h-3.5 w-3.5" aria-hidden="true" />{/if}
                </button>
              </div>
              <p class="text-sm font-mono mt-1">{detail.inode}</p>
            </div>
            <div>
              <div class="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Size</div>
              <p class="text-sm tabular-nums mt-1">{isFile(detail.kind) ? formatBytes(detail.size) : ''}</p>
            </div>
            <div>
              <div class="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Modified</div>
              {#if detail.mtime}
                <p class="text-sm tabular-nums mt-1">{formatTzShort(detail.mtime / 1_000_000, tz.value)}</p>
                <p class="text-xs text-muted-foreground tabular-nums">{formatRelative(detail.mtime / 1_000_000)}</p>
              {/if}
            </div>
            <div>
              <div class="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Created</div>
              {#if detail.ctime}
                <p class="text-sm tabular-nums mt-1">{formatTzShort(detail.ctime / 1_000_000, tz.value)}</p>
                <p class="text-xs text-muted-foreground tabular-nums">{formatRelative(detail.ctime / 1_000_000)}</p>
              {/if}
            </div>
            <div>
              <div class="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Owner</div>
              <p class="text-sm font-mono mt-1">{detail.owner ?? ''}</p>
            </div>
            <div>
              <div class="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Mode</div>
              <p class="text-sm font-mono mt-1">{fmtMode(detail.mode)}</p>
            </div>
            {#if detail.creatorId || detail.updaterId}
              <div>
                <div class="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Created by</div>
                <p class="text-sm mt-1" title={detail.creatorId ? `user#${detail.creatorId}` : ''}>
                  {void userCache.rev, userCache.display(detail.creatorId ?? 0)}
                </p>
              </div>
              <div>
                <div class="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Updated by</div>
                <p class="text-sm mt-1" title={detail.updaterId ? `user#${detail.updaterId}` : ''}>
                  {void userCache.rev, userCache.display(detail.updaterId ?? 0)}
                </p>
              </div>
            {/if}
          </section>

          {#if xattrEntries.length > 0}
            <section>
              <div class="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-2">Xattrs</div>
              <ul class="border border-border/40 rounded-sm divide-y divide-border/30">
                {#each xattrEntries as x (x.key)}
                  <li class="grid grid-cols-[max-content_1fr] gap-2 px-2 py-1.5 font-mono text-xs">
                    <span class="text-muted-foreground">{x.key}</span>
                    <span class="break-all">{x.value}</span>
                  </li>
                {/each}
              </ul>
            </section>
          {/if}

          {#if isFile(detail.kind)}
            <section>
              <Button variant="outline" size="sm" onclick={onversions} class="gap-1.5 min-h-[44px] sm:min-h-9">
                <HistoryIcon class="h-3.5 w-3.5" aria-hidden="true" /> View versions
              </Button>
            </section>
          {/if}
        {/if}
      </div>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
</DialogPrimitive.Root>
