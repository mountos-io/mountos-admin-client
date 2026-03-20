<script lang="ts">
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { useStorages } from '$lib/core/stores/storages.svelte'
  import { useAuth } from '$lib/core/stores/auth.svelte'
  import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '$lib/components/ui/card'
  import { Button } from '$lib/components/ui/button'
  import { Badge } from '$lib/components/ui/badge'
  import StatusBadge from '$lib/components/shared/StatusBadge.svelte'
  import ConfirmDialog from '$lib/components/shared/ConfirmDialog.svelte'
  import LoadingSpinner from '$lib/components/shared/LoadingSpinner.svelte'
  import { showErrorToast } from '$lib/core/utils/toast'
  import { useConfirmDialog } from '$lib/stores/confirm-dialog.svelte'
  import ArrowLeft from '@lucide/svelte/icons/arrow-left'
  import type { Storage } from '$lib/core/api/types'

  const store = useStorages()
  const auth = useAuth()
  const id = $derived(Number($page.params.id))

  $effect(() => {
    if (!auth.loading && !auth.can('storages', 'read')) {
      showErrorToast('Access denied')
      goto('/', { replaceState: true })
    }
  })
  let storage = $state<Storage | null>(null)
  let loading = $state(true)
  const dialog = useConfirmDialog(() => reload())

  $effect(() => {
    if (Number.isNaN(id)) { loading = false; return }
    loading = true
    store.getStorage(id).then(s => { storage = s }).catch(() => { storage = null }).finally(() => { loading = false })
  })

  async function reload() {
    storage = await store.getStorage(id)
  }
</script>

<div class="space-y-6">
  <div class="flex items-center gap-4">
    <Button variant="ghost" size="sm" href="/storages"><ArrowLeft class="h-4 w-4" /></Button>
    <h1 class="text-2xl font-bold tracking-tight">Storage Detail</h1>
  </div>
  {#if loading}
    <LoadingSpinner />
  {:else if storage}
    <Card>
      <CardHeader><CardTitle>{storage.name}</CardTitle></CardHeader>
      <CardContent class="grid gap-3 md:grid-cols-2">
        <div>
          <span class="text-sm uppercase tracking-wider font-semibold text-muted-foreground">Status</span>
          <div class="mt-1"><StatusBadge active={storage.isActive} /></div>
        </div>
        <div>
          <span class="text-sm uppercase tracking-wider font-semibold text-muted-foreground">Type</span>
          <div class="mt-1 flex gap-2"><Badge variant="outline">{storage.storageType}</Badge><Badge variant="secondary">{storage.providerType}</Badge></div>
        </div>
        <div>
          <span class="text-sm uppercase tracking-wider font-semibold text-muted-foreground">Endpoint</span>
          <p class="mt-1 text-sm font-mono">{storage.endpoint}</p>
        </div>
        {#if storage.bucket}
          <div>
            <span class="text-sm uppercase tracking-wider font-semibold text-muted-foreground">Bucket</span>
            <p class="mt-1 text-sm font-mono">{storage.bucket}</p>
          </div>
        {/if}
      </CardContent>
      {#if auth.can('storages', 'update')}
        <CardFooter>
          <Button variant={storage.isActive ? 'outline' : 'default'} size="sm" onclick={() => {
            if (!auth.guard('storages', 'update')) return
            const active = storage!.isActive
            dialog.confirm(
              active ? 'Deactivate' : 'Activate',
              `${active ? 'Deactivate' : 'Activate'} "${storage!.name}"?`,
              async () => { active ? await store.deactivateStorage(id) : await store.activateStorage(id) },
            )
          }}>
            {storage.isActive ? 'Deactivate' : 'Activate'}
          </Button>
        </CardFooter>
      {/if}
    </Card>
  {:else}
    <p class="text-muted-foreground">Storage not found.</p>
  {/if}
</div>
<ConfirmDialog bind:open={dialog.open} title={dialog.title} description={dialog.desc} onConfirm={dialog.action} />
