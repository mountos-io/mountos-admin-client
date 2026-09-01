import type { Storage, CreateStorageRequest, EditStorageRequest, TestStorageNewBucketRequest, MoveStorageVolumesRequest, RegisterStorageCopysetRequest, RegisterStorageCopysetsBulkRequest } from '$lib/core/api/types'
import { api } from './client.svelte'

let storages = $state<Storage[]>([])
let loading = $state(false)
let totalPages = $state(0)
let currentPage = $state(1)
let fetchCtrl: AbortController | null = null

export interface StorageFilters {
  search?: string
  regionId?: number
  storageType?: string
  providerType?: string
  isActive?: boolean
  directAccess?: boolean
}

type FetchStoragesParams = {
  accountId: number
  page?: number
  limit?: number
  filters?: StorageFilters
}

async function fetchStorages({ accountId, page = 1, limit = 20, filters }: FetchStoragesParams) {
  fetchCtrl?.abort()
  const ctrl = fetchCtrl = new AbortController()
  loading = true
  try {
    const res = await api.storages.list({
      accountId, page, limit,
      search: filters?.search,
      regionId: filters?.regionId,
      storageType: filters?.storageType,
      providerType: filters?.providerType,
      isActive: filters?.isActive,
      directAccess: filters?.directAccess,
    }, ctrl.signal)
    storages = res.items
    totalPages = res.pagination?.totalPages ?? 0
    currentPage = res.pagination?.page ?? 1
  } catch (e) {
    if ((e as Error).name === 'AbortError') return
    throw e
  } finally {
    if (fetchCtrl === ctrl) loading = false
  }
}

async function createStorage(req: CreateStorageRequest) {
  return api.storages.create(req)
}

async function editStorage(id: number, req: EditStorageRequest) {
  return api.storages.edit(id, req)
}

// Toggle maintenance mode (direct object-store access) on a block storage. Name is
// required by the edit endpoint, so it is echoed back unchanged.
async function setDirectAccess(id: number, name: string, directAccess: boolean) {
  return api.storages.edit(id, { name, directAccess })
}

async function getStorage(id: number, signal?: AbortSignal) {
  return api.storages.get(id, signal)
}

async function listBlockVolumes(id: number, signal?: AbortSignal) {
  return api.storages.listBlockVolumes(id, signal)
}

async function deactivateStorage(id: number) {
  await api.storages.deactivate(id)
}

async function testBucket(req: TestStorageNewBucketRequest) {
  return api.storages.testNewBucket(req)
}

async function testStorageBucket(id: number) {
  return api.storages.testStorageBucket(id)
}

// Other storages sharing this one's physicalFingerprint, each with its current
// volumes: move-volumes candidates (fingerprint is a discovery index only;
// the server re-verifies raw fields before actually moving anything).
async function listCompatibleStorages(id: number, signal?: AbortSignal) {
  return api.storages.listCompatible(id, signal)
}

async function moveVolumes(id: number, req: MoveStorageVolumesRequest) {
  return api.storages.moveVolumes(id, req)
}

async function listCopysets(id: number, signal?: AbortSignal) {
  return api.storages.listCopysets(id, undefined, undefined, signal)
}

async function getCopysetStatus(id: number, copysetId: string, signal?: AbortSignal) {
  return api.storages.getCopysetStatus(id, copysetId, signal)
}

async function drainCopyset(id: number, copysetId: string) {
  return api.storages.drainCopyset(id, copysetId)
}

async function cancelDrain(id: number, copysetId: string) {
  return api.storages.cancelDrain(id, copysetId)
}

async function registerCopyset(id: number, req: RegisterStorageCopysetRequest) {
  return api.storages.registerCopyset(id, req)
}

async function registerCopysetsBulk(id: number, req: RegisterStorageCopysetsBulkRequest) {
  return api.storages.registerCopysetsBulk(id, req)
}

async function reactivateMember(id: number, blockVolumeId: string) {
  return api.storages.reactivateMember(id, blockVolumeId)
}

// Permanently deregisters a detached pool member.
async function removeMember(id: number, blockVolumeId: string) {
  return api.storages.removeMember(id, blockVolumeId)
}

export function useStorages() {
  return {
    get storages() { return storages },
    get loading() { return loading },
    get totalPages() { return totalPages },
    get currentPage() { return currentPage },
    fetchStorages,
    createStorage,
    editStorage,
    setDirectAccess,
    getStorage,
    listBlockVolumes,
    deactivateStorage,
    testBucket,
    testStorageBucket,
    listCompatibleStorages,
    moveVolumes,
    listCopysets,
    getCopysetStatus,
    drainCopyset,
    cancelDrain,
    registerCopyset,
    registerCopysetsBulk,
    reactivateMember,
    removeMember,
  }
}
