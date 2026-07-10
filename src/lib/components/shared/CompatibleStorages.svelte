<script lang="ts">
  import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '$lib/components/ui/card'
  import { Badge } from '$lib/components/ui/badge'
  import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '$lib/components/ui/table'
  import { Checkbox } from '$lib/components/ui/checkbox'
  import { Button } from '$lib/components/ui/button'
  import TableSkeleton from '$lib/components/shared/TableSkeleton.svelte'
  import ConfirmDialog from '$lib/components/shared/ConfirmDialog.svelte'
  import { useConfirmDialog } from '$lib/stores/confirm-dialog.svelte'
  import { useStorages } from '$lib/core/stores/storages.svelte'
  import { useAuth } from '$lib/core/stores/auth.svelte'
  import { showSuccessToast, showErrorToast } from '$lib/core/utils/toast'
  import type { CompatibleStorage } from '$lib/core/api/types'
  import ArrowLeftRight from '@lucide/svelte/icons/arrow-left-right'
  import Loader2 from '@lucide/svelte/icons/loader-2'

  let { storageId, storageType, onmoved }: { storageId: number; storageType: string; onmoved?: () => void } = $props()

  const store = useStorages()
  const auth = useAuth()
  const dialog = useConfirmDialog()

  let compatible = $state<CompatibleStorage[]>([])
  let loading = $state(true)
  let error = $state(false)
  let selected = $state<Set<string>>(new Set())
  let moving = $state(false)

  let fetchCtrl: AbortController | undefined
  $effect(() => {
    void storageId
    fetchCtrl?.abort()
    const ctrl = (fetchCtrl = new AbortController())
    loading = true
    error = false
    selected = new Set()
    store
      .listCompatibleStorages(storageId, ctrl.signal)
      .then((res) => {
        if (ctrl.signal.aborted) return
        compatible = res.storages
      })
      .catch(() => {
        if (!ctrl.signal.aborted) error = true
      })
      .finally(() => {
        if (!ctrl.signal.aborted) loading = false
      })
    return () => ctrl.abort()
  })

  const totalVolumes = $derived(compatible.reduce((n, s) => n + s.volumes.length, 0))
  const selectedCount = $derived(selected.size)

  function toggle(volumeId: string, checked: boolean) {
    const next = new Set(selected)
    if (checked) next.add(volumeId)
    else next.delete(volumeId)
    selected = next
  }

  // A source storage of type "block" moving onto an "object" target requires the
  // source to already be in maintenance (directAccess) mode and fully drained —
  // enforced server-side; this is a heads-up, not a client-side gate.
  function sourceNote(sourceType: string): string | null {
    if (sourceType === 'block' && storageType === 'object') {
      return 'Block → object: source must already be in maintenance mode and fully drained.'
    }
    return null
  }

  async function reload() {
    const res = await store.listCompatibleStorages(storageId)
    compatible = res.storages
    selected = new Set()
  }

  function moveSelected() {
    if (selectedCount === 0 || !auth.guard('storages', 'update')) return
    const volumeIds = [...selected]
    dialog.confirm(
      'Move volumes',
      `Move ${volumeIds.length} ${volumeIds.length === 1 ? 'volume' : 'volumes'} onto this storage? This only repoints storage metadata — no data moves, since both storages share the same physical bucket.`,
      async () => {
        moving = true
        try {
          const res = await store.moveVolumes(storageId, { volumeIds })
          if (res.failures.length > 0) {
            showErrorToast(`${res.moved.length} moved, ${res.failures.length} failed: ${res.failures[0].error}`)
          } else {
            showSuccessToast(`${res.moved.length} ${res.moved.length === 1 ? 'volume' : 'volumes'} moved`)
          }
          await reload()
          onmoved?.()
        } finally {
          moving = false
        }
        // Let a request-level failure (network/4xx/5xx) propagate untouched to
        // ConfirmDialog's own catch, which already shows one toast — matching every
        // other dialog.confirm() action in this codebase (e.g. DeactivateVolumeDialog),
        // rather than toasting here too and doubling up.
      },
    )
  }
</script>

{#snippet skeletonHeaderRow()}
  <TableRow>
    <TableHead class="w-10"><span class="sr-only">Select</span></TableHead>
    <TableHead>Name</TableHead>
  </TableRow>
{/snippet}

{#if !loading && !error && compatible.length === 0}
  <!-- No compatible storages: nothing to show, this section stays silent. -->
{:else}
  <Card cornerBrackets>
    <CardHeader>
      <CardTitle class="flex items-center gap-2">
        <ArrowLeftRight class="size-4" aria-hidden="true" />
        Compatible Storages
        {#if !loading && !error}<Badge variant="outline">{totalVolumes}</Badge>{/if}
      </CardTitle>
      <p class="text-xs text-muted-foreground">
        Other storages that address the exact same backing bucket. Moving a volume here only repoints its storage
        record; the underlying data is untouched.
      </p>
    </CardHeader>
    <CardContent class="space-y-6">
      {#if loading}
        <TableSkeleton
          header={skeletonHeaderRow}
          caption="Loading compatible storages"
          cells={[{ width: 'w-6' }, { width: 'w-32' }]}
        />
      {:else if error}
        <p class="text-sm text-destructive">Failed to load compatible storages.</p>
      {:else}
        {#each compatible as s (s.id)}
          <div class="space-y-2">
            <div class="flex items-center gap-2">
              <a href="/storages/{s.id}" class="text-sm font-medium hover:underline">{s.name}</a>
              <Badge variant="outline" class="capitalize">{s.storageType}</Badge>
              <Badge variant="secondary">{s.providerType}</Badge>
            </div>
            {#if sourceNote(s.storageType)}
              <p class="text-xs text-warning">{sourceNote(s.storageType)}</p>
            {/if}
            {#if s.volumes.length === 0}
              <p class="text-xs text-muted-foreground pl-1">No volumes on this storage.</p>
            {:else}
              <Table containerLabel="Volumes on {s.name}">
                <caption class="sr-only">Volumes on {s.name}, selectable to move</caption>
                <TableHeader>
                  <TableRow>
                    <TableHead class="w-10"><span class="sr-only">Select</span></TableHead>
                    <TableHead>Name</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {#each s.volumes as v (v.id)}
                    <TableRow>
                      <TableCell>
                        <Checkbox
                          checked={selected.has(v.id)}
                          disabled={moving || !auth.can('storages', 'update')}
                          aria-label="Select {v.name} to move"
                          onchange={(e: Event) => toggle(v.id, (e.currentTarget as HTMLInputElement).checked)}
                        />
                      </TableCell>
                      <TableCell class="text-sm">{v.name}</TableCell>
                    </TableRow>
                  {/each}
                </TableBody>
              </Table>
            {/if}
          </div>
        {/each}
      {/if}
    </CardContent>
    {#if !loading && !error && totalVolumes > 0 && auth.can('storages', 'update')}
      <CardFooter>
        <Button variant="primary" size="sm" disabled={selectedCount === 0 || moving} onclick={moveSelected}>
          {#if moving}
            <Loader2 class="h-4 w-4 animate-spin" />
          {/if}
          Move {selectedCount > 0 ? selectedCount : ''} Selected
        </Button>
      </CardFooter>
    {/if}
  </Card>
{/if}
<ConfirmDialog bind:open={dialog.open} title={dialog.title} description={dialog.desc} variant={dialog.variant} onConfirm={dialog.action} />
