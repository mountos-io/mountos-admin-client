export type {
  Ref,
  Account,
  User,
  Region,
  Storage,
  BlockVolume,
  Volume,
  Fork,
  AuditLog,
  ServiceNode,
  DiscoverMetaResponse,
  DiscoverEndpoint,
  MetricsTarget,
  GenerateMetricTokenRequest,
  MetricsTokenResponse,
  DashboardStats,
  RegionVolumeMetrics,
  CreateAccountRequest,
  EditAccountRequest,
  UpdateAccountQuotaRequest,
  AddUserRequest,
  EditUserRequest,
  CreateRegionRequest,
  EditRegionRequest,
  RegionCluster,
  CreateRegionClusterRequest,
  EditRegionClusterRequest,
  SetRegionClusterReadyRequest,
  RegionClusterListOptions,
  CreateStorageRequest,
  EditStorageRequest,
  TestStorageNewBucketRequest,
  CompatibleStorage,
  CompatibleVolume,
  MoveStorageVolumesRequest,
  MoveVolumeFailure,
  CreateVolumeRequest,
  EditVolumeRequest,
  GenerateVolumeAPIKeysRequest,
  VolumeApiKey,
  RevokeVolumeAPIKeyRequest,
  RevokeVolumeAPIKeysByUserRequest,
  DeactivateVolumeRequest,
  UpdateVolumeQuotaRequest,
  ListOptions,
  PaginatedResponse,
  CursorPaginatedResponse,
  PaginationMeta,
  UserListOptions,
  StorageListOptions,
  VolumeListOptions,
  AuditLogListOptions,
  RegionAuditLogListOptions,
  ClientSession,
  ClientSessionListOptions,
  ClientSessionStatus,
  SessionSummary,
  StandardResponse,
  LicenseDetails,
  LicenseTerms,
  LicenseStatus,
  LicenseType,
  ServiceAlert,
  AlertListOptions,
  AlertCountResponse,
  DeleteVolumeForkRequest,
  CreateVolumeForkRequest,
  RestoreVolumeForkRequest,
  VolumeSizePoint,
  RegionAlert,
  RegionAlertListOptions,
  GCWorkerEvent,
  GCWorkerEventListOptions,
  GCWorkerEventBucket,
  GCWorkerEventHistogramResponse,
  ForkTreeEntry,
  ForkEntryDetail,
  ForkTreeMatch,
  ForkEntryVersion,
  VolumeForkTreeListOptions,
  VolumeForkEntryListOptions,
  VolumeForkSearchListOptions,
} from '@mountos-io/admin-sdk'

import type { NodeStatsSample as SDKNodeStatsSample } from '@mountos-io/admin-sdk'

// Dispatcher telemetry is emitted by newer dataserv nodes before it becomes
// part of the released SDK contract. Keeping the extension here makes the UI
// backward-compatible: every added field is optional and old samples continue
// to render unchanged.
export type NodeStatsSample = SDKNodeStatsSample & {
  dbDispatchLiveOutstanding?: number
  dbDispatchAsyncOutstanding?: number
  dbDispatchAnyOutstanding?: number
  dbDispatchLiveLaneCap?: number
  dbDispatchAsyncLaneCap?: number
  dbDispatchTotalLaneCap?: number
}

export { ApiError } from './errors.js'
export type { AdminClient } from '@mountos-io/admin-sdk'
