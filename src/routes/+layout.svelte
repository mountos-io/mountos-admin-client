<script lang="ts">
  import '../app.css'
  import { useAuth } from '$lib/core/stores/auth.svelte'
  import { useAccounts } from '$lib/core/stores/accounts.svelte'
  import Shell from '$lib/components/layout/Shell.svelte'
  import LoadingSpinner from '$lib/components/shared/LoadingSpinner.svelte'
  import { Toaster } from '$lib/components/ui/sonner'

  const auth = useAuth()
  const accountStore = useAccounts()

  let { children } = $props()

  $effect(() => {
    auth.init().then(() => {
      if (auth.authenticated) {
        accountStore.fetchAccounts().then(() => {
          if (accountStore.accounts.length === 1) {
            accountStore.selectAccount(accountStore.accounts[0].id)
          }
        }).catch(() => {})
      }
    }).catch(() => {})
  })
</script>

{#if auth.loading}
  <div class="flex h-screen items-center justify-center">
    <LoadingSpinner />
  </div>
{:else if !auth.authenticated}
  <div class="flex h-screen items-center justify-center">
    <div class="text-center">
      <h1 class="text-2xl font-bold">Sign in required</h1>
      <p class="mt-2 text-muted-foreground">Please sign in to continue.</p>
      <button class="mt-4 rounded-md bg-primary px-4 py-2 text-primary-foreground" onclick={() => auth.signIn()}>
        Sign in
      </button>
    </div>
  </div>
{:else}
  <Shell>
    {#if children}{@render children()}{/if}
  </Shell>
{/if}
<Toaster />
