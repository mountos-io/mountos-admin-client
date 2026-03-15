<script lang="ts">
  import { goto } from '$app/navigation'
  import { useAccounts } from '$lib/core/stores/accounts.svelte'
  import { useAuth } from '$lib/core/stores/auth.svelte'
  import { usePreferences } from '$lib/stores/preferences.svelte'
  import { Button } from '$lib/components/ui/button'
  import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '$lib/components/ui/card'
  import Input from '$lib/components/ui/input/input.svelte'
  import Label from '$lib/components/ui/label/label.svelte'
  import { showSuccessToast, showErrorToast, handleApiError } from '$lib/core/utils/toast'
  import { debounce } from '$lib/utils'

  const accountStore = useAccounts()
  const auth = useAuth()
  const prefs = usePreferences()

  $effect(() => {
    if (!auth.loading && !auth.can('accounts', 'create')) {
      showErrorToast('Access denied')
      goto('/', { replaceState: true })
    }
  })

  let name = $state('')
  let description = $state('')
  let iconUrl = $state('')
  let submitting = $state(false)
  let iconError = $state(false)
  let previewUrl = $state('')

  const updatePreview = debounce((url: string) => { previewUrl = url }, 300)

  $effect(() => {
    const url = iconUrl.trim()
    iconError = false
    if (!url) previewUrl = ''
    else updatePreview(url)
  })

  async function handleSubmit(e: Event) {
    e.preventDefault()
    if (!name.trim()) return
    submitting = true
    try {
      const created = await accountStore.createAccount({
        name: name.trim(),
        description: description.trim() || undefined,
        iconUrl: iconUrl.trim() || undefined,
      })
      if (created?.id) {
        accountStore.selectAccount(created.id)
        prefs.defaultAccountId = created.id
      }
      showSuccessToast('Account created')
      goto('/')
    } catch (err: unknown) {
      handleApiError(err, 'Failed to create account')
    } finally {
      submitting = false
    }
  }
</script>

<div class="mx-auto max-w-xl">
  <Card cornerBrackets>
    <form onsubmit={handleSubmit}>
      <CardHeader>
        <div class="flex items-start justify-between gap-4">
          <div>
            <CardTitle>Create Account</CardTitle>
            <CardDescription>Set up a new account with its profile.</CardDescription>
          </div>
          <div class="size-14 rounded-lg border border-border bg-muted/50 flex items-center justify-center overflow-hidden shrink-0">
            {#if previewUrl && !iconError}
              <img
                src={previewUrl}
                alt="Icon"
                class="size-full object-cover"
                onerror={() => { iconError = true }}
              />
            {:else}
              <span class="text-muted-foreground/40 text-xl">?</span>
            {/if}
          </div>
        </div>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="space-y-2">
          <Label for="name">Name</Label>
          <Input id="name" bind:value={name} placeholder="Account name" required />
        </div>
        <div class="space-y-2">
          <Label for="description">Description</Label>
          <Input id="description" bind:value={description} placeholder="Optional description" />
        </div>
        <div class="space-y-2">
          <Label for="iconUrl">Icon URL</Label>
          <Input id="iconUrl" bind:value={iconUrl} placeholder="https://example.com/icon.png" />
        </div>
        <div class="flex gap-3 pt-2">
          <Button type="submit" disabled={submitting || !name.trim()}>
            {submitting ? 'Creating...' : 'Create Account'}
          </Button>
          <Button variant="outline" type="button" onclick={() => goto('/accounts')}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </form>
  </Card>
</div>
