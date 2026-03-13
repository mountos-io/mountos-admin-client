<script lang="ts">
  import '../app.css'
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { appConfig } from '$lib/config/app'
  import { authAdapter } from '$lib/config/auth'
  import { useAuth } from '$lib/core/stores/auth.svelte'
  import { useAccounts } from '$lib/core/stores/accounts.svelte'
  import { TokenAuthAdapter } from '$lib/core/auth/token'
  import Shell from '$lib/components/layout/Shell.svelte'
  import LoadingSpinner from '$lib/components/shared/LoadingSpinner.svelte'
  import { Toaster } from '$lib/components/ui/sonner'

  const auth = useAuth()
  const accountStore = useAccounts()

  let { children } = $props()
  let exchanging = $state(false)
  let exchangeError = $state('')
  let progress = $state(0)

  async function exchangeToken(vendorToken: string) {
    exchanging = true
    progress = 20
    try {
      const res = await fetch(`/api/me?token=${encodeURIComponent(vendorToken)}`)
      progress = 60
      if (!res.ok) {
        exchangeError = 'Authentication failed'
        return
      }
      const data = await res.json()
      progress = 80
      if (authAdapter instanceof TokenAuthAdapter) {
        authAdapter.storeTokens(data.token, data.refreshToken)
      }
      progress = 100
      await goto('/', { replaceState: true })
      await auth.init()
    } catch {
      exchangeError = 'Authentication failed'
    } finally {
      exchanging = false
    }
  }

  $effect(() => {
    const isLoginPage = $page.url.pathname === '/login'
    if (isLoginPage) return

    const vendorToken = $page.url.searchParams.get('token')
    if (vendorToken) {
      exchangeToken(vendorToken)
      return
    }

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

<svelte:head>
  <link rel="icon" href={appConfig.faviconUrl} />
</svelte:head>

{#if exchanging}
  <div class="flex h-screen items-center justify-center">
    <div class="w-80 text-center">
      <svg class="mx-auto h-10 w-10 animate-spin text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
      </svg>
      <p class="mt-4 text-sm text-muted-foreground">Authenticating...</p>
      <div class="mt-4 h-1.5 w-full rounded-full bg-muted">
        <div
          class="h-1.5 rounded-full bg-primary transition-all duration-300"
          style="width: {progress}%"
        ></div>
      </div>
    </div>
  </div>
{:else if exchangeError}
  <div class="flex h-screen items-center justify-center">
    <div class="text-center">
      <h1 class="text-2xl font-bold text-destructive">{exchangeError}</h1>
      <p class="mt-2 text-muted-foreground">Please try again or contact your administrator.</p>
      <button class="mt-4 rounded-md bg-primary px-4 py-2 text-primary-foreground" onclick={() => goto('/login')}>
        Back to login
      </button>
    </div>
  </div>
{:else if $page.url.pathname === '/login'}
  {#if children}{@render children()}{/if}
{:else if auth.loading}
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
