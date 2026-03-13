<script lang="ts">
  import * as Dialog from '$lib/components/ui/dialog'
  import { Button } from '$lib/components/ui/button'
  import { handleApiError } from '$lib/core/utils/toast'
  import { useWebAuthn } from '$lib/core/stores/webauthn.svelte'
  import { setStepUpToken } from '$lib/core/api/stepup'
  import Shield from '@lucide/svelte/icons/shield'

  let { open = $bindable(false), title, description, confirmLabel = 'Confirm', variant = 'default', requireStepUp = false, onConfirm }: {
    open?: boolean
    title: string
    description?: string
    confirmLabel?: string
    variant?: 'default' | 'destructive'
    requireStepUp?: boolean
    onConfirm: () => void | Promise<void>
  } = $props()

  const webauthn = useWebAuthn()
  let loading = $state(false)
  let stepUpPhase = $state(false)
  let stepUpError = $state('')

  function resetStepUp() {
    stepUpPhase = false
    stepUpError = ''
  }

  async function handleConfirm() {
    if (requireStepUp && !stepUpPhase) {
      stepUpPhase = true
      stepUpError = ''
      await doStepUp()
      return
    }
    loading = true
    try {
      await onConfirm()
      open = false
      resetStepUp()
    } catch (e: unknown) {
      handleApiError(e, 'Operation failed')
    } finally {
      loading = false
    }
  }

  async function doStepUp() {
    loading = true
    stepUpError = ''
    try {
      const token = await webauthn.authenticate()
      setStepUpToken(token)
      await onConfirm()
      open = false
      resetStepUp()
    } catch (e: unknown) {
      stepUpError = (e instanceof Error) ? e.message : 'Verification failed'
    } finally {
      loading = false
    }
  }

  function handleClose() {
    open = false
    resetStepUp()
  }
</script>

<Dialog.Root bind:open onOpenChange={(v) => { if (!v) resetStepUp() }}>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>{title}</Dialog.Title>
      {#if !stepUpPhase && description}
        <Dialog.Description>{description}</Dialog.Description>
      {/if}
    </Dialog.Header>

    {#if stepUpPhase}
      <div class="flex flex-col items-center gap-4 py-4">
        <Shield class="h-10 w-10 text-muted-foreground" />
        {#if loading}
          <p class="text-sm text-muted-foreground">Touch your security key...</p>
        {:else if stepUpError}
          <p class="text-sm text-destructive">{stepUpError}</p>
        {/if}
      </div>
      <Dialog.Footer>
        <Button variant="outline" onclick={handleClose}>Cancel</Button>
        {#if stepUpError}
          <Button {variant} onclick={doStepUp}>Retry</Button>
        {/if}
      </Dialog.Footer>
    {:else}
      <Dialog.Footer>
        <Button variant="outline" onclick={handleClose}>Cancel</Button>
        <Button {variant} disabled={loading} onclick={handleConfirm}>
          {loading ? 'Processing...' : confirmLabel}
        </Button>
      </Dialog.Footer>
    {/if}
  </Dialog.Content>
</Dialog.Root>
