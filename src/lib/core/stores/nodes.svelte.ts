import type { ServiceNode } from '$lib/core/api/types'
import { api } from './client.svelte'

let nodes = $state<ServiceNode[]>([])
let loading = $state(false)
let selectedRegionId = $state<number | null>(null)
let fetchCtrl: AbortController | null = null

async function fetchNodes(regionId: number) {
  fetchCtrl?.abort()
  const ctrl = fetchCtrl = new AbortController()
  selectedRegionId = regionId
  loading = true
  try {
    nodes = await api.serviceNodes.list(regionId, ctrl.signal)
  } catch (e) {
    if ((e as Error).name === 'AbortError') return
    throw e
  } finally {
    if (fetchCtrl === ctrl) loading = false
  }
}

async function drainNode(regionId: number, nodeId: string) {
  await api.serviceNodes.drain(regionId, nodeId)
  await fetchNodes(regionId)
}

async function activateNode(regionId: number, nodeId: string) {
  await api.serviceNodes.activate(regionId, nodeId)
  await fetchNodes(regionId)
}

async function removeNode(regionId: number, nodeId: string) {
  await api.serviceNodes.remove(regionId, nodeId)
  await fetchNodes(regionId)
}

export function useNodes() {
  return {
    get nodes() { return nodes },
    get loading() { return loading },
    get selectedRegionId() { return selectedRegionId },
    fetchNodes,
    drainNode,
    activateNode,
    removeNode,
  }
}
