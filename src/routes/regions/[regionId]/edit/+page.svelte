<script lang="ts">
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { useRegions } from '$lib/core/stores/regions.svelte'
  import { useAuth } from '$lib/core/stores/auth.svelte'
  import { Button } from '$lib/components/ui/button'
  import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '$lib/components/ui/card'
  import Input from '$lib/components/ui/input/input.svelte'
  import Label from '$lib/components/ui/label/label.svelte'
  import EmptyState from '$lib/components/shared/EmptyState.svelte'
  import { showSuccessToast, showErrorToast, handleApiError } from '$lib/core/utils/toast'
  import type { Region } from '$lib/core/api/types'

  const regionId = $derived(Number($page.params.regionId))
  const regionStore = useRegions()
  const auth = useAuth()

  const nameRe = /^[a-z][a-z0-9-]{2,}$/

  let region = $state<Region | null>(null)
  let loading = $state(false)
  let submitting = $state(false)
  let name = $state('')
  let dns = $state('')

  const nameValid = $derived(nameRe.test(name))
  const nameError = $derived(
    !name ? '' :
    /[A-Z]/.test(name) ? 'Lowercase only' :
    /\s/.test(name) ? 'Spaces not allowed' :
    !/^[a-z]/.test(name) ? 'Must start with a letter' :
    /[^a-z0-9-]/.test(name) ? 'Only lowercase letters, digits and hyphens' :
    name.length < 3 ? 'At least 3 characters' : ''
  )
  const unchanged = $derived(
    !!region && name.trim() === region.name && dns.trim() === region.dns,
  )

  $effect(() => {
    if (!auth.loading && !auth.can('regions', 'update')) {
      showErrorToast('Access denied')
      goto(`/regions/${regionId}`, { replaceState: true })
    }
  })

  async function load() {
    if (!regionId) return
    loading = true
    try {
      region = await regionStore.getRegion(regionId)
      name = region.name
      dns = region.dns
    } catch (e) {
      handleApiError(e, 'Failed to load region')
    } finally {
      loading = false
    }
  }
  $effect(() => { load() })

  async function handleSubmit(e: Event) {
    e.preventDefault()
    if (!region || !nameValid || !dns.trim() || unchanged) return
    submitting = true
    try {
      await regionStore.editRegion(regionId, { accountId: region.accountId, name: name.trim(), dns: dns.trim() })
      showSuccessToast('Region updated')
      goto(`/regions/${regionId}`)
    } catch (err: unknown) {
      handleApiError(err, 'Failed to update region')
    } finally {
      submitting = false
    }
  }
</script>

<svelte:head><title>Edit Region · mountOS Admin</title></svelte:head>

<div class="mx-auto max-w-lg space-y-6">
  {#if loading && !region}
    <p class="text-muted-foreground text-base" role="status" aria-live="polite">Loading…</p>
  {:else if !region}
    <EmptyState title="Region not found" description="It may have been deactivated or never existed." />
  {:else}
    <Card cornerBrackets>
      <CardHeader>
        <CardTitle>Edit Region</CardTitle>
        <CardDescription>Update region name and base DNS.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onsubmit={handleSubmit} class="space-y-4">
          <div class="space-y-2">
            <Label for="name">Name</Label>
            <Input id="name" bind:value={name} required aria-required="true" autocomplete="off" aria-invalid={!!nameError || undefined} aria-describedby={nameError ? 'name-error' : undefined} />
            {#if nameError}
              <p id="name-error" class="text-destructive text-sm" role="alert">{nameError}</p>
            {/if}
          </div>
          <div class="space-y-2">
            <Label for="dns">Base DNS</Label>
            <Input id="dns" bind:value={dns} required aria-required="true" autocomplete="off" />
            <p class="text-muted-foreground text-sm">Used to build the S3 endpoint for direct S3 access.</p>
          </div>
          <div class="flex gap-3 pt-2">
            <Button variant="primary" type="submit" class="cyberpunk-skewed-sm" disabled={submitting || !nameValid || !dns.trim() || unchanged}>
              {submitting ? 'Saving...' : 'Save'}
            </Button>
            <Button variant="outline" type="button" onclick={() => goto(`/regions/${regionId}`)}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  {/if}
</div>
