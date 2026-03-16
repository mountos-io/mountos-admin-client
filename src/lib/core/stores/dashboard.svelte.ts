import type { DashboardStats } from '$lib/core/api/types'
import { api } from './client.svelte'

let stats = $state<DashboardStats | null>(null)
let loading = $state(false)
let fetchCtrl: AbortController | null = null

async function fetchStats(accountId: number) {
  fetchCtrl?.abort()
  const ctrl = fetchCtrl = new AbortController()
  loading = true
  try {
    stats = await api.dashboard.stats(accountId, ctrl.signal)
  } catch (e) {
    if ((e as Error).name === 'AbortError') return
    throw e
  } finally {
    if (fetchCtrl === ctrl) loading = false
  }
}

function reset() {
  stats = null
  loading = false
  fetchCtrl?.abort()
  fetchCtrl = null
}

export function useDashboard() {
  return {
    get stats() { return stats },
    get loading() { return loading },
    fetchStats,
    reset,
  }
}
