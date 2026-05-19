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
const fetchCtrls: Record<number, AbortController | null> = {}

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
    fetchClusters,
    createCluster,
    editCluster,
    getCluster,
    setDefault,
    setReady,
    deactivate,
  }
}
