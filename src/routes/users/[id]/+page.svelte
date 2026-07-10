<script lang="ts">
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { useUsers } from '$lib/core/stores/users.svelte'
  import { useAuth } from '$lib/core/stores/auth.svelte'
  import { ROLE } from '$lib/core/auth/adapter'
  import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '$lib/components/ui/card'
  import { Button } from '$lib/components/ui/button'
  import Input from '$lib/components/ui/input/input.svelte'
  import Label from '$lib/components/ui/label/label.svelte'
  import { Badge } from '$lib/components/ui/badge'
  import StatusBadge from '$lib/components/shared/StatusBadge.svelte'
  import ConfirmDialog from '$lib/components/shared/ConfirmDialog.svelte'
  import DetailSkeleton from '$lib/components/shared/DetailSkeleton.svelte'
  import ArrowLeft from '@lucide/svelte/icons/arrow-left'
  import PencilIcon from '@lucide/svelte/icons/pencil'
  import { showErrorToast, showSuccessToast, handleApiError } from '$lib/core/utils/toast'
  import { isUsernameValid, usernameErrorMessage } from '$lib/core/utils/validation'
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

  const usernameValid = $derived(isUsernameValid(editUsername))
  const usernameError = $derived(usernameErrorMessage(editUsername))

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

  let fetchCtrl: AbortController | undefined
  $effect(() => {
    if (Number.isNaN(id)) { loading = false; return }
    fetchCtrl?.abort()
    fetchCtrl = new AbortController()
    const ctrl = fetchCtrl
    loading = true
    store.getUser(id).then(u => { if (!ctrl.signal.aborted) user = u }).catch(() => { if (!ctrl.signal.aborted) user = null }).finally(() => { if (!ctrl.signal.aborted) loading = false })
  })

  $effect(() => {
    if (editOnLoad && user && !editing && auth.can('users', 'update')) startEdit()
  })

  async function act(fn: () => Promise<void>) {
    await fn()
    user = await store.getUser(id)
  }
</script>

<svelte:head><title>{user?.username ?? 'User'} · mountOS Admin</title></svelte:head>

<div class="space-y-6">
  <div class="flex items-center gap-4">
    <Button variant="ghost" size="sm" href="/users" class="min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0" aria-label="Back to users"><ArrowLeft class="h-4 w-4" /></Button>
    <h1 class="text-2xl font-bold tracking-tight">{user?.username ?? 'User'}</h1>
    {#if user}<Badge variant="outline" style="border-color: var(--pastel-user); color: var(--pastel-user-text)">User</Badge>{/if}
  </div>

  {#if loading}
    <DetailSkeleton gridCols={2} cards={[{ rows: 3, cols: 1 }]} />
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
                <Input id="edit-username" bind:value={editUsername} placeholder="Username" maxlength={16} required aria-required="true" autocomplete="username" aria-invalid={!!usernameError || undefined} aria-describedby={usernameError ? 'edit-username-error' : undefined} />
                {#if usernameError}
                  <p id="edit-username-error" class="text-destructive text-xs" role="alert">{usernameError}</p>
                {/if}
              </div>
              <div class="space-y-2">
                <Label for="edit-email">Email</Label>
                <Input id="edit-email" type="email" bind:value={editEmail} placeholder="user@example.com" required aria-required="true" autocomplete="email" />
              </div>
              <div class="space-y-2">
                <Label for="edit-name">Display Name</Label>
                <Input id="edit-name" bind:value={editName} placeholder="Display name" autocomplete="name" />
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
                  class="inline-flex items-center justify-center min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 opacity-60 hover:opacity-100 hover:text-primary transition-[color,opacity] focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
                  title="Edit user"
                  aria-label="Edit user"
                >
                  <PencilIcon class="size-4" aria-hidden="true" />
                </button>
              {/if}
            </div>
          </CardHeader>
          <CardContent>
            <dl class="space-y-3">
              <div>
                <dt class="text-sm font-medium text-muted-foreground">Status</dt>
                <dd class="mt-1"><StatusBadge active={user.isActive} /></dd>
              </div>
              <div>
                <dt class="text-sm font-medium text-muted-foreground">Email</dt>
                <dd class="mt-1 text-sm">{user.email}</dd>
              </div>
              <div>
                <dt class="text-sm font-medium text-muted-foreground">Display Name</dt>
                <dd class="mt-1 text-sm">{user.name || '·'}</dd>
              </div>
            </dl>
          </CardContent>
          {#if auth.can('users', 'update')}
            <CardFooter class="gap-2">
              {#if user.isActive}
                <Button variant="destructive" size="sm" onclick={() => dialog.confirm('Deactivate', `Permanently deactivate "${user!.username}"?`, () => act(() => store.deactivateUser(id)), 'destructive')}>Deactivate</Button>
              {/if}
              {#if auth.user?.role === ROLE.superadmin && user.username}
                <Button variant="outline" size="sm" onclick={() => dialog.confirm(
                  'Revoke Admin Sessions',
                  `Revoke all admin dashboard sessions for "${user!.username}"? They will be signed out immediately.`,
                  async () => { await store.revokeAdminSessions(user!.username!); showSuccessToast('Admin sessions revoked') },
                  'destructive',
                )}>Revoke Sessions</Button>
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

<ConfirmDialog bind:open={dialog.open} title={dialog.title} description={dialog.desc} variant={dialog.variant} onConfirm={dialog.action} />
