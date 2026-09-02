<script lang="ts">
  // Unified per-server view for a block storage's copyset pool:
  // one row per registered block-volume server, whether it's currently serving a copyset
  // (paired) or unpaired (detached, awaiting removal or a fresh pairing). Driven primarily
  // by `copysets` (for paired rows) and `blockVolumesById` (the source of truth for a
  // server's current state, including any server a retired copyset's members fell back to).
  import { tick } from 'svelte'
  import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card'
  import { Badge } from '$lib/components/ui/badge'
  import { Button } from '$lib/components/ui/button'
  import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '$lib/components/ui/table'
  import * as Dialog from '$lib/components/ui/dialog'
  import { Input } from '$lib/components/ui/input'
  import Label from '$lib/components/ui/label/label.svelte'
  import CopysetStateBadge from '$lib/components/shared/CopysetStateBadge.svelte'
  import ConfirmDialog from '$lib/components/shared/ConfirmDialog.svelte'
  import HowItWorks from '$lib/components/shared/HowItWorks.svelte'
  import { useConfirmDialog } from '$lib/stores/confirm-dialog.svelte'
  import { nodeStatusVariant } from '$lib/core/utils/format'
  import { nodeConverging } from '$lib/core/utils/node-health'
  import { copyText } from '$lib/core/utils/clipboard'
  import { showSuccessToast, showErrorToast, handleApiError } from '$lib/core/utils/toast'
  import { isCopysetState } from '$lib/core/api/copyset-ui-types'
  import type { Copyset, CopysetState, BlockVolume, ServiceNode } from '$lib/core/api/types'
  import Plus from '@lucide/svelte/icons/plus'
  import Layers from '@lucide/svelte/icons/layers'
  import CopyIcon from '@lucide/svelte/icons/copy'
  import TriangleAlert from '@lucide/svelte/icons/triangle-alert'
  import ArrowUpRight from '@lucide/svelte/icons/arrow-up-right'
  import SearchIcon from '@lucide/svelte/icons/search'

  const MAX_BULK_COUNT = 100

  let {
    copysets, storageId, blockVolumesById, nodesByVolume, directAccess = false, canUpdate,
    staleStatus = false, nodesStale = false, registering = $bindable(false),
    onDrain, onCancelDrain, onRegisterCopyset, onRegisterCopysetsBulk, onRemove,
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
    // Bindable so a page-level "Add Copyset" action can open this same dialog without
    // duplicating the form (see the storage detail page's top-level action row).
    registering?: boolean
    onDrain: (copysetId: string) => Promise<void>
    onCancelDrain: (copysetId: string) => Promise<void>
    // Creates a whole new copyset (both members atomically, names derived from name);
    // returns the copyset so its memberA/memberB ids can be shown to the operator as
    // BLOCK_VOLUME_ID env values.
    onRegisterCopyset: (name: string) => Promise<Copyset>
    // Creates count new copysets in one call, every name auto-generated.
    onRegisterCopysetsBulk: (count: number) => Promise<Copyset[]>
    // Permanently deregisters a detached member (server-side guards this to
    // member_state='detached' - never a paired/draining member). The client additionally
    // withholds this while the member still has a live blockserv reporting its id -
    // see stillReachable below.
    onRemove: (blockVolumeId: string) => Promise<unknown>
  } = $props()

  interface ServerRow {
    id: string
    name: string
    servers: ServiceNode[]
    copysetId?: string
    copysetName?: string
    copysetState?: CopysetState
    pendingSyncJobs?: number
    detached: boolean
    // 'A' or 'B' for a paired row (which slot it fills in its copyset); undefined for a
    // detached/unpaired row, which belongs to no copyset. Drives the visual grouping band
    // and label, purely presentational - never used to pick which member to act on.
    slot?: 'A' | 'B'
    // Alternates per copyset so consecutive A/B rows share a background tint and the next
    // pair reads as visually distinct; unset (no tint) for detached/unpaired rows.
    groupParity?: 0 | 1
    // True when this row's copyset has both members' commit hashes known and they differ -
    // the two paired blockserv processes are running incompatible builds.
    commitMismatch?: boolean
  }

  // The commit hash comes from the first registered blockserv for a volume; a volume with
  // zero or duplicate registrations is already flagged by servingBadges' own warning.
  function commitHashOf(nodes: ServiceNode[]): string | null {
    const raw = nodes[0]?.metadata?.['commitHash']
    return typeof raw === 'string' && raw ? raw : null
  }

  // Only a real mismatch (both hashes known and different) is alarming. A missing hash on
  // either side just predates this feature's rollout on that binary, not a live mismatch.
  const copysetCommitMismatch = $derived.by(() => {
    const map = new Map<string, boolean>()
    for (const copyset of copysets) {
      if (copyset.state === 'retired') continue
      const commitA = copyset.memberA ? commitHashOf(nodesByVolume.get(copyset.memberA) ?? []) : null
      const commitB = copyset.memberB ? commitHashOf(nodesByVolume.get(copyset.memberB) ?? []) : null
      map.set(copyset.id, !!commitA && !!commitB && commitA !== commitB)
    }
    return map
  })

  // Retired copysets contribute no rows of their own: a retired copyset's members are already
  // reflected as detached servers via blockVolumesById, which is the authoritative source
  // for a server's current state. Rendering the retired Copyset record too would show the same
  // server twice under two different framings.
  const rows = $derived.by((): ServerRow[] => {
    const list: ServerRow[] = []
    const seen = new Set<string>()

    let groupParity: 0 | 1 = 0

    function pushMember(volumeId: string | undefined, copyset: Copyset, pendingSyncJobs: number | undefined, slot: 'A' | 'B') {
      if (!volumeId) return
      seen.add(volumeId)
      const vol = blockVolumesById.get(volumeId)
      list.push({
        id: volumeId,
        name: vol?.name || volumeId,
        servers: nodesByVolume.get(volumeId) ?? [],
        copysetId: copyset.id,
        copysetName: copyset.name,
        copysetState: copyset.state,
        pendingSyncJobs,
        detached: false,
        slot,
        groupParity,
        commitMismatch: copysetCommitMismatch.get(copyset.id) ?? false,
      })
    }

    for (const copyset of copysets) {
      if (copyset.state === 'retired') continue
      pushMember(copyset.memberA, copyset, copyset.pendingSyncJobsA, 'A')
      pushMember(copyset.memberB, copyset, copyset.pendingSyncJobsB, 'B')
      groupParity = groupParity === 0 ? 1 : 0
    }
    for (const vol of blockVolumesById.values()) {
      if (seen.has(vol.id)) continue
      list.push({
        id: vol.id,
        name: vol.name || vol.id,
        servers: nodesByVolume.get(vol.id) ?? [],
        detached: vol.memberState === 'detached',
      })
    }
    return list
  })

  // Local, client-side filter only - no API round-trip. Matches a row's own name/id or its
  // copyset's name, case-insensitively. A match on the copyset name (or on either member)
  // keeps BOTH of that copyset's rows: a paired copyset's two members share one derived
  // name stem, so searching by that stem should surface the pair together rather than
  // orphaning one half of it.
  let query = $state('')
  const filteredRows = $derived.by((): ServerRow[] => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    const rowMatches = (r: ServerRow) =>
      r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q) || (r.copysetName?.toLowerCase().includes(q) ?? false)
    const matchedCopysetIds = new Set(rows.filter(rowMatches).map((r) => r.copysetId).filter((id): id is string => !!id))
    return rows.filter((r) => rowMatches(r) || (r.copysetId !== undefined && matchedCopysetIds.has(r.copysetId)))
  })

  const dialog = useConfirmDialog()

  let name = $state('')
  let submitting = $state(false)
  let removingId = $state<string | null>(null)
  // Set once registration succeeds: the two generated BLOCK_VOLUME_IDs, shown for the
  // operator to copy into the launch config of the two instances they're about to start.
  let registered = $state<{ nameA: string; idA: string; nameB: string; idB: string } | null>(null)
  // Receives focus when the dialog swaps from the form to this success view, so a
  // keyboard or screen-reader user gets a cue the content changed instead of losing focus.
  let successRef = $state<HTMLDivElement | null>(null)

  // Resets the form on every open, regardless of which entry point triggered it.
  $effect(() => {
    if (registering) { name = ''; registered = null }
  })

  function startRegister() {
    registering = true
  }

  // The member's real name is always deterministically <copysetName>-a/-b, so that's
  // the fallback when it's not (yet) resolvable via blockVolumesById - a fresher,
  // more useful label than the raw BLOCK_VOLUME_ID.
  function memberLabel(copyset: Copyset, memberId: string | undefined, suffix: 'a' | 'b'): string {
    const resolved = memberId ? blockVolumesById.get(memberId)?.name : undefined
    return resolved ?? `${copyset.name}-${suffix}`
  }

  async function handleRegister(e: Event) {
    e.preventDefault()
    submitting = true
    try {
      const copyset = await onRegisterCopyset(name.trim())
      registered = {
        nameA: memberLabel(copyset, copyset.memberA, 'a'), idA: copyset.memberA ?? '',
        nameB: memberLabel(copyset, copyset.memberB, 'b'), idB: copyset.memberB ?? '',
      }
      showSuccessToast('Copyset registered')
      await tick()
      successRef?.focus()
    } catch (err: unknown) {
      handleApiError(err, 'Failed to register copyset')
    } finally {
      submitting = false
    }
  }

  // Bulk registration: a separate dialog from the single-copyset one above, since it
  // takes no name (count-only) and its success view is a list, not a fixed pair.
  let bulkRegistering = $state(false)
  let count = $state(5)
  let bulkSubmitting = $state(false)
  let bulkResults = $state<Copyset[] | null>(null)
  let bulkSuccessRef = $state<HTMLDivElement | null>(null)
  const bulkCountValid = $derived(Number.isInteger(count) && count >= 1 && count <= MAX_BULK_COUNT)

  $effect(() => {
    if (bulkRegistering) { count = 5; bulkResults = null }
  })

  function startBulkRegister() {
    bulkRegistering = true
  }

  async function handleBulkRegister(e: Event) {
    e.preventDefault()
    if (!bulkCountValid) return
    bulkSubmitting = true
    try {
      const results = await onRegisterCopysetsBulk(count)
      bulkResults = results
      showSuccessToast(`${results.length} cop${results.length === 1 ? 'yset' : 'ysets'} registered`)
      await tick()
      bulkSuccessRef?.focus()
    } catch (err: unknown) {
      handleApiError(err, 'Failed to register copysets')
    } finally {
      bulkSubmitting = false
    }
  }

  const bulkMemberPairs = $derived.by(() =>
    (bulkResults ?? []).flatMap((c) => [
      { label: memberLabel(c, c.memberA, 'a'), id: c.memberA ?? '' },
      { label: memberLabel(c, c.memberB, 'b'), id: c.memberB ?? '' },
    ]).filter((m) => m.id)
  )

  async function copyAllBulkIds() {
    const lines = bulkMemberPairs.map((m) => `BLOCK_VOLUME_ID=${m.id}`).join('\n')
    if (await copyText(lines)) {
      showSuccessToast(`${bulkMemberPairs.length} BLOCK_VOLUME_IDs copied`)
    } else {
      showErrorToast('Copy failed: clipboard access blocked')
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

  // A detached row still showing a serving-blockserv entry means that instance is still
  // heartbeating (see the "Serving blockserv" column) - its BLOCK_VOLUME_ID is still live,
  // so the instance was never actually terminated. Removing the row now would just orphan
  // a running instance nobody tracks anymore. Blocked in the UI, not just discouraged: the
  // Remove button stays disabled until no live blockserv reports this row's id.
  function stillReachable(row: ServerRow): boolean {
    return row.detached && row.servers.length > 0
  }

  function handleRemoveClick(row: ServerRow) {
    if (stillReachable(row)) return
    dialog.confirm(
      'Remove this server?',
      `This permanently deregisters ${row.name} from the pool. It can't be brought back afterward - register a new one if you need it.`,
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
        {@const ready = n.metadata?.['ready'] === true}
        {@const haSynced = n.metadata?.['ha_synced'] === true}
        {@const converging = nodeConverging(n)}
        <a href={`/nodes/${n.regionId}/${n.nodeId}`}
          class="inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-xs hover:border-primary hover:text-primary transition-colors">
          <span class="font-mono" title={n.nodeId}>{n.nodeId}</span>
          <Badge variant={nodeStatusVariant(n.status)} class="text-xs px-1 py-0">{n.status}</Badge>
          {#if converging}
            <Badge variant="warning" class="text-xs px-1 py-0"
              title={`Heartbeat is healthy, but ${!ready ? 'not yet ready to serve reads' : ''}${!ready && !haSynced ? ' and ' : ''}${!haSynced ? 'not yet HA-synced with its peer' : ''}`}>
              {!ready ? 'not ready' : 'unsynced'}
            </Badge>
          {/if}
          {#if typeof unsynced === 'number' && unsynced > 0}
            <Badge variant="warning" class="text-xs px-1 py-0" title="Objects not yet synced to object storage: do not stop this instance until synced">{unsynced} unsynced</Badge>
          {:else if directAccess && drainReady}
            <Badge variant="outline" class="text-xs px-1 py-0" title="Fully synced and no active clients: safe to stop for maintenance">drain&#8209;ready</Badge>
          {/if}
        </a>
      {/each}
    </span>
  {/if}
{/snippet}

<Card cornerBrackets={false} id="pool-members">
  <CardHeader>
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <CardTitle class="text-base">Servers</CardTitle>
      {#if canUpdate}
        <div class="flex items-center gap-2">
          <HowItWorks topic="copyset" />
          <Button variant="outline" size="sm" class="gap-1.5" onclick={startBulkRegister}>
            <Layers class="size-4" aria-hidden="true" /> Add multiple
          </Button>
          <Button variant="outline" size="sm" class="gap-1.5" onclick={startRegister}>
            <Plus class="size-4" aria-hidden="true" /> Add copyset
          </Button>
        </div>
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
      <div class="relative max-w-xs">
        <SearchIcon class="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" aria-hidden="true" />
        <Input bind:value={query} placeholder="Filter by name..." aria-label="Filter servers by name" class="pl-8" />
      </div>
      {#if filteredRows.length === 0}
        <p class="text-sm text-muted-foreground">No servers match "{query}".</p>
      {:else}
        <Table containerLabel="Servers">
          <TableHeader>
            <TableRow>
              <TableHead class="th-cyber">Server</TableHead>
              <TableHead class="th-cyber">State</TableHead>
              <TableHead class="th-cyber">Serving blockserv</TableHead>
              {#if canUpdate}<TableHead class="th-cyber text-right">Actions</TableHead>{/if}
            </TableRow>
          </TableHeader>
          <TableBody>
            {#each filteredRows as row (row.id)}
              <TableRow id={row.slot === 'A' ? `copyset-${row.copysetId}` : undefined}
                class="{row.groupParity === 1 ? 'bg-muted/20' : ''} {row.copysetId ? 'border-l-2 border-l-primary/30' : ''}">
                <TableCell>
                  <div class="flex items-center gap-1.5">
                    {#if row.slot}
                      <span class="inline-flex items-center justify-center size-4 rounded-full border text-[10px] font-mono text-muted-foreground shrink-0" title={`Slot ${row.slot} of copyset ${row.copysetName ?? row.copysetId}`}>{row.slot}</span>
                    {/if}
                    <span class="font-medium">{row.name}</span>
                    <button type="button" onclick={() => copyValue(row.id, 'Server ID')}
                      class="inline-flex items-center justify-center min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 opacity-50 hover:opacity-100 hover:text-primary transition-opacity"
                      title="Copy BLOCK_VOLUME_ID" aria-label={`Copy ID for ${row.name}`}>
                      <CopyIcon class="size-3" aria-hidden="true" />
                    </button>
                  </div>
                </TableCell>
                <TableCell>
                  {#if row.copysetId && row.copysetState}
                    {#if isCopysetState(row.copysetState)}
                      <CopysetStateBadge state={row.copysetState} />
                    {:else}
                      <Badge variant="destructive">{row.copysetState}</Badge>
                    {/if}
                    {#if row.commitMismatch}
                      <Badge variant="warning" class="ml-1.5 gap-1"
                        title="These two servers are running different builds. Replication between them needs matching versions.">
                        <TriangleAlert class="size-3 shrink-0" aria-hidden="true" /> Build mismatch
                      </Badge>
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
                      {@const blocked = stillReachable(row)}
                      <div class="inline-flex flex-col items-end gap-1">
                        <Button variant="outline" size="sm" class="text-destructive hover:text-destructive"
                          disabled={removingId === row.id || blocked}
                          title={blocked ? 'This server still has a live blockserv registered. Terminate its instance first, then remove it here.' : undefined}
                          onclick={() => handleRemoveClick(row)}>
                          {removingId === row.id ? 'Removing...' : 'Remove'}
                        </Button>
                        {#if blocked}
                          <span class="text-xs text-muted-foreground">Instance still reachable</span>
                        {/if}
                      </div>
                    {/if}
                  </TableCell>
                {/if}
              </TableRow>
            {/each}
          </TableBody>
        </Table>
      {/if}
    {/if}
  </CardContent>
</Card>

<Dialog.Root bind:open={registering} onOpenChange={(v) => { if (!v) submitting = false }}>
  <Dialog.Content class="sm:max-w-sm" showCloseButton={!submitting}
    escapeKeydownBehavior={submitting ? 'ignore' : 'close'} interactOutsideBehavior={submitting ? 'ignore' : 'close'}>
    {#if registered}
      <Dialog.Header>
        <Dialog.Title>Copyset registered</Dialog.Title>
        <Dialog.Description>
          Paste each BLOCK_VOLUME_ID into the launch config of the matching instance.
        </Dialog.Description>
      </Dialog.Header>
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div class="space-y-3" bind:this={successRef} tabindex="-1">
        {#each [{ label: registered.nameA, id: registered.idA }, { label: registered.nameB, id: registered.idB }] as m (m.id)}
          <div class="space-y-1">
            <span class="text-sm font-medium">{m.label}</span>
            <div class="flex items-center gap-1.5">
              <code class="flex-1 rounded-sm border bg-muted px-2 py-1.5 text-xs font-mono break-all">BLOCK_VOLUME_ID={m.id}</code>
              <button type="button" onclick={() => copyValue(`BLOCK_VOLUME_ID=${m.id}`, `${m.label}'s BLOCK_VOLUME_ID`)}
                class="inline-flex items-center justify-center min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 opacity-70 hover:opacity-100 hover:text-primary transition-opacity"
                title="Copy" aria-label={`Copy BLOCK_VOLUME_ID for ${m.label}`}>
                <CopyIcon class="size-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        {/each}
      </div>
      <Dialog.Footer>
        <Button variant="primary" type="button" class="cyberpunk-skewed-sm" onclick={() => (registering = false)}>Done</Button>
      </Dialog.Footer>
    {:else}
      <Dialog.Header>
        <Dialog.Title>Add Copyset</Dialog.Title>
        <Dialog.Description>
          Registers a new copyset for this storage: two servers, launched as a pair. Leave the
          name blank to auto-generate one - both servers derive their names from it.
        </Dialog.Description>
      </Dialog.Header>
      <form onsubmit={handleRegister} class="space-y-5">
        <div class="space-y-2">
          <Label for="register-copyset-name">Copyset name</Label>
          <Input id="register-copyset-name" bind:value={name} maxlength={98} placeholder="Auto-generated if left blank" autocomplete="off" />
        </div>
        <Dialog.Footer class="gap-2">
          <Button variant="secondary" type="button" onclick={() => registering = false} disabled={submitting}>Cancel</Button>
          <Button variant="primary" type="submit" class="cyberpunk-skewed-sm" disabled={submitting}>
            {submitting ? 'Registering...' : 'Register'}
          </Button>
        </Dialog.Footer>
      </form>
    {/if}
  </Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={bulkRegistering} onOpenChange={(v) => { if (!v) bulkSubmitting = false }}>
  <Dialog.Content class="sm:max-w-md" showCloseButton={!bulkSubmitting}
    escapeKeydownBehavior={bulkSubmitting ? 'ignore' : 'close'} interactOutsideBehavior={bulkSubmitting ? 'ignore' : 'close'}>
    {#if bulkResults}
      <Dialog.Header>
        <Dialog.Title>{bulkResults.length} copyset{bulkResults.length === 1 ? '' : 's'} registered</Dialog.Title>
        <Dialog.Description>
          Paste each BLOCK_VOLUME_ID into the launch config of the matching instance.
        </Dialog.Description>
      </Dialog.Header>
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div class="space-y-3" bind:this={bulkSuccessRef} tabindex="-1">
        <Button variant="outline" size="sm" class="gap-1.5 w-full" onclick={copyAllBulkIds}>
          <CopyIcon class="size-4" aria-hidden="true" /> Copy all {bulkMemberPairs.length} BLOCK_VOLUME_IDs
        </Button>
        <div class="max-h-72 overflow-y-auto space-y-2 pr-1">
          {#each bulkMemberPairs as m (m.id)}
            <div class="space-y-1">
              <span class="text-xs font-medium text-muted-foreground">{m.label}</span>
              <div class="flex items-center gap-1.5">
                <code class="flex-1 rounded-sm border bg-muted px-2 py-1 text-xs font-mono break-all">BLOCK_VOLUME_ID={m.id}</code>
                <button type="button" onclick={() => copyValue(`BLOCK_VOLUME_ID=${m.id}`, `${m.label}'s BLOCK_VOLUME_ID`)}
                  class="inline-flex items-center justify-center min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 opacity-70 hover:opacity-100 hover:text-primary transition-opacity"
                  title="Copy" aria-label={`Copy BLOCK_VOLUME_ID for ${m.label}`}>
                  <CopyIcon class="size-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          {/each}
        </div>
      </div>
      <Dialog.Footer>
        <Button variant="primary" type="button" class="cyberpunk-skewed-sm" onclick={() => (bulkRegistering = false)}>Done</Button>
      </Dialog.Footer>
    {:else}
      <Dialog.Header>
        <Dialog.Title>Add Multiple Copysets</Dialog.Title>
        <Dialog.Description>
          Registers this many copysets at once, every name auto-generated - up to {MAX_BULK_COUNT} per call.
        </Dialog.Description>
      </Dialog.Header>
      <form onsubmit={handleBulkRegister} class="space-y-5">
        <div class="space-y-2">
          <Label for="register-copysets-bulk-count">Count</Label>
          <Input id="register-copysets-bulk-count" type="number" min="1" max={MAX_BULK_COUNT}
            bind:value={count} autocomplete="off" />
          {#if !bulkCountValid}
            <p class="text-xs text-destructive">Count must be between 1 and {MAX_BULK_COUNT} and must be a whole number.</p>
          {/if}
        </div>
        <Dialog.Footer class="gap-2">
          <Button variant="secondary" type="button" onclick={() => bulkRegistering = false} disabled={bulkSubmitting}>Cancel</Button>
          <Button variant="primary" type="submit" class="cyberpunk-skewed-sm" disabled={bulkSubmitting || !bulkCountValid}>
            {bulkSubmitting ? 'Registering...' : 'Register'}
          </Button>
        </Dialog.Footer>
      </form>
    {/if}
  </Dialog.Content>
</Dialog.Root>

<ConfirmDialog bind:open={dialog.open} title={dialog.title} description={dialog.desc} variant={dialog.variant} confirmLabel={dialog.confirmLabel} onConfirm={dialog.action} />
