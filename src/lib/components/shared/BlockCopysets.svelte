<script lang="ts">
  // Copyset/server-aware view rendered on the storage detail page. Self-fetches; owns the
  // 15s poll loop while any copyset is draining. "Copyset servers" (default) and "Volumes"
  // sit in tabs, reusing the shared Tabs primitive.
  import { onDestroy } from 'svelte'
  import * as Tabs from '$lib/components/ui/tabs'
  import { Button } from '$lib/components/ui/button'
  import NodeGrid from '$lib/components/shared/NodeGrid.svelte'
  import ServersList from '$lib/components/shared/ServersList.svelte'
  import StorageVolumes from '$lib/components/shared/StorageVolumes.svelte'
  import { useStorages } from '$lib/core/stores/storages.svelte'
  import { api } from '$lib/core/stores/client.svelte'
  import { groupNodesByVolume } from '$lib/core/utils/nodes'
  import type { Copyset, BlockVolume, ServiceNode } from '$lib/core/api/types'
  import RefreshCw from '@lucide/svelte/icons/refresh-cw'

  // Matches the reconciler's actual shipped tick, copysetDrainReconcilerInterval.
  const POLL_INTERVAL_MS = 15_000

  let {
    storageId, regionId, accountId, directAccess = false, canUpdate, volumesRefreshKey = 0,
    addServerOpen = $bindable(false),
  }: {
    storageId: number
    regionId: number
    accountId: number
    directAccess?: boolean
    canUpdate: boolean
    // Bumped by the caller (a compatible-storage volume move) to force the Volumes tab to refetch.
    volumesRefreshKey?: number
    // Bindable: lets the storage detail page's top-level "Add Copyset" button open the
    // servers list's register dialog without duplicating its form.
    addServerOpen?: boolean
  } = $props()

  const store = useStorages()

  let copysets = $state<Copyset[]>([])
  let blockVolumesById = $state<Map<string, BlockVolume>>(new Map())
  let nodesByVolume = $state<Map<string, ServiceNode[]>>(new Map())
  let loading = $state(true)
  let error = $state(false)
  let refreshing = $state(false)
  // Set when the fast copyset-status poll's latest request failed; the copysets/topology
  // already on screen are kept as-is.
  let staleStatus = $state(false)
  // Set when the last node-discovery fetch failed; nodesByVolume keeps its last-known-good value.
  let nodesStale = $state(false)

  // Copyset-centric summary: operators think in copysets, not individual servers.
  // Detached/unpaired counts come from blockVolumesById (the source of truth for a
  // server's current membership state), not from the copysets list, since a retired
  // copyset's members are never included in `copysets` itself.
  const summary = $derived.by(() => {
    let active = 0, draining = 0, synced = 0
    for (const c of copysets) {
      if (c.state === 'active') active++
      else if (c.state === 'draining') draining++
      else if (c.state === 'synced_drained') synced++
    }
    const pairedMemberIds = new Set(copysets.flatMap(c => [c.memberA, c.memberB]).filter((id): id is string => !!id))
    let detached = 0, unpaired = 0
    for (const v of blockVolumesById.values()) {
      if (pairedMemberIds.has(v.id)) continue
      if (v.memberState === 'detached') detached++
      else if (v.isActive) unpaired++
    }
    return { copysetCount: active + draining + synced, active, draining, synced, detached, unpaired }
  })

  let activeTab = $state<'servers' | 'volumes'>('servers')

  // Sequence guards: a slower in-flight request (poll tick, mutation reload, mount) must
  // never overwrite state with an older snapshot than one that already landed.
  let copysetsSeq = 0
  let topologySeq = 0

  // Fast path: copyset status/backlog only. Polled on POLL_INTERVAL_MS while a copyset is draining.
  async function refreshCopysets(signal?: AbortSignal): Promise<void> {
    const seq = ++copysetsSeq
    try {
      const copysetList = await store.listCopysets(storageId, signal)
      if (signal?.aborted || seq !== copysetsSeq) return
      copysets = copysetList
      staleStatus = false
    } catch (err) {
      if (signal?.aborted || seq !== copysetsSeq) return
      staleStatus = true
      throw err
    }
  }

  // Slow path: pool membership + service-node topology. Fetched on mount and after any
  // mutation, not on every poll tick: this data rarely changes between drain polls.
  async function refreshTopology(signal?: AbortSignal): Promise<void> {
    const seq = ++topologySeq
    // Full pool, not just copyset members: resolves a copyset's memberA/memberB ids and
    // every server outside any copyset.
    const volumes = await store.listBlockVolumes(storageId, signal)
    if (signal?.aborted || seq !== topologySeq) return
    blockVolumesById = new Map(volumes.map(v => [v.id, v]))

    try {
      const nodes = await api.serviceNodes.list(regionId, 'blockserv', undefined, undefined, undefined, signal)
      if (signal?.aborted || seq !== topologySeq) return
      nodesByVolume = groupNodesByVolume(nodes)
      nodesStale = false
    } catch (err) {
      // Discovery hiccup: keep the last-known-good node data and flag it stale rather than
      // rendering an empty list as if there really were no nodes.
      if (signal?.aborted || seq !== topologySeq) return
      nodesStale = true
    }
  }

  async function load(signal?: AbortSignal) {
    await Promise.all([refreshCopysets(signal), refreshTopology(signal)])
  }

  let pollActive = false
  let pollHandle: ReturnType<typeof setTimeout> | undefined
  let pollAbort: AbortController | undefined

  function stopPolling() {
    pollActive = false
    if (pollHandle) { clearTimeout(pollHandle); pollHandle = undefined }
    pollAbort?.abort()
    pollAbort = undefined
  }

  function scheduleNextPoll() {
    pollHandle = setTimeout(async () => {
      pollAbort = new AbortController()
      // Also refresh topology on every tick, not just copyset status: a copyset finishing
      // its synced_drained -> retired transition detaches both its members, which only
      // refreshTopology's blockVolumesById fetch observes.
      await Promise.allSettled([refreshCopysets(pollAbort.signal), refreshTopology(pollAbort.signal)])
      if (pollActive) scheduleNextPoll()
    }, POLL_INTERVAL_MS)
  }

  // Keep polling through synced_drained too, not just draining: retirement (the
  // synced_drained -> retired transition, which also detaches both members) happens on the
  // reconciler's own schedule after draining finishes, so stopping the poll the moment
  // draining ends would miss it and leave the list showing a stale "Synced" state forever.
  $effect(() => {
    const anyInFlight = copysets.some(c => c.state === 'draining' || c.state === 'synced_drained')
    if (anyInFlight && !pollActive) {
      pollActive = true
      scheduleNextPoll()
    } else if (!anyInFlight && pollActive) {
      stopPolling()
    }
  })
  onDestroy(stopPolling)

  // Slow topology poll, independent of the drain poll above: catches a node going
  // unhealthy (killed/restarted blockserv) or a member's state changing without needing an
  // active drain. Paused while the tab is hidden.
  const TOPOLOGY_POLL_INTERVAL_MS = 30_000
  let topologyPollHandle: ReturnType<typeof setInterval> | undefined
  $effect(() => {
    topologyPollHandle = setInterval(() => {
      if (document.visibilityState === 'visible') refreshTopology().catch(() => {})
    }, TOPOLOGY_POLL_INTERVAL_MS)
    return () => clearInterval(topologyPollHandle)
  })

  $effect(() => {
    const ctrl = new AbortController()
    loading = true
    error = false
    load(ctrl.signal)
      .catch(() => { if (!ctrl.signal.aborted) error = true })
      .finally(() => { if (!ctrl.signal.aborted) loading = false })
    return () => ctrl.abort()
  })

  // The mutation call itself is never caught here: a thrown error must still reach
  // ServersList's confirm dialog, which routes it through handleApiError and skips the
  // success toast. Only the follow-up load() is caught, so a transient reload failure after
  // a mutation that actually succeeded server-side is not reported as a failed mutation;
  // refreshCopysets/refreshTopology already set staleStatus/nodesStale for the UI to show.
  async function reloadAfterMutation() {
    try {
      await load()
    } catch {
      // staleStatus/nodesStale already recorded by refreshCopysets/refreshTopology
    }
  }

  async function handleDrain(copysetId: string) {
    await store.drainCopyset(storageId, copysetId)
    await reloadAfterMutation()
  }

  async function handleCancelDrain(copysetId: string) {
    await store.cancelDrain(storageId, copysetId)
    await reloadAfterMutation()
  }

  async function handleRegisterCopyset(name: string) {
    const copyset = await store.registerCopyset(storageId, { name: name || undefined })
    await reloadAfterMutation()
    return copyset
  }

  async function handleRegisterCopysetsBulk(count: number) {
    const result = await store.registerCopysetsBulk(storageId, { count })
    await reloadAfterMutation()
    return result.copysets
  }

  async function handleRemoveMember(blockVolumeId: string) {
    await store.removeMember(storageId, blockVolumeId)
    await reloadAfterMutation()
  }
</script>

{#if loading}
  <p class="text-sm text-muted-foreground">Loading copysets…</p>
{:else if error}
  <p class="text-sm text-destructive">Failed to load copysets.</p>
{:else}
  <div class="space-y-4">
    <div class="flex items-center gap-3 flex-wrap">
      <span class="text-sm text-muted-foreground">
        <span class="font-mono font-medium text-foreground">{summary.copysetCount}</span>
        copyset{summary.copysetCount === 1 ? '' : 's'}
        {#if summary.active}· <span class="font-mono text-foreground">{summary.active}</span> active{/if}
        {#if summary.draining}· <span class="font-mono text-foreground">{summary.draining}</span> draining{/if}
        {#if summary.synced}· <span class="font-mono text-foreground">{summary.synced}</span> synced{/if}
        {#if summary.detached}· <span class="font-mono text-foreground">{summary.detached}</span> detached member{summary.detached === 1 ? '' : 's'}{/if}
        {#if summary.unpaired}· <span class="font-mono text-foreground">{summary.unpaired}</span> unpaired member{summary.unpaired === 1 ? '' : 's'}{/if}
      </span>
      <Button variant="ghost" size="sm" disabled={refreshing} onclick={() => { refreshing = true; load().finally(() => { refreshing = false }) }}>
        <RefreshCw class="h-3.5 w-3.5 {refreshing ? 'animate-spin' : ''}" />
        Refresh
      </Button>
    </div>

    <Tabs.Root bind:value={activeTab}>
      <Tabs.List>
        <Tabs.Trigger value="servers">Copyset servers</Tabs.Trigger>
        <Tabs.Trigger value="volumes">Volumes</Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="servers" class="space-y-4">
        <NodeGrid {copysets} {blockVolumesById} {nodesByVolume} {storageId} />
        <ServersList {copysets} {storageId} {blockVolumesById} {nodesByVolume} {directAccess} {canUpdate} {staleStatus} {nodesStale}
          bind:registering={addServerOpen}
          onDrain={handleDrain} onCancelDrain={handleCancelDrain}
          onRegisterCopyset={handleRegisterCopyset} onRegisterCopysetsBulk={handleRegisterCopysetsBulk}
          onRemove={handleRemoveMember} />
      </Tabs.Content>
      <Tabs.Content value="volumes">
        {#key volumesRefreshKey}
          <StorageVolumes {storageId} {accountId} />
        {/key}
      </Tabs.Content>
    </Tabs.Root>
  </div>
{/if}
