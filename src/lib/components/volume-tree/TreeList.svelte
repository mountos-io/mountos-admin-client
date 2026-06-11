<script lang="ts">
  import type { ForkTreeEntry } from '$lib/core/api/types'
  import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '$lib/components/ui/table'
  import { Button } from '$lib/components/ui/button'
  import { formatBytes, formatRelative, formatTzShort } from '$lib/core/utils/format'
  import { tz } from '$lib/core/stores/tz.svelte'
  import { userCache } from '$lib/core/stores/user-cache.svelte'
  import ListSkeleton from '$lib/components/shared/ListSkeleton.svelte'
  import EmptyState from '$lib/components/shared/EmptyState.svelte'
  import Folder from '@lucide/svelte/icons/folder'
  import FileIcon from '@lucide/svelte/icons/file'
  import LinkIcon from '@lucide/svelte/icons/link'

  let {
    entries,
    loading,
    hasMore,
    loadingMore,
    onenter,
    onselect,
    onloadMore,
  }: {
    entries: ForkTreeEntry[]
    loading: boolean
    hasMore: boolean
    loadingMore: boolean
    onenter: (entry: ForkTreeEntry) => void
    onselect: (entry: ForkTreeEntry) => void
    onloadMore: () => void
  } = $props()

  // Pre-warm the user cache for every creator/updater on the visible page
  // so the bulk endpoint sees one request per page-load instead of one
  // per cell.
  $effect(() => {
    const ids = new Set<number>()
    for (const e of entries) {
      if (e.creatorId) ids.add(e.creatorId)
      if (e.updaterId) ids.add(e.updaterId)
    }
    if (ids.size > 0) userCache.ensure(ids)
  })

  function isDir(kind: string): boolean {
    return kind === 'dir' || kind === 'directory'
  }

  function activate(e: ForkTreeEntry) {
    if (isDir(e.kind)) onenter(e)
    else onselect(e)
  }

  function handleKey(event: KeyboardEvent, e: ForkTreeEntry) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      activate(e)
    }
  }
</script>

{#if loading && entries.length === 0}
  <ListSkeleton rows={6} />
{:else if entries.length === 0}
  <div class="relative rounded-sm border border-border/60 bg-card/60 overflow-hidden">
    <div class="tech-grid absolute inset-0 pointer-events-none opacity-20"></div>
    <div class="relative">
      <EmptyState title="Empty directory" description="No entries at this path." />
    </div>
  </div>
{:else}
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead class="th-cyber w-[28px]"></TableHead>
        <TableHead class="th-cyber min-w-[50ch]">Name</TableHead>
        <TableHead class="th-cyber hidden md:table-cell w-[120px] text-right">Size</TableHead>
        <TableHead class="th-cyber hidden xl:table-cell w-[180px]">Created</TableHead>
        <TableHead class="th-cyber hidden xl:table-cell w-[140px]">Created By</TableHead>
        <TableHead class="th-cyber hidden lg:table-cell w-[180px]">Last Modified</TableHead>
        <TableHead class="th-cyber hidden lg:table-cell w-[140px]">Last Modified By</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {#each entries as e (e.inode)}
        <TableRow
          class="cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
          tabindex={0}
          aria-label={isDir(e.kind) ? `Open directory ${e.name}` : `Open ${e.name} details`}
          onclick={() => activate(e)}
          onkeydown={(ev) => handleKey(ev, e)}>
          <TableCell class="text-muted-foreground py-4 min-h-[44px]">
            {#if isDir(e.kind)}
              <Folder class="h-4 w-4 text-primary" aria-hidden="true" />
            {:else if e.kind === 'symlink'}
              <LinkIcon class="h-4 w-4" aria-hidden="true" />
            {:else}
              <FileIcon class="h-4 w-4" aria-hidden="true" />
            {/if}
          </TableCell>
          <TableCell class="text-sm py-4 min-h-[44px] min-w-[50ch]">
            <span class="truncate">{e.name}</span>
          </TableCell>
          <TableCell class="hidden md:table-cell text-right text-xs text-muted-foreground tabular-nums py-4">
            {isDir(e.kind) ? '' : formatBytes(e.size)}
          </TableCell>
          <TableCell class="hidden xl:table-cell text-xs text-muted-foreground tabular-nums py-4 align-middle whitespace-nowrap">
            {#if e.ctime}
              <div class="leading-tight">
                <div class="text-foreground">{formatTzShort(e.ctime / 1_000_000, tz.value)}</div>
                <div class="text-muted-foreground/70">{formatRelative(e.ctime / 1_000_000)}</div>
              </div>
            {/if}
          </TableCell>
          <TableCell class="hidden xl:table-cell text-xs text-muted-foreground py-4 align-middle truncate">
            {#if e.creatorId}
              <a
                href={`/users/${e.creatorId}`}
                class="detail-link inline-block max-w-full truncate font-mono"
                title={`user#${e.creatorId}`}
                onclick={(ev: MouseEvent) => ev.stopPropagation()}>
                {void userCache.rev, userCache.display(e.creatorId)}
              </a>
            {/if}
          </TableCell>
          <TableCell class="hidden lg:table-cell text-xs text-muted-foreground tabular-nums py-4 align-middle whitespace-nowrap">
            {#if e.mtime}
              <div class="leading-tight">
                <div class="text-foreground">{formatTzShort(e.mtime / 1_000_000, tz.value)}</div>
                <div class="text-muted-foreground/70">{formatRelative(e.mtime / 1_000_000)}</div>
              </div>
            {/if}
          </TableCell>
          <TableCell class="hidden lg:table-cell text-xs text-muted-foreground py-4 align-middle truncate">
            {#if e.updaterId}
              <a
                href={`/users/${e.updaterId}`}
                class="detail-link inline-block max-w-full truncate font-mono"
                title={`user#${e.updaterId}`}
                onclick={(ev: MouseEvent) => ev.stopPropagation()}>
                {void userCache.rev, userCache.display(e.updaterId)}
              </a>
            {/if}
          </TableCell>
        </TableRow>
      {/each}
    </TableBody>
  </Table>

  {#if hasMore}
    <div class="flex justify-center mt-3">
      <Button variant="outline" size="sm" onclick={onloadMore} disabled={loadingMore} class="min-h-[44px] sm:min-h-9">
        {loadingMore ? 'Loading…' : 'Load more'}
      </Button>
    </div>
  {/if}
{/if}
