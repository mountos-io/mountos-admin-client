<script lang="ts">
  import { cn } from '$lib/utils.js'
  import { useAccounts } from '$lib/core/stores/accounts.svelte'
  import { Button } from '$lib/components/ui/button'

  const store = useAccounts()
  let dropdownOpen = $state(false)
</script>

<div class="relative">
  <Button
    variant="outline"
    class="w-full justify-between text-left"
    onclick={() => dropdownOpen = !dropdownOpen}
  >
    <span class="truncate text-sm">
      {store.selectedAccount?.name ?? 'Select account'}
    </span>
    <svg class="h-4 w-4 shrink-0 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="m6 9 6 6 6-6" />
    </svg>
  </Button>

  {#if dropdownOpen}
    <div class="absolute left-0 top-full z-50 mt-1 w-full rounded-md border bg-popover p-1 shadow-md">
      {#each store.accounts as account}
        <button
          class={cn(
            'flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent',
            account.id === store.selectedAccountId && 'bg-accent',
          )}
          onclick={() => { store.selectAccount(account.id); dropdownOpen = false }}
        >
          {account.name}
        </button>
      {/each}
      {#if store.accounts.length === 0}
        <p class="px-2 py-1.5 text-sm text-muted-foreground">No accounts</p>
      {/if}
    </div>
  {/if}
</div>
