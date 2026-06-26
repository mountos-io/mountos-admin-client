import type { Region, CreateRegionRequest, EditRegionRequest } from '$lib/core/api/types'
import { api } from './client.svelte'

let regions = $state<Region[]>([])
let loading = $state(false)
let totalPages = $state(0)
let currentPage = $state(1)
let fetchCtrl: AbortController | null = null
// Account context retained so internal refetches (e.g. after deactivate) stay
// scoped to the same account.
let lastAccountId: number | null = null

async function fetchRegions(accountId: number, { page = 1, limit = 20, isActive }: { page?: number; limit?: number; isActive?: boolean } = {}) {
  fetchCtrl?.abort()
  const ctrl = fetchCtrl = new AbortController()
  lastAccountId = accountId
  loading = true
  try {
    const res = await api.regions.list({ accountId, page, limit, isActive }, ctrl.signal)
    regions = res.items
    totalPages = res.pagination?.totalPages ?? 0
    currentPage = res.pagination?.page ?? 1
  } catch (e) {
    if ((e as Error).name === 'AbortError') return
    throw e
  } finally {
    if (fetchCtrl === ctrl) loading = false
  }
}

async function createRegion(req: CreateRegionRequest) {
  return api.regions.create(req)
}

async function editRegion(id: number, req: EditRegionRequest) {
  return api.regions.edit(id, req)
}

async function getRegion(id: number) {
  return api.regions.get(id)
}

async function deactivateRegion(id: number) {
  await api.regions.deactivate(id)
  if (lastAccountId != null) await fetchRegions(lastAccountId, { page: currentPage })
}

export function useRegions() {
  return {
    get regions() { return regions },
    get loading() { return loading },
    get totalPages() { return totalPages },
    get currentPage() { return currentPage },
    fetchRegions,
    createRegion,
    editRegion,
    getRegion,
    deactivateRegion,
  }
}
