<script lang="ts">
  import { goto } from '$app/navigation'
  import { Card } from '$lib/components/ui/card'
  import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '$lib/components/ui/table'
  import type { ServiceNode } from '$lib/core/api/types'

  type TierData = {
    id: string
    label: string
    groups: { type: string; nodes: ServiceNode[] }[]
    nodeCount: number
  }

  let { tierData, basePath, regionId }: {
    tierData: TierData[]
    basePath: string
    regionId: number
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

<Card cornerPlus class="px-4">
  <Table>
    <caption class="sr-only">Region nodes</caption>
    <TableHeader>
      <TableRow>
        <TableHead>Node ID</TableHead>
        <TableHead class="w-44">Service Type</TableHead>
        <TableHead class="w-32">Tier</TableHead>
        <TableHead class="w-28">Status</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {#each allNodes as node (node.id)}
        <TableRow
          class="cursor-pointer hover:bg-foreground/[0.04] transition-colors"
          onclick={() => goto(`${basePath}/${regionId}/${node.nodeId}`)}
        >
          <TableCell>
            <span class="font-mono text-sm">{node.nodeId}</span>
          </TableCell>
          <TableCell>
            <span class="text-sm whitespace-nowrap">{node.serviceLabel}</span>
          </TableCell>
          <TableCell>
            <span class="text-xs font-bold uppercase tracking-wider text-muted-foreground">{node.tier}</span>
          </TableCell>
          <TableCell>
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
</Card>

<style>
  .led-dot {
    box-shadow: 0 0 6px var(--led);
  }
</style>
