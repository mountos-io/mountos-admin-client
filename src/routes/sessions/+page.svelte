<script lang="ts">
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { useSessions } from '$lib/core/stores/sessions.svelte'
  import { useAccounts } from '$lib/core/stores/accounts.svelte'
  import { useAuth } from '$lib/core/stores/auth.svelte'
  import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '$lib/components/ui/table'
  import { Badge } from '$lib/components/ui/badge'
  import LoadingSpinner from '$lib/components/shared/LoadingSpinner.svelte'
  import EmptyState from '$lib/components/shared/EmptyState.svelte'
  import Pagination from '$lib/components/shared/Pagination.svelte'
  import SessionSummaryChart from '$lib/components/shared/SessionSummaryChart.svelte'
  import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card'
  import { formatRelative, formatDuration, formatClientType, formatSessionStatus } from '$lib/core/utils/format'
  import { showErrorToast } from '$lib/core/utils/toast'

  const sessionStore = useSessions()
  const accountStore = useAccounts()
  const auth = useAuth()
  const account = $derived(accountStore.selectedAccount)
  const accountId = $derived(account?.id ?? null)
  const volumeIdParam = $derived($page.url.searchParams.get('volumeId'))
  const volumeId = $derived(volumeIdParam ? Number(volumeIdParam) : undefined)
  let redirected = false

  $effect(() => {
    if (auth.loading) return () => sessionStore.reset()
    if (!auth.can('clientSessions', 'read')) {
      if (!redirected) {
        redirected = true
        showErrorToast('Access denied')
        goto('/', { replaceState: true })
      }
      return () => sessionStore.reset()
    }
    if (accountId) {
      sessionStore.fetchSessions({ accountId, volumeId })
      sessionStore.fetchSummary(accountId, volumeId)
    } else {
      sessionStore.reset()
    }
    return () => sessionStore.reset()
  })

  function onPageChange(p: number) {
    if (accountId) sessionStore.fetchSessions({ accountId, volumeId, page: p })
  }

  function clearVolumeFilter() {
    goto('/sessions')
  }
</script>

<div class="space-y-6">
  <div class="flex items-center gap-3">
    <h1 class="text-2xl font-bold tracking-tight">Sessions</h1>
    {#if volumeId}
      <Badge variant="outline" class="gap-1">
        Volume #{volumeId}
        <button type="button" class="ml-1 hover:text-destructive" onclick={clearVolumeFilter} aria-label="Clear volume filter">&times;</button>
      </Badge>
    {/if}
  </div>

  {#if !account}
    <EmptyState title="No account selected" description="Select an account to view sessions." />
  {:else}
    <!-- Summary -->
    <Card cornerPlus>
      <CardHeader>
        <div class="flex items-center justify-between">
          <CardTitle>Summary</CardTitle>
          {#if sessionStore.totalActive > 0}
            <Badge variant="success">{sessionStore.totalActive} active</Badge>
          {/if}
        </div>
      </CardHeader>
      <CardContent>
        <SessionSummaryChart summary={sessionStore.summary} loading={sessionStore.summaryLoading} />
      </CardContent>
    </Card>

    <!-- Sessions Table -->
    {#if sessionStore.loading && sessionStore.sessions.length === 0}
      <div class="flex justify-center py-12"><LoadingSpinner /></div>
    {:else if sessionStore.error}
      <Card cornerPlus>
        <CardContent class="py-8">
          <p class="text-center text-destructive">{sessionStore.error}</p>
        </CardContent>
      </Card>
    {:else if sessionStore.sessions.length === 0}
      <EmptyState title="No sessions" description="No client sessions found for this account." />
    {:else}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead class="th-cyber">Client</TableHead>
            <TableHead class="th-cyber">Host</TableHead>
            <TableHead class="th-cyber">Region</TableHead>
            <TableHead class="th-cyber">Volume</TableHead>
            <TableHead class="th-cyber">Status</TableHead>
            <TableHead class="th-cyber hidden md:table-cell">Duration</TableHead>
            <TableHead class="th-cyber hidden md:table-cell">Last Heartbeat</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {#each sessionStore.sessions as session (session.id)}
            {@const st = formatSessionStatus(session.status)}
            <TableRow>
              <TableCell>
                <div>
                  <p class="text-sm font-medium">{formatClientType(session.clientType)}</p>
                  <p class="text-sm text-muted-foreground">{session.osName}{session.osVersion ? ` ${session.osVersion}` : ''}</p>
                </div>
              </TableCell>
              <TableCell class="font-mono text-sm max-w-[160px] truncate">{session.hostname || session.ipAddr}</TableCell>
              <TableCell class="text-sm text-muted-foreground">{session.region.name}</TableCell>
              <TableCell class="text-sm max-w-[120px] truncate">{session.volumeName || session.volumeId}</TableCell>
              <TableCell>
                <Badge variant={st.variant}>{st.label}</Badge>
              </TableCell>
              <TableCell class="text-sm text-muted-foreground hidden md:table-cell">
                {session.connectedAt ? formatDuration(session.connectedAt, session.disconnectedAt) : '—'}
              </TableCell>
              <TableCell class="text-sm text-muted-foreground hidden md:table-cell">
                {session.lastHeartbeat ? formatRelative(session.lastHeartbeat) : '—'}
              </TableCell>
            </TableRow>
          {/each}
        </TableBody>
      </Table>
      <Pagination currentPage={sessionStore.currentPage} totalPages={sessionStore.totalPages} {onPageChange} />
    {/if}
  {/if}
</div>
