<script lang="ts">
  import * as Dialog from '$lib/components/ui/dialog'
  import { Button } from '$lib/components/ui/button'
  import { useStepUp, type StepUpRequest } from '$lib/core/stores/stepup.svelte'
  import { useWebAuthn } from '$lib/core/stores/webauthn.svelte'
  import Shield from '@lucide/svelte/icons/shield'
  import KeyRound from '@lucide/svelte/icons/key-round'

  const stepUp = useStepUp()
  const webauthn = useWebAuthn()

  let phase = $state<'register' | 'authenticate'>('authenticate')
  let registering = $state(false)
  let authenticating = $state(false)
  let error = $state('')
  let handledRequest = $state<StepUpRequest | null>(null)

  const open = $derived(stepUp.request !== null)
  const busy = $derived(registering || authenticating)

  $effect(() => {
    const req = stepUp.request
    if (!req || req === handledRequest) return
    handledRequest = req
    phase = req.mode
    error = ''
    registering = false
    authenticating = false
    if (req.mode === 'authenticate') startAuthentication()
    else handleRegister()
  })

  async function startAuthentication() {
    authenticating = true
    error = ''
    try {
      const token = await webauthn.authenticate()
      if (!stepUp.request) return
      stepUp.complete(token)
    } catch (e: unknown) {
      if (!stepUp.request) return
      error = e instanceof Error ? e.message : 'Verification failed'
    } finally {
      authenticating = false
    }
  }

  async function handleRegister() {
    registering = true
    error = ''
    try {
      await webauthn.registerCredential()
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Registration failed'
      return
    } finally {
      registering = false
    }
    phase = 'authenticate'
    await startAuthentication()
  }

  function handleCancel() {
    if (busy) return
    stepUp.cancel()
    handledRequest = null
  }

  function handleOpenChange(v: boolean) {
    if (!v && busy) return
    if (!v) { stepUp.cancel(); handledRequest = null }
  }
</script>

<Dialog.Root {open} onOpenChange={handleOpenChange}>
  <Dialog.Content
    class="sm:max-w-md"
    showCloseButton={!busy}
    onEscapeKeydown={(e) => { if (busy) e.preventDefault() }}
    onInteractOutside={(e) => { if (busy) e.preventDefault() }}
  >
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
        {#if registering}
          <p class="text-sm text-muted-foreground">Waiting for security key...</p>
        {:else if error}
          <div class="space-y-3 text-center">
            <p class="text-sm text-destructive" role="alert">{error}</p>
            <Button variant="outline" size="sm" onclick={handleRegister}>Retry</Button>
          </div>
        {/if}
      {:else}
        <Shield class="h-10 w-10 text-muted-foreground" />
        {#if authenticating}
          <p class="text-sm text-muted-foreground">Waiting for security key...</p>
        {:else if error}
          <div class="space-y-3 text-center">
            <p class="text-sm text-destructive" role="alert">{error}</p>
            <Button variant="outline" size="sm" onclick={startAuthentication}>Retry</Button>
          </div>
        {/if}
      {/if}
    </div>

    <Dialog.Footer>
      <Button variant="outline" onclick={handleCancel} disabled={busy}>Cancel</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
