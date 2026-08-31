// Groups blockserv ServiceNodes by the BlockVolume they serve, keyed off the
// block_volume_id each node carries in its own metadata. Shared by BlockCopysets.svelte
// (storage-wide topology) and the copyset detail route (single-copyset topology) so
// both resolve copyset members to their serving node the same way.
import type { ServiceNode } from '$lib/core/api/types'

export function groupNodesByVolume(nodes: ServiceNode[]): Map<string, ServiceNode[]> {
  const map = new Map<string, ServiceNode[]>()
  for (const n of nodes) {
    const bvId = n.metadata?.['block_volume_id']
    if (typeof bvId !== 'string' || !bvId) continue
    const list = map.get(bvId) ?? []
    list.push(n)
    map.set(bvId, list)
  }
  return map
}
