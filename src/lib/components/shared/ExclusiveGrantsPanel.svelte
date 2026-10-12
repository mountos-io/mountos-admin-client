<script lang="ts">
  import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card'
  import { Badge } from '$lib/components/ui/badge'
  import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '$lib/components/ui/table'
  import type { ExclusiveGrantsResponse } from '$lib/core/api/types'
  import { formatClockMs, grantRoleLabel, grantStateVariant, liveLabel, scopeLabel } from '$lib/core/utils/exclusive'
  import { formatDate, formatRelative } from '$lib/core/utils/format'

  let { result }: { result: ExclusiveGrantsResponse } = $props()
</script>

<Card>
  <CardHeader>
    <CardTitle>Exclusive grants ({result.grants.length}{result.truncated ? '+' : ''})</CardTitle>
    <p class="text-sm text-muted-foreground">Fork {result.fork || 'main'}. Includes standby places that have no live mount.</p>
  </CardHeader>
  <CardContent class="space-y-3">
    {#if !result.ownerReachable}
      <p class="text-sm text-warning" role="note">The owner is not reachable. Live status is unknown.</p>
    {/if}
    <Table containerLabel="Exclusive grants">
      <TableHeader>
        <TableRow>
          <TableHead class="th-cyber">Role</TableHead>
          <TableHead class="th-cyber">State</TableHead>
          <TableHead class="th-cyber">Scope</TableHead>
          <TableHead class="th-cyber hidden md:table-cell">Holder</TableHead>
          <TableHead class="th-cyber hidden lg:table-cell">Durability</TableHead>
          <TableHead class="th-cyber hidden lg:table-cell">Live</TableHead>
          <TableHead class="th-cyber hidden lg:table-cell">Last renew</TableHead>
          <TableHead class="th-cyber hidden md:table-cell">Since</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {#each result.grants as g (g.sessionId + g.scopeInode + g.role + g.standbyPosition)}
          <TableRow>
            <TableCell class="text-sm"><Badge variant={g.role === 'primary' ? 'primary' : 'secondary'}>{grantRoleLabel(g)}</Badge></TableCell>
            <TableCell><Badge variant={grantStateVariant(g.state)}>{g.state}</Badge></TableCell>
            <TableCell class="text-sm font-mono whitespace-nowrap">{scopeLabel(g)}</TableCell>
            <TableCell class="text-sm text-muted-foreground hidden md:table-cell font-mono whitespace-nowrap">{g.sessionName || g.holderIp || '·'}</TableCell>
            <TableCell class="text-sm text-muted-foreground hidden lg:table-cell">{g.durability}</TableCell>
            <TableCell class="text-sm text-muted-foreground hidden lg:table-cell">{liveLabel(result?.ownerReachable === false ? null : g.live)}</TableCell>
            <TableCell class="text-sm text-muted-foreground hidden lg:table-cell tabular-nums">{formatClockMs(result?.ownerReachable === false ? null : g.lastRenewAgeMs)}</TableCell>
            <TableCell class="text-sm text-muted-foreground hidden md:table-cell" title={formatDate(new Date(g.sinceUnixMs))}>{formatRelative(new Date(g.sinceUnixMs))}</TableCell>
          </TableRow>
        {/each}
      </TableBody>
    </Table>
    {#if result.truncated}
      <p class="text-sm text-warning" role="note">The list was cut short. More grants exist on this volume.</p>
    {/if}
  </CardContent>
</Card>
