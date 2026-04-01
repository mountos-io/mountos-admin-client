import type {
  Volume, CreateVolumeRequest, EditVolumeRequest,
  DeactivateVolumeRequest, GenerateVolumeAPIKeysRequest, UpdateVolumeQuotaRequest,
} from '$lib/core/api/types'
import { api } from './client.svelte'

let volumes = $state<Volume[]>([])
let loading = $state(false)
let totalPages = $state(0)
let currentPage = $state(1)
let fetchCtrl: AbortController | null = null

async function fetchVolumes(accountId: number, page = 1, limit = 20, regionId?: number, storageId?: number) {
  fetchCtrl?.abort()
  const ctrl = fetchCtrl = new AbortController()
  loading = true
  try {
    const res = await api.volumes.list({ accountId, page, limit, regionId, storageId }, ctrl.signal)
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

async function generateApiKeys(volumeId: number, req: GenerateVolumeAPIKeysRequest) {
  return api.volumes.generateAPIKeys(volumeId, req)
}

async function revokeApiKey(volumeId: number, apiKey: string) {
  return api.volumes.revokeAPIKey(volumeId, { apiKey })
}

async function revokeApiKeysByUser(volumeId: number, userId: number) {
  return api.volumes.revokeAPIKeysByUser(volumeId, { userId })
}

async function updateQuota(volumeId: number, quotaLimit: number) {
  return api.volumes.updateQuota(volumeId, { quotaLimit })
}

async function listForks(volumeId: number) {
  return api.volumes.listForks(volumeId)
}

async function listAllForks(volumeId: number) {
  return api.volumes.listAllForks(volumeId)
}

async function deleteFork(volumeId: number, forkName: string, force: boolean = false) {
  return api.volumes.deleteFork(volumeId, forkName, { force })
}

async function restoreFork(volumeId: number, forkName: string) {
  return api.volumes.restoreFork(volumeId, forkName)
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
    generateApiKeys,
    revokeApiKey,
    revokeApiKeysByUser,
    updateQuota,
    listForks,
    listAllForks,
    deleteFork,
    restoreFork,
  }
}
