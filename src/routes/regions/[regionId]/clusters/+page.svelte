<script lang="ts">
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { useClusters } from '$lib/core/stores/clusters.svelte'
  import { Badge } from '$lib/components/ui/badge'
  import { Button } from '$lib/components/ui/button'
  import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card'
  import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '$lib/components/ui/table'
  import EmptyState from '$lib/components/shared/EmptyState.svelte'
  import InfoTip from '$lib/components/shared/InfoTip.svelte'
  import { formatRelative } from '$lib/core/utils/format'

  const regionId = $derived(Number($page.params.regionId))
  const store = useClusters()

  $effect(() => { if (regionId) store.fetchClusters(regionId) })

  const clusters = $derived(store.clustersFor(regionId))
  const loading = $derived(store.isLoading(regionId))
</script>

<svelte:head><title>Region Clusters · mountOS Admin</title></svelte:head>

<div class="mx-auto max-w-5xl space-y-4">
  <Card cornerBrackets>
    <CardHeader class="flex flex-row items-center justify-between gap-4">
      <div>
        <CardTitle>Region Clusters</CardTitle>
        <p class="text-muted-foreground text-base">
          Logical grouping of in-region service nodes for tenant isolation or load balancing.
          Volumes can only be assigned once the cluster is marked ready.
        </p>
      </div>
      <Button variant="primary" onclick={() => goto(`/regions/${regionId}/clusters/create`)}>New cluster</Button>
    </CardHeader>

    <CardContent>
      {#if loading && clusters.length === 0}
        <p class="text-muted-foreground text-base" role="status" aria-live="polite">Loading…</p>
      {:else if clusters.length === 0}
        <EmptyState title="No clusters" description="Create one to start grouping instances and volumes." />
      {:else}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>State</TableHead>
              <TableHead>Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {#each clusters as c (c.id)}
              <TableRow>
                <TableCell>
                  <a
                    href={`/regions/${regionId}/clusters/${c.id}`}
                    class="inline-flex min-h-[44px] items-center font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >{c.name}</a>
                </TableCell>
                <TableCell class="space-x-1">
                  {#if c.defaultCluster}
                    <Badge variant="secondary">default</Badge>
                  {/if}
                  {#if c.isReady}
                    <Badge variant="success">ready</Badge>
                  {:else}
                    <Badge variant="warning">
                      not ready
                      <InfoTip text="Auto-flips to ready when any instance heartbeats this cluster, or click set-ready manually." />
                    </Badge>
                  {/if}
                  {#if !c.isActive}
                    <Badge variant="destructive">deactivated</Badge>
                  {/if}
                </TableCell>
                <TableCell>{formatRelative(c.updatedAt)}</TableCell>
              </TableRow>
            {/each}
          </TableBody>
        </Table>
      {/if}
    </CardContent>
  </Card>
</div>
