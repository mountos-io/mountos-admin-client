<script lang="ts">
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { Button } from '$lib/components/ui/button'
  import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '$lib/components/ui/card'
  import Input from '$lib/components/ui/input/input.svelte'
  import Label from '$lib/components/ui/label/label.svelte'
  import TriangleAlert from '@lucide/svelte/icons/triangle-alert'
  import { fetchMinPasswordLength, DEFAULT_MIN_PASSWORD_LENGTH } from '$lib/core/api/localauth'

  const token = $page.url.searchParams.get('token') ?? ''
  let newPassword = $state('')
  let submitting = $state(false)
  let error = $state('')
  let done = $state(false)
  let minPasswordLength = $state(DEFAULT_MIN_PASSWORD_LENGTH)
  fetchMinPasswordLength().then((v) => { minPasswordLength = v })

  async function handleSubmit(e: Event) {
    e.preventDefault()
    error = ''
    submitting = true
    try {
      const res = await fetch('/api/auth/local/password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Reset failed')
      done = true
    } catch (err: unknown) {
      error = err instanceof Error ? err.message : 'Reset failed'
    } finally {
      submitting = false
    }
  }
</script>

<svelte:head><title>Reset password · mountOS Dashboard</title></svelte:head>

<div class="flex h-screen items-center justify-center">
  <div class="w-full max-w-md space-y-3">
    {#if error}
      <div role="alert" class="flex items-start gap-2 rounded-sm border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
        <TriangleAlert class="mt-0.5 size-4 shrink-0" />
        <span>{error}</span>
      </div>
    {/if}
    <Card cornerBrackets class="w-full">
      <CardHeader>
        <CardTitle>Reset password</CardTitle>
        <CardDescription>Choose a new password.</CardDescription>
      </CardHeader>
      <CardContent aria-live="polite">
        {#if !token}
          <div role="alert" class="flex items-start gap-2 rounded-sm border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
            <TriangleAlert class="mt-0.5 size-4 shrink-0" />
            <span>Missing or invalid reset link.</span>
          </div>
        {:else if done}
          <p class="text-sm text-muted-foreground">Password updated. You can sign in now.</p>
          <Button variant="primary" class="mt-4 w-full" onclick={() => goto('/login')}>Back to sign in</Button>
        {:else}
          <form onsubmit={handleSubmit} class="space-y-4">
            <div class="space-y-2">
              <Label for="new-password">New password</Label>
              <Input id="new-password" type="password" bind:value={newPassword} required autocomplete="new-password" minlength={minPasswordLength} />
              <p class="text-xs text-muted-foreground">At least {minPasswordLength} characters.</p>
            </div>
            <Button variant="primary" type="submit" class="w-full" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save new password'}
            </Button>
          </form>
        {/if}
      </CardContent>
    </Card>
  </div>
</div>
