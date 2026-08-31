import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte'
import { readable } from 'svelte/store'
import Page from './+page.svelte'

const { createStorage, gotoMock, fetchRegions, fetchClusters } = vi.hoisted(() => ({
  createStorage: vi.fn(),
  gotoMock: vi.fn(),
  fetchRegions: vi.fn().mockResolvedValue(undefined),
  fetchClusters: vi.fn(),
}))

vi.mock('$app/navigation', () => ({ goto: gotoMock }))
vi.mock('$app/stores', () => ({
  page: readable({ url: new URL('http://localhost/storages/create?regionId=7'), params: {} }),
}))

vi.mock('$lib/core/stores/storages.svelte', () => ({
  useStorages: () => ({ createStorage }),
}))
vi.mock('$lib/core/stores/regions.svelte', () => ({
  useRegions: () => ({ regions: [{ id: 7, name: 'us-east' }], fetchRegions }),
}))
vi.mock('$lib/core/stores/clusters.svelte', () => ({
  useClusters: () => ({
    clustersFor: (regionId: number) => regionId === 7 ? [
      { id: 101, name: 'az-1', isActive: true, isReady: true, defaultCluster: true },
      { id: 102, name: 'az-2', isActive: true, isReady: true, defaultCluster: false },
    ] : [],
    isLoading: () => false,
    fetchClusters,
  }),
}))
vi.mock('$lib/core/stores/accounts.svelte', () => ({
  useAccounts: () => ({ selectedAccountId: 1 }),
}))
vi.mock('$lib/core/stores/auth.svelte', () => ({
  useAuth: () => ({ loading: false, can: () => true, isUserRole: false }),
}))
vi.mock('$lib/core/utils/toast', () => ({
  showSuccessToast: vi.fn(),
  showErrorToast: vi.fn(),
  handleApiError: vi.fn(),
}))

async function renderBlockForm() {
  render(Page)
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Create Storage' })).toBeInTheDocument())
  await fireEvent.click(screen.getByRole('button', { name: 'Storage Type' }))
  await fireEvent.click(await screen.findByRole('option', { name: 'Block' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Add member' })).toBeInTheDocument())
}

function clusterSelects() {
  return screen.getAllByRole('button', { name: 'Availability / placement' })
}

async function selectCluster(index: number, label: string) {
  await fireEvent.click(clusterSelects()[index])
  await fireEvent.click(await screen.findByRole('option', { name: label }))
}

beforeEach(() => { vi.clearAllMocks() })

describe('storages/create', () => {
  it('does not cap block members at 3: adding a 4th member stays enabled', async () => {
    await renderBlockForm()

    expect(screen.getAllByText('Block Volume')).toHaveLength(1)
    const addBtn = screen.getByRole('button', { name: 'Add member' })

    await fireEvent.click(addBtn)
    await fireEvent.click(addBtn)
    expect(screen.getAllByText('Block Volume')).toHaveLength(3)
    expect(addBtn).not.toBeDisabled()

    await fireEvent.click(addBtn)
    expect(screen.getAllByText('Block Volume')).toHaveLength(4)
    expect(addBtn).not.toBeDisabled()
  })

  it('warns only when members have no cluster diversity at all, not on every repeat', async () => {
    await renderBlockForm()
    await fireEvent.click(screen.getByRole('button', { name: 'Add member' }))

    await selectCluster(0, 'az-1 (default)')
    await selectCluster(1, 'az-1 (default)')
    expect(screen.getByText(/All members are in the same cluster/)).toBeInTheDocument()

    // Spanning two clusters resolves it.
    await selectCluster(1, 'az-2')
    expect(screen.queryByText(/All members are in the same cluster/)).not.toBeInTheDocument()

    // A third member reusing an already-used cluster is normal under the pooled copyset-
    // formation model (copysets always draw from the same two clusters), so it must not
    // re-trigger the warning.
    await fireEvent.click(screen.getByRole('button', { name: 'Add member' }))
    await selectCluster(2, 'az-1 (default)')
    expect(screen.queryByText(/All members are in the same cluster/)).not.toBeInTheDocument()
  })
})
