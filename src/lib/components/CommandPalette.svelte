<script lang="ts">
  import { goto } from '$app/navigation'
  import { navigation, navFilter } from '$lib/config/navigation'
  import { features } from '$lib/config/features'
  import { useAccounts } from '$lib/core/stores/accounts.svelte'
  import { useAuth } from '$lib/core/stores/auth.svelte'
  import { usePreferences } from '$lib/stores/preferences.svelte'
  import { useSettingsModal } from '$lib/stores/settings-modal.svelte'
  import { vendorSettingsTabs } from '$vendor/config/settings'
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
  import UserIcon from '@lucide/svelte/icons/user'
  import Box from '@lucide/svelte/icons/box'

  let { open = $bindable(false) }: { open?: boolean } = $props()

  const accountStore = useAccounts()
  const auth = useAuth()
  const prefs = usePreferences()
  const settingsModal = useSettingsModal()

  const iconMap: Record<string, Component> = {
    'layout-dashboard': LayoutDashboard, 'building-2': Building2,
    'users': Users, 'globe': Globe, 'hard-drive': HardDrive,
    'database': Database, 'scroll-text': ScrollText, 'server': Server,
  }

  const visibleNav = $derived(
    navigation.filter(item =>
      navFilter ? navFilter(item, auth.capabilities) : (!item.feature || features[item.feature])
    )
  )

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
      {#each visibleNav as item}
        {@const Icon = item.iconComponent ?? iconMap[item.icon] ?? Box}
        <Command.CommandItem value={item.label} onSelect={() => nav(item.href)}>
          {#if Icon}<Icon class="mr-2 h-4 w-4" />{/if}
          {item.label}
        </Command.CommandItem>
      {/each}
    </Command.CommandGroup>

    <Command.CommandSeparator />

    <Command.CommandGroup heading="Actions">
      <Command.CommandItem value="Settings" onSelect={() => run(() => settingsModal.show())}>
        <Settings class="mr-2 h-4 w-4" />
        Settings
        <Command.CommandShortcut>⌘,</Command.CommandShortcut>
      </Command.CommandItem>
      <Command.CommandItem value="Toggle Sidebar" onSelect={() => run(() => { prefs.sidebarCollapsed = !prefs.sidebarCollapsed })}>
        <PanelLeft class="mr-2 h-4 w-4" />
        Toggle Sidebar
        <Command.CommandShortcut>⌘B</Command.CommandShortcut>
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

    {#if vendorSettingsTabs.length > 0}
      <Command.CommandSeparator />
      <Command.CommandGroup heading="Settings">
        {#each vendorSettingsTabs as vt}
          {@const VIcon = vt.icon}
          <Command.CommandItem value="Settings: {vt.label}" onSelect={() => run(() => settingsModal.show(vt.id))}>
            {#if VIcon}<VIcon class="mr-2 h-4 w-4" />{/if}
            {vt.label}
          </Command.CommandItem>
        {/each}
      </Command.CommandGroup>
    {/if}

    {#if accountStore.accounts.length > 0}
      <Command.CommandSeparator />
      <Command.CommandGroup heading="Switch Account">
        {#each accountStore.accounts as account, i}
          <Command.CommandItem
            value="account {account.name}"
            onSelect={() => run(() => accountStore.selectAccount(account.id))}
          >
            <UserIcon class="mr-2 h-4 w-4" />
            <span class="flex-1">{account.name}</span>
            {#if account.id === accountStore.selectedAccountId}
              <span class="text-xs text-primary">active</span>
            {/if}
            {#if i < 9}
              <Command.CommandShortcut>⌘{i + 1}</Command.CommandShortcut>
            {/if}
          </Command.CommandItem>
        {/each}
      </Command.CommandGroup>
    {/if}
  </Command.CommandList>
</Command.CommandDialog>
