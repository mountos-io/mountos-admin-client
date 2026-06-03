import type { Component } from 'svelte'
import type { Capabilities } from '$lib/core/auth/adapter'
import type { FeatureFlags } from './features'
import { providerNavItems, providerNavFilter } from '$provider/config/navigation'

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
