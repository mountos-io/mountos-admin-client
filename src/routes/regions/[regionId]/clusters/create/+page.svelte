<script lang="ts">
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { useClusters } from '$lib/core/stores/clusters.svelte'
  import { Button } from '$lib/components/ui/button'
  import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '$lib/components/ui/card'
  import Input from '$lib/components/ui/input/input.svelte'
  import Label from '$lib/components/ui/label/label.svelte'
  import { showSuccessToast, handleApiError } from '$lib/core/utils/toast'
  import { isClusterNameValid, clusterNameErrorMessage } from '$lib/core/utils/validation'

  const regionId = $derived(Number($page.params.regionId))
  const store = useClusters()

  let name = $state('')
  let submitting = $state(false)

  const nameValid = $derived(isClusterNameValid(name))
  const nameError = $derived(clusterNameErrorMessage(name))

  async function handleSubmit(e: Event) {
    e.preventDefault()
    if (!nameValid) return
    submitting = true
    try {
      await store.createCluster(regionId, { name: name.trim() })
      showSuccessToast('Cluster created')
      goto(`/regions/${regionId}/clusters`)
    } catch (err) {
      handleApiError(err, 'Failed to create cluster')
    } finally {
      submitting = false
    }
  }
</script>

<svelte:head><title>Create Cluster · mountOS Admin</title></svelte:head>

<div class="mx-auto max-w-lg space-y-6">
  <Card cornerBrackets>
    <CardHeader>
      <CardTitle>Create region cluster</CardTitle>
      <CardDescription>Clusters group instances inside a region. New clusters start non-default and not-ready.</CardDescription>
    </CardHeader>
    <CardContent>
      <form onsubmit={handleSubmit} class="space-y-4">
        <div class="space-y-2">
          <Label for="name">Name</Label>
          <Input id="name" bind:value={name} placeholder="e.g. tenant-acme" required aria-required="true" autocomplete="off" aria-invalid={!!nameError || undefined} aria-describedby={nameError ? 'name-error' : undefined} />
          {#if nameError}
            <p id="name-error" class="text-destructive text-sm" role="alert">{nameError}</p>
          {/if}
        </div>
        <div class="flex gap-3 pt-2">
          <Button variant="primary" type="submit" disabled={submitting || !nameValid}>
            {submitting ? 'Creating…' : 'Create cluster'}
          </Button>
          <Button variant="outline" type="button" onclick={() => goto(`/regions/${regionId}/clusters`)}>
            Cancel
          </Button>
        </div>
      </form>
    </CardContent>
  </Card>
</div>
