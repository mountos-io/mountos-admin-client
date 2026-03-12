import type { ServiceNode } from '$lib/core/api/types'
import { api } from './client.svelte'

let nodes = $state<ServiceNode[]>([])
let loading = $state(false)
let selectedRegionId = $state<number | null>(null)

async function fetchNodes(regionId: number) {
  selectedRegionId = regionId
  loading = true
  try {
    nodes = await api.serviceNodes.list(regionId)
  } finally {
    loading = false
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
