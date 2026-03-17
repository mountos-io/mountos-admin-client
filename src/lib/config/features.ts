import { vendorFeatures } from '$vendor/config/features'

export interface FeatureFlags {
  accounts: boolean
  users: boolean
  regions: boolean
  storages: boolean
  volumes: boolean
  auditLogs: boolean
  serviceNodes: boolean
  cache: boolean
  volumeApiKeys: boolean
  volumeStats: boolean
  accountLock: boolean
  allAccountsView: boolean
  clientSessions: boolean
}

const defaults: FeatureFlags = {
  accounts: true,
  users: true,
  regions: true,
  storages: true,
  volumes: true,
  auditLogs: true,
  serviceNodes: true,
  cache: false,
  volumeApiKeys: true,
  volumeStats: true,
  accountLock: true,
  allAccountsView: false,
  clientSessions: true,
}

export const features: FeatureFlags = { ...defaults, ...vendorFeatures }
