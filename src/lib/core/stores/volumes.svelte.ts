import type {
  Volume, CreateVolumeRequest, EditVolumeRequest,
  DeactivateVolumeRequest, GenerateVolumeAPIKeysRequest, UpdateVolumeQuotaRequest,
  CreateVolumeForkRequest, DeleteVolumeForkRequest, RestoreVolumeForkRequest,
} from '$lib/core/api/types'
import { api } from './client.svelte'

let volumes = $state<Volume[]>([])
let loading = $state(false)
let totalPages = $state(0)
let currentPage = $state(1)
let fetchCtrl: AbortController | null = null

type FetchVolumesParams = {
  accountId: number
  page?: number
  limit?: number
  regionId?: number
  regionClusterId?: number
  storageId?: number
  volumeType?: string
  locked?: boolean
  isActive?: boolean
}

async function fetchVolumes({
  accountId, page = 1, limit = 20,
  regionId, regionClusterId, storageId, volumeType, locked, isActive,
}: FetchVolumesParams) {
  fetchCtrl?.abort()
  const ctrl = fetchCtrl = new AbortController()
  loading = true
  try {
    const res = await api.volumes.list({ accountId, page, limit, regionId, regionClusterId, storageId, volumeType, locked, isActive }, ctrl.signal)
    volumes = res.items
    totalPages = res.pagination?.totalPages ?? 0
    currentPage = res.pagination?.page ?? 1
  } catch (e) {
    if ((e as Error).name === 'AbortError') return
    throw e
  } finally {
    if (fetchCtrl === ctrl) loading = false
  }
}

async function createVolume(req: CreateVolumeRequest) {
  return api.volumes.create(req)
}

async function editVolume(id: number, req: EditVolumeRequest) {
  return api.volumes.edit(id, req)
}

async function getVolume(id: number) {
  return api.volumes.get(id)
}

async function lockVolume(id: number) {
  await api.volumes.lock(id)
}

async function unlockVolume(id: number) {
  await api.volumes.unlock(id)
}

async function deactivateVolume(id: number, req: DeactivateVolumeRequest) {
  await api.volumes.deactivate(id, req)
}

async function activateVolume(id: number) {
  await api.volumes.activate(id)
}

async function generateApiKeys(volumeId: number, req: GenerateVolumeAPIKeysRequest) {
  return api.volumes.generateAPIKeys(volumeId, req)
}

async function listApiKeys(volumeId: number, signal?: AbortSignal) {
  return api.volumes.listAPIKeys(volumeId, signal)
}

async function revokeApiKey(volumeId: number, apiKey: string) {
  return api.volumes.revokeAPIKey(volumeId, { apiKey })
}

async function revokeApiKeysByUser({ volumeId, userId }: { volumeId: number; userId: number }) {
  return api.volumes.revokeAPIKeysByUser(volumeId, { userId })
}

async function updateQuota({ volumeId, quotaLimit }: { volumeId: number; quotaLimit: number }) {
  return api.volumes.updateQuota(volumeId, { quotaLimit })
}

async function listForks(volumeId: number, volumeType?: string) {
  return api.volumes.listForks(volumeId, volumeType)
}

async function listAllForks(volumeId: number, volumeType?: string) {
  return api.volumes.listForks(volumeId, volumeType, true)
}

async function createFork(volumeId: number, req: CreateVolumeForkRequest) {
  return api.volumes.createFork(volumeId, req)
}

async function deleteFork(volumeId: number, forkName: string, req: DeleteVolumeForkRequest = {}) {
  return api.volumes.deleteFork(volumeId, forkName, req)
}

async function restoreFork(volumeId: number, forkName: string, req: RestoreVolumeForkRequest = {}) {
  return api.volumes.restoreFork(volumeId, forkName, req)
}

async function sizeHistory({ volumeId, from, to }: { volumeId: number; from: string; to: string }) {
  return api.volumes.sizeHistory(volumeId, from, to)
}

export function useVolumes() {
  return {
    get volumes() { return volumes },
    get loading() { return loading },
    get totalPages() { return totalPages },
    get currentPage() { return currentPage },
    fetchVolumes,
    createVolume,
    editVolume,
    getVolume,
    lockVolume,
    unlockVolume,
    deactivateVolume,
    activateVolume,
    generateApiKeys,
    listApiKeys,
    revokeApiKey,
    revokeApiKeysByUser,
    updateQuota,
    listForks,
    listAllForks,
    createFork,
    deleteFork,
    restoreFork,
    sizeHistory,
  }
}
