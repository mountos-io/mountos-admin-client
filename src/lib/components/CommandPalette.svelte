<script lang="ts">
  import { goto } from '$app/navigation'
  import { visibleNavItems } from '$lib/config/navigation'
  import { useAccounts } from '$lib/core/stores/accounts.svelte'
  import { useAuth } from '$lib/core/stores/auth.svelte'
  import { usePreferences } from '$lib/stores/preferences.svelte'
  import { useSettingsModal } from '$lib/stores/settings-modal.svelte'
  import { providerSettingsTabs } from '$provider/config/settings'
  import * as Command from '$lib/components/ui/command'
  import type { Component } from 'svelte'
  import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard'
  import Building2 from '@lucide/svelte/icons/building-2'
  import Users from '@lucide/svelte/icons/users'
  import Globe from '@lucide/svelte/icons/globe'
  import HardDrive from '@lucide/svelte/icons/hard-drive'
  import Database from '@lucide/svelte/icons/database'
  import ScrollText from '@lucide/svelte/icons/scroll-text'
  import Server from '@lucide/svelte/icons/server'
  import Settings from '@lucide/svelte/icons/settings'
  import PanelLeft from '@lucide/svelte/icons/panel-left'
  import Plus from '@lucide/svelte/icons/plus'
  import LogOut from '@lucide/svelte/icons/log-out'
  import Box from '@lucide/svelte/icons/box'
  import { Badge } from '$lib/components/ui/badge'
  import { isMacPlatform } from '$lib/utils'

  let { open = $bindable(false) }: { open?: boolean } = $props()

  const accountStore = useAccounts()
  const auth = useAuth()
  const prefs = usePreferences()
  const settingsModal = useSettingsModal()
  const mac = isMacPlatform()
  const modSymbol = mac ? '⌘' : 'Ctrl+'
  const navModSymbol = mac ? '⌘⇧' : 'Ctrl+Shift+'
  const altModSymbol = mac ? '⌘⌥' : 'Ctrl+Alt+'

  const iconMap: Record<string, Component> = {
    'layout-dashboard': LayoutDashboard, 'building-2': Building2,
    'users': Users, 'globe': Globe, 'hard-drive': HardDrive,
    'database': Database, 'scroll-text': ScrollText, 'server': Server,
  }

  const hasAccount = $derived(accountStore.selectedAccountId !== null)
  const visibleNav = $derived(visibleNavItems(auth, hasAccount))

  function navShortcut(index: number): string | null {
    if (index >= 10) return null
    return navModSymbol + (index === 9 ? '0' : String(index + 1))
  }

  function run(action: () => void) {
    open = false
    action()
  }

  function nav(href: string) {
    run(() => goto(href))
  }
</script>

<Command.CommandDialog bind:open>
  <Command.CommandInput placeholder="Type a command or search..." />
  <Command.CommandList>
    <Command.CommandEmpty>No results found.</Command.CommandEmpty>

    <Command.CommandGroup heading="Navigation">
      {#each visibleNav as item, i}
        {@const Icon = item.iconComponent ?? iconMap[item.icon] ?? Box}
        {@const shortcut = navShortcut(i)}
        <Command.CommandItem value={item.label} onSelect={() => nav(item.href)}>
          {#if Icon}<Icon class="mr-2 h-4 w-4" />{/if}
          {item.label}
          {#if shortcut}<Command.CommandShortcut>{shortcut}</Command.CommandShortcut>{/if}
        </Command.CommandItem>
      {/each}
    </Command.CommandGroup>

    <Command.CommandSeparator />

    <Command.CommandGroup heading="Actions">
      <Command.CommandItem value="Settings" onSelect={() => run(() => settingsModal.show())}>
        <Settings class="mr-2 h-4 w-4" />
        Settings
        <Command.CommandShortcut>{modSymbol},</Command.CommandShortcut>
      </Command.CommandItem>
      <Command.CommandItem value="Toggle Sidebar" onSelect={() => run(() => { prefs.sidebarCollapsed = !prefs.sidebarCollapsed })}>
        <PanelLeft class="mr-2 h-4 w-4" />
        Toggle Sidebar
        <Command.CommandShortcut>{modSymbol}B</Command.CommandShortcut>
      </Command.CommandItem>
      {#if auth.can('accounts', 'create')}
        <Command.CommandItem value="Create Account" onSelect={() => nav('/accounts/create')}>
          <Plus class="mr-2 h-4 w-4" />
          Create Account
        </Command.CommandItem>
      {/if}
      <Command.CommandItem value="Sign Out" onSelect={() => run(() => auth.signOut())}>
        <LogOut class="mr-2 h-4 w-4" />
        Sign Out
      </Command.CommandItem>
    </Command.CommandGroup>

    {#if providerSettingsTabs.length > 0}
      <Command.CommandSeparator />
      <Command.CommandGroup heading="Settings">
        {#each providerSettingsTabs as vt}
          {@const VIcon = vt.icon}
          <Command.CommandItem value="Settings: {vt.label}" onSelect={() => run(() => settingsModal.show(vt.id))}>
            {#if VIcon}<VIcon class="mr-2 h-4 w-4" />{/if}
            {vt.label}
          </Command.CommandItem>
        {/each}
      </Command.CommandGroup>
    {/if}

    {#if !auth.isUserRole && accountStore.accounts.length > 0}
      <Command.CommandSeparator />
      <Command.CommandGroup heading="Switch Account">
        {#each accountStore.accounts as account, i}
          <Command.CommandItem
            value="account {account.name}"
            onSelect={() => run(() => accountStore.selectAccount(account.id))}
          >
            <Building2 class="mr-2 h-4 w-4" />
            <span class="flex-1">{account.name}</span>
            {#if account.id === accountStore.selectedAccountId}
              <Badge variant="primary">active</Badge>
            {/if}
            {#if i < 9}
              <Command.CommandShortcut>{altModSymbol}{i + 1}</Command.CommandShortcut>
            {/if}
          </Command.CommandItem>
        {/each}
      </Command.CommandGroup>
    {/if}
  </Command.CommandList>
</Command.CommandDialog>
