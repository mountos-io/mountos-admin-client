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

  const nameRe = /^[a-z][a-z0-9-]{2,}$/

  let name = $state('')
  let dns = $state('')
  let submitting = $state(false)

  const nameValid = $derived(nameRe.test(name))
  const nameError = $derived(
    !name ? '' :
    /[A-Z]/.test(name) ? 'Lowercase only' :
    /\s/.test(name) ? 'Spaces not allowed' :
    !/^[a-z]/.test(name) ? 'Must start with a letter' :
    /[^a-z0-9-]/.test(name) ? 'Only lowercase letters, digits and hyphens' :
    name.length < 3 ? 'At least 3 characters' : ''
  )

  async function handleSubmit(e: Event) {
    e.preventDefault()
    if (!nameValid || !dns.trim() || !accountId) return
    submitting = true
    try {
      await regionStore.createRegion({ accountId, name: name.trim(), dns: dns.trim() })
      showSuccessToast('Region created')
      goto('/regions')
    } catch (err: unknown) {
      handleApiError(err, 'Failed to create region')
    } finally {
      submitting = false
    }
  }
</script>

<svelte:head><title>Create Region — mountOS Admin</title></svelte:head>

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
            <Input id="name" bind:value={name} placeholder="e.g. ap-south-1a" required autocomplete="off" aria-invalid={!!nameError || undefined} aria-describedby={nameError ? 'name-error' : undefined} />
            {#if nameError}
              <p id="name-error" class="text-destructive text-sm" role="alert">{nameError}</p>
            {/if}
          </div>
          <div class="space-y-2">
            <Label for="dns">Base DNS</Label>
            <Input id="dns" bind:value={dns} placeholder="e.g. ap-south-1a.example.com" required autocomplete="off" />
            <p class="text-muted-foreground text-sm">Used to build the S3 endpoint for direct S3 access.</p>
          </div>
          <div class="flex gap-3 pt-2">
            <Button variant="primary" type="submit" class="cyberpunk-skewed-sm" disabled={submitting || !nameValid || !dns.trim()}>
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
