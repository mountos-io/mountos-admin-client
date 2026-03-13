<script lang="ts">
  import { Card, CardHeader, CardTitle, CardContent } from '$lib/components/ui/card'
  import { useAccounts } from '$lib/core/stores/accounts.svelte'
  import AccountIcon from '$lib/components/shared/AccountIcon.svelte'
  import StatusBadge from '$lib/components/shared/StatusBadge.svelte'

  const accountStore = useAccounts()
  const account = $derived(accountStore.selectedAccount)
</script>

<div class="space-y-6">
  <h2 class="text-2xl font-bold tracking-tight">Dashboard</h2>

  {#if account}
    <div class="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader><CardTitle>Account</CardTitle></CardHeader>
        <CardContent>
          <div class="flex items-center gap-3">
            <AccountIcon {account} size={40} />
            <div>
              <p class="text-lg font-medium">{account.name}</p>
              <div class="mt-1"><StatusBadge active={account.isActive} locked={account.locked} /></div>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Description</CardTitle></CardHeader>
        <CardContent>
          <p class="text-sm text-muted-foreground">{account.description || 'No description'}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Created</CardTitle></CardHeader>
        <CardContent>
          <p class="text-sm text-muted-foreground">{new Date(account.createdAt).toLocaleDateString()}</p>
        </CardContent>
      </Card>
    </div>
  {:else}
    <Card>
      <CardContent class="py-8">
        <p class="text-center text-muted-foreground">Select an account to view dashboard</p>
      </CardContent>
    </Card>
  {/if}
</div>
