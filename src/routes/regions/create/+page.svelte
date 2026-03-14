<script lang="ts">
  import { goto } from '$app/navigation'
  import { useRegions } from '$lib/core/stores/regions.svelte'
  import { useAccounts } from '$lib/core/stores/accounts.svelte'
  import { useAuth } from '$lib/core/stores/auth.svelte'
  import { Button } from '$lib/components/ui/button'
  import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '$lib/components/ui/card'
  import Input from '$lib/components/ui/input/input.svelte'
  import Label from '$lib/components/ui/label/label.svelte'
  import EmptyState from '$lib/components/shared/EmptyState.svelte'
  import { showSuccessToast, showErrorToast, handleApiError } from '$lib/core/utils/toast'

  const regionStore = useRegions()
  const accountStore = useAccounts()
  const auth = useAuth()
  const accountId = $derived(accountStore.selectedAccountId)

  $effect(() => {
    if (!auth.loading && !auth.can('regions', 'create')) {
      showErrorToast('Access denied')
      goto('/', { replaceState: true })
    }
  })

  let name = $state('')
  let submitting = $state(false)

  async function handleSubmit(e: Event) {
    e.preventDefault()
    if (!name.trim() || !accountId) return
    submitting = true
    try {
      await regionStore.createRegion({ accountId, name: name.trim() })
      showSuccessToast('Region created')
      goto('/regions')
    } catch (err: unknown) {
      handleApiError(err, 'Failed to create region')
    } finally {
      submitting = false
    }
  }
</script>

<div class="mx-auto max-w-lg space-y-6">
  {#if !accountId}
    <EmptyState title="Select an account" description="Choose an account before creating a region." />
  {:else}
    <Card cornerBrackets>
      <CardHeader>
        <CardTitle>Create Region</CardTitle>
        <CardDescription>Add a new region to the current account.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onsubmit={handleSubmit} class="space-y-4">
          <div class="space-y-2">
            <Label for="name">Name</Label>
            <Input id="name" bind:value={name} placeholder="Region name" required />
          </div>
          <div class="flex gap-3 pt-2">
            <Button type="submit" disabled={submitting || !name.trim()}>
              {submitting ? 'Creating...' : 'Create Region'}
            </Button>
            <Button variant="outline" type="button" onclick={() => goto('/regions')}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  {/if}
</div>
