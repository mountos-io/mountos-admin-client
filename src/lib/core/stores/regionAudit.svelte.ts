import type { AuditLog } from '$lib/core/api/types'
import { api } from './client.svelte'

let logs = $state<AuditLog[]>([])
let loading = $state(false)
let error = $state('')
let nextCursor = $state<number | null>(null)
let hasMore = $derived(nextCursor !== null)
let fetchCtrl: AbortController | null = null

async function fetchLogs(regionId: number, opts?: { subject?: string; node?: string; limit?: number; reset?: boolean }) {
  fetchCtrl?.abort()
  const ctrl = fetchCtrl = new AbortController()
  loading = true
  try {
    const cursor = opts?.reset ? undefined : nextCursor ?? undefined
    const res = await api.regionAuditLogs.list(regionId, {
      subject: opts?.subject,
      node: opts?.node,
      cursor,
      limit: opts?.limit ?? 20,
    }, ctrl.signal)
    if (opts?.reset || !cursor) {
      logs = res.items
    } else {
      logs = [...logs, ...res.items]
    }
    nextCursor = res.nextCursor
    error = ''
  } catch (e) {
    if ((e as Error).name === 'AbortError') return
    const msg = (e as Error).message
    error = msg ? `Failed to load audit logs: ${msg}` : 'Failed to load audit logs'
  } finally {
    if (fetchCtrl === ctrl) loading = false
  }
}

function reset() {
  fetchCtrl?.abort()
  fetchCtrl = null
  logs = []
  loading = false
  error = ''
  nextCursor = null
}

export function useRegionAuditLogs() {
  return {
    get logs() { return logs },
    get loading() { return loading },
    get error() { return error },
    get hasMore() { return hasMore },
    fetchLogs,
    reset,
  }
}
