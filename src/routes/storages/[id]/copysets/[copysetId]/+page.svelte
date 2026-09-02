<script lang="ts">
  // Copyset detail page: a copyset's two members shown together,
  // each in its own tab, rather than as two disconnected node-detail visits. Reached from
  // NodeGrid's per-cell detail link and ServersList's own copyset link.
  // Self-fetches by (storageId, copysetId) so a direct link/refresh works without the caller's
  // in-memory topology. Polls copyset status on the same POLL_INTERVAL_MS as
  // BlockCopysets.svelte's list-page poll while the copyset is draining, so the backlog/elapsed
  // banner above doesn't go stale on a page the operator opened specifically to watch it.
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { useAuth } from '$lib/core/stores/auth.svelte'
  import { useStorages } from '$lib/core/stores/storages.svelte'
  import { api } from '$lib/core/stores/client.svelte'
  import { showErrorToast } from '$lib/core/utils/toast'
  import { groupNodesByVolume } from '$lib/core/utils/nodes'
  import { isCopysetState } from '$lib/core/api/copyset-ui-types'
  import { formatDuration } from '$lib/core/utils/format'
  import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card'
  import { Badge } from '$lib/components/ui/badge'
  import { Button } from '$lib/components/ui/button'
  import DetailSkeleton from '$lib/components/shared/DetailSkeleton.svelte'
  import CopysetStateBadge from '$lib/components/shared/CopysetStateBadge.svelte'
  import NodeDetail from '$lib/components/shared/NodeDetail.svelte'
  import * as Tabs from '$lib/components/ui/tabs'
  import type { Copyset, BlockVolume, ServiceNode, Storage } from '$lib/core/api/types'
  import ArrowLeft from '@lucide/svelte/icons/arrow-left'
  import TriangleAlert from '@lucide/svelte/icons/triangle-alert'

  const POLL_INTERVAL_MS = 15_000

  const storageId = $derived(Number($page.params.id))
  const copysetId = $derived($page.params.copysetId ?? '')

  const store = useStorages()
  const auth = useAuth()

  let storage = $state<Storage | null>(null)
  let copyset = $state<Copyset | null>(null)
  let blockVolumesById = $state<Map<string, BlockVolume>>(new Map())
  let nodesByVolume = $state<Map<string, ServiceNode[]>>(new Map())
  let loading = $state(true)
  let error = $state(false)

  $effect(() => {
    if (!auth.loading && !auth.can('storages', 'read')) {
      showErrorToast('Access denied')
      goto('/', { replaceState: true })
    }
  })

  // Sequence guard: a slower in-flight request (poll tick, mount) must never overwrite state
  // with an older snapshot than one that already landed. Mirrors BlockCopysets.svelte's own
  // copysetsSeq guard.
  let copysetSeq = 0

  async function refreshCopysetStatus(id: number, cid: string, signal?: AbortSignal) {
    const seq = ++copysetSeq
    const c = await store.getCopysetStatus(id, cid, signal)
    if (signal?.aborted || seq !== copysetSeq) return
    copyset = c
  }

  $effect(() => {
    const id = storageId
    const cid = copysetId
    if (Number.isNaN(id) || !cid) { loading = false; error = true; return }
    const ctrl = new AbortController()
    loading = true
    error = false
    ;(async () => {
      const [s, , volumes] = await Promise.all([
        store.getStorage(id),
        refreshCopysetStatus(id, cid, ctrl.signal),
        store.listBlockVolumes(id, ctrl.signal),
      ])
      if (ctrl.signal.aborted) return
      storage = s
      blockVolumesById = new Map(volumes.map((v) => [v.id, v]))
      const nodes = await api.serviceNodes.list(s.regionInfo.id, 'blockserv', undefined, undefined, undefined, ctrl.signal)
      if (ctrl.signal.aborted) return
      nodesByVolume = groupNodesByVolume(nodes)
    })()
      .catch(() => { if (!ctrl.signal.aborted) error = true })
      .finally(() => { if (!ctrl.signal.aborted) loading = false })
    return () => ctrl.abort()
  })

  // Keeps the draining banner's backlog/elapsed-time readout live without a manual reload.
  // Effect-scoped cleanup (rather than BlockCopysets.svelte's module-level pollActive flag)
  // so switching to a different copyset while this page stays mounted stops the old poll
  // before any new one starts, instead of leaking a poll bound to the previous copysetId.
  $effect(() => {
    const id = storageId
    const cid = copysetId
    if (loading || copyset?.state !== 'draining') return

    let active = true
    let handle: ReturnType<typeof setTimeout>
    let abort: AbortController | undefined

    const tick = async () => {
      abort = new AbortController()
      try {
        await refreshCopysetStatus(id, cid, abort.signal)
      } catch {
        // A transient poll failure just keeps the last-known-good copyset state on screen.
      }
      if (active) handle = setTimeout(tick, POLL_INTERVAL_MS)
    }
    handle = setTimeout(tick, POLL_INTERVAL_MS)

    return () => { active = false; clearTimeout(handle); abort?.abort() }
  })

  const memberA = $derived(copyset?.memberA ? blockVolumesById.get(copyset.memberA) : undefined)
  const memberB = $derived(copyset?.memberB ? blockVolumesById.get(copyset.memberB) : undefined)
  const nodesA = $derived(copyset?.memberA ? nodesByVolume.get(copyset.memberA) ?? [] : [])
  const nodesB = $derived(copyset?.memberB ? nodesByVolume.get(copyset.memberB) ?? [] : [])

  // Backlog is only a confirmed number once both members have been observed at least once;
  // a null/undefined count means "not yet observed," not zero. Mirrors ServersList's own gate.
  const backlogKnown = $derived(typeof copyset?.pendingSyncJobsA === 'number' && typeof copyset?.pendingSyncJobsB === 'number')
  const pendingTotal = $derived((copyset?.pendingSyncJobsA ?? 0) + (copyset?.pendingSyncJobsB ?? 0))

  // NodeDetail keeps its live stats/polling state in a single app-wide store (useNodes()),
  // not per-instance, so mounting both members' NodeDetail at once would have them clobber
  // each other's stats. Bits-ui keeps both Tabs.Content panels mounted (just hidden), so the
  // member markup itself is gated on the active tab to guarantee only one NodeDetail exists
  // at a time; switching tabs unmounts the old one (its own onDestroy clears the store) before
  // the new one mounts.
  let activeTab = $state('a')
</script>

<svelte:head><title>Copyset · mountOS Admin</title></svelte:head>

{#snippet memberPanel(member: BlockVolume | undefined, nodes: ServiceNode[], regionId: number)}
  {#if !member}
    <div class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
      No member assigned. This copyset is in the defensive 0/1-member edge case: treat it as
      degraded, not normally formed.
    </div>
  {:else if nodes.length === 0}
    <div class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
      No blockserv registered for {member.name || 'this member'} yet.
    </div>
  {:else}
    {#if nodes.length > 1}
      <div class="mb-4 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
        <TriangleAlert class="size-4 shrink-0" aria-hidden="true" />
        <p>{nodes.length} blockserv processes are serving {member.name || 'this member'}. Each member should have exactly one; showing the first.</p>
      </div>
    {/if}
    <NodeDetail regionId={regionId} nodeId={nodes[0].nodeId} basePath="/nodes" />
  {/if}
{/snippet}

<div class="space-y-5">
  <div class="flex items-center gap-3">
    <Button variant="ghost" size="sm" href={`/storages/${storageId}`}
      class="min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0" aria-label="Back to storage">
      <ArrowLeft class="h-4 w-4" />
    </Button>
    <div>
      <h1 class="text-xl font-bold tracking-tight">Copyset</h1>
      {#if storage}
        <a href={`/storages/${storageId}`} class="text-sm text-muted-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">{storage.name}</a>
      {/if}
    </div>
  </div>

  {#if loading}
    <DetailSkeleton cards={[{ rows: 2, cols: 2, title: false }, { rows: 6, cols: 3, title: true }]} />
  {:else if error || !copyset}
    <p class="text-sm text-destructive">Copyset not found.</p>
  {:else}
    <Card cornerBrackets>
      <CardHeader>
        <div class="flex items-center gap-3">
          <CardTitle class="min-w-0 flex-1 truncate" title={copyset.name}>{copyset.name}</CardTitle>
          {#if isCopysetState(copyset.state)}
            <CopysetStateBadge state={copyset.state} />
          {:else}
            <Badge variant="destructive" title="Unrecognized copyset state, treat as unsafe to act on">{copyset.state}</Badge>
          {/if}
        </div>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="grid gap-4 md:grid-cols-2">
          <div class="min-w-0">
            <span class="text-sm uppercase tracking-wider font-semibold text-muted-foreground">ID</span>
            <p class="mt-1 text-sm font-mono break-all">{copyset.id}</p>
          </div>
          <div>
            <span class="text-sm uppercase tracking-wider font-semibold text-muted-foreground" title="Volumes currently drawing this copyset into their working set">Volumes</span>
            <p class="mt-1 text-sm font-mono">{copyset.volumeCount}</p>
          </div>
          <div>
            <span class="text-sm uppercase tracking-wider font-semibold text-muted-foreground">Member A</span>
            <p class="mt-1 text-sm">{memberA?.name ?? '—'}</p>
          </div>
          <div>
            <span class="text-sm uppercase tracking-wider font-semibold text-muted-foreground">Member B</span>
            <p class="mt-1 text-sm">{memberB?.name ?? '—'}</p>
          </div>
        </div>

        {#if copyset.tags.length > 0}
          <div>
            <span class="text-sm uppercase tracking-wider font-semibold text-muted-foreground">Tags</span>
            <div class="mt-1 flex flex-wrap gap-1">
              {#each copyset.tags as tag (tag)}<Badge variant="outline" class="text-xs">{tag}</Badge>{/each}
            </div>
          </div>
        {/if}

        {#if copyset.state === 'draining'}
          <p class="text-sm text-warning">
            {#if backlogKnown}
              Draining. {pendingTotal} object{pendingTotal === 1 ? '' : 's'} left to sync.
            {:else}
              Draining. Sync backlog unknown.
            {/if}
            {#if copyset.drainStartedAt}Started {formatDuration(copyset.drainStartedAt)} ago.{/if}
          </p>
        {:else if copyset.state === 'synced_drained'}
          <p class="text-sm text-muted-foreground">Fully synced. Ready to retire.</p>
        {:else if copyset.state === 'retired'}
          <p class="text-sm text-muted-foreground">
            Retired. Members are detached; find them in Pool Members on the storage page to
            remove them or pair them into a different copyset.
          </p>
        {/if}
      </CardContent>
    </Card>

    {#if storage}
      <Tabs.Root bind:value={activeTab}>
        <Tabs.List>
          <Tabs.Trigger value="a">Member A{memberA?.name ? ` · ${memberA.name}` : ''}</Tabs.Trigger>
          <Tabs.Trigger value="b">Member B{memberB?.name ? ` · ${memberB.name}` : ''}</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="a">
          {#if activeTab === 'a'}
            {@render memberPanel(memberA, nodesA, storage.regionInfo.id)}
          {/if}
        </Tabs.Content>
        <Tabs.Content value="b">
          {#if activeTab === 'b'}
            {@render memberPanel(memberB, nodesB, storage.regionInfo.id)}
          {/if}
        </Tabs.Content>
      </Tabs.Root>
    {/if}
  {/if}
</div>
