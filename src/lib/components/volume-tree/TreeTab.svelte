<script lang="ts">
  import { onDestroy } from 'svelte'
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import type {
    Fork, Volume, ForkTreeEntry, ForkEntryDetail, ForkTreeMatch, ForkEntryVersion,
  } from '$lib/core/api/types'
  import { api } from '$lib/core/stores/client.svelte'
  import { ApiError } from '$lib/core/api/errors'
  import { MAIN_FORK, gcFloorMs, forkAnchorFloorMs } from '$lib/core/utils/forkRetention'
  import { showSuccessToast } from '$lib/core/utils/toast'
  import { debounce } from '$lib/utils'
  import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card'
  import { Button } from '$lib/components/ui/button'
  import ForkPicker from './ForkPicker.svelte'
  import TimezonePicker from '$lib/components/shared/TimezonePicker.svelte'
  import SearchIcon from '@lucide/svelte/icons/search'
  import TreeBreadcrumb from './TreeBreadcrumb.svelte'
  import TreeTimePicker from './TreeTimePicker.svelte'
  import TreeList from './TreeList.svelte'
  import TreeSearch from './TreeSearch.svelte'
  import TreeFilePanel from './TreeFilePanel.svelte'
  import TreeVersionsModal from './TreeVersionsModal.svelte'
  import TreeContextChip from './TreeContextChip.svelte'

  let {
    volumeId,
    volume,
    forks,
  }: {
    volumeId: number
    volume: Volume | null
    forks: Fork[]
  } = $props()

  const PAGE_SIZE = 20

  // ── URL-backed state ────────────────────────────────────────────────
  const params = $derived($page.url.searchParams)
  const forkName = $derived(params.get('fork') ?? MAIN_FORK)
  const path = $derived(normalisePath(params.get('path') ?? '/'))
  const asOf = $derived.by(() => {
    const v = params.get('asof')
    if (!v) return null
    const n = Number(v)
    return Number.isFinite(n) && n > 0 ? n : null
  })
  const q = $derived(params.get('q') ?? '')
  const exact = $derived(params.get('exact') === '1')

  // URL stores asof in ms (human-readable, matches Date.now() conventions);
  // backend tree APIs operate in microseconds (matching mtime/ctime).
  function asOfMicros(): number | undefined {
    return asOf != null ? asOf * 1000 : undefined
  }

  function normalisePath(p: string): string {
    if (!p || p === '') return '/'
    const collapsed = p.replace(/\/+/g, '/')
    if (collapsed === '/') return '/'
    return collapsed.replace(/\/$/, '')
  }

  // Path / fork / asOf transitions push a new entry so browser Back unwinds the
  // traversal as operators expect. Search text edits stay in-place to avoid
  // littering history with every keystroke.
  function updateUrl(next: Record<string, string | number | null>, opts: { replace?: boolean } = {}) {
    const sp = new URLSearchParams($page.url.searchParams)
    for (const [k, v] of Object.entries(next)) {
      if (v == null || v === '') sp.delete(k)
      else sp.set(k, String(v))
    }
    goto(`?${sp.toString()}`, { replaceState: opts.replace === true, noScroll: true, keepFocus: true })
  }

  // ── Fork picker options (active forks) ──────────────────────────────
  const forkOptions = $derived([
    { value: MAIN_FORK, label: MAIN_FORK },
    ...forks.filter(f => f.status === 'active' && f.name !== MAIN_FORK).map(f => ({ value: f.name, label: f.name })),
  ])

  // ── Directory listing state ─────────────────────────────────────────
  let entries = $state<ForkTreeEntry[]>([])
  let cursor = $state<number | null>(null)
  let loading = $state(false)
  let loadingMore = $state(false)
  let listError = $state<string | null>(null)
  let listCtrl: AbortController | null = null

  async function loadDir(append: boolean) {
    if (!volume) return
    if (listCtrl) listCtrl.abort()
    listCtrl = new AbortController()
    if (append) loadingMore = true
    else { loading = true; entries = []; cursor = null; listError = null }
    try {
      const res = await api.volumeForkTrees.list(volumeId, forkName, {
        path,
        asOf: asOfMicros(),
        cursor: append ? (cursor ?? undefined) : undefined,
        limit: PAGE_SIZE,
      }, listCtrl.signal)
      entries = append ? [...entries, ...res.items] : res.items
      cursor = res.nextCursor
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      listError = e instanceof ApiError ? e.message : 'Failed to load directory'
      if (!append) entries = []
    } finally {
      if (append) loadingMore = false
      else loading = false
    }
  }

  // Trigger on (volumeId, forkName, path, asOf) changes.
  $effect(() => {
    void volumeId; void forkName; void path; void asOf
    if (!volume) return
    void loadDir(false)
  })

  // ── Search state ────────────────────────────────────────────────────
  let searchDraft = $state('')
  let searchExact = $state(false)
  let searchResults = $state<ForkTreeMatch[]>([])
  let searchCursor = $state<number | null>(null)
  let searchLoading = $state(false)
  let searchLoadingMore = $state(false)
  let searchError = $state<string | null>(null)
  let searchOpen = $state(false)
  let searchInputEl: HTMLInputElement | null = $state(null)
  let searchCtrl: AbortController | null = null

  // Mirror q/exact into draft state only when they actually change, not on
  // every params object reshuffle. Without the lastSynced* trackers, edits
  // to fork / path / asOf would clobber an in-progress draft because the
  // effect would re-fire and reassign searchDraft = q.
  let lastSyncedQ = $state('')
  let lastSyncedExact = $state(false)
  $effect(() => {
    if (q !== lastSyncedQ) {
      searchDraft = q
      lastSyncedQ = q
    }
  })
  $effect(() => {
    if (exact !== lastSyncedExact) {
      searchExact = exact
      lastSyncedExact = exact
    }
  })
  // Auto-expand search row whenever there's an active query.
  $effect(() => { if (q) searchOpen = true })

  const searchActive = $derived(q.length > 0)

  async function runSearch(append: boolean) {
    if (!volume || !q) return
    if (searchCtrl) searchCtrl.abort()
    searchCtrl = new AbortController()
    if (append) searchLoadingMore = true
    else { searchLoading = true; searchResults = []; searchCursor = null; searchError = null }
    try {
      const res = await api.volumeForkSearches.find(volumeId, forkName, {
        q,
        path,
        asOf: asOfMicros(),
        exact,
        cursor: append ? (searchCursor ?? undefined) : undefined,
        limit: PAGE_SIZE,
      }, searchCtrl.signal)
      searchResults = append ? [...searchResults, ...res.items] : res.items
      searchCursor = res.nextCursor
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      searchError = e instanceof ApiError ? e.message : 'Search failed'
      if (!append) searchResults = []
    } finally {
      if (append) searchLoadingMore = false
      else searchLoading = false
    }
  }

  // Coalesce rapid (fork, path, asOf, q, exact) changes into a single fetch.
  const debouncedSearch = debounce(() => { void runSearch(false) }, 120)
  $effect(() => {
    void volumeId; void forkName; void path; void asOf; void q; void exact
    if (q) debouncedSearch()
    else { searchResults = []; searchCursor = null; searchError = null }
  })

  function submitSearch() {
    const trimmed = searchDraft.trim()
    if (!trimmed) return
    // Searching is an exploration step; keep it in history so Back unwinds.
    updateUrl({ q: trimmed, exact: searchExact ? '1' : null })
  }
  function clearSearch() {
    searchDraft = ''
    updateUrl({ q: null, exact: null }, { replace: true })
  }
  function pickSearchResult(m: ForkTreeMatch) {
    if (m.kind === 'dir' || m.kind === 'directory') {
      updateUrl({ path: m.path, q: null, exact: null })
      searchOpen = false
    } else {
      const parent = m.path.replace(/\/[^/]+$/, '') || '/'
      updateUrl({ path: parent, q: null, exact: null })
      searchOpen = false
      // Use inode for the detail lookup; search results may carry a path
      // built from a partial parent walk (orphan rows), so a path-based
      // re-resolve would 404. Inode is the stable identifier.
      void openDetailByInode(m.inode, m.path)
    }
  }

  function toggleSearch() {
    searchOpen = !searchOpen
    if (searchOpen) requestAnimationFrame(() => searchInputEl?.focus())
  }

  // Keyboard shortcuts:
  //   `/`         focus search
  //   Backspace   pop to parent directory (when not editing an input)
  function handleGlobalKey(e: KeyboardEvent) {
    const target = e.target as HTMLElement | null
    const editing = !!(target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable))
    if (e.key === '/' && !editing) {
      e.preventDefault()
      searchOpen = true
      requestAnimationFrame(() => searchInputEl?.focus())
      return
    }
    if (e.key === 'Backspace' && !editing && !panelOpen && !versionsOpen && path !== '/') {
      e.preventDefault()
      const parent = path.replace(/\/[^/]+$/, '') || '/'
      updateUrl({ path: parent })
    }
  }

  // ── Entry navigation ────────────────────────────────────────────────
  function enterDir(entry: ForkTreeEntry) {
    const next = path === '/' ? '/' + entry.name : path + '/' + entry.name
    updateUrl({ path: next })
  }
  function selectFile(entry: ForkTreeEntry) {
    const full = path === '/' ? '/' + entry.name : path + '/' + entry.name
    void openDetailByPath(full)
  }
  function selectBreadcrumb(p: string) { updateUrl({ path: p }) }

  function changeFork(value: string) {
    // Clamp asOf into the new fork's retention window. If the previous
    // timestamp lives outside it, drop to Live and tell the operator
    // why (avoids a backend 4xx and a confusing "Failed to load directory").
    const next: Record<string, string | number | null> = { fork: value === MAIN_FORK ? null : value, path: '/' }
    if (asOf != null && volume) {
      const minMs = Math.max(gcFloorMs(volume, forks), forkAnchorFloorMs(forks, value))
      const maxMs = Math.floor(Date.now() / 60_000) * 60_000
      if (asOf < minMs || asOf > maxMs) {
        next.asof = null
        showSuccessToast(`Switched to live on ${value}: previous timestamp is outside this fork's retention window.`)
      }
    }
    updateUrl(next)
    closePanel()
  }
  function changeAsOf(next: number | null) { updateUrl({ asof: next ?? null }) }

  // ── File detail panel ───────────────────────────────────────────────
  let panelOpen = $state(false)
  let panelPath = $state('')
  let detail = $state<ForkEntryDetail | null>(null)
  let detailLoading = $state(false)
  let detailError = $state<string | null>(null)
  let detailCtrl: AbortController | null = null

  // Last identifier used to open the detail panel; retry replays whichever
  // mode opened the panel (path for breadcrumb nav, inode for search picks).
  let panelInode = $state(0)

  async function fetchDetail(p: string, inode: number) {
    if (!volume) return
    if (detailCtrl) detailCtrl.abort()
    detailCtrl = new AbortController()
    panelOpen = true
    panelPath = p
    panelInode = inode
    detailLoading = true
    detail = null
    detailError = null
    try {
      detail = await api.volumeForkEntries.get(volumeId, forkName, p, inode, asOfMicros() ?? 0, detailCtrl.signal)
      // Backend reconstructs path from inode walk when path is empty; sync
      // panelPath so breadcrumbs/version-modal use the resolved value.
      if (!p && detail?.path) panelPath = detail.path
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      detailError = e instanceof ApiError ? e.message : 'Failed to load entry'
    } finally {
      detailLoading = false
    }
  }
  async function openDetailByPath(p: string) { await fetchDetail(p, 0) }
  async function openDetailByInode(inode: number, hintPath: string) { await fetchDetail(hintPath || '', inode) }
  function retryDetail() {
    if (panelInode > 0) void openDetailByInode(panelInode, panelPath)
    else if (panelPath) void openDetailByPath(panelPath)
  }
  function closePanel() {
    if (detailCtrl) detailCtrl.abort()
    panelOpen = false
    detail = null
    detailError = null
  }

  // ── Versions modal ──────────────────────────────────────────────────
  let versionsOpen = $state(false)
  let versions = $state<ForkEntryVersion[]>([])
  let versionsCursor = $state<number | null>(null)
  let versionsLoading = $state(false)
  let versionsLoadingMore = $state(false)
  let versionsError = $state<string | null>(null)
  let versionsCtrl: AbortController | null = null

  async function loadVersions(append: boolean) {
    if (!volume || !panelPath) return
    if (versionsCtrl) versionsCtrl.abort()
    versionsCtrl = new AbortController()
    if (append) versionsLoadingMore = true
    else { versionsLoading = true; versions = []; versionsCursor = null; versionsError = null }
    try {
      const res = await api.volumeForkEntries.versions(volumeId, forkName, {
        path: panelPath,
        cursor: append ? (versionsCursor ?? undefined) : undefined,
        limit: PAGE_SIZE,
      }, versionsCtrl.signal)
      versions = append ? [...versions, ...res.items] : res.items
      versionsCursor = res.nextCursor
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      versionsError = e instanceof ApiError ? e.message : 'Failed to load versions'
    } finally {
      if (append) versionsLoadingMore = false
      else versionsLoading = false
    }
  }
  function openVersions() {
    versionsOpen = true
    void loadVersions(false)
  }
  function retryVersions() { void loadVersions(false) }

  onDestroy(() => {
    listCtrl?.abort()
    searchCtrl?.abort()
    detailCtrl?.abort()
    versionsCtrl?.abort()
  })
</script>

<svelte:window onkeydown={handleGlobalKey} />

<Card cornerBrackets>
  <CardHeader class="space-y-3">
    <!-- Row 1: title + context controls -->
    <div class="flex items-start justify-between flex-wrap gap-3">
      <CardTitle class="shrink-0">Tree</CardTitle>
      <div class="flex items-start gap-2 flex-wrap justify-end">
        <ForkPicker
          options={forkOptions}
          value={forkName}
          placeholder="Fork"
          onchange={(v) => changeFork(v ?? MAIN_FORK)} />
        <TimezonePicker />
        <TreeTimePicker
          {volume}
          {forks}
          {forkName}
          {asOf}
          onchange={changeAsOf} />
      </div>
    </div>

    <!-- Row 2: breadcrumb + (snapshot mode badge) + search trigger -->
    <div class="flex items-center justify-between gap-2 flex-wrap border-t border-border/30 pt-3">
      <div class="flex items-center gap-2 min-w-0 flex-wrap">
        <TreeBreadcrumb {path} onselect={selectBreadcrumb} />
        {#if asOf != null}
          <TreeContextChip {forkName} {asOf} />
        {/if}
      </div>
      <Button
        variant={searchOpen || searchActive ? 'primary' : 'outline'}
        size="sm"
        class="gap-1.5 min-h-[44px] sm:min-h-9"
        aria-expanded={searchOpen}
        aria-controls="tree-search-row"
        onclick={toggleSearch}>
        <SearchIcon class="h-3.5 w-3.5" aria-hidden="true" />
        Search
        <kbd class="ml-1 text-[10px] opacity-70 font-mono">/</kbd>
      </Button>
    </div>
  </CardHeader>

  <CardContent class="space-y-3">
    {#if searchOpen}
      <div id="tree-search-row">
        <TreeSearch
          bind:draft={searchDraft}
          bind:exact={searchExact}
          bind:inputEl={searchInputEl}
          active={searchActive}
          results={searchResults}
          loading={searchLoading}
          hasMore={searchCursor != null}
          loadingMore={searchLoadingMore}
          error={searchError}
          onsubmit={submitSearch}
          onclear={clearSearch}
          onpick={pickSearchResult}
          onloadMore={() => runSearch(true)}
          onretry={() => runSearch(false)} />
      </div>
    {/if}

    {#if listError}
      <div class="rounded-sm border border-destructive/40 bg-destructive/10 px-3 py-2 flex items-start justify-between gap-2">
        <p class="text-sm text-destructive">{listError}</p>
        <Button variant="outline" size="sm" onclick={() => loadDir(false)} class="min-h-[44px] sm:min-h-9 shrink-0">Retry</Button>
      </div>
    {/if}

    <TreeList
      {entries}
      {loading}
      hasMore={cursor != null}
      {loadingMore}
      onenter={enterDir}
      onselect={selectFile}
      onloadMore={() => loadDir(true)} />
  </CardContent>
</Card>

<TreeFilePanel
  bind:open={panelOpen}
  {detail}
  loading={detailLoading}
  error={detailError}
  {forkName}
  {asOf}
  onclose={closePanel}
  onretry={retryDetail}
  onversions={openVersions} />

<TreeVersionsModal
  bind:open={versionsOpen}
  path={panelPath}
  {versions}
  loading={versionsLoading}
  hasMore={versionsCursor != null}
  loadingMore={versionsLoadingMore}
  error={versionsError}
  onloadMore={() => loadVersions(true)}
  onretry={retryVersions} />
