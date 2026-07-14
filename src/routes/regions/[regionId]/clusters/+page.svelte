<script lang="ts">
  import { tick } from 'svelte'
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { useClusters } from '$lib/core/stores/clusters.svelte'
  import { useAuth } from '$lib/core/stores/auth.svelte'
  import { Badge } from '$lib/components/ui/badge'
  import { Button } from '$lib/components/ui/button'
  import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card'
  import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '$lib/components/ui/table'
  import { Popover, PopoverTrigger, PopoverContent } from '$lib/components/ui/popover'
  import * as Dialog from '$lib/components/ui/dialog'
  import Input from '$lib/components/ui/input/input.svelte'
  import Label from '$lib/components/ui/label/label.svelte'
  import EmptyState from '$lib/components/shared/EmptyState.svelte'
  import InfoTip from '$lib/components/shared/InfoTip.svelte'
  import TableSkeleton from '$lib/components/shared/TableSkeleton.svelte'
  import DeactivateClusterDialog from '$lib/components/shared/DeactivateClusterDialog.svelte'
  import { formatRelative } from '$lib/core/utils/format'
  import { showSuccessToast, showErrorToast, handleApiError } from '$lib/core/utils/toast'
  import { copyText } from '$lib/core/utils/clipboard'
  import { isClusterNameValid, clusterNameErrorMessage } from '$lib/core/utils/validation'
  import type { RegionCluster } from '$lib/core/api/types'
  import Copy from '@lucide/svelte/icons/copy'
  import MoreVertical from '@lucide/svelte/icons/more-vertical'

  const regionId = $derived(Number($page.params.regionId))
  const store = useClusters()
  const auth = useAuth()

  $effect(() => { if (regionId) store.fetchClusters(regionId) })

  const clusters = $derived(store.clustersFor(regionId))
  const loading = $derived(store.isLoading(regionId))

  let openMenuId = $state<number | null>(null)
  let renameTarget = $state<RegionCluster | null>(null)
  let renameDraft = $state('')
  let renameSubmitting = $state(false)
  let renameInputEl = $state<HTMLInputElement | null>(null)
  let deactivateTarget = $state<RegionCluster | null>(null)

  const renameError = $derived(clusterNameErrorMessage(renameDraft))
  const renameValid = $derived(isClusterNameValid(renameDraft))
  const renameUnchanged = $derived(!!renameTarget && renameDraft.trim() === renameTarget.name)

  async function copyExportId(exportId: string) {
    if (await copyText(exportId)) {
      showSuccessToast('Copied to clipboard')
    } else {
      showErrorToast('Failed to copy')
    }
  }

  async function openRename(c: RegionCluster) {
    openMenuId = null
    renameTarget = c
    renameDraft = c.name
    await tick()
    renameInputEl?.focus()
    renameInputEl?.select()
  }

  async function saveRename() {
    if (!renameTarget || !renameValid || renameUnchanged) return
    renameSubmitting = true
    try {
      await store.editCluster(regionId, renameTarget.id, { name: renameDraft.trim() })
      showSuccessToast('Cluster renamed')
      renameTarget = null
    } catch (e) {
      handleApiError(e, 'Failed to rename cluster')
    } finally {
      renameSubmitting = false
    }
  }

  async function makeDefault(c: RegionCluster) {
    openMenuId = null
    try {
      await store.setDefault(regionId, c.id)
      showSuccessToast(`"${c.name}" is now the default cluster`)
    } catch (e) {
      handleApiError(e, 'Failed to set default')
    }
  }

  async function toggleReady(c: RegionCluster, target: boolean) {
    openMenuId = null
    try {
      await store.setReady(regionId, c.id, { ready: target })
      showSuccessToast(target ? `"${c.name}" marked ready` : `"${c.name}" marked not-ready`)
    } catch (e) {
      handleApiError(e, 'Failed to update ready flag')
    }
  }

  function openDeactivate(c: RegionCluster) {
    openMenuId = null
    deactivateTarget = c
  }

  async function confirmDeactivate() {
    if (!deactivateTarget) return
    await store.deactivate(regionId, deactivateTarget.id)
    showSuccessToast(`"${deactivateTarget.name}" deactivated`)
    deactivateTarget = null
  }
</script>

<svelte:head><title>Region Clusters · mountOS Admin</title></svelte:head>

<div class="mx-auto max-w-5xl space-y-4">
  {#snippet headerRow()}
    <TableRow>
      <TableHead>Name</TableHead>
      <TableHead class="hidden lg:table-cell">
        <span class="inline-flex items-center gap-1">
          Export ID
          <InfoTip text="Set as env on service instances to pin them to this specific cluster within the region." />
        </span>
      </TableHead>
      <TableHead>State</TableHead>
      <TableHead>Updated</TableHead>
      {#if !auth.isUserRole}<TableHead class="w-12"></TableHead>{/if}
    </TableRow>
  {/snippet}

  <Card cornerBrackets>
    <CardHeader class="flex flex-row items-center justify-between gap-4">
      <div>
        <CardTitle>
            <span class="inline-flex items-center gap-1">
              Region Clusters
              <InfoTip text="Volumes can only be assigned once the cluster is marked ready." />
            </span>
        </CardTitle>
        <p class="text-muted-foreground text-base">
          Logical grouping of in-region service nodes used for tenant isolation, load balancing, or availability and placement control.
        </p>
      </div>
      {#if !auth.isUserRole}
        <Button variant="primary" onclick={() => goto(`/regions/${regionId}/clusters/create`)}>New cluster</Button>
      {/if}
    </CardHeader>

    <CardContent>
      {#if loading && clusters.length === 0}
        <TableSkeleton
          header={headerRow}
          caption="Loading clusters"
          cells={[
            { width: 'w-32' },
            { width: 'w-40', class: 'hidden lg:table-cell' },
            { width: 'w-20', height: 'h-5' },
            { width: 'w-20' },
            ...(!auth.isUserRole ? [{ width: 'w-8' }] : []),
          ]}
        />
      {:else if clusters.length === 0}
        <EmptyState title="No clusters" description="Create one to start grouping instances and volumes." />
      {:else}
        <Table>
          <TableHeader>
            {@render headerRow()}
          </TableHeader>
          <TableBody>
            {#each clusters as c (c.id)}
              <TableRow>
                <TableCell>
                  <a
                    href={`/regions/${regionId}/clusters/${c.id}`}
                    class="inline-flex min-h-[44px] items-center font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >{c.name}</a>
                </TableCell>
                <TableCell class="hidden lg:table-cell">
                  <span class="inline-flex items-center gap-1 font-mono text-sm">
                    {c.exportId}
                    <button
                      type="button"
                      title="Copy Export ID" aria-label="Copy Export ID {c.exportId}"
                      class="inline-flex items-center justify-center min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 p-1.5 -m-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onclick={() => copyExportId(c.exportId)}
                    >
                      <Copy class="size-3.5" aria-hidden="true" />
                    </button>
                  </span>
                </TableCell>
                <TableCell class="space-x-1">
                  {#if c.defaultCluster}
                    <Badge variant="secondary">default</Badge>
                  {/if}
                  {#if c.isReady}
                    <Badge variant="success">ready</Badge>
                  {:else}
                    <Badge variant="warning">
                      not ready
                      <InfoTip text="Auto-flips to ready when any instance heartbeats this cluster, or click set-ready manually." />
                    </Badge>
                  {/if}
                  {#if !c.isActive}
                    <Badge variant="destructive">deactivated</Badge>
                  {/if}
                </TableCell>
                <TableCell>{formatRelative(c.updatedAt)}</TableCell>
                {#if !auth.isUserRole}
                <TableCell>
                  <Popover
                    open={openMenuId === c.id}
                    onOpenChange={(v) => (openMenuId = v ? c.id : null)}
                  >
                    <PopoverTrigger>
                      {#snippet child({ props })}
                        <button
                          {...props}
                          type="button"
                          aria-label="Cluster actions"
                          aria-haspopup="menu"
                          aria-expanded={openMenuId === c.id}
                          class="inline-flex h-9 w-9 min-h-[44px] min-w-[44px] sm:min-h-9 sm:min-w-9 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <MoreVertical class="h-4 w-4" />
                        </button>
                      {/snippet}
                    </PopoverTrigger>
                    <PopoverContent class="w-48 p-1" align="end">
                      <div role="menu" aria-label="Cluster {c.name} actions">
                        <button
                          type="button"
                          role="menuitem"
                          class="flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                          onclick={() => openRename(c)}
                        >Rename</button>
                        {#if !c.defaultCluster && c.isActive}
                          <button
                            type="button"
                            role="menuitem"
                            class="flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                            onclick={() => makeDefault(c)}
                          >Mark default</button>
                        {/if}
                        {#if !c.isReady}
                          <button
                            type="button"
                            role="menuitem"
                            class="flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                            onclick={() => toggleReady(c, true)}
                          >Mark ready</button>
                        {:else if !c.defaultCluster}
                          <button
                            type="button"
                            role="menuitem"
                            class="flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                            onclick={() => toggleReady(c, false)}
                          >Mark not-ready</button>
                        {/if}
                        {#if !c.defaultCluster && c.isActive}
                          <div class="my-1 h-px bg-border/50" role="separator"></div>
                          <button
                            type="button"
                            role="menuitem"
                            class="flex w-full items-center rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10 focus-visible:bg-destructive/10 focus-visible:outline-none"
                            onclick={() => openDeactivate(c)}
                          >Deactivate</button>
                        {/if}
                      </div>
                    </PopoverContent>
                  </Popover>
                </TableCell>
                {/if}
              </TableRow>
            {/each}
          </TableBody>
        </Table>
      {/if}
    </CardContent>
  </Card>
</div>

<Dialog.Root open={renameTarget !== null} onOpenChange={(v) => { if (!v) renameTarget = null }}>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title>Rename cluster</Dialog.Title>
    </Dialog.Header>
    <form
      class="space-y-3 py-1"
      onsubmit={(e) => { e.preventDefault(); saveRename() }}
    >
      <Label for="cluster-rename-input">Name</Label>
      <Input
        id="cluster-rename-input"
        bind:value={renameDraft}
        bind:ref={renameInputEl}
        autocomplete="off"
        aria-invalid={!!renameError || undefined}
        aria-describedby={renameError ? 'cluster-rename-input-error' : undefined}
      />
      {#if renameError}
        <p id="cluster-rename-input-error" class="text-destructive text-sm" role="alert">{renameError}</p>
      {/if}
      <Dialog.Footer>
        <Button variant="outline" type="button" onclick={() => (renameTarget = null)} disabled={renameSubmitting}>Cancel</Button>
        <Button variant="primary" type="submit" disabled={!renameValid || renameUnchanged || renameSubmitting}>
          {renameSubmitting ? 'Saving…' : 'Save'}
        </Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>

{#if deactivateTarget}
  <DeactivateClusterDialog
    open={true}
    clusterName={deactivateTarget.name}
    onConfirm={confirmDeactivate}
  />
{/if}
