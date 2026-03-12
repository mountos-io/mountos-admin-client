// VENDOR EDITS HERE
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
}

export const features: FeatureFlags = {
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
}
