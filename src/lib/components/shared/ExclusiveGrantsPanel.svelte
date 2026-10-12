<script lang="ts">
  import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card'
  import { Badge } from '$lib/components/ui/badge'
  import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '$lib/components/ui/table'
  import type { ExclusiveGrantsResponse } from '$lib/core/api/types'
  import { formatClockMs, grantRoleLabel, grantStateVariant, liveLabel, scopeLabel } from '$lib/core/utils/exclusive'
  import { formatDate, formatRelative } from '$lib/core/utils/format'

  let { result }: { result: ExclusiveGrantsResponse } = $props()
  // A fork column appears only when a row belongs to a fork other than main.
  const showFork = $derived(result.grants.some((g) => g.fork && g.fork !== 'main'))
</script>

<Card>
  <CardHeader>
    <CardTitle>Exclusive grants ({result.grants.length}{result.truncated ? '+' : ''})</CardTitle>
    <p class="text-sm text-muted-foreground">All forks. Includes standby places.</p>
  </CardHeader>
  <CardContent class="space-y-3">
    {#if !result.ownerReachable}
      <p class="text-sm text-warning" role="note">An owner is not reachable. Live status is unknown for the grants of its forks.</p>
    {/if}
    <Table containerLabel="Exclusive grants">
      <TableHeader>
        <TableRow>
          {#if showFork}<TableHead class="th-cyber">Fork</TableHead>{/if}
          <TableHead class="th-cyber">Holder</TableHead>
          <TableHead class="th-cyber">Scope</TableHead>
          <TableHead class="th-cyber">Grant</TableHead>
          <TableHead class="th-cyber hidden xl:table-cell">Durability</TableHead>
          <TableHead class="th-cyber hidden xl:table-cell">Window</TableHead>
          <TableHead class="th-cyber hidden md:table-cell">Since</TableHead>
          <TableHead class="th-cyber hidden xl:table-cell">Live</TableHead>
          <TableHead class="th-cyber hidden xl:table-cell">Last renew</TableHead>
          <TableHead class="th-cyber hidden xl:table-cell">Last seen</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {#each result.grants as g (g.fork + g.sessionId + g.scopeInode + g.role + g.standbyPosition)}
          <TableRow>
            {#if showFork}<TableCell class="text-sm font-mono break-all sm:break-normal sm:whitespace-nowrap">{g.fork || 'main'}</TableCell>{/if}
            <TableCell class="text-sm">
              <div class="font-mono break-all sm:break-normal sm:whitespace-nowrap">{g.sessionName || '·'}</div>
              <div class="text-muted-foreground font-mono break-all sm:break-normal sm:whitespace-nowrap">{g.holderIp || '·'}</div>
            </TableCell>
            <TableCell class="text-sm">
              <div class="font-mono break-all sm:break-normal sm:whitespace-nowrap">{scopeLabel(g)}</div>
              {#if g.takeOverText}<div class="text-muted-foreground max-w-xs hidden sm:block">{g.takeOverText}</div>{/if}
            </TableCell>
            <TableCell>
              <div class="flex flex-col items-start gap-1">
                <Badge variant={g.role === 'primary' ? 'primary' : 'secondary'}>{grantRoleLabel(g)}</Badge>
                <Badge variant={grantStateVariant(g.state)}>{g.state}</Badge>
              </div>
            </TableCell>
            <TableCell class="text-sm text-muted-foreground hidden xl:table-cell">{g.durability}</TableCell>
            <TableCell class="text-sm text-muted-foreground hidden xl:table-cell tabular-nums">{g.windowSeconds} s</TableCell>
            <TableCell class="text-sm text-muted-foreground hidden md:table-cell whitespace-nowrap" title={formatDate(new Date(g.sinceUnixMs))}>{formatRelative(new Date(g.sinceUnixMs))}</TableCell>
            <TableCell class="text-sm text-muted-foreground hidden xl:table-cell">{liveLabel(g.live)}</TableCell>
            <TableCell class="text-sm text-muted-foreground hidden xl:table-cell tabular-nums">{formatClockMs(g.lastRenewAgeMs)}</TableCell>
            <TableCell class="text-sm text-muted-foreground hidden xl:table-cell tabular-nums">{formatClockMs(g.lastSeenAgeMs)}</TableCell>
          </TableRow>
        {/each}
      </TableBody>
    </Table>
    {#if result.truncated}
      <p class="text-sm text-warning" role="note">The list was cut short. More grants exist on this volume.</p>
    {/if}
  </CardContent>
</Card>
