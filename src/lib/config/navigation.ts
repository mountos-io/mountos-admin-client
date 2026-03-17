import type { Component } from 'svelte'
import type { Capabilities } from '$lib/core/auth/adapter'
import type { FeatureFlags } from './features'
import { vendorNavItems, vendorNavFilter } from '$vendor/config/navigation'

export interface NavItem {
  label: string
  href: string
  icon: string
  iconComponent?: Component
  feature?: keyof FeatureFlags
}

export type NavFilter = (item: NavItem, caps: Capabilities) => boolean

const defaults: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: 'layout-dashboard' },
  { label: 'Accounts', href: '/accounts', icon: 'building-2', feature: 'accounts' },
  { label: 'Users', href: '/users', icon: 'users', feature: 'users' },
  { label: 'Regions', href: '/regions', icon: 'globe', feature: 'regions' },
  { label: 'Storages', href: '/storages', icon: 'hard-drive', feature: 'storages' },
  { label: 'Volumes', href: '/volumes', icon: 'database', feature: 'volumes' },
  { label: 'Audit Log', href: '/audit', icon: 'scroll-text', feature: 'auditLogs' },
  { label: 'Sessions', href: '/sessions', icon: 'monitor-dot', feature: 'clientSessions' },
  { label: 'Nodes', href: '/nodes', icon: 'server', feature: 'serviceNodes' },
]

export const navigation: NavItem[] = [...defaults, ...(vendorNavItems ?? [])]
export const navFilter: NavFilter | null = vendorNavFilter ?? null
