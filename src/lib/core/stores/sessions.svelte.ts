import type { ClientSession, ClientSessionListOptions, SessionSummary } from '$lib/core/api/types'
import { api } from './client.svelte'

let sessions = $state<ClientSession[]>([])
let summary = $state<SessionSummary[]>([])
let loading = $state(false)
let summaryLoading = $state(false)
let error = $state<string | null>(null)
let totalPages = $state(0)
let currentPage = $state(1)
let fetchCtrl: AbortController | null = null
let summaryCtrl: AbortController | null = null

const totalActive = $derived(
  summary.reduce((sum, s) => sum + (s.status === 'connected' ? s.count : 0), 0)
)

async function fetchSessions(opts?: ClientSessionListOptions) {
  fetchCtrl?.abort()
  const ctrl = fetchCtrl = new AbortController()
  loading = true
  error = null
  try {
    const res = await api.clientSessions.list(opts, ctrl.signal)
    sessions = res.items
    totalPages = res.pagination?.totalPages ?? 0
    currentPage = res.pagination?.page ?? 1
  } catch (e) {
    if ((e as Error).name === 'AbortError') return
    error = (e as Error).message || 'Failed to load sessions'
  } finally {
    if (fetchCtrl === ctrl) loading = false
  }
}

async function fetchSummary(accountId?: number, volumeId?: number) {
  summaryCtrl?.abort()
  const ctrl = summaryCtrl = new AbortController()
  summaryLoading = true
  try {
    summary = await api.clientSessions.summary(accountId, volumeId, ctrl.signal)
  } catch (e) {
    if ((e as Error).name === 'AbortError') return
    summary = []
  } finally {
    if (summaryCtrl === ctrl) summaryLoading = false
  }
}

async function getSession(id: number): Promise<ClientSession> {
  return api.clientSessions.get(id)
}

function reset() {
  sessions = []
  summary = []
  loading = false
  summaryLoading = false
  error = null
  totalPages = 0
  currentPage = 1
  fetchCtrl?.abort()
  fetchCtrl = null
  summaryCtrl?.abort()
  summaryCtrl = null
}

export function useSessions() {
  return {
    get sessions() { return sessions },
    get summary() { return summary },
    get loading() { return loading },
    get summaryLoading() { return summaryLoading },
    get error() { return error },
    get totalPages() { return totalPages },
    get currentPage() { return currentPage },
    get totalActive() { return totalActive },
    fetchSessions,
    fetchSummary,
    getSession,
    reset,
  }
}
