<script lang="ts">
  import { goto } from '$app/navigation'
  import { useAuditLogs } from '$lib/core/stores/audit.svelte'
  import { useAccounts } from '$lib/core/stores/accounts.svelte'
  import { useAuth } from '$lib/core/stores/auth.svelte'
  import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '$lib/components/ui/table'
  import { Button } from '$lib/components/ui/button'
  import { Badge } from '$lib/components/ui/badge'
  import { Input } from '$lib/components/ui/input'
  import LoadingSpinner from '$lib/components/shared/LoadingSpinner.svelte'
  import EmptyState from '$lib/components/shared/EmptyState.svelte'
  import { formatRelative } from '$lib/core/utils/format'
  import { showErrorToast } from '$lib/core/utils/toast'

  const store = useAuditLogs()
  const accountStore = useAccounts()
  const auth = useAuth()
  const accountId = $derived(accountStore.selectedAccountId)

  let subject = $state('')
  let appliedSubject = $state('')
  let expanded = $state<Set<number>>(new Set())

  $effect(() => {
    if (!auth.loading && !auth.can('auditLogs', 'read')) {
      showErrorToast('Access denied')
      goto('/', { replaceState: true })
      return
    }
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
  <h1 class="text-2xl font-bold tracking-tight">Audit Logs</h1>

  <div class="corner-brackets relative border border-border/30 rounded-sm p-4 w-fit max-w-full">
    <div class="tech-grid absolute inset-0 pointer-events-none opacity-20"></div>
    <div class="relative flex gap-3 items-end">
      <div class="flex-1 max-w-sm">
        <Input bind:value={subject} placeholder="Filter by subject..." aria-label="Filter by subject" onkeydown={(e: KeyboardEvent) => e.key === 'Enter' && applyFilter()} />
      </div>
      <Button variant="primary" size="sm" onclick={applyFilter}>Filter</Button>
    </div>
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
          <TableHead class="th-cyber">Title</TableHead>
          <TableHead class="th-cyber">Subject</TableHead>
          <TableHead class="th-cyber">Result</TableHead>
          <TableHead class="th-cyber">By</TableHead>
          <TableHead class="th-cyber">When</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {#each store.logs as log}
          <TableRow class="cursor-pointer" onclick={() => toggleRow(log.id)} onkeydown={(e: KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), toggleRow(log.id))} role="button" tabindex={0}>
            <TableCell class="text-muted-foreground" aria-hidden="true">{expanded.has(log.id) ? '▾' : '▸'}</TableCell>
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
