<script lang="ts">
  import { cn } from '$lib/utils.js'
  import { useAccounts } from '$lib/core/stores/accounts.svelte'
  import { Button } from '$lib/components/ui/button'
  import * as Dialog from '$lib/components/ui/dialog'
  import Input from '$lib/components/ui/input/input.svelte'
  import Check from '@lucide/svelte/icons/check'
  import Plus from '@lucide/svelte/icons/plus'

  let { collapsed = false }: { collapsed?: boolean } = $props()

  const store = useAccounts()
  let dialogOpen = $state(false)
  let search = $state('')

  const filtered = $derived(
    search
      ? store.accounts.filter(a => a.name.toLowerCase().includes(search.toLowerCase()))
      : store.accounts
  )

  function select(id: number) {
    store.selectAccount(id)
    dialogOpen = false
    search = ''
  }
</script>

<Button
  variant="outline"
  class={cn("w-full justify-between text-left", collapsed && "justify-center px-0")}
  onclick={() => dialogOpen = true}
  aria-haspopup="dialog"
>
  {#if collapsed}
    <span class="text-xs font-bold">
      {store.selectedAccount?.name?.[0]?.toUpperCase() ?? '?'}
    </span>
  {:else}
    <span class="truncate text-sm">
      {store.selectedAccount?.name ?? 'Select account'}
    </span>
    <svg class="h-4 w-4 shrink-0 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="m6 9 6 6 6-6" />
    </svg>
  {/if}
</Button>

<Dialog.Dialog bind:open={dialogOpen} onOpenChange={(o) => { if (!o) search = '' }}>
  <Dialog.DialogContent class="sm:max-w-md p-0 gap-0">
    <Dialog.DialogHeader class="p-4 pb-2">
      <Dialog.DialogTitle class="text-base">Switch Account</Dialog.DialogTitle>
      <Dialog.DialogDescription class="sr-only">Select an account</Dialog.DialogDescription>
    </Dialog.DialogHeader>
    <div class="px-4 pb-2">
      <Input
        placeholder="Search accounts..."
        bind:value={search}
        class="h-9"
      />
    </div>
    <div class="max-h-[280px] overflow-y-auto px-2 pb-2">
      {#each filtered as account, i}
        <button
          class={cn(
            'flex w-full items-center gap-3 rounded-sm px-3 py-2 text-sm transition-colors hover:bg-accent',
            account.id === store.selectedAccountId && 'bg-accent'
          )}
          onclick={() => select(account.id)}
        >
          <span class="flex-1 text-left truncate">{account.name}</span>
          {#if account.id === store.selectedAccountId}
            <Check class="h-4 w-4 text-primary" />
          {/if}
          {#if !search && i < 9}
            <kbd class="ml-auto rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              ⌘{i + 1}
            </kbd>
          {/if}
        </button>
      {/each}
      {#if filtered.length === 0}
        <p class="px-3 py-4 text-center text-sm text-muted-foreground">No accounts found</p>
      {/if}
    </div>
    <div class="border-t p-2">
      <a
        href="/accounts/create"
        class="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        onclick={() => { dialogOpen = false }}
      >
        <Plus class="h-4 w-4" />
        Create Account
      </a>
    </div>
  </Dialog.DialogContent>
</Dialog.Dialog>
