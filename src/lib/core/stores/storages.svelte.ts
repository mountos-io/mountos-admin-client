import type { Storage, CreateStorageRequest, EditStorageRequest } from '$lib/core/api/types'
import { api } from './client.svelte'

let storages = $state<Storage[]>([])
let loading = $state(false)
let totalPages = $state(0)
let currentPage = $state(1)

async function fetchStorages(accountId: number, page = 1, limit = 20) {
  loading = true
  try {
    const res = await api.storages.list({ accountId, page, limit })
    storages = res.items
    totalPages = res.pagination.totalPages
    currentPage = res.pagination.page
  } finally {
    loading = false
  }
}

async function createStorage(req: CreateStorageRequest) {
  return api.storages.create(req)
}

async function editStorage(id: number, req: EditStorageRequest) {
  return api.storages.edit(id, req)
}

async function getStorage(id: number) {
  return api.storages.get(id)
}

async function activateStorage(id: number) {
  await api.storages.activate(id)
}

async function deactivateStorage(id: number) {
  await api.storages.deactivate(id)
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
    getStorage,
    activateStorage,
    deactivateStorage,
  }
}
