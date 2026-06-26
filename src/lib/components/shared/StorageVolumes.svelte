<script lang="ts">
  import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card'
  import { Badge } from '$lib/components/ui/badge'
  import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '$lib/components/ui/table'
  import StatusBadge from '$lib/components/shared/StatusBadge.svelte'
  import Pagination from '$lib/components/shared/Pagination.svelte'
  import TableSkeleton from '$lib/components/shared/TableSkeleton.svelte'
  import { formatBytes } from '$lib/core/utils/format'
  import { api } from '$lib/core/stores/client.svelte'
  import type { Volume } from '$lib/core/api/types'
  import DatabaseIcon from '@lucide/svelte/icons/database'
  import Lock from '@lucide/svelte/icons/lock'

  let { storageId, accountId }: { storageId: number; accountId: number } = $props()

  let volumes = $state<Volume[]>([])
  let loading = $state(true)
  let error = $state(false)
  let page = $state(1)
  let totalPages = $state(0)
  let total = $state(0)
  let fetchCtrl: AbortController | undefined

  $effect(() => {
    void page
    fetchCtrl?.abort()
    const ctrl = fetchCtrl = new AbortController()
    loading = true
    error = false
    api.volumes.list({ accountId, storageId, page, limit: 20 }, ctrl.signal)
      .then(res => {
        if (ctrl.signal.aborted) return
        volumes = res.items
        totalPages = res.pagination?.totalPages ?? 0
        total = res.pagination?.total ?? res.items.length
      })
      .catch(() => { if (!ctrl.signal.aborted) error = true })
      .finally(() => { if (!ctrl.signal.aborted) loading = false })
    return () => ctrl.abort()
  })
</script>

{#snippet headerRow()}
  <TableRow>
    <TableHead>Name</TableHead>
    <TableHead>Type</TableHead>
    <TableHead class="hidden md:table-cell">Region</TableHead>
    <TableHead class="hidden lg:table-cell">Cluster</TableHead>
    <TableHead class="hidden md:table-cell">Live</TableHead>
    <TableHead>Status</TableHead>
  </TableRow>
{/snippet}

<Card cornerBrackets>
  <CardHeader>
    <CardTitle class="flex items-center gap-2">
      <DatabaseIcon class="size-4" aria-hidden="true" />
      Volumes
      {#if !loading && !error}<Badge variant="outline">{total}</Badge>{/if}
    </CardTitle>
  </CardHeader>
  <CardContent class="space-y-4">
    {#if loading}
      <TableSkeleton
        header={headerRow}
        caption="Loading volumes"
        cells={[
          { width: 'w-32' },
          { width: 'w-16', height: 'h-5' },
          { width: 'w-20', class: 'hidden md:table-cell' },
          { width: 'w-20', class: 'hidden lg:table-cell' },
          { width: 'w-16', class: 'hidden md:table-cell' },
          { width: 'w-16', height: 'h-5' },
        ]}
      />
    {:else if error}
      <p class="text-sm text-destructive">Failed to load volumes.</p>
    {:else if volumes.length === 0}
      <p class="text-sm text-muted-foreground">No volumes on this storage.</p>
    {:else}
      <p class="sr-only" role="status" aria-live="polite">
        Showing {volumes.length} {volumes.length === 1 ? 'volume' : 'volumes'} of {total} on page {page} of {totalPages}
      </p>
      <Table containerLabel="Storage volumes">
        <caption class="sr-only">Volumes on this storage</caption>
        <TableHeader>
          {@render headerRow()}
        </TableHeader>
        <TableBody>
          {#each volumes as volume (volume.id)}
            <TableRow class={`relative cursor-pointer hover:bg-muted/50 ${volume.isActive ? '' : 'bg-muted/40'}`}>
              <TableCell class="font-medium max-w-[200px] truncate" title={volume.name}>
                <a href="/volumes/{volume.id}" class="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring" aria-label="Volume {volume.name}{volume.isActive ? '' : ', deactivated'}">{volume.name}</a>
                {#if volume.locked}<Lock class="ml-1 inline size-3.5 align-text-bottom text-warning" aria-label="Locked" />{/if}
              </TableCell>
              <TableCell>
                <Badge variant={volume.volumeType === 'iceberg' ? 'primary' : 'secondary'} class="capitalize">{volume.volumeType}</Badge>
              </TableCell>
              <TableCell class="text-sm text-muted-foreground hidden md:table-cell">{volume.region.name}</TableCell>
              <TableCell class="text-sm text-muted-foreground hidden lg:table-cell">{volume.regionCluster?.name || '(not set)'}</TableCell>
              <TableCell class="text-sm text-muted-foreground hidden md:table-cell font-mono">{formatBytes(volume.liveVolume)}</TableCell>
              <TableCell><StatusBadge active={volume.isActive} locked={volume.locked} /></TableCell>
            </TableRow>
          {/each}
        </TableBody>
      </Table>
      <Pagination currentPage={page} {totalPages} onPageChange={(p) => page = p} />
    {/if}
  </CardContent>
</Card>
