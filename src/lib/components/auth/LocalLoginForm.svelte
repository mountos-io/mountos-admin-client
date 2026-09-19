<script lang="ts">
  import { startAuthentication } from '@simplewebauthn/browser'
  import { goto } from '$app/navigation'
  import { useAuth } from '$lib/core/stores/auth.svelte'
  import { Button } from '$lib/components/ui/button'
  import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '$lib/components/ui/card'
  import Input from '$lib/components/ui/input/input.svelte'
  import Label from '$lib/components/ui/label/label.svelte'
  import { Separator } from '$lib/components/ui/separator'
  import TotpSetupFlow from './TotpSetupFlow.svelte'

  const auth = useAuth()

  type Step = 'password' | 'mfa' | 'totp_setup'
  let step = $state<Step>('password')
  let email = $state('')
  let password = $state('')
  let code = $state('')
  let error = $state('')
  let submitting = $state(false)
  let passkeyPending = $state(false)

  let challengeId = $state('')
  let totpEnabled = $state(false)
  let hasPasskey = $state(false)
  let setupToken = $state('')
  let secretBase32 = $state('')
  let otpauthUri = $state('')

  async function post(path: string, body: unknown) {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'same-origin',
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.message || 'Request failed')
    return data
  }

  async function completeSession() {
    await goto('/', { replaceState: true })
    await auth.init()
  }

  async function handlePasswordSubmit(e: Event) {
    e.preventDefault()
    error = ''
    submitting = true
    try {
      const data = await post('/api/auth/local/login', { email: email.trim(), password })
      if (data.status === 'mfa_required') {
        challengeId = data.challengeId
        totpEnabled = data.totpEnabled
        hasPasskey = data.hasPasskey
        step = 'mfa'
      } else if (data.status === 'totp_setup_required') {
        setupToken = data.setupToken
        secretBase32 = data.secretBase32
        otpauthUri = data.otpauthUri
        step = 'totp_setup'
      } else {
        await completeSession()
      }
    } catch (err: unknown) {
      error = err instanceof Error ? err.message : 'Sign in failed'
    } finally {
      submitting = false
    }
  }

  async function handleMfaSubmit(e: Event) {
    e.preventDefault()
    error = ''
    submitting = true
    try {
      await post('/api/auth/local/mfa/verify', { challengeId, code })
      await completeSession()
    } catch (err: unknown) {
      error = err instanceof Error ? err.message : 'Invalid code'
    } finally {
      submitting = false
    }
  }

  async function handlePasskeyAuth() {
    error = ''
    passkeyPending = true
    try {
      const options = await post('/api/auth/local/mfa/passkey/options', { challengeId })
      const assertion = await startAuthentication({ optionsJSON: options })
      await post('/api/auth/local/mfa/passkey/verify', { challengeId, response: assertion })
      await completeSession()
    } catch (err: unknown) {
      error = err instanceof Error ? err.message : 'Passkey sign-in failed'
    } finally {
      passkeyPending = false
    }
  }
</script>

<div class="flex h-screen items-center justify-center">
  <Card cornerBrackets class="w-full max-w-md">
    <CardHeader>
      <CardTitle>Sign in</CardTitle>
      <CardDescription>
        {#if step === 'password'}mountOS Dashboard
        {:else if step === 'mfa'}Verify it's you
        {:else}Set up two-factor authentication
        {/if}
      </CardDescription>
    </CardHeader>
    <CardContent aria-live="polite">
      {#if step === 'password'}
        <form onsubmit={handlePasswordSubmit} class="space-y-4">
          <div class="space-y-2">
            <Label for="email">Email</Label>
            <Input id="email" type="email" bind:value={email} required autocomplete="email" />
          </div>
          <div class="space-y-2">
            <Label for="password">Password</Label>
            <Input id="password" type="password" bind:value={password} required autocomplete="current-password" />
          </div>
          {#if error}<p class="text-destructive text-sm" role="alert">{error}</p>{/if}
          <Button variant="primary" type="submit" class="w-full" disabled={submitting}>
            {submitting ? 'Signing in...' : 'Sign in'}
          </Button>
          <div class="text-center">
            <a href="/password/forgot" class="text-sm text-muted-foreground hover:underline">Forgot password?</a>
          </div>
        </form>
      {:else if step === 'mfa'}
        <div class="space-y-4">
          {#if hasPasskey}
            <Button variant="primary" class="w-full" onclick={handlePasskeyAuth} disabled={passkeyPending}>
              {passkeyPending ? 'Waiting for passkey...' : 'Use a passkey'}
            </Button>
          {/if}
          {#if hasPasskey && totpEnabled}
            <div class="flex items-center gap-3 text-xs text-muted-foreground" aria-hidden="true">
              <span class="h-px flex-1 bg-border"></span>
              or
              <span class="h-px flex-1 bg-border"></span>
            </div>
          {/if}
          {#if totpEnabled}
            <form onsubmit={handleMfaSubmit} class="space-y-4">
              <div class="space-y-2">
                <Label for="code">Authenticator or backup code</Label>
                <Input id="code" bind:value={code} required autocomplete="one-time-code" placeholder="123456" class="h-14 text-center text-2xl font-mono tracking-[0.3em]" />
              </div>
              <Button variant={hasPasskey ? 'outline' : 'primary'} type="submit" class="w-full" disabled={submitting}>
                {submitting ? 'Verifying...' : 'Verify'}
              </Button>
            </form>
          {/if}
          {#if error}<p class="text-destructive text-sm" role="alert">{error}</p>{/if}
        </div>
      {:else}
        <TotpSetupFlow
          {secretBase32}
          {otpauthUri}
          onVerify={(code) => post('/api/auth/local/totp/setup/verify', { setupToken, code })}
          onComplete={completeSession}
        />
      {/if}
    </CardContent>
  </Card>
</div>
