<script lang="ts">
  import type { ForkTreeMatch } from '$lib/core/api/types'
  import { Input } from '$lib/components/ui/input'
  import { Button } from '$lib/components/ui/button'
  import { Checkbox } from '$lib/components/ui/checkbox'
  import { formatBytes } from '$lib/core/utils/format'
  import InfoTip from '$lib/components/shared/InfoTip.svelte'
  import SearchIcon from '@lucide/svelte/icons/search'
  import XIcon from '@lucide/svelte/icons/x'
  import Folder from '@lucide/svelte/icons/folder'
  import FileIcon from '@lucide/svelte/icons/file'

  let {
    draft = $bindable(''),
    exact = $bindable(false),
    inputEl = $bindable(null),
    active,
    results,
    loading,
    hasMore,
    loadingMore,
    error,
    onsubmit,
    onclear,
    onpick,
    onloadMore,
    onretry,
  }: {
    draft: string
    exact: boolean
    inputEl: HTMLInputElement | null
    active: boolean
    results: ForkTreeMatch[]
    loading: boolean
    hasMore: boolean
    loadingMore: boolean
    error: string | null
    onsubmit: () => void
    onclear: () => void
    onpick: (m: ForkTreeMatch) => void
    onloadMore: () => void
    onretry: () => void
  } = $props()

  let focusedIndex = $state(-1)
  let resultListEl: HTMLUListElement | undefined = $state()

  // Reset focus only when a new query empties the list (new searches clear
  // before populating). Appending via "Load more" preserves focus position.
  $effect(() => {
    if (results.length === 0) focusedIndex = -1
  })

  function isDir(kind: string): boolean {
    return kind === 'dir' || kind === 'directory'
  }

  function handleInputKey(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (focusedIndex >= 0 && results[focusedIndex]) onpick(results[focusedIndex])
      else onsubmit()
      return
    }
    if (e.key === 'Escape') {
      if (focusedIndex >= 0) focusedIndex = -1
      else onclear()
      return
    }
    if (e.key === 'ArrowDown') {
      if (results.length === 0) return
      e.preventDefault()
      focusedIndex = Math.min(focusedIndex + 1, results.length - 1)
      scrollFocusedIntoView()
    } else if (e.key === 'ArrowUp') {
      if (results.length === 0) return
      e.preventDefault()
      focusedIndex = Math.max(focusedIndex - 1, -1)
      scrollFocusedIntoView()
    }
  }

  function scrollFocusedIntoView() {
    if (focusedIndex < 0 || !resultListEl) return
    const child = resultListEl.children[focusedIndex] as HTMLElement | undefined
    child?.scrollIntoView({ block: 'nearest' })
  }

  // Split a path into segments, marking those that match the query for highlight.
  function highlight(text: string, query: string): { value: string; match: boolean }[] {
    if (!query) return [{ value: text, match: false }]
    const out: { value: string; match: boolean }[] = []
    const needle = query.toLowerCase()
    const haystack = text.toLowerCase()
    let i = 0
    while (i < text.length) {
      const idx = haystack.indexOf(needle, i)
      if (idx === -1) {
        out.push({ value: text.slice(i), match: false })
        break
      }
      if (idx > i) out.push({ value: text.slice(i, idx), match: false })
      out.push({ value: text.slice(idx, idx + needle.length), match: true })
      i = idx + needle.length
    }
    return out
  }

  const matchCount = $derived(results.length)
  const matchLabel = $derived.by(() => {
    if (loading && matchCount === 0) return 'searching…'
    if (matchCount === 0) return 'no matches'
    return `${matchCount}${hasMore ? '+' : ''} match${matchCount === 1 && !hasMore ? '' : 'es'}`
  })
</script>

<div class="flex flex-col gap-2 min-w-0">
  <div class="flex items-center gap-2 flex-wrap">
    <div class="relative flex-1 min-w-[200px]">
      <SearchIcon class="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
      <Input
        type="text"
        placeholder="Find name in subtree"
        class="h-9 min-h-[44px] sm:min-h-9 pl-7 pr-8 text-sm"
        bind:value={draft}
        bind:ref={inputEl}
        onkeydown={handleInputKey}
        aria-label="Search names in current subtree"
        aria-controls="tree-search-results"
        aria-activedescendant={focusedIndex >= 0 ? `tree-search-result-${focusedIndex}` : undefined} />
      {#if draft}
        <button type="button"
          class="absolute right-1 top-1/2 -translate-y-1/2 inline-flex items-center justify-center h-7 w-7 min-h-[44px] sm:min-h-7 min-w-[44px] sm:min-w-7 rounded-sm text-muted-foreground hover:text-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          onclick={onclear} aria-label="Clear search">
          <XIcon class="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      {/if}
    </div>
    <label class="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none min-h-[44px] sm:min-h-9">
      <Checkbox bind:checked={exact} />
      Exact
      <InfoTip text={"Off: name contains the query (case-insensitive prefix).\nOn: full name must equal the query."} />
    </label>
    <Button variant="outline" size="sm" onclick={onsubmit} disabled={!draft || loading} class="min-h-[44px] sm:min-h-9">
      {loading ? 'Searching…' : 'Search'}
    </Button>
  </div>

  {#if active}
    {#if error}
      <div class="rounded-sm border border-destructive/40 bg-destructive/10 px-3 py-2 flex items-start justify-between gap-2">
        <p class="text-sm text-destructive">{error}</p>
        <Button variant="outline" size="sm" onclick={onretry} class="min-h-[44px] sm:min-h-9 shrink-0">Retry</Button>
      </div>
    {:else}
      <div class="border border-border/40 rounded-sm" role="region" aria-label="Search results">
        <div class="px-3 py-2 border-b border-border/30 bg-muted/20">
          <span class="text-xs text-muted-foreground" aria-live="polite">{matchLabel}</span>
        </div>
        {#if matchCount === 0 && !loading}
          <p class="px-3 py-4 text-sm text-muted-foreground text-center">No entries match this query.</p>
        {:else}
          <ul id="tree-search-results" role="listbox" bind:this={resultListEl}
            class="overflow-y-auto divide-y divide-border/30" style="max-height: min(60vh, 520px)">
            {#each results as m, i (m.inode + ':' + m.path)}
              <li role="option"
                id="tree-search-result-{i}"
                aria-selected={focusedIndex === i}
                class={focusedIndex === i ? 'bg-accent' : ''}>
                <button type="button"
                  class="w-full text-left px-3 py-2 min-h-[44px] hover:bg-accent focus-visible:bg-accent focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring flex items-center gap-2"
                  onclick={() => onpick(m)}>
                  {#if isDir(m.kind)}
                    <Folder class="h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" />
                  {:else}
                    <FileIcon class="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                  {/if}
                  <span class="font-mono text-xs truncate flex-1">
                    {#each highlight(m.path, draft) as part, p (p)}
                      {#if part.match}<mark class="bg-warning/30 text-foreground rounded-[1px]">{part.value}</mark>
                      {:else}{part.value}{/if}
                    {/each}
                  </span>
                  {#if !isDir(m.kind)}
                    <span class="text-xs text-muted-foreground tabular-nums shrink-0">{formatBytes(m.size)}</span>
                  {/if}
                </button>
              </li>
            {/each}
          </ul>
          {#if hasMore}
            <div class="flex justify-center p-2 border-t border-border/30">
              <Button variant="outline" size="sm" onclick={onloadMore} disabled={loadingMore} class="min-h-[44px] sm:min-h-9">
                {loadingMore ? 'Loading…' : 'Load more'}
              </Button>
            </div>
          {/if}
        {/if}
      </div>
    {/if}
  {/if}
</div>
