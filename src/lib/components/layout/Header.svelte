<script lang="ts">
  import { Button } from '$lib/components/ui/button'
  import { useAuth } from '$lib/core/stores/auth.svelte'
  import { appConfig } from '$lib/config/app'

  const auth = useAuth()
</script>

<header class="sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-background px-6">
  <div class="flex-1">
    <h1 class="text-sm font-semibold">{appConfig.appName}</h1>
  </div>
  <div class="flex items-center gap-3">
    {#if auth.user}
      <span class="text-sm text-muted-foreground">{auth.user.name}</span>
    {/if}
    <Button variant="ghost" size="sm" onclick={() => auth.signOut()}>Sign out</Button>
  </div>
</header>
