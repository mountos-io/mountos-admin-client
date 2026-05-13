<script lang="ts">
  import type { ForkTreeEntry } from '$lib/core/api/types'
  import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '$lib/components/ui/table'
  import { Button } from '$lib/components/ui/button'
  import { formatBytes, formatRelative, formatTzShort } from '$lib/core/utils/format'
  import { tz } from '$lib/core/stores/tz.svelte'
  import ListSkeleton from '$lib/components/shared/ListSkeleton.svelte'
  import EmptyState from '$lib/components/shared/EmptyState.svelte'
  import Folder from '@lucide/svelte/icons/folder'
  import FileIcon from '@lucide/svelte/icons/file'
  import LinkIcon from '@lucide/svelte/icons/link'
  import Tag from '@lucide/svelte/icons/tag'

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
    <div class="tech-grid absolute inset-0 pointer-events-none opacity-60"></div>
    <div class="relative">
      <EmptyState title="Empty directory" description="No entries at this path." />
    </div>
  </div>
{:else}
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead class="th-cyber w-[28px]"></TableHead>
        <TableHead class="th-cyber">Name</TableHead>
        <TableHead class="th-cyber hidden md:table-cell w-[120px] text-right">Size</TableHead>
        <TableHead class="th-cyber hidden lg:table-cell w-[260px]">Modified</TableHead>
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
          <TableCell class="text-sm py-4 min-h-[44px]">
            <span class="truncate">{e.name}</span>
            {#if e.hasXattr}
              <Tag class="inline-block h-3 w-3 ml-1 align-text-bottom text-muted-foreground" aria-label="Has extended attributes" />
            {/if}
          </TableCell>
          <TableCell class="hidden md:table-cell text-right text-xs text-muted-foreground tabular-nums py-4">
            {isDir(e.kind) ? '' : formatBytes(e.size)}
          </TableCell>
          <TableCell class="hidden lg:table-cell text-xs text-muted-foreground tabular-nums py-4 align-middle whitespace-nowrap">
            {#if e.mtime}
              <div class="leading-tight">
                <div class="text-foreground">{formatTzShort(e.mtime / 1_000_000, tz.value)}</div>
                <div class="text-muted-foreground/70">{formatRelative(e.mtime / 1_000_000)}</div>
              </div>
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
