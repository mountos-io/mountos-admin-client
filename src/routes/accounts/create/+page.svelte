<script lang="ts">
  import { goto } from '$app/navigation'
  import { useAccounts } from '$lib/core/stores/accounts.svelte'
  import { usePreferences } from '$lib/stores/preferences.svelte'
  import { Button } from '$lib/components/ui/button'
  import { Card, CardContent } from '$lib/components/ui/card'
  import Input from '$lib/components/ui/input/input.svelte'
  import Label from '$lib/components/ui/label/label.svelte'
  import { showSuccessToast, showErrorToast } from '$lib/core/utils/toast'

  const accountStore = useAccounts()
  const prefs = usePreferences()

  let name = $state('')
  let description = $state('')
  let submitting = $state(false)

  async function handleSubmit(e: Event) {
    e.preventDefault()
    if (!name.trim()) return
    submitting = true
    try {
      const created = await accountStore.createAccount({
        name: name.trim(),
        description: description.trim() || undefined,
      })
      if (created?.id) {
        accountStore.selectAccount(created.id)
        prefs.defaultAccountId = created.id
      }
      showSuccessToast('Account created')
      goto('/')
    } catch (err) {
      showErrorToast('Failed to create account')
    } finally {
      submitting = false
    }
  }
</script>

<div class="mx-auto max-w-lg space-y-6">
  <h2 class="text-2xl font-bold tracking-tight">Create Account</h2>
  <Card>
    <CardContent class="pt-6">
      <form onsubmit={handleSubmit} class="space-y-4">
        <div class="space-y-2">
          <Label for="name">Name</Label>
          <Input id="name" bind:value={name} placeholder="Account name" required />
        </div>
        <div class="space-y-2">
          <Label for="description">Description</Label>
          <Input id="description" bind:value={description} placeholder="Optional description" />
        </div>
        <div class="flex gap-3 pt-2">
          <Button type="submit" disabled={submitting || !name.trim()}>
            {submitting ? 'Creating...' : 'Create Account'}
          </Button>
          <Button variant="outline" type="button" onclick={() => goto('/accounts')}>
            Cancel
          </Button>
        </div>
      </form>
    </CardContent>
  </Card>
</div>
