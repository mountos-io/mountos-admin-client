<script lang="ts">
  import * as Dialog from '$lib/components/ui/dialog'
  import { Button } from '$lib/components/ui/button'
  import { useStepUp, type StepUpRequest } from '$lib/core/stores/stepup.svelte'
  import { useWebAuthn } from '$lib/core/stores/webauthn.svelte'
  import Shield from '@lucide/svelte/icons/shield'
  import KeyRound from '@lucide/svelte/icons/key-round'
  import TriangleAlert from '@lucide/svelte/icons/triangle-alert'

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
          <div class="w-full space-y-3">
            <div role="alert" class="flex items-start gap-2 rounded-sm border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
              <TriangleAlert class="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </div>
            <div class="flex justify-center">
              <Button variant="outline" size="sm" onclick={handleRegister}>Retry</Button>
            </div>
          </div>
        {/if}
      {:else}
        <Shield class="h-10 w-10 text-muted-foreground" />
        {#if authenticating}
          <p class="text-sm text-muted-foreground">Waiting for security key...</p>
        {:else if error}
          <div class="w-full space-y-3">
            <div role="alert" class="flex items-start gap-2 rounded-sm border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
              <TriangleAlert class="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </div>
            <div class="flex justify-center">
              <Button variant="outline" size="sm" onclick={startAuthentication}>Retry</Button>
            </div>
          </div>
        {/if}
      {/if}
    </div>

    <Dialog.Footer>
      <Button variant="outline" onclick={handleCancel} disabled={busy}>Cancel</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
