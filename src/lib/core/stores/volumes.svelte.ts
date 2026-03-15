import type {
  Volume, CreateVolumeRequest, EditVolumeRequest,
  GenerateVolumeAPIKeysRequest, UpdateVolumeQuotaRequest,
} from '$lib/core/api/types'
import { api } from './client.svelte'

let volumes = $state<Volume[]>([])
let loading = $state(false)
let totalPages = $state(0)
let currentPage = $state(1)
let fetchCtrl: AbortController | null = null

async function fetchVolumes(accountId: number, page = 1, limit = 20) {
  fetchCtrl?.abort()
  const ctrl = fetchCtrl = new AbortController()
  loading = true
  try {
    const res = await api.volumes.list({ accountId, page, limit }, ctrl.signal)
    volumes = res.items
    totalPages = res.pagination.totalPages
    currentPage = res.pagination.page
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

async function activateVolume(id: number) {
  await api.volumes.activate(id)
}

async function deactivateVolume(id: number) {
  await api.volumes.deactivate(id)
}

async function generateApiKeys(volumeId: number, req: GenerateVolumeAPIKeysRequest) {
  return api.volumes.generateAPIKeys(volumeId, req)
}

async function revokeApiKey(volumeId: number, apiKey: string) {
  return api.volumes.revokeAPIKey(volumeId, { apiKey })
}

async function updateQuota(volumeId: number, quotaLimit: number) {
  return api.volumes.updateQuota(volumeId, { quotaLimit })
}

async function getStats(volumeId: number) {
  return api.volumes.stats(volumeId)
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
    activateVolume,
    deactivateVolume,
    generateApiKeys,
    revokeApiKey,
    updateQuota,
    getStats,
  }
}
