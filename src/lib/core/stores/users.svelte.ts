import type { User, AddUserRequest, EditUserRequest } from '$lib/core/api/types'
import { api } from './client.svelte'

let users = $state<User[]>([])
let loading = $state(false)
let totalPages = $state(0)
let currentPage = $state(1)

async function fetchUsers(accountId: number, page = 1, limit = 20) {
  loading = true
  try {
    const res = await api.users.list({ accountId, page, limit })
    users = res.items
    totalPages = res.pagination.totalPages
    currentPage = res.pagination.page
  } finally {
    loading = false
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

async function activateUser(id: number) {
  await api.users.activate(id)
}

async function deactivateUser(id: number) {
  await api.users.deactivate(id)
}

export function useUsers() {
  return {
    get users() { return users },
    get loading() { return loading },
    get totalPages() { return totalPages },
    get currentPage() { return currentPage },
    fetchUsers,
    addUser,
    editUser,
    getUser,
    activateUser,
    deactivateUser,
  }
}
