<script lang="ts">
  import { tick } from 'svelte'
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { useClusters } from '$lib/core/stores/clusters.svelte'
  import { Badge } from '$lib/components/ui/badge'
  import { Button } from '$lib/components/ui/button'
  import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card'
  import Input from '$lib/components/ui/input/input.svelte'
  import Label from '$lib/components/ui/label/label.svelte'
  import EmptyState from '$lib/components/shared/EmptyState.svelte'
  import DeactivateClusterDialog from '$lib/components/shared/DeactivateClusterDialog.svelte'
  import { formatRelative } from '$lib/core/utils/format'
  import { showSuccessToast, showErrorToast, handleApiError } from '$lib/core/utils/toast'
  import Copy from '@lucide/svelte/icons/copy'
  import { isClusterNameValid, clusterNameErrorMessage } from '$lib/core/utils/validation'
  import type { RegionCluster } from '$lib/core/api/types'

  const regionId = $derived(Number($page.params.regionId))
  const clusterId = $derived(Number($page.params.clusterId))
  const store = useClusters()

  let cluster = $state<RegionCluster | null>(null)
  let loading = $state(false)
  let editing = $state(false)
  let nameDraft = $state('')
  let renameSubmitting = $state(false)
  let deactivateOpen = $state(false)
  let nameInputEl = $state<HTMLInputElement | null>(null)

  const renameError = $derived(clusterNameErrorMessage(nameDraft))
  const renameValid = $derived(isClusterNameValid(nameDraft))
  const renameUnchanged = $derived(!!cluster && nameDraft.trim() === cluster.name)

  async function load() {
    if (!regionId || !clusterId) return
    loading = true
    try {
      cluster = await store.getCluster(regionId, clusterId)
      nameDraft = cluster.name
    } finally {
      loading = false
    }
  }
  $effect(() => { load() })

  async function startEdit() {
    editing = true
    await tick()
    nameInputEl?.focus()
    nameInputEl?.select()
  }

  function cancelEdit() {
    editing = false
    if (cluster) nameDraft = cluster.name
  }

  async function saveName() {
    if (!cluster || !renameValid || renameUnchanged) return
    renameSubmitting = true
    try {
      await store.editCluster(regionId, clusterId, { name: nameDraft.trim() })
      showSuccessToast('Cluster updated')
      editing = false
      await load()
    } catch (e) {
      handleApiError(e, 'Failed to update cluster')
    } finally {
      renameSubmitting = false
    }
  }

  async function makeDefault() {
    try {
      await store.setDefault(regionId, clusterId)
      showSuccessToast('Default cluster updated')
      await load()
    } catch (e) {
      handleApiError(e, 'Failed to set default')
    }
  }

  async function toggleReady(target: boolean) {
    try {
      await store.setReady(regionId, clusterId, { ready: target })
      showSuccessToast(target ? 'Cluster marked ready' : 'Cluster marked not-ready')
      await load()
    } catch (e) {
      handleApiError(e, 'Failed to update ready flag')
    }
  }

  async function deactivate() {
    try {
      await store.deactivate(regionId, clusterId)
      showSuccessToast('Cluster deactivated')
      goto(`/regions/${regionId}/clusters`)
    } catch (e) {
      handleApiError(e, 'Failed to deactivate')
      throw e
    }
  }
</script>

<svelte:head><title>Cluster · mountOS Admin</title></svelte:head>

<div class="mx-auto max-w-3xl space-y-4">
  {#if loading && !cluster}
    <p class="text-muted-foreground text-base" role="status" aria-live="polite">Loading…</p>
  {:else if !cluster}
    <EmptyState title="Cluster not found" description="It may have been deactivated or never existed." />
  {:else}
    <Card cornerBrackets>
      <CardHeader>
        <CardTitle>
          {#if editing}
            <form
              class="flex flex-wrap items-start gap-2"
              onsubmit={(e) => { e.preventDefault(); saveName() }}
            >
              <div class="flex min-w-0 flex-1 flex-col gap-1">
                <Label for="cluster-rename" class="sr-only">Cluster name</Label>
                <Input
                  id="cluster-rename"
                  bind:value={nameDraft}
                  bind:ref={nameInputEl}
                  class="max-w-xs"
                  autocomplete="off"
                  aria-invalid={!!renameError || undefined}
                  aria-describedby={renameError ? 'cluster-rename-error' : undefined}
                />
                {#if renameError}
                  <p id="cluster-rename-error" class="text-destructive text-sm" role="alert">{renameError}</p>
                {/if}
              </div>
              <div class="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="primary"
                  type="submit"
                  disabled={!renameValid || renameUnchanged || renameSubmitting}
                >
                  {renameSubmitting ? 'Saving…' : 'Save'}
                </Button>
                <Button size="sm" variant="outline" type="button" onclick={cancelEdit} disabled={renameSubmitting}>Cancel</Button>
              </div>
            </form>
          {:else}
            <div class="flex items-center gap-2">
              <span>{cluster.name}</span>
              <Button size="sm" variant="outline" onclick={startEdit}>Rename</Button>
            </div>
          {/if}
        </CardTitle>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="grid grid-cols-1 gap-4 text-base sm:grid-cols-2">
          <div>
            <span class="text-muted-foreground text-sm font-medium">State</span>
            <div class="mt-1 flex flex-wrap gap-1">
              {#if cluster.defaultCluster}<Badge variant="secondary">default</Badge>{/if}
              {#if cluster.isReady}<Badge variant="success">ready</Badge>{:else}<Badge variant="warning">not ready</Badge>{/if}
              {#if !cluster.isActive}<Badge variant="destructive">deactivated</Badge>{/if}
            </div>
          </div>
          <div>
            <span class="text-muted-foreground text-sm font-medium">Updated</span>
            <div class="mt-1">{formatRelative(cluster.updatedAt)}</div>
          </div>
          <div class="sm:col-span-2">
            <span class="text-muted-foreground text-sm font-medium">Export ID</span>
            <div class="mt-1 inline-flex items-center gap-1 font-mono text-xs break-all">
              {cluster.exportId}
              <button
                type="button"
                title="Copy Export ID" aria-label="Copy Export ID {cluster.exportId}"
                class="inline-flex items-center justify-center min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 p-1.5 -m-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onclick={async () => {
                  try { await navigator.clipboard.writeText(cluster!.exportId); showSuccessToast('Copied to clipboard') }
                  catch { showErrorToast('Failed to copy') }
                }}
              >
                <Copy class="size-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        <div class="flex flex-wrap gap-2 pt-2">
          {#if !cluster.defaultCluster && cluster.isActive}
            <Button size="sm" variant="outline" onclick={makeDefault}>Mark default</Button>
          {/if}
          {#if !cluster.isReady}
            <Button size="sm" variant="outline" onclick={() => toggleReady(true)}>Mark ready</Button>
          {:else if !cluster.defaultCluster}
            <Button size="sm" variant="outline" onclick={() => toggleReady(false)}>Mark not-ready</Button>
          {/if}
          {#if !cluster.defaultCluster && cluster.isActive}
            <Button size="sm" variant="destructive" onclick={() => { deactivateOpen = true }}>Deactivate</Button>
          {/if}
        </div>
      </CardContent>
    </Card>

    <DeactivateClusterDialog bind:open={deactivateOpen} clusterName={cluster.name} onConfirm={deactivate} />
  {/if}
</div>
