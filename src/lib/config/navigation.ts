import type { Component } from 'svelte'
import type { Capabilities } from '$lib/core/auth/adapter'
import type { Action } from '$lib/core/auth/authorize'
import type { FeatureFlags } from './features'
import { providerNavItems, providerNavFilter } from '$provider/config/navigation'
import { features } from './features'

export interface NavItem {
  label: string
  href: string
  icon: string
  iconComponent?: Component
  feature?: keyof FeatureFlags
  adminOnly?: boolean
}

export type NavFilter = (item: NavItem, caps: Capabilities) => boolean

const defaults: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: 'layout-dashboard' },
  { label: 'Accounts', href: '/accounts', icon: 'building-2', feature: 'accounts' },
  { label: 'Users', href: '/users', icon: 'users', feature: 'users' },
  { label: 'Regions', href: '/regions', icon: 'globe', feature: 'regions', adminOnly: true },
  { label: 'Storages', href: '/storages', icon: 'hard-drive', feature: 'storages', adminOnly: true },
  { label: 'Volumes', href: '/volumes', icon: 'database', feature: 'volumes' },
  { label: 'Audit Log', href: '/audit', icon: 'scroll-text', feature: 'auditLogs' },
  { label: 'Sessions', href: '/sessions', icon: 'monitor-dot', feature: 'clientSessions' },
  { label: 'Nodes', href: '/nodes', icon: 'server', feature: 'serviceNodes' },
  { label: 'Alerts', href: '/alerts', icon: 'bell', feature: 'alerts' },
]

export const navigation: NavItem[] = [...defaults, ...(providerNavItems ?? [])]
export const navFilter: NavFilter | null = providerNavFilter ?? null

const accountFreeRoutes = new Set(['/', '/accounts', '/alerts'])

export interface NavVisibilityAuth {
  isUserRole: boolean
  capabilities: Capabilities
  can: (resource: string, action: Action) => boolean
}

// Single source of truth for which nav items a role/account state can reach,
// shared by the sidebar, the command palette, and the global keyboard shortcuts,
// so a shortcut number always points at the item actually shown in the sidebar.
export function visibleNavItems(auth: NavVisibilityAuth, hasAccount: boolean): NavItem[] {
  return navigation.filter(item => {
    if (!hasAccount && !accountFreeRoutes.has(item.href)) return false
    if (item.adminOnly && auth.isUserRole) return false
    if (navFilter) return navFilter(item, auth.capabilities)
    if (item.feature && !features[item.feature]) return false
    if (item.feature && !auth.can(item.feature, 'read')) return false
    return true
  })
}
