import type { FeatureFlags } from './features'
import { vendorNavigation } from '$vendor/config/navigation'

export interface NavItem {
  label: string
  href: string
  icon: string
  feature?: keyof FeatureFlags
}

const defaults: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: 'layout-dashboard' },
  { label: 'Accounts', href: '/accounts', icon: 'building-2', feature: 'accounts' },
  { label: 'Users', href: '/users', icon: 'users', feature: 'users' },
  { label: 'Regions', href: '/regions', icon: 'globe', feature: 'regions' },
  { label: 'Storages', href: '/storages', icon: 'hard-drive', feature: 'storages' },
  { label: 'Volumes', href: '/volumes', icon: 'database', feature: 'volumes' },
  { label: 'Audit Log', href: '/audit', icon: 'scroll-text', feature: 'auditLogs' },
  { label: 'Nodes', href: '/nodes', icon: 'server', feature: 'serviceNodes' },
]

export const navigation: NavItem[] = vendorNavigation ?? defaults
