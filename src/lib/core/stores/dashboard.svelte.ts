import type { DashboardStats } from '$lib/core/api/types'
import { api } from './client.svelte'

let stats = $state<DashboardStats | null>(null)
let loading = $state(false)
let error = $state<string | null>(null)
let fetchCtrl: AbortController | null = null

async function fetchStats(accountId: number) {
  fetchCtrl?.abort()
  const ctrl = fetchCtrl = new AbortController()
  loading = true
  error = null
  try {
    stats = await api.dashboard.stats(accountId, ctrl.signal)
  } catch (e) {
    if ((e as Error).name === 'AbortError') return
    error = (e as Error).message || 'Failed to load stats'
  } finally {
    if (fetchCtrl === ctrl) loading = false
  }
}

function reset() {
  stats = null
  loading = false
  error = null
  fetchCtrl?.abort()
  fetchCtrl = null
}

export function useDashboard() {
  return {
    get stats() { return stats },
    get loading() { return loading },
    get error() { return error },
    fetchStats,
    reset,
  }
}
