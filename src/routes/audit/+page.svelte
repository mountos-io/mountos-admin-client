<script lang="ts">
  import { useAuditLogs } from '$lib/core/stores/audit.svelte'
  import { useAccounts } from '$lib/core/stores/accounts.svelte'
  import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '$lib/components/ui/table'
  import { Button } from '$lib/components/ui/button'
  import { Badge } from '$lib/components/ui/badge'
  import { Input } from '$lib/components/ui/input'
  import LoadingSpinner from '$lib/components/shared/LoadingSpinner.svelte'
  import EmptyState from '$lib/components/shared/EmptyState.svelte'
  import { formatRelative } from '$lib/core/utils/format'

  const store = useAuditLogs()
  const accountStore = useAccounts()
  const accountId = $derived(accountStore.selectedAccountId)

  let subject = $state('')
  let appliedSubject = $state('')
  let expanded = $state<Set<number>>(new Set())

  $effect(() => {
    const acctId = accountId ?? undefined
    store.fetchLogs({ accountId: acctId, subject: appliedSubject || undefined, reset: true })
  })

  function toggleRow(id: number) {
    const next = new Set(expanded)
    next.has(id) ? next.delete(id) : next.add(id)
    expanded = next
  }

  function applyFilter() {
    appliedSubject = subject
  }

  function loadMore() {
    store.fetchLogs({ accountId: accountId ?? undefined, subject: appliedSubject || undefined })
  }
</script>

<div class="space-y-4">
  <h2 class="text-2xl font-bold tracking-tight">Audit Logs</h2>

  <div class="flex gap-3 items-end">
    <div class="flex-1 max-w-sm">
      <Input bind:value={subject} placeholder="Filter by subject..." onkeydown={(e: KeyboardEvent) => e.key === 'Enter' && applyFilter()} />
    </div>
    <Button variant="outline" size="sm" onclick={applyFilter}>Filter</Button>
  </div>

  {#if store.loading && store.logs.length === 0}
    <LoadingSpinner />
  {:else if store.logs.length === 0}
    <EmptyState title="No audit logs" description="No entries match the current filters." />
  {:else}
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead class="w-8"></TableHead>
          <TableHead>Title</TableHead>
          <TableHead>Subject</TableHead>
          <TableHead>Result</TableHead>
          <TableHead>By</TableHead>
          <TableHead>When</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {#each store.logs as log}
          <TableRow class="cursor-pointer" onclick={() => toggleRow(log.id)}>
            <TableCell class="text-muted-foreground">{expanded.has(log.id) ? '▾' : '▸'}</TableCell>
            <TableCell class="font-medium">{log.title}</TableCell>
            <TableCell class="text-sm text-muted-foreground">{log.subject ?? '—'}</TableCell>
            <TableCell><Badge variant={log.success ? 'default' : 'destructive'}>{log.success ? 'OK' : 'Fail'}</Badge></TableCell>
            <TableCell class="text-sm text-muted-foreground">{log.createdBy ?? '—'}</TableCell>
            <TableCell class="text-sm text-muted-foreground">{log.createdAt ? formatRelative(log.createdAt) : '—'}</TableCell>
          </TableRow>
          {#if expanded.has(log.id)}
            <TableRow>
              <TableCell></TableCell>
              <TableCell colspan={5}>
                <div class="space-y-2 py-2">
                  {#if log.description}
                    <p class="text-sm">{log.description}</p>
                  {/if}
                  {#if log.data}
                    <pre class="text-xs bg-muted rounded-md p-3 overflow-x-auto max-h-64">{JSON.stringify(log.data, null, 2)}</pre>
                  {/if}
                </div>
              </TableCell>
            </TableRow>
          {/if}
        {/each}
      </TableBody>
    </Table>
    {#if store.hasMore}
      <div class="flex justify-center pt-2">
        <Button variant="outline" size="sm" disabled={store.loading} onclick={loadMore}>
          {store.loading ? 'Loading...' : 'Load More'}
        </Button>
      </div>
    {/if}
  {/if}
</div>
