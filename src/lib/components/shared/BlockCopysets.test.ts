import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/svelte'
import BlockCopysets from './BlockCopysets.svelte'
import type { Copyset, BlockVolume, ServiceNode } from '$lib/core/api/types'

// Matches the component's own drain-poll tick.
const POLL_INTERVAL_MS = 15_000

const baseProps = { storageId: 1, regionId: 2, accountId: 9, canUpdate: true }

function bv(id: string, overrides: Partial<BlockVolume> = {}): BlockVolume {
  return {
    id, name: id, isActive: true, clusterUuid: `cluster-${id}`, clusterName: 'az-1', clusterReady: true,
    memberState: 'active', copysetId: undefined,
    ...overrides,
  } as unknown as BlockVolume
}

function copyset(overrides: Partial<Copyset> = {}): Copyset {
  return { id: 'copyset-1', storageId: 'storage-1', state: 'active', memberA: 'bv-a', memberB: 'bv-b', tags: [], ...overrides }
}

function sn(nodeId: string, blockVolumeId: string): ServiceNode {
  return {
    id: 1, regionId: 2, serviceType: 'blockserv', nodeId, advertiseAddr: '10.0.0.1:9100', status: 'up',
    metadata: { block_volume_id: blockVolumeId },
  } as unknown as ServiceNode
}

const {
  listCopysets, listBlockVolumes, drainCopyset, cancelDrain, serviceNodesList, volumesList,
  getConfig, updateConfig, registerMember, reactivateMember,
} = vi.hoisted(() => ({
  listCopysets: vi.fn(),
  listBlockVolumes: vi.fn(),
  drainCopyset: vi.fn(),
  cancelDrain: vi.fn(),
  serviceNodesList: vi.fn(),
  volumesList: vi.fn(),
  getConfig: vi.fn(),
  updateConfig: vi.fn(),
  registerMember: vi.fn(),
  reactivateMember: vi.fn(),
}))

vi.mock('$lib/core/stores/storages.svelte', () => ({
  useStorages: () => ({ listCopysets, listBlockVolumes, drainCopyset, cancelDrain, getConfig, updateConfig, registerMember, reactivateMember }),
}))

vi.mock('$lib/core/stores/clusters.svelte', () => ({
  useClusters: () => ({
    clustersFor: () => [{ id: 101, regionId: 2, name: 'az-1', isActive: true, isReady: true, defaultCluster: true }],
    fetchClusters: vi.fn(),
  }),
}))

vi.mock('$lib/core/stores/client.svelte', () => ({
  api: { serviceNodes: { list: serviceNodesList }, volumes: { list: volumesList } },
}))

vi.mock('$lib/core/utils/toast', () => ({
  showSuccessToast: vi.fn(),
  showErrorToast: vi.fn(),
  showWarningToast: vi.fn(),
  handleApiError: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
  listCopysets.mockResolvedValue([copyset()])
  listBlockVolumes.mockResolvedValue([bv('bv-a', { copysetId: 'copyset-1' }), bv('bv-b', { copysetId: 'copyset-1' })])
  serviceNodesList.mockResolvedValue([])
  volumesList.mockResolvedValue({ items: [], pagination: { page: 1, totalPages: 0, total: 0 } })
  getConfig.mockResolvedValue({ id: 'storage-1', k: 1, algorithmVersion: 1, epochPolicyVersion: 1 })
})

describe('BlockCopysets', () => {
  it('loads copysets + block volumes + nodes + config and renders the resolved servers list, defaulting to the Copyset servers tab', async () => {
    render(BlockCopysets, { props: baseProps })
    expect(screen.getByText('Loading copysets…')).toBeInTheDocument()

    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Drain' })[0]).toBeInTheDocument())
    expect(listCopysets).toHaveBeenCalledWith(1, expect.anything())
    expect(listBlockVolumes).toHaveBeenCalledWith(1, expect.anything())
    expect(serviceNodesList).toHaveBeenCalledWith(2, 'blockserv', undefined, undefined, undefined, expect.anything())
    expect(getConfig).toHaveBeenCalledWith(1, expect.anything())
  })

  it('shows the live active-server count next to the copyset-count control', async () => {
    listBlockVolumes.mockResolvedValue([
      bv('bv-a', { copysetId: 'copyset-1' }),
      bv('bv-b', { copysetId: 'copyset-1' }),
      bv('bv-inactive', { isActive: false, memberState: 'detached' }),
    ])
    render(BlockCopysets, { props: baseProps })
    await waitFor(() => expect(screen.getByText('2', { selector: '.font-mono.font-medium' })).toBeInTheDocument())
    expect(screen.getByText(/servers registered/)).toBeInTheDocument()
  })

  it('shows an error state when the initial load fails', async () => {
    listCopysets.mockRejectedValue(new Error('boom'))
    render(BlockCopysets, { props: baseProps })
    await waitFor(() => expect(screen.getByText('Failed to load copysets.')).toBeInTheDocument())
  })

  it('drain: calls the store then reloads the copysets list', async () => {
    render(BlockCopysets, { props: baseProps })
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Drain' })[0]).toBeInTheDocument())

    listCopysets.mockResolvedValue([copyset({ state: 'draining', pendingSyncJobsA: 1, pendingSyncJobsB: 1 })])
    drainCopyset.mockResolvedValue({ id: 'copyset-1', state: 'draining' })

    await fireEvent.click(screen.getAllByRole('button', { name: 'Drain' })[0])
    await fireEvent.click(screen.getByRole('button', { name: 'Start drain' }))

    await waitFor(() => expect(drainCopyset).toHaveBeenCalledWith(1, 'copyset-1'))
    await waitFor(() => expect(listCopysets).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Cancel drain' }).length).toBeGreaterThan(0))
  })

  it('renders the copyset-count control wired to getConfig/updateConfig', async () => {
    render(BlockCopysets, { props: baseProps })
    await waitFor(() => expect(screen.getByText('1', { selector: '.font-mono.font-medium' })).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Edit copyset count' })).toBeInTheDocument()

    updateConfig.mockResolvedValue({ id: 'storage-1', copysetsFormed: 1, copysetsRequested: 2, partial: false, activeCopysetCountBefore: 1, activeCopysetCountAfter: 2 })
    listCopysets.mockResolvedValue([copyset(), copyset({ id: 'copyset-2', memberA: 'bv-c', memberB: 'bv-d' })])
    getConfig.mockResolvedValue({ id: 'storage-1', k: 2, algorithmVersion: 1, epochPolicyVersion: 1 })

    await fireEvent.click(screen.getByRole('button', { name: 'Edit copyset count' }))
    await fireEvent.input(screen.getByRole('spinbutton'), { target: { value: '2' } })
    await fireEvent.click(screen.getByRole('button', { name: 'Update' }))

    await waitFor(() => expect(updateConfig).toHaveBeenCalledWith(1, 2))
    await waitFor(() => expect(listCopysets).toHaveBeenCalledTimes(2))
  })

  it('renders unpaired and detached servers alongside paired ones in one list, and wires add/reactivate to the store', async () => {
    listBlockVolumes.mockResolvedValue([
      bv('bv-a', { copysetId: 'copyset-1' }),
      bv('bv-b', { copysetId: 'copyset-1' }),
      bv('bv-unpaired', { memberState: 'active', copysetId: undefined, clusterName: 'az-2' }),
      bv('bv-detached', { memberState: 'detached', copysetId: undefined, clusterName: 'az-2' }),
    ])
    registerMember.mockResolvedValue({ id: 'bv-new', name: 'new', regionId: 2, regionClusterId: 101, memberState: 'active' })
    reactivateMember.mockResolvedValue({ id: 'bv-detached', name: 'bv-detached', regionId: 2, regionClusterId: 101, memberState: 'active' })

    render(BlockCopysets, { props: baseProps })
    await waitFor(() => expect(screen.getByText('bv-unpaired')).toBeInTheDocument())
    expect(screen.getByText('bv-detached')).toBeInTheDocument()
    expect(screen.getByText('Unpaired')).toBeInTheDocument()
    expect(screen.getByText('Detached')).toBeInTheDocument()

    await fireEvent.click(screen.getByRole('button', { name: 'Reactivate' }))
    await waitFor(() => expect(reactivateMember).toHaveBeenCalledWith(1, 'bv-detached'))

    await fireEvent.click(screen.getByRole('button', { name: 'Add server' }))
    await fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'replica-3' } })
    await fireEvent.click(screen.getByRole('button', { name: 'Availability / placement' }))
    await fireEvent.click(await screen.findByRole('option', { name: 'az-1 (default)' }))
    await fireEvent.click(screen.getByRole('button', { name: 'Register' }))

    await waitFor(() => expect(registerMember).toHaveBeenCalledWith(1, { name: 'replica-3', regionClusterId: 101 }))
  })

  it('opens the Add Server dialog when the caller sets addServerOpen, without a second form', async () => {
    listBlockVolumes.mockResolvedValue([bv('bv-unpaired', { memberState: 'active', copysetId: undefined })])
    const { rerender } = render(BlockCopysets, { props: { ...baseProps, addServerOpen: false } })
    await waitFor(() => expect(screen.getByText('bv-unpaired')).toBeInTheDocument())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await rerender({ ...baseProps, addServerOpen: true })
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Add Server')).toBeInTheDocument()
  })

  it('canUpdate=false hides every copyset mutation control while keeping status/server display visible', async () => {
    listBlockVolumes.mockResolvedValue([
      bv('bv-a', { copysetId: 'copyset-1' }),
      bv('bv-b', { copysetId: 'copyset-1' }),
      bv('bv-unpaired', { memberState: 'active', copysetId: undefined, clusterName: 'az-2' }),
      bv('bv-detached', { memberState: 'detached', copysetId: undefined, clusterName: 'az-2' }),
    ])

    render(BlockCopysets, { props: { ...baseProps, canUpdate: false } })
    await waitFor(() => expect(screen.getByText('bv-unpaired')).toBeInTheDocument())

    expect(screen.queryByRole('button', { name: 'Edit copyset count' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Drain' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add server' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reactivate' })).not.toBeInTheDocument()
    // Read-only display stays visible for a read-only user.
    expect(screen.getByText('bv-detached')).toBeInTheDocument()
  })

  it('switches to the Volumes tab and renders this storage’s volumes list there', async () => {
    volumesList.mockResolvedValue({
      items: [{ id: 1, name: 'vol-1', volumeType: 'standard', isActive: true, liveVolume: 0, region: { id: 2, name: 'us-east' } }],
      pagination: { page: 1, totalPages: 1, total: 1 },
    })
    render(BlockCopysets, { props: baseProps })
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Drain' })[0]).toBeInTheDocument())

    await fireEvent.click(screen.getByRole('tab', { name: 'Volumes' }))
    expect(await screen.findByText('vol-1')).toBeInTheDocument()
    expect(volumesList).toHaveBeenCalledWith(expect.objectContaining({ accountId: 9, storageId: 1 }), expect.anything())
  })

  it('a normal drain-poll tick refetches only copyset status, not the block-volume/node/config topology', async () => {
    listCopysets.mockResolvedValue([copyset({ state: 'draining', pendingSyncJobsA: 1, pendingSyncJobsB: 1 })])
    vi.useFakeTimers()
    try {
      render(BlockCopysets, { props: baseProps })
      await vi.advanceTimersByTimeAsync(0)
      expect(listCopysets).toHaveBeenCalledTimes(1)
      expect(listBlockVolumes).toHaveBeenCalledTimes(1)
      expect(serviceNodesList).toHaveBeenCalledTimes(1)
      expect(getConfig).toHaveBeenCalledTimes(1)

      vi.clearAllMocks()
      listCopysets.mockResolvedValue([copyset({ state: 'draining', pendingSyncJobsA: 2, pendingSyncJobsB: 2 })])
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS)

      expect(listCopysets).toHaveBeenCalledTimes(1)
      expect(listBlockVolumes).not.toHaveBeenCalled()
      expect(serviceNodesList).not.toHaveBeenCalled()
      expect(getConfig).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('refetches topology on mount and after a mutation, in addition to copyset status', async () => {
    render(BlockCopysets, { props: baseProps })
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Drain' })[0]).toBeInTheDocument())
    expect(listCopysets).toHaveBeenCalledTimes(1)
    expect(listBlockVolumes).toHaveBeenCalledTimes(1)

    listCopysets.mockResolvedValue([copyset({ state: 'draining', pendingSyncJobsA: 1, pendingSyncJobsB: 1 })])
    drainCopyset.mockResolvedValue({ id: 'copyset-1', state: 'draining' })
    await fireEvent.click(screen.getAllByRole('button', { name: 'Drain' })[0])
    await fireEvent.click(screen.getByRole('button', { name: 'Start drain' }))

    await waitFor(() => expect(listCopysets).toHaveBeenCalledTimes(2))
    expect(listBlockVolumes).toHaveBeenCalledTimes(2)
    expect(serviceNodesList).toHaveBeenCalledTimes(2)
  })

  it('does not let a slower stale poll response overwrite a newer response that already landed', async () => {
    listCopysets.mockResolvedValueOnce([copyset({ state: 'draining', pendingSyncJobsA: 1, pendingSyncJobsB: 1 })])
    vi.useFakeTimers()
    try {
      render(BlockCopysets, { props: baseProps })
      await vi.advanceTimersByTimeAsync(0)
      expect(screen.getAllByText(/1 pending/).length).toBeGreaterThan(0)

      // Poll tick fires and hangs mid-flight (the "slow first call").
      let resolveStale!: (v: Copyset[]) => void
      listCopysets.mockImplementationOnce(() => new Promise(res => { resolveStale = res }))
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS)

      // A mutation reload lands and resolves before the stale poll response (the "fast second call").
      listCopysets.mockResolvedValueOnce([copyset({ state: 'draining', pendingSyncJobsA: 9, pendingSyncJobsB: 9 })])
      cancelDrain.mockResolvedValue({ id: 'copyset-1', state: 'active' })
      await fireEvent.click(screen.getAllByRole('button', { name: 'Cancel drain' })[0])
      await fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel drain' }))
      await vi.advanceTimersByTimeAsync(0)
      expect(screen.getAllByText(/9 pending/).length).toBeGreaterThan(0)

      // The stale response finally resolves; it must be discarded, not win over the newer state.
      resolveStale([copyset({ state: 'draining', pendingSyncJobsA: 1, pendingSyncJobsB: 1 })])
      await vi.advanceTimersByTimeAsync(0)
      expect(screen.getAllByText(/9 pending/).length).toBeGreaterThan(0)
      expect(screen.queryByText(/1 pending/)).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('stops the drain poll on teardown', async () => {
    listCopysets.mockResolvedValue([copyset({ state: 'draining', pendingSyncJobsA: 1, pendingSyncJobsB: 1 })])
    vi.useFakeTimers()
    try {
      const { unmount } = render(BlockCopysets, { props: baseProps })
      await vi.advanceTimersByTimeAsync(0)
      expect(listCopysets).toHaveBeenCalledTimes(1)

      unmount()
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3)
      expect(listCopysets).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps the last-known-good node data and shows a staleness notice on a node-discovery error, instead of treating empty as real', async () => {
    serviceNodesList.mockResolvedValueOnce([sn('node-1', 'bv-a')])
    render(BlockCopysets, { props: baseProps })
    await waitFor(() => expect(screen.getByText('node-1')).toBeInTheDocument())

    serviceNodesList.mockRejectedValueOnce(new Error('discovery unavailable'))
    updateConfig.mockResolvedValue({ id: 'storage-1', copysetsFormed: 1, copysetsRequested: 2, partial: false, activeCopysetCountBefore: 1, activeCopysetCountAfter: 2 })
    getConfig.mockResolvedValue({ id: 'storage-1', k: 2, algorithmVersion: 1, epochPolicyVersion: 1 })

    await fireEvent.click(screen.getByRole('button', { name: 'Edit copyset count' }))
    await fireEvent.input(screen.getByRole('spinbutton'), { target: { value: '2' } })
    await fireEvent.click(screen.getByRole('button', { name: 'Update' }))

    await waitFor(() => expect(screen.getByText(/Can't confirm blockserv node data right now/)).toBeInTheDocument())
    expect(screen.getByText('node-1')).toBeInTheDocument()
  })
})
