<script lang="ts">
  import { goto } from '$app/navigation'
  import { useAccounts } from '$lib/core/stores/accounts.svelte'
  import { useAuth } from '$lib/core/stores/auth.svelte'
  import { usePreferences } from '$lib/stores/preferences.svelte'
  import { Button } from '$lib/components/ui/button'
  import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '$lib/components/ui/card'
  import Input from '$lib/components/ui/input/input.svelte'
  import Label from '$lib/components/ui/label/label.svelte'
  import { Textarea } from '$lib/components/ui/textarea'
  import { Separator } from '$lib/components/ui/separator'
  import { showSuccessToast, showErrorToast } from '$lib/core/utils/toast'

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
  let vendorInfoStr = $state('')
  let vendorInfoError = $state('')
  let submitting = $state(false)

  function parseVendorInfo(): Record<string, unknown> | undefined | null {
    const trimmed = vendorInfoStr.trim()
    if (!trimmed) return undefined
    try {
      const parsed = JSON.parse(trimmed)
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        vendorInfoError = 'Must be a JSON object'
        return null
      }
      vendorInfoError = ''
      return parsed
    } catch {
      vendorInfoError = 'Invalid JSON'
      return null
    }
  }

  async function handleSubmit(e: Event) {
    e.preventDefault()
    if (!name.trim()) return
    const vendorInfo = parseVendorInfo()
    if (vendorInfo === null) return
    submitting = true
    try {
      const created = await accountStore.createAccount({
        name: name.trim(),
        description: description.trim() || undefined,
        iconUrl: iconUrl.trim() || undefined,
        vendorInfo,
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
  <Card cornerBrackets>
    <CardHeader>
      <CardTitle>Create Account</CardTitle>
      <CardDescription>Set up a new account with its profile and metadata.</CardDescription>
    </CardHeader>
    <CardContent>
      <form onsubmit={handleSubmit} class="space-y-4">
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
          {#if iconUrl.trim()}
            <div class="flex items-center gap-2 mt-1">
              <img
                src={iconUrl.trim()}
                alt="Preview"
                width={32} height={32}
                class="rounded-full shrink-0"
                style="width: 32px; height: 32px;"
                onerror={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                onload={(e) => { (e.currentTarget as HTMLImageElement).style.display = '' }}
              />
              <span class="text-xs text-muted-foreground">Preview</span>
            </div>
          {/if}
        </div>

        <Separator />

        <div class="space-y-2">
          <Label for="vendorInfo">Vendor Info</Label>
          <p class="text-xs text-muted-foreground">Optional JSON metadata for this account.</p>
          <Textarea id="vendorInfo" bind:value={vendorInfoStr} placeholder={'{"key": "value"}'} rows={4} />
          {#if vendorInfoError}
            <p class="text-xs text-destructive">{vendorInfoError}</p>
          {/if}
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
