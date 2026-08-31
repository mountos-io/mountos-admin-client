<script lang="ts">
  // Copyset-count control. Presentational: the caller wires `onSave`
  // to api.storages.updateConfig.
  import * as Dialog from '$lib/components/ui/dialog'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import Label from '$lib/components/ui/label/label.svelte'
  import InfoTip from '$lib/components/shared/InfoTip.svelte'
  import { showSuccessToast, showWarningToast, handleApiError } from '$lib/core/utils/toast'
  import type { UpdateConfigResult } from '$lib/core/api/types'
  import Pencil from '@lucide/svelte/icons/pencil'

  // Mirrors blockcopysets.MaxTargetCopysetCount (mountos-servers), the server-enforced
  // ceiling on this storage's copyset count. Same bound VolumeCopysetCountControl.svelte
  // uses for the per-volume target.
  const MAX_TARGET_COPYSET_COUNT = 100

  let { k, canUpdate, onSave }: { k: number; canUpdate: boolean; onSave: (k: number) => Promise<UpdateConfigResult> } = $props()

  let editing = $state(false)
  let editValue = $state('')
  let submitting = $state(false)
  let inputEl = $state<HTMLInputElement | null>(null)

  const editNum = $derived(Number(editValue))
  const validValue = $derived(Number.isInteger(editNum) && editNum >= 1 && editNum <= MAX_TARGET_COPYSET_COUNT)
  // Submitting the current value again is a legitimate submission (admin-sdk.md §4): the
  // server treats it as an explicit "reconcile now" call that re-runs auto-copyset-forming
  // without changing the target, forming any copysets newly possible from pool members
  // registered since the last call.
  const unchanged = $derived(validValue && editNum === k)
  const canSubmit = $derived(validValue)

  function startEdit() {
    editValue = String(k)
    editing = true
  }

  async function handleSave(e: Event) {
    e.preventDefault()
    if (!canSubmit) return
    const next = editNum
    const reconcile = next === k
    submitting = true
    try {
      const result = await onSave(next)
      editing = false
      // Use the server's authoritative post-update count, not a locally recomputed one:
      // it already accounts for draining copysets and any concurrent change.
      const total = result.activeCopysetCountAfter
      if (result.partial) {
        showWarningToast(`Formed ${result.copysetsFormed} copyset(s); ${total} of ${result.targetK} target copysets now provisioned.${result.reason ? ` ${result.reason}` : ''}`)
      } else if (reconcile) {
        showSuccessToast(result.copysetsFormed > 0
          ? `Reconciled: formed ${result.copysetsFormed} new copyset(s), ${total} copyset(s) now provisioned.`
          : `Reconciled: no new copysets possible, ${total} copyset(s) already provisioned.`)
      } else {
        showSuccessToast(`Updated to ${total} copyset(s).`)
      }
    } catch (err: unknown) {
      handleApiError(err, 'Failed to update copyset count')
    } finally {
      submitting = false
    }
  }
</script>

<div class="flex items-center gap-2">
  <span class="text-sm text-muted-foreground inline-flex items-center gap-1">
    Copysets
    <InfoTip text="A copyset provides High Availability (HA): two nodes holding identical copies." />
  </span>
  <span class="font-mono font-medium">{k > 0 ? k : 'not set'}</span>
  {#if canUpdate}
    <Button variant="ghost" size="icon" class="min-h-[44px] min-w-[44px] sm:min-h-9 sm:min-w-9" onclick={startEdit} aria-label="Edit copyset count">
      <Pencil class="size-4" aria-hidden="true" />
    </Button>
  {/if}
</div>

<Dialog.Root bind:open={editing} onOpenChange={(v) => { if (!v) submitting = false }}>
  <Dialog.Content class="sm:max-w-sm" onOpenAutoFocus={(e) => { e.preventDefault(); inputEl?.focus() }}>
    <Dialog.Header>
      <Dialog.Title>Edit Copyset Count</Dialog.Title>
      <Dialog.Description>
        Sets how many copysets this storage keeps active. Raising this number forms new copysets
        from unpaired members. Lowering it does not drain existing copysets on its own. Submitting
        the same number again reconciles now, forming any new copysets the pool allows without
        changing the target.
      </Dialog.Description>
    </Dialog.Header>
    <form onsubmit={handleSave} class="space-y-5">
      <div class="space-y-2">
        <Label for="edit-copyset-count">Copysets</Label>
        <Input id="edit-copyset-count" bind:ref={inputEl} type="number" bind:value={editValue} min="1" max={MAX_TARGET_COPYSET_COUNT} step="1" required />
      </div>
      <Dialog.Footer class="gap-2">
        <Button variant="secondary" type="button" onclick={() => editing = false} disabled={submitting}>Cancel</Button>
        <Button variant="primary" type="submit" class="cyberpunk-skewed-sm" disabled={submitting || !canSubmit}>
          {submitting ? (unchanged ? 'Reconciling...' : 'Updating...') : (unchanged ? 'Reconcile' : 'Update')}
        </Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>
