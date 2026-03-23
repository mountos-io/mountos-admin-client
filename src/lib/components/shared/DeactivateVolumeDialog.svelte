<script lang="ts">
  import * as Dialog from '$lib/components/ui/dialog'
  import { Button } from '$lib/components/ui/button'
  import { Checkbox } from '$lib/components/ui/checkbox'
  import { handleApiError } from '$lib/core/utils/toast'
  import TriangleAlert from '@lucide/svelte/icons/triangle-alert'

  let { open = $bindable(false), volumeName, onConfirm }: {
    open?: boolean
    volumeName: string
    onConfirm: (opts: { isCleanupMetaEnabled: boolean; isCleanupStorageEnabled: boolean; isCleanupVaultEnabled: boolean }) => Promise<void>
  } = $props()

  let loading = $state(false)
  let cleanupMeta = $state(true)
  let cleanupStorage = $state(true)
  let cleanupVault = $state(true)

  async function handleConfirm() {
    loading = true
    try {
      await onConfirm({ isCleanupMetaEnabled: cleanupMeta, isCleanupStorageEnabled: cleanupStorage, isCleanupVaultEnabled: cleanupVault })
      open = false
    } catch (e: unknown) {
      handleApiError(e, 'Deactivation failed')
    } finally {
      loading = false
    }
  }

  function handleClose() {
    open = false
    loading = false
  }

  function reset() {
    cleanupMeta = true
    cleanupStorage = true
    cleanupVault = true
  }
</script>

<Dialog.Root bind:open onOpenChange={(v) => { if (!v) { loading = false } else { reset() } }}>
  <Dialog.Content class="cyberpunk-skewed sm:max-w-md p-0 gap-0 border-none" showCloseButton={false}>
    <div class="cyberpunk-skewed-inner flex flex-col gap-4">
      <div class="flex items-start gap-4">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center text-destructive">
          <TriangleAlert class="h-6 w-6" />
        </div>
        <div class="flex flex-col gap-1.5 pt-0.5">
          <Dialog.Title class="text-base font-semibold tracking-tight">Deactivate Volume</Dialog.Title>
          <Dialog.Description class="text-sm text-muted-foreground leading-relaxed">
            Deactivate "{volumeName}"?
          </Dialog.Description>
        </div>
      </div>

      <div role="alert" class="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
        This volume will be permanently deactivated and cannot be reactivated.
      </div>

      <fieldset class="flex flex-col gap-3 border-none p-0 m-0">
        <legend class="text-sm font-medium">Cleanup options</legend>
        <Checkbox bind:checked={cleanupMeta} label="Remove metadata" disabled={loading} />
        <Checkbox bind:checked={cleanupStorage} label="Delete stored data" disabled={loading} />
        <Checkbox bind:checked={cleanupVault} label="Purge vault secrets" disabled={loading} />
      </fieldset>

      <div class="pt-2">
        <div class="flex justify-end gap-2">
          <Button variant="outline" class="cyberpunk-skewed-sm" onclick={handleClose} disabled={loading}>Cancel</Button>
          <Button variant="primary" class="cyberpunk-skewed-sm" disabled={loading} onclick={handleConfirm}>
            {loading ? 'Processing...' : 'Deactivate'}
          </Button>
        </div>
      </div>
    </div>
  </Dialog.Content>
</Dialog.Root>
