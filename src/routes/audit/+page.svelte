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

  const subjectColors: Record<string, string> = {
    user: 'var(--pastel-user)', volume: 'var(--pastel-volume)',
    account: 'var(--pastel-account)', storage: 'var(--pastel-storage)',
    role: 'var(--pastel-role)', region: 'var(--pastel-region)',
    mount: 'var(--pastel-mount)', key: 'var(--pastel-key)',
    session: 'var(--pastel-session)', node: 'var(--pastel-node)',
    license: 'var(--pastel-license)',
  }

  function subjectColor(s?: string) {
    return subjectColors[s ?? ''] ?? 'var(--muted-foreground)'
  }

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

<svelte:head><title>Audit Logs — mountOS Admin</title></svelte:head>

<div class="space-y-4">
  <h1 class="text-2xl font-bold tracking-tight">Audit Logs</h1>

  <div class="corner-brackets relative border border-border/30 rounded-sm p-4 max-w-full">
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
          <TableRow class="cursor-pointer" onclick={() => toggleRow(log.id)} tabindex={0} onkeydown={(e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleRow(log.id) } }}>
            <TableCell class="text-muted-foreground">
              <button type="button" class="p-2" aria-expanded={expanded.has(log.id)} aria-label="Toggle log details">{expanded.has(log.id) ? '▾' : '▸'}</button>
            </TableCell>
            <TableCell class="font-medium">{log.title}</TableCell>
            <TableCell>
              {#if log.subject}
                <span class="audit-subject" style="--sc: {subjectColor(log.subject)}">{log.subject}</span>
              {:else}
                <span class="text-sm text-muted-foreground">—</span>
              {/if}
            </TableCell>
            <TableCell><Badge variant={log.success ? 'default' : 'destructive'}>{log.success ? 'OK' : 'Fail'}</Badge></TableCell>
            <TableCell class="text-sm text-muted-foreground">{log.createdBy ?? '—'}</TableCell>
            <TableCell class="text-sm text-muted-foreground">{log.createdAt ? formatRelative(log.createdAt) : '—'}</TableCell>
          </TableRow>
          {#if expanded.has(log.id)}
            <TableRow>
              <TableCell></TableCell>
              <TableCell colspan={5}>
                <div class="audit-detail space-y-3 py-3">
                  {#if log.description}
                    <div class="audit-desc">{log.description}</div>
                  {/if}
                  {#if log.data}
                    <div class="audit-data-wrap corner-brackets">
                      <pre class="audit-data">{JSON.stringify(log.data, null, 2)}</pre>
                    </div>
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

<style>
  .audit-desc {
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    letter-spacing: 0.04em;
    color: var(--primary);
    position: relative;
    padding: 0.375rem 0.75rem;
    border-left: 2px solid var(--primary);
    background: color-mix(in oklch, var(--card) 94%, var(--primary));
    clip-path: polygon(0 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%);
  }

  .audit-desc::before {
    content: "//";
    color: var(--muted-foreground);
    opacity: 0.5;
    margin-right: 0.5rem;
  }

  .audit-desc::after {
    content: "";
    position: absolute;
    bottom: 0;
    left: 0;
    width: 40%;
    height: 1px;
    background: linear-gradient(90deg, var(--primary), transparent);
    opacity: 0.4;
  }

  .audit-data-wrap {
    position: relative;
    border: 1px solid var(--border);
    border-radius: 0;
    background: var(--card);
  }

  .audit-data {
    font-size: 0.8125rem;
    padding: 0.75rem 1rem;
    overflow-x: auto;
    height: 12rem;
    overflow-y: auto;
    border-radius: 0;
    color: var(--card-foreground);
    background: transparent;
    position: relative;
    background-image: repeating-linear-gradient(
      0deg,
      transparent,
      transparent calc(1.6em - 1px),
      var(--border) calc(1.6em - 1px),
      var(--border) 1.6em
    );
    background-size: 100% 1.6em;
    background-position: 0 0.75rem;
    line-height: 1.6;
  }

  :global(.dark) .audit-desc {
    background: color-mix(in oklch, var(--card) 92%, var(--primary));
  }

  .audit-subject {
    display: inline-block;
    font-family: var(--font-mono);
    font-size: 0.6rem;
    text-transform: uppercase;
    letter-spacing: 0.15em;
    padding: 0.125rem 0.375rem;
    border: 1px solid var(--sc);
    border-radius: 1px;
    color: color-mix(in oklch, var(--sc) 80%, black);
    background: color-mix(in oklch, var(--sc) 15%, transparent);
  }

  :global(.dark) .audit-subject {
    color: var(--sc);
    background: color-mix(in oklch, var(--sc) 10%, transparent);
  }
</style>
