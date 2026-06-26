import type {
  RegionCluster,
  CreateRegionClusterRequest,
  EditRegionClusterRequest,
  SetRegionClusterReadyRequest,
} from '$lib/core/api/types'
import { api } from './client.svelte'

// Per-region store. Multiple regions can be browsed in different tabs of the
// UI, so we cache by regionId rather than holding one global list. fetchCtrl
// is keyed by regionId too so an in-flight request for region A doesn't get
// aborted by a fetch for region B.
let clustersByRegion = $state<Record<number, RegionCluster[]>>({})
let loadingByRegion = $state<Record<number, boolean>>({})
let allLoading = $state(false)
const fetchCtrls: Record<number, AbortController | null> = {}
let allCtrl: AbortController | null = null

// Cross-region views (e.g. the nodes table cluster column) need names for every
// region's clusters in the account. fetchAllClusters pulls them in a single
// account-scoped call instead of fanning out one /regions/:id/clusters/list per
// region, then rebuilds the per-region cache from the authoritative snapshot.
// Paginated defensively in case an account ever exceeds one page of clusters.
async function fetchAllClusters(accountId: number, opts: { isActive?: boolean } = {}) {
  allCtrl?.abort()
  const ctrl = new AbortController()
  allCtrl = ctrl
  allLoading = true
  try {
    const grouped: Record<number, RegionCluster[]> = {}
    let page = 1
    for (;;) {
      const res = await api.clusters.list({ accountId, page, limit: 1000, isActive: opts.isActive }, ctrl.signal)
      for (const c of res.items) (grouped[c.regionId] ??= []).push(c)
      if (page >= (res.pagination?.totalPages ?? 1)) break
      page++
    }
    clustersByRegion = grouped
  } catch (e) {
    if ((e as Error).name === 'AbortError') return
    throw e
  } finally {
    if (allCtrl === ctrl) allLoading = false
  }
}

async function fetchClusters(regionId: number, opts: { page?: number; limit?: number; isActive?: boolean } = {}) {
  fetchCtrls[regionId]?.abort()
  const ctrl = new AbortController()
  fetchCtrls[regionId] = ctrl
  loadingByRegion[regionId] = true
  try {
    const res = await api.regionClusters.list(regionId, {
      page: opts.page ?? 1,
      limit: opts.limit ?? 50,
      isActive: opts.isActive,
    }, ctrl.signal)
    clustersByRegion[regionId] = res.items
  } catch (e) {
    if ((e as Error).name === 'AbortError') return
    throw e
  } finally {
    if (fetchCtrls[regionId] === ctrl) loadingByRegion[regionId] = false
  }
}

async function createCluster(regionId: number, req: CreateRegionClusterRequest) {
  const r = await api.regionClusters.create(regionId, req)
  await fetchClusters(regionId)
  return r
}

async function editCluster(regionId: number, clusterId: number, req: EditRegionClusterRequest) {
  const r = await api.regionClusters.edit(regionId, clusterId, req)
  await fetchClusters(regionId)
  return r
}

async function getCluster(regionId: number, clusterId: number) {
  return api.regionClusters.get(regionId, clusterId)
}

async function setDefault(regionId: number, clusterId: number) {
  const r = await api.regionClusters.setDefault(regionId, clusterId)
  await fetchClusters(regionId)
  return r
}

async function setReady(regionId: number, clusterId: number, req: SetRegionClusterReadyRequest) {
  const r = await api.regionClusters.setReady(regionId, clusterId, req)
  await fetchClusters(regionId)
  return r
}

async function deactivate(regionId: number, clusterId: number) {
  const r = await api.regionClusters.deactivate(regionId, clusterId)
  await fetchClusters(regionId)
  return r
}

export function useClusters() {
  return {
    clustersFor(regionId: number) {
      return clustersByRegion[regionId] ?? []
    },
    isLoading(regionId: number) {
      return loadingByRegion[regionId] ?? false
    },
    isLoadingAll() {
      return allLoading
    },
    fetchClusters,
    fetchAllClusters,
    createCluster,
    editCluster,
    getCluster,
    setDefault,
    setReady,
    deactivate,
  }
}
