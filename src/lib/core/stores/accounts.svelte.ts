import type { Account, CreateAccountRequest, EditAccountRequest, UpdateAccountQuotaRequest, UpdateAccountMetadataRateLimitRequest } from '$lib/core/api/types'
import { api } from './client.svelte'

let accounts = $state<Account[]>([])
let selectedAccountId = $state<number | null>(null)
let loading = $state(false)
let totalPages = $state(0)
let currentPage = $state(1)
let fetchCtrl: AbortController | null = null

const selectedAccount = $derived(accounts.find(a => a.id === selectedAccountId) ?? null)

async function fetchAccounts({ page = 1, limit = 20, isActive }: { page?: number; limit?: number; isActive?: boolean } = {}) {
  fetchCtrl?.abort()
  const ctrl = fetchCtrl = new AbortController()
  loading = true
  try {
    const res = await api.accounts.list({ page, limit, isActive }, ctrl.signal)
    accounts = res.items
    totalPages = res.pagination?.totalPages ?? 0
    currentPage = res.pagination?.page ?? 1
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

function setFixedAccount(account: Account) {
  accounts = [account]
  selectedAccountId = account.id
}

async function createAccount(req: CreateAccountRequest) {
  const res = await api.accounts.create(req)
  await fetchAccounts({ page: currentPage })
  return res
}

async function editAccount(id: number, req: EditAccountRequest) {
  const res = await api.accounts.edit(id, req)
  await fetchAccounts({ page: currentPage })
  return res
}

async function updateQuota(id: number, req: UpdateAccountQuotaRequest) {
  const res = await api.accounts.updateQuota(id, req)
  await fetchAccounts({ page: currentPage })
  return res
}

async function updateMetadataRateLimit(id: number, req: UpdateAccountMetadataRateLimitRequest) {
  const res = await api.accounts.updateMetadataRateLimit(id, req)
  await fetchAccounts({ page: currentPage })
  return res
}

async function lockAccount(id: number) {
  await api.accounts.lock(id)
  await fetchAccounts({ page: currentPage })
}

async function unlockAccount(id: number) {
  await api.accounts.unlock(id)
  await fetchAccounts({ page: currentPage })
}

async function deactivateAccount(id: number) {
  await api.accounts.deactivate(id)
  await fetchAccounts({ page: currentPage })
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
    setFixedAccount,
    createAccount,
    editAccount,
    updateQuota,
    updateMetadataRateLimit,
    lockAccount,
    unlockAccount,
    deactivateAccount,
    getAccount,
  }
}
