import type { Region, CreateRegionRequest, EditRegionRequest } from '$lib/core/api/types'
import { api } from './client.svelte'

let regions = $state<Region[]>([])
let loading = $state(false)
let totalPages = $state(0)
let currentPage = $state(1)
let fetchCtrl: AbortController | null = null

async function fetchRegions(page = 1, limit = 20) {
  fetchCtrl?.abort()
  fetchCtrl = new AbortController()
  loading = true
  try {
    const res = await api.regions.list({ page, limit }, fetchCtrl.signal)
    regions = res.items
    totalPages = res.pagination.totalPages
    currentPage = res.pagination.page
  } catch (e) {
    if ((e as Error).name === 'AbortError') return
    throw e
  } finally {
    loading = false
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

async function activateRegion(id: number) {
  await api.regions.activate(id)
  await fetchRegions(currentPage)
}

async function deactivateRegion(id: number) {
  await api.regions.deactivate(id)
  await fetchRegions(currentPage)
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
    activateRegion,
    deactivateRegion,
  }
}
