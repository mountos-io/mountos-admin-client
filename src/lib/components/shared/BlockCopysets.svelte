<script lang="ts">
  // Copyset/server-aware view rendered on the storage detail page. Self-fetches; owns the
  // 15s poll loop while any copyset is draining. "Copyset servers" (default) and "Volumes"
  // sit in tabs, reusing the shared Tabs primitive.
  import { onDestroy } from 'svelte'
  import * as Tabs from '$lib/components/ui/tabs'
  import NodeGrid from '$lib/components/shared/NodeGrid.svelte'
  import ServersList from '$lib/components/shared/ServersList.svelte'
  import StorageVolumes from '$lib/components/shared/StorageVolumes.svelte'
  import { useStorages } from '$lib/core/stores/storages.svelte'
  import { api } from '$lib/core/stores/client.svelte'
  import { groupNodesByVolume } from '$lib/core/utils/nodes'
  import type { Copyset, BlockVolume, ServiceNode } from '$lib/core/api/types'

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
  // Set when the fast copyset-status poll's latest request failed; the copysets/topology
  // already on screen are kept as-is.
  let staleStatus = $state(false)
  // Set when the last node-discovery fetch failed; nodesByVolume keeps its last-known-good value.
  let nodesStale = $state(false)

  // Live count of currently-active registered servers.
  const activeServerCount = $derived(Array.from(blockVolumesById.values()).filter(v => v.isActive).length)

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
      try {
        await refreshCopysets(pollAbort.signal)
      } catch {
        // staleStatus already recorded by refreshCopysets
      }
      if (pollActive) scheduleNextPoll()
    }, POLL_INTERVAL_MS)
  }

  $effect(() => {
    const anyDraining = copysets.some(c => c.state === 'draining')
    if (anyDraining && !pollActive) {
      pollActive = true
      scheduleNextPoll()
    } else if (!anyDraining && pollActive) {
      stopPolling()
    }
  })
  onDestroy(stopPolling)

  $effect(() => {
    const ctrl = new AbortController()
    loading = true
    error = false
    load(ctrl.signal)
      .catch(() => { if (!ctrl.signal.aborted) error = true })
      .finally(() => { if (!ctrl.signal.aborted) loading = false })
    return () => ctrl.abort()
  })

  // No try/catch here: ServersList's confirm dialog already routes a thrown error through
  // handleApiError and skips the success toast: catching here too would double-toast.
  async function handleDrain(copysetId: string) {
    await store.drainCopyset(storageId, copysetId)
    await load()
  }

  async function handleCancelDrain(copysetId: string) {
    await store.cancelDrain(storageId, copysetId)
    await load()
  }

  async function handleRegisterCopyset(name: string) {
    const copyset = await store.registerCopyset(storageId, { name: name || undefined })
    await load()
    return copyset
  }

  async function handleRegisterCopysetsBulk(count: number) {
    const result = await store.registerCopysetsBulk(storageId, { count })
    await load()
    return result.copysets
  }

  async function handleReactivateMember(blockVolumeId: string) {
    await store.reactivateMember(storageId, blockVolumeId)
    await load()
  }

  async function handleRemoveMember(blockVolumeId: string) {
    await store.removeMember(storageId, blockVolumeId)
    await load()
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
        <span class="font-mono font-medium text-foreground">{activeServerCount}</span>
        server{activeServerCount === 1 ? '' : 's'} registered
      </span>
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
          onDrain={handleDrain} onCancelDrain={handleCancelDrain} onReactivate={handleReactivateMember}
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
