<script lang="ts">
  // Per-volume copyset working-set control: edits a single volume's own
  // target_copyset_count, its working-set size within the storage's copyset pool. The
  // storage's pool itself has no separate admin-settable count; it grows by registering
  // copysets directly.
  // Presentational: the caller wires `onSave` to api.volumes.updateCopysetConfig.
  import * as Dialog from '$lib/components/ui/dialog'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import Label from '$lib/components/ui/label/label.svelte'
  import { showSuccessToast, showWarningToast, handleApiError } from '$lib/core/utils/toast'
  import type { VolumeBlockPlacementResizeResult } from '$lib/core/api/types'
  import Pencil from '@lucide/svelte/icons/pencil'

  // Mirrors the server-enforced ceiling on a volume's own target copyset count.
  const MAX_TARGET_COPYSET_COUNT = 100

  let {
    targetCopysetCount, copysetCount, canUpdate, onSave,
  }: {
    targetCopysetCount: number
    copysetCount: number
    canUpdate: boolean
    onSave: (targetCopysetCount: number) => Promise<VolumeBlockPlacementResizeResult>
  } = $props()

  let editing = $state(false)
  let editValue = $state('')
  let submitting = $state(false)
  let inputEl = $state<HTMLInputElement | null>(null)

  const editNum = $derived(Number(editValue))
  const validValue = $derived(Number.isInteger(editNum) && editNum >= 1 && editNum <= MAX_TARGET_COPYSET_COUNT)
  const canSubmit = $derived(validValue)

  function startEdit() {
    editValue = String(targetCopysetCount)
    editing = true
  }

  async function handleSave(e: Event) {
    e.preventDefault()
    if (!canSubmit) return
    const next = editNum
    submitting = true
    try {
      const result = await onSave(next)
      editing = false
      // Use the server's authoritative post-update count, not a locally recomputed one:
      // it already accounts for pool/cluster exhaustion and any concurrent change.
      const total = result.copysetCountAfter
      if (result.partial) {
        showWarningToast(`Assigned ${result.copysetsAdded} copyset(s); ${total} of ${result.targetCopysetCount} target copysets now in use.${result.reason ? ` ${result.reason}` : ''}`)
      } else {
        showSuccessToast(`Updated to ${total} copyset(s).`)
      }
    } catch (err: unknown) {
      // Covers every failure mode uniformly, including a throttled (429) resize: the
      // server's own message ("copyset config update throttled, retry shortly") surfaces
      // verbatim, and the dialog stays open so the operator can retry once it clears.
      handleApiError(err, 'Failed to update volume copyset count')
    } finally {
      submitting = false
    }
  }
</script>

<div class="flex items-center gap-2">
  <span class="text-sm text-muted-foreground">Copysets (this volume)</span>
  <span class="font-mono font-medium">{targetCopysetCount > 0 ? targetCopysetCount : 'not set'}</span>
  {#if canUpdate}
    <Button variant="ghost" size="icon" class="min-h-[44px] min-w-[44px] sm:min-h-9 sm:min-w-9" onclick={startEdit} aria-label="Edit volume copyset count">
      <Pencil class="size-4" aria-hidden="true" />
    </Button>
  {/if}
</div>
{#if targetCopysetCount > 0}
  <p class="text-xs text-muted-foreground">Currently using {copysetCount} of {targetCopysetCount} target copyset(s).</p>
{/if}

<Dialog.Root bind:open={editing} onOpenChange={(v) => { if (!v) submitting = false }}>
  <Dialog.Content class="sm:max-w-sm" onOpenAutoFocus={(e) => { e.preventDefault(); inputEl?.focus() }}>
    <Dialog.Header>
      <Dialog.Title>Edit Volume Copyset Count</Dialog.Title>
      <Dialog.Description>
        Sets how many copysets this volume's own data spreads across within its storage's copyset
        pool. This is independent of the storage's fleet-wide copyset count. Raising the target
        assigns more copysets, minting new ones only when the pool cannot supply enough. Lowering
        it releases the most recently assigned copysets. A request beyond available capacity
        partially fulfills and reports why.
      </Dialog.Description>
    </Dialog.Header>
    <form onsubmit={handleSave} class="space-y-5">
      <div class="space-y-2">
        <Label for="edit-volume-copyset-count">Copysets</Label>
        <Input id="edit-volume-copyset-count" bind:ref={inputEl} type="number" bind:value={editValue} min="1" max={MAX_TARGET_COPYSET_COUNT} step="1" required />
      </div>
      <Dialog.Footer class="gap-2">
        <Button variant="secondary" type="button" onclick={() => editing = false} disabled={submitting}>Cancel</Button>
        <Button variant="primary" type="submit" class="cyberpunk-skewed-sm" disabled={submitting || !canSubmit}>
          {submitting ? 'Updating...' : 'Update'}
        </Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>
