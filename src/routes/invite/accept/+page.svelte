<script lang="ts">
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { useAuth } from '$lib/core/stores/auth.svelte'
  import { Button } from '$lib/components/ui/button'
  import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '$lib/components/ui/card'
  import { SecretInput } from '$lib/components/ui/input'
  import Label from '$lib/components/ui/label/label.svelte'
  import TotpSetupFlow from '$lib/components/auth/TotpSetupFlow.svelte'
  import TriangleAlert from '@lucide/svelte/icons/triangle-alert'
  import { fetchMinPasswordLength, DEFAULT_MIN_PASSWORD_LENGTH } from '$lib/core/api/localauth'

  const auth = useAuth()
  const token = $page.url.searchParams.get('token') ?? ''

  type Step = 'set_password' | 'totp_setup'
  let step = $state<Step>('set_password')
  let password = $state('')
  let error = $state('')
  let submitting = $state(false)
  let minPasswordLength = $state(DEFAULT_MIN_PASSWORD_LENGTH)
  fetchMinPasswordLength().then((v) => { minPasswordLength = v })

  let setupToken = $state('')
  let secretBase32 = $state('')
  let otpauthUri = $state('')

  async function completeSession() {
    await goto('/', { replaceState: true })
    await auth.init()
  }

  async function handleSubmit(e: Event) {
    e.preventDefault()
    error = ''
    submitting = true
    try {
      const res = await fetch('/api/auth/local/invite/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
        credentials: 'same-origin',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Could not accept invite')
      if (data.status === 'totp_setup_required') {
        setupToken = data.setupToken
        secretBase32 = data.secretBase32
        otpauthUri = data.otpauthUri
        step = 'totp_setup'
      } else {
        await completeSession()
      }
    } catch (err: unknown) {
      error = err instanceof Error ? err.message : 'Could not accept invite'
    } finally {
      submitting = false
    }
  }
</script>

<svelte:head><title>Accept invite · mountOS Dashboard</title></svelte:head>

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
        <CardTitle>Welcome to mountOS Dashboard</CardTitle>
        <CardDescription>
          {#if step === 'set_password'}Set a password to activate your account.{:else}Two-factor setup required for this account.{/if}
        </CardDescription>
      </CardHeader>
      <CardContent aria-live="polite">
        {#if !token}
          <div role="alert" class="flex items-start gap-2 rounded-sm border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
            <TriangleAlert class="mt-0.5 size-4 shrink-0" />
            <span>Missing or invalid invite link.</span>
          </div>
        {:else if step === 'set_password'}
          <form onsubmit={handleSubmit} class="space-y-4">
            <div class="space-y-2">
              <Label for="password">Password</Label>
              <SecretInput id="password" bind:value={password} required autocomplete="new-password" minlength={minPasswordLength} />
              <p class="text-xs text-muted-foreground">At least {minPasswordLength} characters.</p>
            </div>
            <Button variant="primary" type="submit" class="w-full" disabled={submitting}>
              {submitting ? 'Activating...' : 'Activate account'}
            </Button>
          </form>
        {:else}
          <TotpSetupFlow
            {secretBase32}
            {otpauthUri}
            onVerify={async (code) => {
              const res = await fetch('/api/auth/local/totp/setup/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ setupToken, code }),
                credentials: 'same-origin',
              })
              const result = await res.json().catch(() => ({}))
              if (!res.ok) throw new Error(result.message || 'Invalid code')
              return result
            }}
            onComplete={completeSession}
          />
        {/if}
      </CardContent>
    </Card>
  </div>
</div>
