<script lang="ts">
  import * as jose from 'jose'
  import { ROLE } from '$lib/core/auth/adapter'
  import { Button } from '$lib/components/ui/button'
  import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '$lib/components/ui/card'
  import Input from '$lib/components/ui/input/input.svelte'
  import SecretInput from '$lib/components/ui/input/secret-input.svelte'
  import Label from '$lib/components/ui/label/label.svelte'
  import { Select } from '$lib/components/ui/select'
  import { copyText } from '$lib/core/utils/clipboard'
  import { showSuccessToast, showErrorToast } from '$lib/core/utils/toast'
  import TriangleAlert from '@lucide/svelte/icons/triangle-alert'
  import ExternalLink from '@lucide/svelte/icons/external-link'
  import RefreshCw from '@lucide/svelte/icons/refresh-cw'
  import Copy from '@lucide/svelte/icons/copy'
  import Check from '@lucide/svelte/icons/check'

  // Mirrors gen/test-token.ts so the URL this page produces matches
  // `make generate-test-token`: an Ed25519 (EdDSA) provider JWT valid for 60s,
  // audience mountos/dashboard, signed locally with the base64 seed.
  const PKCS8_ED25519_PREFIX = Uint8Array.from([
    0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06,
    0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20,
  ])
  const AUDIENCE = 'mountos/dashboard'
  const EXPIRES_IN = '60s'

  const roleOptions = [
    { value: ROLE.superadmin, label: 'superadmin' },
    { value: ROLE.l1admin, label: 'l1admin' },
    { value: ROLE.l2admin, label: 'l2admin' },
    { value: ROLE.user, label: 'user' },
  ]

  let sub = $state('test-user')
  let name = $state('Test User')
  let email = $state('test@localhost')
  let role = $state<string>(ROLE.superadmin)
  let username = $state('')
  let accountId = $state('')
  let signingKey = $state('')

  let generatedUrl = $state('')
  let error = $state('')
  let generating = $state(false)
  let copied = $state(false)

  const isUserRole = $derived(role === ROLE.user)

  function base64ToBytes(b64: string): Uint8Array {
    const norm = b64.trim().replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/')
    const bin = atob(norm)
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  }

  async function generate() {
    error = ''
    generating = true
    try {
      if (!signingKey.trim()) throw new Error('Signing key is required')
      if (isUserRole && (!username.trim() || !accountId.trim())) {
        throw new Error('role=user requires a username and account id')
      }

      let seed: Uint8Array
      try {
        seed = base64ToBytes(signingKey)
      } catch {
        throw new Error('Signing key is not valid base64')
      }
      if (seed.length !== 32) {
        throw new Error(`Signing key must decode to 32 bytes (got ${seed.length})`)
      }

      const pkcs8 = new Uint8Array(PKCS8_ED25519_PREFIX.length + seed.length)
      pkcs8.set(PKCS8_ED25519_PREFIX)
      pkcs8.set(seed, PKCS8_ED25519_PREFIX.length)
      const privateKey = await crypto.subtle.importKey('pkcs8', pkcs8, { name: 'Ed25519' }, false, ['sign'])

      const claims: Record<string, string> = { name, email, role }
      if (username.trim()) claims.username = username.trim()
      if (accountId.trim()) claims.account_id = accountId.trim()

      const token = await new jose.SignJWT(claims)
        .setProtectedHeader({ alg: 'EdDSA' })
        .setSubject(sub.trim() || 'test-user')
        .setAudience(AUDIENCE)
        .setIssuedAt()
        .setExpirationTime(EXPIRES_IN)
        .sign(privateKey)

      // Sign in against this page's own origin, whatever host it is served from.
      const url = new URL(window.location.origin)
      url.searchParams.set('token', token)
      generatedUrl = url.toString()
    } catch (e) {
      generatedUrl = ''
      error = e instanceof Error ? e.message : 'Failed to generate token'
    } finally {
      generating = false
    }
  }

  function openUrl() {
    if (generatedUrl) window.open(generatedUrl, '_blank', 'noopener')
  }

  async function copyUrl() {
    if (!generatedUrl) return
    if (await copyText(generatedUrl)) {
      copied = true
      showSuccessToast('Login URL copied')
      setTimeout(() => (copied = false), 1500)
    } else {
      showErrorToast('Copy failed')
    }
  }
</script>

<svelte:head>
  <title>Login-Token Generator (internal)</title>
</svelte:head>

<div class="min-h-screen w-full bg-background text-foreground">
  <div class="mx-auto max-w-2xl px-4 py-8 space-y-6">
    <div class="rounded-sm border-2 border-warning/60 bg-warning/10">
      <div class="flex items-start gap-3 px-5 py-4">
        <TriangleAlert class="size-7 shrink-0 text-warning" aria-hidden="true" />
        <div>
          <h1 class="text-lg font-bold uppercase tracking-wide text-warning">Internal · Test Login-Token Generator</h1>
          <p class="mt-1 text-sm text-muted-foreground">
            Signs a short-lived provider JWT in your browser and builds a login URL for this origin.
            Not linked from the app — for local development only.
          </p>
        </div>
      </div>
    </div>

    <Card>
      <CardHeader>
        <CardTitle>Token details</CardTitle>
        <CardDescription>Same claims as <code class="text-xs">make generate-test-token</code>.</CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="space-y-2">
          <Label for="signingKey">Signing key</Label>
          <SecretInput id="signingKey" bind:value={signingKey} placeholder="base64 seed" autocomplete="off" spellcheck={false} />
          <p class="text-xs text-muted-foreground">
            Provider→dashboard signing key (base64). Same value as <code>PROVIDER2DASHBOARD_SIGNING_KEY</code>.
            Stays in this tab; never sent anywhere.
          </p>
        </div>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div class="space-y-2">
            <Label for="sub">Subject (sub)</Label>
            <Input id="sub" bind:value={sub} placeholder="test-user" autocomplete="off" />
          </div>
          <div class="space-y-2">
            <Label for="role" id="role-label">Role</Label>
            <Select id="role" options={roleOptions} bind:value={role} ariaLabelledby="role-label" />
          </div>
          <div class="space-y-2">
            <Label for="name">Name</Label>
            <Input id="name" bind:value={name} placeholder="Test User" autocomplete="off" />
          </div>
          <div class="space-y-2">
            <Label for="email">Email</Label>
            <Input id="email" bind:value={email} placeholder="test@localhost" autocomplete="off" />
          </div>
          {#if isUserRole}
            <div class="space-y-2">
              <Label for="username">Username</Label>
              <Input id="username" bind:value={username} placeholder="required for role=user" autocomplete="off" aria-required="true" />
            </div>
            <div class="space-y-2">
              <Label for="accountId">Account ID</Label>
              <Input id="accountId" bind:value={accountId} placeholder="required for role=user" autocomplete="off" aria-required="true" />
            </div>
          {/if}
        </div>

        {#if error}
          <p class="text-sm text-destructive" role="alert">{error}</p>
        {/if}

        <div class="pt-1">
          <Button variant="primary" class="cyberpunk-skewed-sm" onclick={generate} disabled={generating || !signingKey.trim()}>
            {generating ? 'Generating…' : generatedUrl ? 'Regenerate' : 'Generate login URL'}
          </Button>
        </div>
      </CardContent>
    </Card>

    {#if generatedUrl}
      <Card>
        <CardHeader>
          <CardTitle>Login URL</CardTitle>
          <CardDescription>Token expires 60 seconds after generation — regenerate if it lapses.</CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <div class="rounded-sm border border-border bg-muted/40 px-3 py-2 font-mono text-xs break-all select-all">
            {generatedUrl}
          </div>
          <div class="flex flex-wrap gap-3">
            <Button variant="primary" class="cyberpunk-skewed-sm" onclick={openUrl}>
              <ExternalLink class="size-4" aria-hidden="true" /> Open
            </Button>
            <Button variant="outline" onclick={copyUrl}>
              {#if copied}<Check class="size-4" aria-hidden="true" />{:else}<Copy class="size-4" aria-hidden="true" />{/if}
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <Button variant="outline" onclick={generate} disabled={generating}>
              <RefreshCw class="size-4" aria-hidden="true" /> Regenerate
            </Button>
          </div>
        </CardContent>
      </Card>
    {/if}
  </div>
</div>
