<script lang="ts">
  import * as Dialog from '$lib/components/ui/dialog'
  import { Button } from '$lib/components/ui/button'
  import { handleApiError } from '$lib/core/utils/toast'
  import type { Component } from 'svelte'

  let { open = $bindable(false), title, description, confirmLabel = 'Confirm', variant = 'default', icon, onConfirm }: {
    open?: boolean
    title: string
    description?: string
    confirmLabel?: string
    variant?: 'default' | 'destructive'
    icon?: Component<{ class?: string }>
    onConfirm: () => void | Promise<void>
  } = $props()

  let loading = $state(false)

  const isDestructive = $derived(variant === 'destructive')

  async function handleConfirm() {
    loading = true
    try {
      await onConfirm()
      open = false
    } catch (e: unknown) {
      handleApiError(e, 'Operation failed')
    } finally {
      loading = false
    }
  }

  function handleClose() {
    open = false
    loading = false
  }
</script>

<Dialog.Root bind:open onOpenChange={(v) => { if (!v) { loading = false } }}>
  <Dialog.Content class="cyberpunk-skewed sm:max-w-md p-0 gap-0 border-none" showCloseButton={false} role="alertdialog" aria-busy={loading}>
    <div class="cyberpunk-skewed-inner flex flex-col gap-4">
      <div class="flex items-start gap-4">
        {#if icon}
          <div class="flex h-10 w-10 shrink-0 items-center justify-center {isDestructive ? 'text-destructive' : 'text-muted-foreground'}">
            {@render iconSlot()}
          </div>
        {/if}
        <div class="flex flex-col gap-1.5 {icon ? 'pt-0.5' : ''}">
          <Dialog.Title class="text-base font-semibold tracking-tight">{title}</Dialog.Title>
          {#if description}
            <Dialog.Description class="text-sm text-muted-foreground leading-relaxed">{description}</Dialog.Description>
          {/if}
        </div>
      </div>

      <div class="pt-2">
        <div class="flex justify-end gap-2">
          <Button variant="outline" class="cyberpunk-skewed-sm" onclick={handleClose} disabled={loading}>Cancel</Button>
          <Button
            variant="primary"
            class="cyberpunk-skewed-sm"
            disabled={loading}
            onclick={handleConfirm}
          >
            {loading ? 'Processing...' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  </Dialog.Content>
</Dialog.Root>

{#snippet iconSlot()}
  {#if icon}
    {@const Icon = icon}
    <Icon class="h-6 w-6" />
  {/if}
{/snippet}
