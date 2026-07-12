<script lang="ts">
  import { Card } from '$lib/components/ui/card'
  import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '$lib/components/ui/table'
  import { Badge } from '$lib/components/ui/badge'
  import { formatBinaryVersion } from '$lib/core/utils/format'
  import type { ServiceNode } from '$lib/core/api/types'

  type TierData = {
    id: string
    label: string
    groups: { type: string; nodes: ServiceNode[] }[]
    nodeCount: number
  }

  let { tierData, basePath, regionId, embedded = false }: {
    tierData: TierData[]
    basePath: string
    regionId: number
    embedded?: boolean
  } = $props()

  const SERVICE_LABELS: Record<string, string> = {
    hub: 'Hub',
    dataserv: 'Metadata',
    gcserv: 'Garbage Collection',
    fuseserv: 'FUSE',
    blockserv: 'Block',
    s3gatewayserv: 'S3 Gateway',
    hdfsserv: 'HDFS Gateway',
    csiserv: 'CSI',
  }

  const STATUS_COLORS: Record<string, string> = {
    healthy: 'var(--success)',
    registered: 'var(--primary)',
    unhealthy: 'var(--destructive)',
    draining: 'var(--warning)',
  }

  const allNodes = $derived(
    tierData.flatMap(tier =>
      tier.groups.flatMap(g =>
        g.nodes.map(n => ({ ...n, tier: tier.label, serviceLabel: SERVICE_LABELS[g.type] ?? g.type }))
      )
    )
  )

  function statusColor(s: string) { return STATUS_COLORS[s] ?? 'var(--muted-foreground)' }
</script>

{#snippet nodeTable()}
  <Table class={embedded ? 'w-auto' : undefined}>
    <caption class="sr-only">Region nodes</caption>
    <TableHeader>
      <TableRow>
        <TableHead>Node ID</TableHead>
        <TableHead class={embedded ? 'pl-8' : 'w-44'}>Service Type</TableHead>
        <TableHead class={embedded ? 'pl-8' : 'w-32'}>Tier</TableHead>
        <TableHead class={embedded ? 'pl-8' : 'w-28'}>Status</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {#each allNodes as node (node.id)}
        <TableRow class="relative cursor-pointer hover:bg-foreground/[0.04] transition-colors">
          <TableCell>
            <a href="{basePath}/{regionId}/{node.nodeId}" class="font-mono text-sm after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring" aria-label="Node {node.nodeId}, {node.serviceLabel}, {node.status}">{node.nodeId}</a>
            {#if node.binaryVersion != null}
              <Badge variant="outline" class="relative z-10 ml-1.5 font-mono text-xs">{formatBinaryVersion(node.binaryVersion)}</Badge>
            {/if}
          </TableCell>
          <TableCell class={embedded ? 'pl-8' : undefined}>
            <span class="text-sm whitespace-nowrap">{node.serviceLabel}</span>
          </TableCell>
          <TableCell class={embedded ? 'pl-8' : undefined}>
            <span class="text-xs font-bold uppercase tracking-wider text-muted-foreground">{node.tier}</span>
          </TableCell>
          <TableCell class={embedded ? 'pl-8' : undefined}>
            <span class="inline-flex items-center gap-2">
              <span
                class="led-dot block h-2 w-2 shrink-0 rounded-full"
                class:led-ping={node.status === 'healthy'}
                style="background: {statusColor(node.status)}; --led: {statusColor(node.status)};"
              ></span>
              <span class="text-sm capitalize">{node.status}</span>
            </span>
          </TableCell>
        </TableRow>
      {/each}
    </TableBody>
  </Table>
{/snippet}

{#if embedded}
  {@render nodeTable()}
{:else}
  <Card cornerPlus class="px-4">
    {@render nodeTable()}
  </Card>
{/if}

<style>
  .led-dot {
    box-shadow: 0 0 6px var(--led);
  }
</style>
