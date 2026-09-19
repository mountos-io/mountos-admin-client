<script lang="ts">
  import { Button } from '$lib/components/ui/button'
  import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '$lib/components/ui/card'
  import Input from '$lib/components/ui/input/input.svelte'
  import Label from '$lib/components/ui/label/label.svelte'

  let email = $state('')
  let submitting = $state(false)
  let sent = $state(false)

  async function handleSubmit(e: Event) {
    e.preventDefault()
    submitting = true
    try {
      await fetch('/api/auth/local/password/forgot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
    } finally {
      sent = true
      submitting = false
    }
  }
</script>

<svelte:head><title>Forgot password · mountOS Admin</title></svelte:head>

<div class="flex h-screen items-center justify-center">
  <Card cornerBrackets class="w-full max-w-md">
    <CardHeader>
      <CardTitle>Forgot password</CardTitle>
      <CardDescription>We’ll email you a reset link if an account exists.</CardDescription>
    </CardHeader>
    <CardContent>
      {#if sent}
        <p class="text-sm text-muted-foreground">
          If an account exists for that address, a reset link is on its way. Check your inbox.
        </p>
      {:else}
        <form onsubmit={handleSubmit} class="space-y-4">
          <div class="space-y-2">
            <Label for="email">Email</Label>
            <Input id="email" type="email" bind:value={email} required autocomplete="email" />
          </div>
          <Button variant="primary" type="submit" class="w-full" disabled={submitting}>
            {submitting ? 'Sending...' : 'Send reset link'}
          </Button>
        </form>
      {/if}
      <div class="mt-4 text-center">
        <a href="/login" class="text-sm text-muted-foreground hover:underline">Back to sign in</a>
      </div>
    </CardContent>
  </Card>
</div>
