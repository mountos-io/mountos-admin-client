<script lang="ts">
  import { goto } from '$app/navigation'
  import { useRegions } from '$lib/core/stores/regions.svelte'
  import { useAuth } from '$lib/core/stores/auth.svelte'
  import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card'
  import { Badge } from '$lib/components/ui/badge'
  import LoadingSpinner from '$lib/components/shared/LoadingSpinner.svelte'
  import EmptyState from '$lib/components/shared/EmptyState.svelte'
  import { showErrorToast } from '$lib/core/utils/toast'

  const regionStore = useRegions()
  const auth = useAuth()

  $effect(() => {
    if (!auth.loading && !auth.can('serviceNodes', 'read')) {
      showErrorToast('Access denied')
      goto('/', { replaceState: true })
      return
    }
    regionStore.fetchRegions()
  })
</script>

<div class="space-y-4">
  <h1 class="text-2xl font-bold tracking-tight">Nodes</h1>
  <p class="text-sm text-muted-foreground">Select a region to view its node topology.</p>

  {#if regionStore.loading}
    <LoadingSpinner />
  {:else if regionStore.regions.length === 0}
    <EmptyState title="No regions" description="No regions configured yet." />
  {:else}
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {#each regionStore.regions as region}
        <button class="text-left w-full" onclick={() => goto(`/nodes/${region.id}`)}>
          <Card cornerBrackets class="transition-colors hover:border-foreground/30 cursor-pointer h-full">
            <CardHeader>
              <div class="flex items-center justify-between gap-2">
                <CardTitle class="text-base truncate">{region.name}</CardTitle>
                <Badge variant={region.isActive ? 'success' : 'secondary'}>
                  {region.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent class="pt-0">
              <div class="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" class="font-mono text-[10px]">{region.dns}</Badge>
              </div>
            </CardContent>
          </Card>
        </button>
      {/each}
    </div>
  {/if}
</div>
