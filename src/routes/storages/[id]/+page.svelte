<script lang="ts">
  import { page } from '$app/stores'
  import { useStorages } from '$lib/core/stores/storages.svelte'
  import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '$lib/components/ui/card'
  import { Button } from '$lib/components/ui/button'
  import { Badge } from '$lib/components/ui/badge'
  import StatusBadge from '$lib/components/shared/StatusBadge.svelte'
  import ConfirmDialog from '$lib/components/shared/ConfirmDialog.svelte'
  import LoadingSpinner from '$lib/components/shared/LoadingSpinner.svelte'
  import type { Storage } from '$lib/core/api/types'

  const store = useStorages()
  const id = $derived(Number($page.params.id))
  let storage = $state<Storage | null>(null)
  let loading = $state(true)
  let confirmOpen = $state(false)

  $effect(() => {
    if (Number.isNaN(id)) { loading = false; return }
    loading = true
    store.getStorage(id).then(s => { storage = s }).catch(() => { storage = null }).finally(() => { loading = false })
  })

  async function toggleActive() {
    if (!storage) return
    storage.isActive ? await store.deactivateStorage(id) : await store.activateStorage(id)
    storage = await store.getStorage(id)
    confirmOpen = false
  }
</script>

<div class="space-y-6">
  <div class="flex items-center gap-4">
    <Button variant="ghost" size="sm" href="/storages">Back</Button>
    <h2 class="text-2xl font-bold tracking-tight">Storage Detail</h2>
  </div>
  {#if loading}
    <LoadingSpinner />
  {:else if storage}
    <Card>
      <CardHeader><CardTitle>{storage.name}</CardTitle></CardHeader>
      <CardContent class="grid gap-3 md:grid-cols-2">
        <div>
          <span class="text-sm text-muted-foreground">Status</span>
          <div class="mt-1"><StatusBadge active={storage.isActive} /></div>
        </div>
        <div>
          <span class="text-sm text-muted-foreground">Type</span>
          <div class="mt-1 flex gap-2"><Badge variant="outline">{storage.storageType}</Badge><Badge variant="secondary">{storage.providerType}</Badge></div>
        </div>
        <div>
          <span class="text-sm text-muted-foreground">Endpoint</span>
          <p class="mt-1 text-sm font-mono">{storage.endpoint}</p>
        </div>
        {#if storage.bucket}
          <div>
            <span class="text-sm text-muted-foreground">Bucket</span>
            <p class="mt-1 text-sm font-mono">{storage.bucket}</p>
          </div>
        {/if}
      </CardContent>
      <CardFooter>
        <Button variant={storage.isActive ? 'outline' : 'default'} size="sm" onclick={() => confirmOpen = true}>
          {storage.isActive ? 'Deactivate' : 'Activate'}
        </Button>
      </CardFooter>
    </Card>
  {:else}
    <p class="text-muted-foreground">Storage not found.</p>
  {/if}
</div>
<ConfirmDialog bind:open={confirmOpen} title={storage?.isActive ? 'Deactivate' : 'Activate'} description={`${storage?.isActive ? 'Deactivate' : 'Activate'} "${storage?.name}"?`} onConfirm={toggleActive} />
