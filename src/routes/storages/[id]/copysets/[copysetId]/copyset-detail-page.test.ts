import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/svelte'
import { readable } from 'svelte/store'
import Page from './+page.svelte'
import { ApiError } from '$lib/core/api/errors'
import type { Copyset, BlockVolume, ServiceNode, Storage } from '$lib/core/api/types'

const {
  getStorage, getCopysetStatus, listBlockVolumes, serviceNodesList, gotoMock, showErrorToast, showSuccessToast, handleApiError, authCan,
  markMemberLost, addCopysetMember,
} = vi.hoisted(() => ({
  getStorage: vi.fn(),
  getCopysetStatus: vi.fn(),
  listBlockVolumes: vi.fn(),
  serviceNodesList: vi.fn(),
  gotoMock: vi.fn(),
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
  handleApiError: vi.fn(),
  authCan: vi.fn((_resource?: string, _action?: string) => true),
  markMemberLost: vi.fn(),
  addCopysetMember: vi.fn(),
}))

vi.mock('$app/navigation', () => ({ goto: gotoMock }))
vi.mock('$app/stores', () => ({
  page: readable({ params: { id: '1', copysetId: 'copyset-1' }, url: new URL('http://localhost/storages/1/copysets/copyset-1') }),
}))
vi.mock('$lib/core/stores/auth.svelte', () => ({
  useAuth: () => ({ loading: false, can: authCan }),
}))
vi.mock('$lib/core/stores/storages.svelte', () => ({
  useStorages: () => ({ getStorage, getCopysetStatus, listBlockVolumes, markMemberLost, addCopysetMember }),
}))
vi.mock('$lib/core/stores/client.svelte', () => ({
  api: { serviceNodes: { list: serviceNodesList } },
}))
vi.mock('$lib/core/utils/toast', () => ({ showErrorToast, showSuccessToast, handleApiError }))
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
  return { id: 'copyset-1', storageId: 'storage-uuid', name: 'mos-block-a', state: 'active', memberA: 'bv-a', memberB: 'bv-b', volumeCount: 0, tags: [], ...overrides }
}

function bv(id: string, name: string): BlockVolume {
  return { id, name, isActive: true, clusterUuid: `cluster-${id}`, clusterName: 'az-1', clusterReady: true } as unknown as BlockVolume
}

function sn(nodeId: string, blockVolumeId: string, extraMetadata: Record<string, unknown> = {}): ServiceNode {
  return {
    id: 1, regionId: 2, serviceType: 'blockserv', nodeId, advertiseAddr: '10.0.0.1:9100', status: 'healthy',
    metadata: { block_volume_id: blockVolumeId, ...extraMetadata },
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

  it('warns when the two members are on different commits', async () => {
    getCopysetStatus.mockResolvedValue(copyset())
    serviceNodesList.mockResolvedValue([
      sn('blockserv-a1', 'bv-a', { commitHash: 'abc1234' }),
      sn('blockserv-b1', 'bv-b', { commitHash: 'def5678' }),
    ])
    render(Page)

    await screen.findByText('Build mismatch')
    expect(screen.getByTitle(/abc1234.*def5678/)).toBeInTheDocument()
    expect(screen.getAllByText('abc1234').length).toBeGreaterThan(0)
    expect(screen.getAllByText('def5678').length).toBeGreaterThan(0)
  })

  it('stays calm when both members are on the same commit', async () => {
    getCopysetStatus.mockResolvedValue(copyset())
    serviceNodesList.mockResolvedValue([
      sn('blockserv-a1', 'bv-a', { commitHash: 'abc1234' }),
      sn('blockserv-b1', 'bv-b', { commitHash: 'abc1234' }),
    ])
    render(Page)

    await screen.findByTestId('node-detail-stub')
    expect(screen.queryByText('Build mismatch')).not.toBeInTheDocument()
  })

  it('stays calm when a commit hash is unknown on one or both members', async () => {
    getCopysetStatus.mockResolvedValue(copyset())
    serviceNodesList.mockResolvedValue([
      sn('blockserv-a1', 'bv-a', { commitHash: 'abc1234' }),
      sn('blockserv-b1', 'bv-b'), // no commitHash reported
    ])
    render(Page)

    await screen.findByTestId('node-detail-stub')
    expect(screen.queryByText('Build mismatch')).not.toBeInTheDocument()
  })

  it('redirects away when the viewer lacks storages read access', async () => {
    authCan.mockReturnValue(false)
    getCopysetStatus.mockResolvedValue(copyset())
    render(Page)
    await waitFor(() => expect(gotoMock).toHaveBeenCalledWith('/', { replaceState: true }))
    expect(showErrorToast).toHaveBeenCalledWith('Access denied')
  })

  describe('mark member lost', () => {
    it('shows a confirm dialog, calls markMemberLost, and refetches the copyset on success', async () => {
      getCopysetStatus.mockResolvedValueOnce(copyset()).mockResolvedValueOnce(copyset({ memberA: undefined }))
      markMemberLost.mockResolvedValue({ id: 'bv-a', memberState: 'lost' })
      render(Page)

      await fireEvent.click(await screen.findByRole('button', { name: 'Mark member lost' }))
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      await fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Mark lost' }))

      await waitFor(() => expect(markMemberLost).toHaveBeenCalledWith(1, 'copyset-1', { blockVolumeId: 'bv-a' }))
      await waitFor(() => expect(showSuccessToast).toHaveBeenCalledWith('Member marked lost'))
      await waitFor(() => expect(getCopysetStatus).toHaveBeenCalledTimes(2))
    })

    it('refused because the node is not confirmed deactivated: shows the reason and offers a force confirmation that resends with force: true', async () => {
      getCopysetStatus.mockResolvedValue(copyset())
      markMemberLost
        .mockRejectedValueOnce(new ApiError("member's service node is not confirmed deactivated; retry with force=true to override", 409))
        .mockResolvedValueOnce({ id: 'bv-a', memberState: 'lost' })
      render(Page)

      await fireEvent.click(await screen.findByRole('button', { name: 'Mark member lost' }))
      await fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Mark lost' }))

      const forceDialog = await screen.findByText('Force mark this member lost?')
      expect(forceDialog).toBeInTheDocument()
      expect(screen.getByText(/not confirmed deactivated/)).toBeInTheDocument()

      await fireEvent.click(screen.getByRole('button', { name: 'Force mark lost' }))
      await waitFor(() => expect(markMemberLost).toHaveBeenCalledWith(1, 'copyset-1', { blockVolumeId: 'bv-a', force: true }))
    })

    it('refused for any other reason shows the real message and does not offer a force confirmation', async () => {
      getCopysetStatus.mockResolvedValue(copyset())
      markMemberLost.mockRejectedValue(new ApiError('block volume is not an active member of this copyset', 409))
      render(Page)

      await fireEvent.click(await screen.findByRole('button', { name: 'Mark member lost' }))
      await fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Mark lost' }))

      await waitFor(() => expect(handleApiError).toHaveBeenCalled())
      expect(screen.queryByText('Force mark this member lost?')).not.toBeInTheDocument()
    })

    it('is hidden for a viewer without storages update access', async () => {
      authCan.mockImplementation((_resource, action) => action !== 'update')
      getCopysetStatus.mockResolvedValue(copyset())
      render(Page)

      await screen.findByTestId('node-detail-stub')
      expect(screen.queryByRole('button', { name: 'Mark member lost' })).not.toBeInTheDocument()
    })

    it('is hidden once the copyset is no longer active', async () => {
      getCopysetStatus.mockResolvedValue(copyset({ state: 'draining', pendingSyncJobsA: 1, pendingSyncJobsB: 1 }))
      render(Page)

      await screen.findByTestId('node-detail-stub')
      expect(screen.queryByRole('button', { name: 'Mark member lost' })).not.toBeInTheDocument()
    })
  })

  describe('fill a vacant slot', () => {
    it('shows a failure-domain form in place of the missing member, calls addCopysetMember, and refetches on success', async () => {
      getCopysetStatus.mockResolvedValueOnce(copyset({ memberA: undefined })).mockResolvedValueOnce(copyset())
      addCopysetMember.mockResolvedValue({ id: 'bv-new-a', name: 'mos-block-a-a' })
      render(Page)

      const domainInput = await screen.findByLabelText('Failure domain (optional)')
      await fireEvent.input(domainInput, { target: { value: ' rack-2 ' } })
      await fireEvent.click(screen.getByRole('button', { name: 'Fill vacant slot' }))

      await waitFor(() => expect(addCopysetMember).toHaveBeenCalledWith(1, 'copyset-1', { failureDomain: 'rack-2' }))
      await waitFor(() => expect(showSuccessToast).toHaveBeenCalledWith('Member added'))
      await waitFor(() => expect(getCopysetStatus).toHaveBeenCalledTimes(2))
    })

    it('leaves the failure domain blank and passes undefined', async () => {
      getCopysetStatus.mockResolvedValue(copyset({ memberA: undefined }))
      addCopysetMember.mockResolvedValue({ id: 'bv-new-a', name: 'mos-block-a-a' })
      render(Page)

      await screen.findByLabelText('Failure domain (optional)')
      await fireEvent.click(screen.getByRole('button', { name: 'Fill vacant slot' }))

      await waitFor(() => expect(addCopysetMember).toHaveBeenCalledWith(1, 'copyset-1', { failureDomain: undefined }))
    })

    it('routes a failed submit through handleApiError, keeping the form as-is', async () => {
      getCopysetStatus.mockResolvedValue(copyset({ memberA: undefined }))
      addCopysetMember.mockRejectedValue(new ApiError('failure domain matches the surviving member\'s own domain', 409))
      render(Page)

      await screen.findByLabelText('Failure domain (optional)')
      await fireEvent.click(screen.getByRole('button', { name: 'Fill vacant slot' }))

      await waitFor(() => expect(handleApiError).toHaveBeenCalled())
    })

    it('is hidden for a viewer without storages update access', async () => {
      authCan.mockImplementation((_resource, action) => action !== 'update')
      getCopysetStatus.mockResolvedValue(copyset({ memberA: undefined }))
      render(Page)

      await waitFor(() => expect(screen.getByText(/No member assigned/)).toBeInTheDocument())
      expect(screen.queryByLabelText('Failure domain (optional)')).not.toBeInTheDocument()
    })
  })
})
