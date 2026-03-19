<script lang="ts">
  import { goto } from '$app/navigation'
  import { useVolumes } from '$lib/core/stores/volumes.svelte'
  import { useAccounts } from '$lib/core/stores/accounts.svelte'
  import { useAuth } from '$lib/core/stores/auth.svelte'
  import { usePreferences } from '$lib/stores/preferences.svelte'
  import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '$lib/components/ui/table'
  import { Button } from '$lib/components/ui/button'
  import StatusBadge from '$lib/components/shared/StatusBadge.svelte'
  import Pagination from '$lib/components/shared/Pagination.svelte'
  import LoadingSpinner from '$lib/components/shared/LoadingSpinner.svelte'
  import EmptyState from '$lib/components/shared/EmptyState.svelte'
  import { formatQuota } from '$lib/core/utils/format'
  import { showErrorToast } from '$lib/core/utils/toast'
  import Plus from '@lucide/svelte/icons/plus'

  const volumeStore = useVolumes()
  const accountStore = useAccounts()
  const auth = useAuth()
  const prefs = usePreferences()
  const accountId = $derived(accountStore.selectedAccountId)

  $effect(() => {
    if (!auth.loading && !auth.can('volumes', 'read')) {
      showErrorToast('Access denied')
      goto('/', { replaceState: true })
      return
    }
    if (accountId) volumeStore.fetchVolumes(accountId, 1, prefs.pageSize)
  })
</script>

<div class="space-y-4">
  <div class="flex items-center justify-between">
    <h1 class="text-2xl font-bold tracking-tight">Volumes</h1>
    {#if accountId && auth.can('volumes', 'create')}
      <Button href="/volumes/create" size="sm" class="gap-1.5">
        <Plus class="h-4 w-4" />
        Create Volume
      </Button>
    {/if}
  </div>
  {#if !accountId}
    <EmptyState title="Select an account" description="Choose an account to view its volumes." />
  {:else if volumeStore.loading}
    <LoadingSpinner />
  {:else if volumeStore.volumes.length === 0}
    <EmptyState title="No volumes" action={auth.can('volumes', 'create') ? { label: 'Create Volume', href: '/volumes/create' } : undefined} />
  {:else}
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead class="th-cyber">Name</TableHead>
          <TableHead class="th-cyber">Quota</TableHead>
          <TableHead class="th-cyber">Status</TableHead>
          <TableHead class="w-24"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {#each volumeStore.volumes as volume}
          <TableRow>
            <TableCell class="font-medium max-w-[200px] truncate">{volume.name}</TableCell>
            <TableCell class="text-sm text-muted-foreground">{formatQuota(volume.quotaUsed, volume.quotaLimit)}</TableCell>
            <TableCell><StatusBadge active={volume.isActive} locked={volume.locked} /></TableCell>
            <TableCell><Button variant="ghost" size="sm" href="/volumes/{volume.id}">View</Button></TableCell>
          </TableRow>
        {/each}
      </TableBody>
    </Table>
    <Pagination currentPage={volumeStore.currentPage} totalPages={volumeStore.totalPages} onPageChange={(p) => accountId && volumeStore.fetchVolumes(accountId, p, prefs.pageSize)} />
  {/if}
</div>
