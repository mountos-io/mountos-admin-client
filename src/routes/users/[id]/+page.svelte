<script lang="ts">
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { useUsers } from '$lib/core/stores/users.svelte'
  import { useAuth } from '$lib/core/stores/auth.svelte'
  import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '$lib/components/ui/card'
  import { Button } from '$lib/components/ui/button'
  import Input from '$lib/components/ui/input/input.svelte'
  import Label from '$lib/components/ui/label/label.svelte'
  import StatusBadge from '$lib/components/shared/StatusBadge.svelte'
  import ConfirmDialog from '$lib/components/shared/ConfirmDialog.svelte'
  import LoadingSpinner from '$lib/components/shared/LoadingSpinner.svelte'
  import PencilIcon from '@lucide/svelte/icons/pencil'
  import { showErrorToast, showSuccessToast, handleApiError } from '$lib/core/utils/toast'
  import { useConfirmDialog } from '$lib/stores/confirm-dialog.svelte'
  import type { User } from '$lib/core/api/types'

  const store = useUsers()
  const auth = useAuth()
  const id = $derived(Number($page.params.id))
  const editOnLoad = $derived($page.url.searchParams.has('edit'))

  $effect(() => {
    if (!auth.loading && !auth.can('users', 'read')) {
      showErrorToast('Access denied')
      goto('/', { replaceState: true })
    }
  })

  let user = $state<User | null>(null)
  let loading = $state(true)
  const dialog = useConfirmDialog()

  let editing = $state(false)
  let editUsername = $state('')
  let editEmail = $state('')
  let editName = $state('')
  let editSubmitting = $state(false)

  const usernameRe = /^[a-zA-Z0-9_-]{3,16}$/
  const usernameValid = $derived(usernameRe.test(editUsername))
  const usernameError = $derived(
    !editUsername ? '' :
    /\s/.test(editUsername) ? 'Spaces not allowed' :
    /[^a-zA-Z0-9_-]/.test(editUsername) ? 'Only letters, digits, hyphen and underscore' :
    editUsername.length < 3 ? 'At least 3 characters' :
    editUsername.length > 16 ? 'At most 16 characters' : ''
  )

  function startEdit() {
    if (!user) return
    editUsername = user.username
    editEmail = user.email
    editName = user.name || ''
    editing = true
  }

  function cancelEdit() {
    editing = false
    if (editOnLoad) goto(`/users/${id}`, { replaceState: true })
  }

  async function handleUpdate(e: Event) {
    e.preventDefault()
    if (!usernameValid || !editEmail.trim()) return
    editSubmitting = true
    try {
      await store.editUser(id, {
        username: editUsername.trim(),
        email: editEmail.trim(),
        name: editName.trim() || undefined,
      })
      user = await store.getUser(id)
      editing = false
      showSuccessToast('User updated')
    } catch (err: unknown) {
      handleApiError(err, 'Failed to update user')
    } finally {
      editSubmitting = false
    }
  }

  $effect(() => {
    if (Number.isNaN(id)) { loading = false; return }
    loading = true
    store.getUser(id).then(u => { user = u }).catch(() => { user = null }).finally(() => { loading = false })
  })

  $effect(() => {
    if (editOnLoad && user && !editing && auth.can('users', 'update')) startEdit()
  })


  async function act(fn: () => Promise<void>) {
    await fn()
    user = await store.getUser(id)
  }
</script>

<div class="space-y-6">
  <div class="flex items-center gap-4">
    <Button variant="ghost" size="sm" href="/users">Back</Button>
    <h1 class="text-2xl font-bold tracking-tight">User Detail</h1>
  </div>

  {#if loading}
    <LoadingSpinner />
  {:else if user}
    <div class="grid gap-6 md:grid-cols-2">
      <Card cornerBrackets>
        {#if editing}
          <form onsubmit={handleUpdate} class="flex flex-col gap-6">
            <CardHeader>
              <CardTitle>Edit User</CardTitle>
            </CardHeader>
            <CardContent class="space-y-5">
              <div class="space-y-2">
                <Label for="edit-username">Username</Label>
                <Input id="edit-username" bind:value={editUsername} placeholder="Username" maxlength={16} required aria-invalid={!!usernameError || undefined} aria-describedby={usernameError ? 'edit-username-error' : undefined} />
                {#if usernameError}
                  <p id="edit-username-error" class="text-destructive text-xs" role="alert">{usernameError}</p>
                {/if}
              </div>
              <div class="space-y-2">
                <Label for="edit-email">Email</Label>
                <Input id="edit-email" type="email" bind:value={editEmail} placeholder="user@example.com" required />
              </div>
              <div class="space-y-2">
                <Label for="edit-name">Display Name</Label>
                <Input id="edit-name" bind:value={editName} placeholder="Display name" />
              </div>
            </CardContent>
            <CardFooter class="gap-4">
              <Button variant="primary" type="submit" size="sm" class="cyberpunk-skewed-sm" disabled={editSubmitting || !usernameValid || !editEmail.trim()}>
                {editSubmitting ? 'Updating...' : 'Update'}
              </Button>
              <Button variant="secondary" size="sm" type="button" onclick={cancelEdit} disabled={editSubmitting}>Cancel</Button>
            </CardFooter>
          </form>
        {:else}
          <CardHeader>
            <div class="flex items-center gap-3">
              <CardTitle class="flex-1">{user.username}</CardTitle>
              {#if auth.can('users', 'update')}
                <button
                  type="button"
                  onclick={startEdit}
                  class="opacity-50 hover:opacity-100 hover:text-primary transition-all"
                  title="Edit user"
                  aria-label="Edit user"
                >
                  <PencilIcon class="size-4" aria-hidden="true" />
                </button>
              {/if}
            </div>
          </CardHeader>
          <CardContent class="space-y-3">
            <div>
              <span class="text-sm text-muted-foreground">Status</span>
              <div class="mt-1"><StatusBadge active={user.isActive} /></div>
            </div>
            <div>
              <span class="text-sm text-muted-foreground">Email</span>
              <p class="mt-1 text-sm">{user.email}</p>
            </div>
            <div>
              <span class="text-sm text-muted-foreground">Display Name</span>
              <p class="mt-1 text-sm">{user.name || '—'}</p>
            </div>
          </CardContent>
          {#if auth.can('users', 'update')}
            <CardFooter class="gap-2">
              {#if user.isActive}
                <Button size="sm" onclick={() => dialog.confirm('Deactivate', `Deactivate "${user!.username}"?`, () => act(() => store.deactivateUser(id)))}>Deactivate</Button>
              {:else}
                <Button size="sm" onclick={() => dialog.confirm('Activate', `Activate "${user!.username}"?`, () => act(() => store.activateUser(id)))}>Activate</Button>
              {/if}
            </CardFooter>
          {/if}
        {/if}
      </Card>
    </div>
  {:else}
    <p class="text-muted-foreground">User not found.</p>
  {/if}
</div>

<ConfirmDialog bind:open={dialog.open} title={dialog.title} description={dialog.desc} onConfirm={dialog.action} />
