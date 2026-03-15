import type { Account, CreateAccountRequest, EditAccountRequest } from '$lib/core/api/types'
import { api } from './client.svelte'

let accounts = $state<Account[]>([])
let selectedAccountId = $state<number | null>(null)
let loading = $state(false)
let totalPages = $state(0)
let currentPage = $state(1)
let fetchCtrl: AbortController | null = null

const selectedAccount = $derived(accounts.find(a => a.id === selectedAccountId) ?? null)

async function fetchAccounts(page = 1, limit = 20) {
  fetchCtrl?.abort()
  const ctrl = fetchCtrl = new AbortController()
  loading = true
  try {
    const res = await api.accounts.list({ page, limit }, ctrl.signal)
    accounts = res.items
    totalPages = res.pagination.totalPages
    currentPage = res.pagination.page
  } catch (e) {
    if ((e as Error).name === 'AbortError') return
    throw e
  } finally {
    if (fetchCtrl === ctrl) loading = false
  }
}

function selectAccount(id: number) {
  selectedAccountId = id
}

async function createAccount(req: CreateAccountRequest) {
  const res = await api.accounts.create(req)
  await fetchAccounts(currentPage)
  return res
}

async function editAccount(id: number, req: EditAccountRequest) {
  const res = await api.accounts.edit(id, req)
  await fetchAccounts(currentPage)
  return res
}

async function lockAccount(id: number) {
  await api.accounts.lock(id)
  await fetchAccounts(currentPage)
}

async function unlockAccount(id: number) {
  await api.accounts.unlock(id)
  await fetchAccounts(currentPage)
}

async function activateAccount(id: number) {
  await api.accounts.activate(id)
  await fetchAccounts(currentPage)
}

async function deactivateAccount(id: number) {
  await api.accounts.deactivate(id)
  await fetchAccounts(currentPage)
}

async function getAccount(id: number) {
  return api.accounts.get(id)
}

export function useAccounts() {
  return {
    get accounts() { return accounts },
    get selectedAccountId() { return selectedAccountId },
    get selectedAccount() { return selectedAccount },
    get loading() { return loading },
    get totalPages() { return totalPages },
    get currentPage() { return currentPage },
    fetchAccounts,
    selectAccount,
    createAccount,
    editAccount,
    lockAccount,
    unlockAccount,
    activateAccount,
    deactivateAccount,
    getAccount,
  }
}
