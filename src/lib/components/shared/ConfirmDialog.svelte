<script lang="ts">
  import * as Dialog from '$lib/components/ui/dialog'
  import { Button } from '$lib/components/ui/button'

  let { open = $bindable(false), title, description, confirmLabel = 'Confirm', variant = 'default', onConfirm }: {
    open?: boolean
    title: string
    description?: string
    confirmLabel?: string
    variant?: 'default' | 'destructive'
    onConfirm: () => void | Promise<void>
  } = $props()

  let loading = $state(false)
  let error = $state('')

  async function handleConfirm() {
    loading = true
    error = ''
    try {
      await onConfirm()
      open = false
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Operation failed'
    } finally {
      loading = false
    }
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>{title}</Dialog.Title>
      {#if description}
        <Dialog.Description>{description}</Dialog.Description>
      {/if}
    </Dialog.Header>
    {#if error}
      <p class="text-sm text-destructive">{error}</p>
    {/if}
    <Dialog.Footer>
      <Button variant="outline" onclick={() => open = false}>Cancel</Button>
      <Button {variant} disabled={loading} onclick={handleConfirm}>
        {loading ? 'Processing...' : confirmLabel}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
