<script lang="ts">
  // Unified per-server view for a block storage's copyset pool:
  // one row per registered block-volume server, whether it's currently serving a copyset
  // (paired), available capacity (unpaired), or needs reactivation (detached). Replaces the
  // earlier copyset-cards-plus-separate-pool-list split with one list, driven primarily by
  // `copysets` (for paired rows) and `blockVolumesById` (the source of truth for a server's
  // current state, including any server a retired copyset's members fell back to).
  import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card'
  import { Badge } from '$lib/components/ui/badge'
  import { Button } from '$lib/components/ui/button'
  import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '$lib/components/ui/table'
  import * as Dialog from '$lib/components/ui/dialog'
  import { Input } from '$lib/components/ui/input'
  import Label from '$lib/components/ui/label/label.svelte'
  import { Select } from '$lib/components/ui/select'
  import CopysetStateBadge from '$lib/components/shared/CopysetStateBadge.svelte'
  import ConfirmDialog from '$lib/components/shared/ConfirmDialog.svelte'
  import { useConfirmDialog } from '$lib/stores/confirm-dialog.svelte'
  import { nodeStatusVariant } from '$lib/core/utils/format'
  import { copyText } from '$lib/core/utils/clipboard'
  import { showSuccessToast, showErrorToast, handleApiError } from '$lib/core/utils/toast'
  import { isCopysetState } from '$lib/core/api/copyset-ui-types'
  import type { Copyset, CopysetState, BlockVolume, ServiceNode } from '$lib/core/api/types'
  import Plus from '@lucide/svelte/icons/plus'
  import CopyIcon from '@lucide/svelte/icons/copy'
  import MapPinIcon from '@lucide/svelte/icons/map-pin'
  import TriangleAlert from '@lucide/svelte/icons/triangle-alert'
  import ArrowUpRight from '@lucide/svelte/icons/arrow-up-right'

  let {
    copysets, storageId, blockVolumesById, nodesByVolume, directAccess = false, canUpdate,
    staleStatus = false, nodesStale = false, clusterOptions, registering = $bindable(false),
    onDrain, onCancelDrain, onReactivate, onRegister, onRemove,
  }: {
    copysets: Copyset[]
    storageId: number
    blockVolumesById: Map<string, BlockVolume>
    nodesByVolume: Map<string, ServiceNode[]>
    directAccess?: boolean
    canUpdate: boolean
    // Set by the caller when its own poll loop's last refresh failed (spec §5).
    staleStatus?: boolean
    // Set by the caller when its last service-node discovery fetch failed.
    nodesStale?: boolean
    clusterOptions: { value: string; label: string }[]
    // Bindable so a page-level "Add Server" action can open this same dialog without
    // duplicating the form (see the storage detail page's top-level action row).
    registering?: boolean
    onDrain: (copysetId: string) => Promise<void>
    onCancelDrain: (copysetId: string) => Promise<void>
    onReactivate: (blockVolumeId: string) => Promise<unknown>
    onRegister: (name: string, regionClusterId: number) => Promise<unknown>
    // Permanently deregisters a detached member (server-side guards this to
    // member_state='detached' - never a paired/draining member).
    onRemove: (blockVolumeId: string) => Promise<unknown>
  } = $props()

  interface ServerRow {
    id: string
    name: string
    cluster: string
    clusterUuid?: string
    servers: ServiceNode[]
    copysetId?: string
    copysetState?: CopysetState
    pendingSyncJobs?: number
    placementGroup?: number
    detached: boolean
  }

  // Retired copysets contribute no rows of their own: a retired copyset's members are already
  // reflected as detached servers via blockVolumesById, which is the authoritative source
  // for a server's current state. Rendering the retired Copyset record too would show the same
  // server twice under two different framings.
  const rows = $derived.by((): ServerRow[] => {
    const list: ServerRow[] = []
    const seen = new Set<string>()

    function pushMember(volumeId: string | undefined, copyset: Copyset, placementGroup: number | undefined, pendingSyncJobs: number | undefined) {
      if (!volumeId) return
      seen.add(volumeId)
      const vol = blockVolumesById.get(volumeId)
      list.push({
        id: volumeId,
        name: vol?.name || volumeId,
        cluster: vol?.clusterName || (vol ? `cluster ${vol.regionClusterId}` : ''),
        clusterUuid: vol?.clusterUuid,
        servers: nodesByVolume.get(volumeId) ?? [],
        copysetId: copyset.id,
        copysetState: copyset.state,
        pendingSyncJobs,
        placementGroup,
        detached: false,
      })
    }

    for (const copyset of copysets) {
      if (copyset.state === 'retired') continue
      pushMember(copyset.memberA, copyset, copyset.placementGroupA, copyset.pendingSyncJobsA)
      pushMember(copyset.memberB, copyset, copyset.placementGroupB, copyset.pendingSyncJobsB)
    }
    for (const vol of blockVolumesById.values()) {
      if (seen.has(vol.id)) continue
      list.push({
        id: vol.id,
        name: vol.name || vol.id,
        cluster: vol.clusterName || `cluster ${vol.regionClusterId}`,
        clusterUuid: vol.clusterUuid,
        servers: nodesByVolume.get(vol.id) ?? [],
        detached: vol.memberState === 'detached',
      })
    }
    return list
  })

  const dialog = useConfirmDialog()

  let name = $state('')
  let regionClusterId = $state('')
  let submitting = $state(false)
  let reactivatingId = $state<string | null>(null)
  let removingId = $state<string | null>(null)

  const canRegister = $derived(!!name.trim() && !!regionClusterId)

  // Resets the form on every open, regardless of which entry point triggered it.
  $effect(() => {
    if (registering) { name = ''; regionClusterId = '' }
  })

  function startRegister() {
    registering = true
  }

  async function handleRegister(e: Event) {
    e.preventDefault()
    if (!canRegister) return
    submitting = true
    try {
      await onRegister(name.trim(), Number(regionClusterId))
      registering = false
      showSuccessToast('Server registered')
    } catch (err: unknown) {
      handleApiError(err, 'Failed to register server')
    } finally {
      submitting = false
    }
  }

  async function handleReactivate(row: ServerRow) {
    reactivatingId = row.id
    try {
      await onReactivate(row.id)
      showSuccessToast(`${row.name} reactivated`)
    } catch (err: unknown) {
      handleApiError(err, 'Failed to reactivate server')
    } finally {
      reactivatingId = null
    }
  }

  async function doRemove(row: ServerRow) {
    removingId = row.id
    try {
      await onRemove(row.id)
      showSuccessToast(`${row.name} removed`)
    } catch (err: unknown) {
      handleApiError(err, 'Failed to remove server')
    } finally {
      removingId = null
    }
  }

  function handleRemoveClick(row: ServerRow) {
    dialog.confirm(
      'Remove this server?',
      `This permanently deregisters ${row.name} from the pool. It won't be reactivatable afterward - register it again if you need it back.`,
      () => doRemove(row),
      'destructive',
      'Remove',
    )
  }

  function handleDrainClick(row: ServerRow) {
    const copysetId = row.copysetId
    if (!copysetId) return
    dialog.confirm(
      'Drain this copyset',
      'This action stops new writes to the copyset now. The copyset keeps serving reads until all its data is confirmed in object storage. This can take a long time. You can cancel the drain before it finishes.',
      async () => {
        await onDrain(copysetId)
        showSuccessToast('Drain started. Watch this copyset’s status for progress.')
      },
      'default',
      'Start drain',
    )
  }

  function handleCancelClick(row: ServerRow) {
    const copysetId = row.copysetId
    if (!copysetId) return
    dialog.confirm(
      'Cancel this drain?',
      'The copyset goes back to active. New writes resume immediately.',
      async () => {
        await onCancelDrain(copysetId)
        showSuccessToast('Drain cancelled. Copyset is active again.')
      },
      'default',
      'Cancel drain',
    )
  }

  async function copyValue(value: string, label: string) {
    if (await copyText(value)) {
      showSuccessToast(`${label} copied`)
    } else {
      showErrorToast('Copy failed: clipboard access blocked')
    }
  }
</script>

{#snippet servingBadges(row: ServerRow)}
  {#if row.servers.length === 0}
    <span class="text-xs text-muted-foreground">No blockserv registered</span>
  {:else}
    <span class="inline-flex flex-wrap items-center gap-1">
      {#if row.servers.length > 1}
        <span class="inline-flex items-center">
          <TriangleAlert class="size-3.5 text-destructive shrink-0" aria-hidden="true" title={`${row.servers.length} blockserv processes are serving this server; each server should have exactly one`} />
          <span class="sr-only">{`${row.servers.length} blockserv processes are serving this server; each server should have exactly one`}</span>
        </span>
      {/if}
      {#each row.servers as n (n.nodeId)}
        {@const unsynced = n.metadata?.['unsynced_objects']}
        {@const drainReady = n.metadata?.['drain_ready'] === true}
        <a href={`/nodes/${n.regionId}/${n.nodeId}`}
          class="inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-xs hover:border-primary hover:text-primary transition-colors">
          <span class="font-mono truncate max-w-[8rem]" title={n.nodeId}>{n.nodeId}</span>
          <Badge variant={nodeStatusVariant(n.status)} class="text-xs px-1 py-0">{n.status}</Badge>
          {#if directAccess}
            {#if drainReady}
              <Badge variant="outline" class="text-xs px-1 py-0" title="Fully synced and no active clients: safe to stop for maintenance">drain&#8209;ready</Badge>
            {:else if typeof unsynced === 'number' && unsynced > 0}
              <Badge variant="warning" class="text-xs px-1 py-0" title="Objects not yet synced to object storage: do not stop this instance until synced">{unsynced} unsynced</Badge>
            {/if}
          {/if}
        </a>
      {/each}
    </span>
  {/if}
{/snippet}

<Card cornerBrackets={false} id="pool-members">
  <CardHeader>
    <div class="flex items-center justify-between gap-3">
      <CardTitle class="text-base">Servers</CardTitle>
      {#if canUpdate}
        <Button variant="outline" size="sm" class="gap-1.5" onclick={startRegister} disabled={clusterOptions.length === 0}>
          <Plus class="size-4" aria-hidden="true" /> Add server
        </Button>
      {/if}
    </div>
  </CardHeader>
  <CardContent class="space-y-3">
    {#if staleStatus}
      <p class="text-xs text-destructive">Can't confirm copyset status right now. Showing the last-known state.</p>
    {/if}
    {#if nodesStale}
      <p class="text-xs text-destructive">Can't confirm blockserv node data right now. Showing the last-known servers.</p>
    {/if}
    {#if rows.length === 0}
      <p class="text-sm text-muted-foreground">No servers registered for this storage yet.</p>
    {:else}
      <Table containerLabel="Servers">
        <TableHeader>
          <TableRow>
            <TableHead class="th-cyber">Server</TableHead>
            <TableHead class="th-cyber hidden md:table-cell">Placement</TableHead>
            <TableHead class="th-cyber">State</TableHead>
            <TableHead class="th-cyber">Serving blockserv</TableHead>
            {#if canUpdate}<TableHead class="th-cyber text-right">Actions</TableHead>{/if}
          </TableRow>
        </TableHeader>
        <TableBody>
          {#each rows as row (row.id)}
            <TableRow id={row.copysetId ? `copyset-${row.copysetId}` : undefined}>
              <TableCell>
                <div class="flex items-center gap-1.5">
                  <span class="font-medium">{row.name}</span>
                  <button type="button" onclick={() => copyValue(row.id, 'Server ID')}
                    class="inline-flex items-center justify-center min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 opacity-50 hover:opacity-100 hover:text-primary transition-opacity"
                    title="Copy BLOCK_VOLUME_ID" aria-label={`Copy ID for ${row.name}`}>
                    <CopyIcon class="size-3" aria-hidden="true" />
                  </button>
                  {#if row.clusterUuid}
                    <button type="button" onclick={() => copyValue(row.clusterUuid ?? '', 'Region cluster ID')}
                      class="inline-flex items-center justify-center min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 opacity-50 hover:opacity-100 hover:text-primary transition-opacity"
                      title="Copy REGION_CLUSTER_ID" aria-label={`Copy region cluster ID for ${row.name}`}>
                      <MapPinIcon class="size-3" aria-hidden="true" />
                    </button>
                  {/if}
                </div>
              </TableCell>
              <TableCell class="hidden md:table-cell text-sm text-muted-foreground">
                {row.cluster || '·'}
                {#if row.placementGroup !== undefined}<Badge variant="outline" class="ml-1 text-xs">pg {row.placementGroup}</Badge>{/if}
              </TableCell>
              <TableCell>
                {#if row.copysetId && row.copysetState}
                  {#if isCopysetState(row.copysetState)}
                    <CopysetStateBadge state={row.copysetState} />
                  {:else}
                    <Badge variant="destructive">{row.copysetState}</Badge>
                  {/if}
                  <a href={`/storages/${storageId}/copysets/${row.copysetId}`}
                    class="ml-1.5 inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-primary hover:underline">
                    {row.copysetId}<ArrowUpRight class="size-3" aria-hidden="true" />
                  </a>
                  {#if row.copysetState === 'draining'}
                    <p class="text-xs text-warning mt-0.5">
                      {typeof row.pendingSyncJobs === 'number' ? `${row.pendingSyncJobs} pending` : 'backlog unknown'}
                    </p>
                  {/if}
                {:else if row.detached}
                  <Badge variant="secondary">Detached</Badge>
                {:else}
                  <Badge variant="outline">Unpaired</Badge>
                {/if}
              </TableCell>
              <TableCell>{@render servingBadges(row)}</TableCell>
              {#if canUpdate}
                <TableCell class="text-right [&_[data-slot=button]]:min-h-[44px] sm:[&_[data-slot=button]]:min-h-8">
                  {#if row.copysetId && row.copysetState === 'active'}
                    <Button variant="outline" size="sm" onclick={() => handleDrainClick(row)}>Drain</Button>
                  {:else if row.copysetId && row.copysetState === 'draining'}
                    <Button variant="outline" size="sm" onclick={() => handleCancelClick(row)}>Cancel drain</Button>
                  {:else if row.detached}
                    <div class="inline-flex items-center gap-1.5">
                      <Button variant="outline" size="sm" disabled={reactivatingId === row.id || removingId === row.id} onclick={() => handleReactivate(row)}>
                        {reactivatingId === row.id ? 'Reactivating...' : 'Reactivate'}
                      </Button>
                      <Button variant="outline" size="sm" class="text-destructive hover:text-destructive"
                        disabled={reactivatingId === row.id || removingId === row.id} onclick={() => handleRemoveClick(row)}>
                        {removingId === row.id ? 'Removing...' : 'Remove'}
                      </Button>
                    </div>
                  {/if}
                </TableCell>
              {/if}
            </TableRow>
          {/each}
        </TableBody>
      </Table>
    {/if}
  </CardContent>
</Card>

<Dialog.Root bind:open={registering} onOpenChange={(v) => { if (!v) submitting = false }}>
  <Dialog.Content class="sm:max-w-sm">
    <Dialog.Header>
      <Dialog.Title>Add Server</Dialog.Title>
      <Dialog.Description>
        Registers a new block server for this storage. Raise the copyset count to form a
        copyset from it.
      </Dialog.Description>
    </Dialog.Header>
    <form onsubmit={handleRegister} class="space-y-5">
      <div class="space-y-2">
        <Label for="register-server-name">Name</Label>
        <Input id="register-server-name" bind:value={name} placeholder="e.g. replica-3" autocomplete="off" required />
      </div>
      <div class="space-y-2">
        <Label id="register-server-cluster-label" for="register-server-cluster">Availability / placement</Label>
        <Select id="register-server-cluster" ariaLabelledby="register-server-cluster-label"
          bind:value={regionClusterId} placeholder="Select cluster..." options={clusterOptions} />
      </div>
      <Dialog.Footer class="gap-2">
        <Button variant="secondary" type="button" onclick={() => registering = false} disabled={submitting}>Cancel</Button>
        <Button variant="primary" type="submit" class="cyberpunk-skewed-sm" disabled={submitting || !canRegister}>
          {submitting ? 'Registering...' : 'Register'}
        </Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>

<ConfirmDialog bind:open={dialog.open} title={dialog.title} description={dialog.desc} variant={dialog.variant} confirmLabel={dialog.confirmLabel} onConfirm={dialog.action} />
