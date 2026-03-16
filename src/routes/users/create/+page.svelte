<script lang="ts">
  import { goto } from '$app/navigation'
  import { useUsers } from '$lib/core/stores/users.svelte'
  import { useAccounts } from '$lib/core/stores/accounts.svelte'
  import { useAuth } from '$lib/core/stores/auth.svelte'
  import { Button } from '$lib/components/ui/button'
  import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '$lib/components/ui/card'
  import Input from '$lib/components/ui/input/input.svelte'
  import Label from '$lib/components/ui/label/label.svelte'
  import { Separator } from '$lib/components/ui/separator'
  import EmptyState from '$lib/components/shared/EmptyState.svelte'
  import { showSuccessToast, showErrorToast, handleApiError } from '$lib/core/utils/toast'

  const userStore = useUsers()
  const accountStore = useAccounts()
  const auth = useAuth()
  const accountId = $derived(accountStore.selectedAccountId)

  $effect(() => {
    if (!auth.loading && !auth.can('users', 'create')) {
      showErrorToast('Access denied')
      goto('/', { replaceState: true })
    }
  })

  let username = $state('')
  let email = $state('')
  let name = $state('')
  let submitting = $state(false)

  async function handleSubmit(e: Event) {
    e.preventDefault()
    if (!username.trim() || !email.trim() || !accountId) return
    submitting = true
    try {
      await userStore.addUser({
        accountId,
        username: username.trim(),
        email: email.trim(),
        name: name.trim() || undefined,
      })
      showSuccessToast('User added')
      goto('/users')
    } catch (err: unknown) {
      handleApiError(err, 'Failed to add user')
    } finally {
      submitting = false
    }
  }
</script>

<div class="mx-auto max-w-lg space-y-6">
  {#if !accountId}
    <EmptyState title="Select an account" description="Choose an account before adding a user." />
  {:else}
    <Card cornerBrackets>
      <CardHeader>
        <CardTitle>Add User</CardTitle>
        <CardDescription>Add a user to the current account.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onsubmit={handleSubmit} class="space-y-4">
          <div class="space-y-2">
            <Label for="username">Username</Label>
            <Input id="username" bind:value={username} placeholder="Username" required />
          </div>
          <div class="space-y-2">
            <Label for="email">Email</Label>
            <Input id="email" type="email" bind:value={email} placeholder="user@example.com" required />
          </div>
          <div class="space-y-2">
            <Label for="name">Display Name</Label>
            <Input id="name" bind:value={name} placeholder="Optional display name" />
          </div>

          <Separator />

          <div class="flex gap-3 pt-2">
            <Button type="submit" disabled={submitting || !username.trim() || !email.trim()}>
              {submitting ? 'Adding...' : 'Add User'}
            </Button>
            <Button variant="outline" type="button" onclick={() => goto('/users')}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  {/if}
</div>
