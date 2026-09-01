import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte'
import { readable } from 'svelte/store'
import Page from './+page.svelte'

const { createStorage, gotoMock, fetchRegions } = vi.hoisted(() => ({
  createStorage: vi.fn(),
  gotoMock: vi.fn(),
  fetchRegions: vi.fn().mockResolvedValue(undefined),
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

async function renderPage() {
  render(Page)
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Create Storage' })).toBeInTheDocument())
}

beforeEach(() => { vi.clearAllMocks() })

describe('storages/create', () => {
  it('shows the copyset advisory notice for a block storage, with no member-drafting form', async () => {
    await renderPage()
    await fireEvent.click(screen.getByRole('button', { name: 'Storage Type' }))
    await fireEvent.click(await screen.findByRole('option', { name: 'Block' }))

    expect(await screen.findByText(/This storage starts with no copyset servers/)).toBeInTheDocument()
    expect(screen.queryByText('Block Volume')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add member' })).not.toBeInTheDocument()
  })

  it('does not show the copyset advisory for an object storage', async () => {
    await renderPage()
    await fireEvent.click(screen.getByRole('button', { name: 'Storage Type' }))
    await fireEvent.click(await screen.findByRole('option', { name: 'Object' }))

    expect(screen.queryByText(/This storage starts with no copyset servers/)).not.toBeInTheDocument()
  })

  it('keeps Create Storage disabled until the bucket is verified, with no member fields to fill first', async () => {
    await renderPage()
    await fireEvent.click(screen.getByRole('button', { name: 'Storage Type' }))
    await fireEvent.click(await screen.findByRole('option', { name: 'Block' }))
    await fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'my-storage' } })

    expect(screen.getByRole('button', { name: 'Create Storage' })).toBeDisabled()
    expect(createStorage).not.toHaveBeenCalled()
  })
})
