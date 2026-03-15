<script lang="ts">
  import * as Dialog from '$lib/components/ui/dialog'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import { useStepUp } from '$lib/core/stores/stepup.svelte'
  import { useWebAuthn } from '$lib/core/stores/webauthn.svelte'
  import { handleApiError } from '$lib/core/utils/toast'
  import Shield from '@lucide/svelte/icons/shield'
  import KeyRound from '@lucide/svelte/icons/key-round'

  const stepUp = useStepUp()
  const webauthn = useWebAuthn()

  let phase = $state<'register' | 'authenticate'>('authenticate')
  let keyLabel = $state('')
  let registering = $state(false)
  let authenticating = $state(false)
  let error = $state('')

  const open = $derived(stepUp.request !== null)

  $effect(() => {
    if (stepUp.request) {
      phase = stepUp.request.mode
      error = ''
      keyLabel = ''
      registering = false
      authenticating = false
      if (stepUp.request.mode === 'authenticate') startAuthentication()
    }
  })

  async function startAuthentication() {
    authenticating = true
    error = ''
    try {
      const token = await webauthn.authenticate()
      stepUp.complete(token)
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Verification failed'
    } finally {
      authenticating = false
    }
  }

  async function handleRegister() {
    registering = true
    error = ''
    try {
      await webauthn.registerCredential(keyLabel || 'Security Key')
      keyLabel = ''
      phase = 'authenticate'
      await startAuthentication()
    } catch (e: unknown) {
      handleApiError(e, 'Registration failed')
      error = e instanceof Error ? e.message : 'Registration failed'
    } finally {
      registering = false
    }
  }

  function handleCancel() {
    stepUp.cancel()
  }

  function handleOpenChange(v: boolean) {
    if (!v) stepUp.cancel()
  }
</script>

<Dialog.Root {open} onOpenChange={handleOpenChange}>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title>
        {phase === 'register' ? 'Register Security Key' : 'Security Verification'}
      </Dialog.Title>
      <Dialog.Description>
        {phase === 'register'
          ? 'This operation requires security key verification. Register a key to continue.'
          : 'Touch your security key to verify this operation.'}
      </Dialog.Description>
    </Dialog.Header>

    <div class="flex flex-col items-center gap-4 py-6">
      {#if phase === 'register'}
        <KeyRound class="h-10 w-10 text-muted-foreground" />
        <div class="w-full space-y-3">
          <div class="flex items-end gap-2">
            <div class="flex-1">
              <Input bind:value={keyLabel} placeholder="Key label (optional)" class="h-9" />
            </div>
            <Button size="sm" disabled={registering} onclick={handleRegister}>
              {registering ? 'Registering...' : 'Register'}
            </Button>
          </div>
          {#if error}
            <p class="text-sm text-destructive text-center">{error}</p>
          {/if}
        </div>
      {:else}
        <Shield class="h-10 w-10 text-muted-foreground" />
        {#if authenticating}
          <p class="text-sm text-muted-foreground">Waiting for security key...</p>
        {:else if error}
          <div class="space-y-3 text-center">
            <p class="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onclick={startAuthentication}>Retry</Button>
          </div>
        {/if}
      {/if}
    </div>

    <Dialog.Footer>
      <Button variant="outline" onclick={handleCancel} disabled={registering}>Cancel</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
