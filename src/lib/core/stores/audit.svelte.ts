import type { AuditLog } from '$lib/core/api/types'
import { api } from './client.svelte'

let logs = $state<AuditLog[]>([])
let loading = $state(false)
let nextCursor = $state<number | null>(null)
let hasMore = $derived(nextCursor !== null)
let fetchCtrl: AbortController | null = null

async function fetchLogs(opts: { accountId: number; subject?: string; limit?: number; reset?: boolean }) {
  fetchCtrl?.abort()
  const ctrl = fetchCtrl = new AbortController()
  loading = true
  try {
    const cursor = opts.reset ? undefined : nextCursor ?? undefined
    const res = await api.auditLogs.list({
      accountId: opts.accountId,
      subject: opts.subject,
      cursor,
      limit: opts.limit ?? 20,
    }, ctrl.signal)
    if (opts.reset || !cursor) {
      logs = res.items
    } else {
      logs = [...logs, ...res.items]
    }
    nextCursor = res.nextCursor
  } catch (e) {
    if ((e as Error).name === 'AbortError') return
    throw e
  } finally {
    if (fetchCtrl === ctrl) loading = false
  }
}

function reset() {
  fetchCtrl?.abort()
  fetchCtrl = null
  logs = []
  loading = false
  nextCursor = null
}

export function useAuditLogs() {
  return {
    get logs() { return logs },
    get loading() { return loading },
    get hasMore() { return hasMore },
    fetchLogs,
    reset,
  }
}
