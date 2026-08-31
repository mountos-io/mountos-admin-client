import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/svelte'
import { readable } from 'svelte/store'
import Page from './+page.svelte'
import type { Copyset, BlockVolume, ServiceNode, Storage } from '$lib/core/api/types'

const { getStorage, getCopysetStatus, listBlockVolumes, serviceNodesList, gotoMock, showErrorToast, authCan } = vi.hoisted(() => ({
  getStorage: vi.fn(),
  getCopysetStatus: vi.fn(),
  listBlockVolumes: vi.fn(),
  serviceNodesList: vi.fn(),
  gotoMock: vi.fn(),
  showErrorToast: vi.fn(),
  authCan: vi.fn(() => true),
}))

vi.mock('$app/navigation', () => ({ goto: gotoMock }))
vi.mock('$app/stores', () => ({
  page: readable({ params: { id: '1', copysetId: 'copyset-1' }, url: new URL('http://localhost/storages/1/copysets/copyset-1') }),
}))
vi.mock('$lib/core/stores/auth.svelte', () => ({
  useAuth: () => ({ loading: false, can: authCan }),
}))
vi.mock('$lib/core/stores/storages.svelte', () => ({
  useStorages: () => ({ getStorage, getCopysetStatus, listBlockVolumes }),
}))
vi.mock('$lib/core/stores/client.svelte', () => ({
  api: { serviceNodes: { list: serviceNodesList } },
}))
vi.mock('$lib/core/utils/toast', () => ({ showErrorToast }))
vi.mock('$lib/components/shared/NodeDetail.svelte', async () => {
  const mod = await import('./__mocks__/node-detail-test-stub.svelte')
  return { default: mod.default }
})

function storage(overrides: Partial<Storage> = {}): Storage {
  return {
    id: 1, uuid: 'storage-uuid', regionInfo: { id: 2, name: 'us-east' }, name: 'my-storage', storageType: 'block', isActive: true,
    ...overrides,
  } as unknown as Storage
}

function copyset(overrides: Partial<Copyset> = {}): Copyset {
  return { id: 'copyset-1', storageId: 'storage-uuid', state: 'active', memberA: 'bv-a', memberB: 'bv-b', tags: [], ...overrides }
}

function bv(id: string, name: string): BlockVolume {
  return { id, name, isActive: true, clusterUuid: `cluster-${id}`, clusterName: 'az-1', clusterReady: true } as unknown as BlockVolume
}

function sn(nodeId: string, blockVolumeId: string): ServiceNode {
  return {
    id: 1, regionId: 2, serviceType: 'blockserv', nodeId, advertiseAddr: '10.0.0.1:9100', status: 'healthy',
    metadata: { block_volume_id: blockVolumeId },
  } as unknown as ServiceNode
}

const blockVolumes = [bv('bv-a', 'replica-a'), bv('bv-b', 'replica-b')]

beforeEach(() => {
  vi.clearAllMocks()
  authCan.mockReturnValue(true)
  getStorage.mockResolvedValue(storage())
  listBlockVolumes.mockResolvedValue(blockVolumes)
  serviceNodesList.mockResolvedValue([sn('blockserv-a1', 'bv-a'), sn('blockserv-b1', 'bv-b')])
})

describe('copyset detail page', () => {
  it('shows a loading state before the copyset resolves', () => {
    getCopysetStatus.mockReturnValue(new Promise(() => {}))
    render(Page)
    expect(screen.getByRole('status', { name: 'Loading details' })).toBeInTheDocument()
  })

  it('shows a not-found message when the copyset fails to load', async () => {
    getCopysetStatus.mockRejectedValue(new Error('not found'))
    render(Page)
    await waitFor(() => expect(screen.getByText('Copyset not found.')).toBeInTheDocument())
  })

  it('shows the copyset state and draining backlog in the shared header', async () => {
    getCopysetStatus.mockResolvedValue(copyset({ state: 'draining', pendingSyncJobsA: 3, pendingSyncJobsB: 5 }))
    render(Page)
    await waitFor(() => expect(screen.getByText('Draining')).toBeInTheDocument())
    expect(screen.getByText(/8 objects left to sync/)).toBeInTheDocument()
  })

  it('labels each tab with the member volume name and defaults to Member A active', async () => {
    getCopysetStatus.mockResolvedValue(copyset())
    render(Page)

    const tabA = await screen.findByRole('tab', { name: 'Member A · replica-a' })
    const tabB = screen.getByRole('tab', { name: 'Member B · replica-b' })
    expect(tabA).toHaveAttribute('aria-selected', 'true')
    expect(tabB).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByTestId('node-detail-stub')).toHaveAttribute('data-node-id', 'blockserv-a1')
  })

  it('switches to Member B on click, mounting that member\'s node detail and unmounting Member A\'s', async () => {
    getCopysetStatus.mockResolvedValue(copyset())
    render(Page)

    await screen.findByTestId('node-detail-stub')
    await fireEvent.click(screen.getByRole('tab', { name: 'Member B · replica-b' }))

    await waitFor(() => expect(screen.getByTestId('node-detail-stub')).toHaveAttribute('data-node-id', 'blockserv-b1'))
    expect(screen.getAllByTestId('node-detail-stub')).toHaveLength(1)
  })

  it('shows a fallback message instead of node detail when a member has no registered blockserv', async () => {
    getCopysetStatus.mockResolvedValue(copyset())
    serviceNodesList.mockResolvedValue([sn('blockserv-a1', 'bv-a')]) // no node for bv-b
    render(Page)

    await screen.findByTestId('node-detail-stub')
    await fireEvent.click(screen.getByRole('tab', { name: 'Member B · replica-b' }))

    await waitFor(() => expect(screen.getByText(/No blockserv registered for replica-b yet/)).toBeInTheDocument())
    expect(screen.queryByTestId('node-detail-stub')).not.toBeInTheDocument()
  })

  it('warns and shows the first node when a member has more than one registered blockserv', async () => {
    getCopysetStatus.mockResolvedValue(copyset())
    serviceNodesList.mockResolvedValue([sn('blockserv-a1', 'bv-a'), sn('blockserv-a2', 'bv-a'), sn('blockserv-b1', 'bv-b')])
    render(Page)

    await waitFor(() => expect(screen.getByText(/2 blockserv processes are serving replica-a/)).toBeInTheDocument())
    expect(screen.getByTestId('node-detail-stub')).toHaveAttribute('data-node-id', 'blockserv-a1')
  })

  it('redirects away when the viewer lacks storages read access', async () => {
    authCan.mockReturnValue(false)
    getCopysetStatus.mockResolvedValue(copyset())
    render(Page)
    await waitFor(() => expect(gotoMock).toHaveBeenCalledWith('/', { replaceState: true }))
    expect(showErrorToast).toHaveBeenCalledWith('Access denied')
  })
})
