import type { User, AddUserRequest, EditUserRequest } from '$lib/core/api/types'
import { authAdapter } from '$lib/config/auth'
import { createStepUpHandler } from '$lib/core/stores/stepup.svelte'
import { api } from './client.svelte'

let users = $state<User[]>([])
let loading = $state(false)
let totalPages = $state(0)
let currentPage = $state(1)
let fetchCtrl: AbortController | null = null

async function fetchUsers(accountId: number, page = 1, limit = 20, search?: string) {
  fetchCtrl?.abort()
  const ctrl = fetchCtrl = new AbortController()
  loading = true
  try {
    const res = await api.users.list({ accountId, search, page, limit }, ctrl.signal)
    users = res.items
    totalPages = res.pagination?.totalPages ?? 0
    currentPage = res.pagination?.page ?? 1
  } catch (e) {
    if ((e as Error).name === 'AbortError') return
    throw e
  } finally {
    if (fetchCtrl === ctrl) loading = false
  }
}

async function addUser(req: AddUserRequest) {
  return api.users.add(req)
}

async function editUser(id: number, req: EditUserRequest) {
  return api.users.edit(id, req)
}

async function getUser(id: number) {
  return api.users.get(id)
}

async function deactivateUser(id: number) {
  await api.users.deactivate(id)
}

let searchCtrl: AbortController | null = null

async function searchUsers(accountId: number, search: string, signal?: AbortSignal): Promise<User[]> {
  searchCtrl?.abort()
  const ctrl = searchCtrl = new AbortController()
  if (signal) signal.addEventListener('abort', () => ctrl.abort(), { once: true })
  try {
    const res = await api.users.list({ accountId, search, limit: 20 }, ctrl.signal)
    return res.items
  } catch (e) {
    if ((e as Error).name === 'AbortError') return []
    throw e
  }
}

const stepUp = createStepUpHandler()

// Raw fetch — targets auth-layer endpoint, not the /api/v1/* proxy
async function revokeAdminSessions(username: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...await authAdapter.getRequestHeaders(),
  }
  let res = await fetch('/api/auth/revoke-user', {
    method: 'POST',
    headers,
    body: JSON.stringify({ username }),
    credentials: 'include',
  })
  if (res.status === 403) {
    const rb = await res.json().catch(() => ({})) as Record<string, string>
    if (rb.status === 'step-up-required') {
      const token = await stepUp()
      headers['X-StepUp-Token'] = token
      res = await fetch('/api/auth/revoke-user', {
        method: 'POST',
        headers,
        body: JSON.stringify({ username }),
        credentials: 'include',
      })
    }
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as Record<string, string>
    throw new Error(data.message ?? 'Failed to revoke sessions')
  }
  return res.json()
}

export function useUsers() {
  return {
    get users() { return users },
    get loading() { return loading },
    get totalPages() { return totalPages },
    get currentPage() { return currentPage },
    fetchUsers,
    searchUsers,
    addUser,
    editUser,
    getUser,
    deactivateUser,
    revokeAdminSessions,
  }
}
