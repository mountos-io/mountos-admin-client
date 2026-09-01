import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/svelte'
import BlockCopysets from './BlockCopysets.svelte'
import type { Copyset, BlockVolume, ServiceNode } from '$lib/core/api/types'

// Matches the component's own drain-poll tick.
const POLL_INTERVAL_MS = 15_000

const baseProps = { storageId: 1, regionId: 2, accountId: 9, canUpdate: true }

function bv(id: string, overrides: Partial<BlockVolume> = {}): BlockVolume {
  return { id, name: id, isActive: true, memberState: 'active', copysetId: undefined, ...overrides } as unknown as BlockVolume
}

function copyset(overrides: Partial<Copyset> = {}): Copyset {
  return { id: 'copyset-1', storageId: 'storage-1', name: 'mos-block-a', state: 'active', memberA: 'bv-a', memberB: 'bv-b', tags: [], ...overrides }
}

function sn(nodeId: string, blockVolumeId: string): ServiceNode {
  return {
    id: 1, regionId: 2, serviceType: 'blockserv', nodeId, advertiseAddr: '10.0.0.1:9100', status: 'up',
    metadata: { block_volume_id: blockVolumeId },
  } as unknown as ServiceNode
}

const {
  listCopysets, listBlockVolumes, drainCopyset, cancelDrain, serviceNodesList, volumesList,
  registerCopyset, registerCopysetsBulk, removeMember,
} = vi.hoisted(() => ({
  listCopysets: vi.fn(),
  listBlockVolumes: vi.fn(),
  drainCopyset: vi.fn(),
  cancelDrain: vi.fn(),
  serviceNodesList: vi.fn(),
  volumesList: vi.fn(),
  registerCopyset: vi.fn(),
  registerCopysetsBulk: vi.fn(),
  removeMember: vi.fn(),
}))

vi.mock('$lib/core/stores/storages.svelte', () => ({
  useStorages: () => ({ listCopysets, listBlockVolumes, drainCopyset, cancelDrain, registerCopyset, registerCopysetsBulk, removeMember }),
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

vi.mock('$lib/core/utils/clipboard', () => ({ copyText: vi.fn().mockResolvedValue(true) }))

beforeEach(() => {
  vi.clearAllMocks()
  listCopysets.mockResolvedValue([copyset()])
  listBlockVolumes.mockResolvedValue([bv('bv-a', { copysetId: 'copyset-1' }), bv('bv-b', { copysetId: 'copyset-1' })])
  serviceNodesList.mockResolvedValue([])
  volumesList.mockResolvedValue({ items: [], pagination: { page: 1, totalPages: 0, total: 0 } })
})

describe('BlockCopysets', () => {
  it('loads copysets + block volumes + nodes and renders the resolved servers list, defaulting to the Copyset servers tab', async () => {
    render(BlockCopysets, { props: baseProps })
    expect(screen.getByText('Loading copysets…')).toBeInTheDocument()

    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Drain' })[0]).toBeInTheDocument())
    expect(listCopysets).toHaveBeenCalledWith(1, expect.anything())
    expect(listBlockVolumes).toHaveBeenCalledWith(1, expect.anything())
    expect(serviceNodesList).toHaveBeenCalledWith(2, 'blockserv', undefined, undefined, undefined, expect.anything())
  })

  it('shows a copyset-centric summary, not a raw server count', async () => {
    listBlockVolumes.mockResolvedValue([
      bv('bv-a', { copysetId: 'copyset-1' }),
      bv('bv-b', { copysetId: 'copyset-1' }),
      bv('bv-inactive', { isActive: false, memberState: 'detached' }),
    ])
    render(BlockCopysets, { props: baseProps })
    // One active copyset (from the default `copyset()` fixture) plus one detached, unpaired
    // member (bv-inactive is not a memberA/memberB of any copyset in the list).
    const count = await screen.findByText('1', { selector: '.font-mono.font-medium' })
    const summaryLine = count.parentElement
    expect(summaryLine?.textContent).toMatch(/1\s*copyset/)
    expect(summaryLine?.textContent).toMatch(/1\s*active/)
    expect(summaryLine?.textContent).toMatch(/1\s*detached member/)
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

  it('renders unpaired and detached servers alongside paired ones in one list, and wires register-copyset to the store', async () => {
    listBlockVolumes.mockResolvedValue([
      bv('bv-a', { copysetId: 'copyset-1' }),
      bv('bv-b', { copysetId: 'copyset-1' }),
      bv('bv-unpaired', { memberState: 'active', copysetId: undefined }),
      bv('bv-detached', { memberState: 'detached', copysetId: undefined }),
    ])
    registerCopyset.mockResolvedValue({ id: 'copyset-2', storageId: 'storage-1', name: 'replica-3', state: 'active', memberA: 'bv-c', memberB: 'bv-d', tags: [] })

    render(BlockCopysets, { props: baseProps })
    await waitFor(() => expect(screen.getByText('bv-unpaired')).toBeInTheDocument())
    expect(screen.getByText('bv-detached')).toBeInTheDocument()
    expect(screen.getByText('Unpaired')).toBeInTheDocument()
    expect(screen.getByText('Detached')).toBeInTheDocument()

    await fireEvent.click(screen.getByRole('button', { name: 'Add copyset' }))
    await fireEvent.input(screen.getByLabelText('Copyset name'), { target: { value: 'replica-3' } })
    await fireEvent.click(screen.getByRole('button', { name: 'Register' }))

    await waitFor(() => expect(registerCopyset).toHaveBeenCalledWith(1, { name: 'replica-3' }))
  })

  it('wires bulk registration to the store', async () => {
    listCopysets.mockResolvedValue([])
    listBlockVolumes.mockResolvedValue([])
    registerCopysetsBulk.mockResolvedValue({
      copysets: [{ id: 'copyset-5', storageId: 'storage-1', name: 'riveted-truss-1a2b', state: 'active', memberA: 'bv-5a', memberB: 'bv-5b', tags: [] }],
    })

    render(BlockCopysets, { props: baseProps })
    await waitFor(() => expect(screen.getByText('No servers registered for this storage yet.')).toBeInTheDocument())

    await fireEvent.click(screen.getByRole('button', { name: 'Add multiple' }))
    await fireEvent.input(screen.getByLabelText('Count'), { target: { value: '3' } })
    await fireEvent.click(screen.getByRole('button', { name: 'Register' }))

    await waitFor(() => expect(registerCopysetsBulk).toHaveBeenCalledWith(1, { count: 3 }))
    await waitFor(() => expect(listCopysets).toHaveBeenCalledTimes(2))
  })

  it('opens the Add Copyset dialog when the caller sets addServerOpen, without a second form', async () => {
    listBlockVolumes.mockResolvedValue([bv('bv-unpaired', { memberState: 'active', copysetId: undefined })])
    const { rerender } = render(BlockCopysets, { props: { ...baseProps, addServerOpen: false } })
    await waitFor(() => expect(screen.getByText('bv-unpaired')).toBeInTheDocument())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await rerender({ ...baseProps, addServerOpen: true })
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Add Copyset')).toBeInTheDocument()
  })

  it('canUpdate=false hides every copyset mutation control while keeping status/server display visible', async () => {
    listBlockVolumes.mockResolvedValue([
      bv('bv-a', { copysetId: 'copyset-1' }),
      bv('bv-b', { copysetId: 'copyset-1' }),
      bv('bv-unpaired', { memberState: 'active', copysetId: undefined }),
      bv('bv-detached', { memberState: 'detached', copysetId: undefined }),
    ])

    render(BlockCopysets, { props: { ...baseProps, canUpdate: false } })
    await waitFor(() => expect(screen.getByText('bv-unpaired')).toBeInTheDocument())

    expect(screen.queryByRole('button', { name: 'Drain' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add copyset' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument()
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

  it('a drain-poll tick refetches both copyset status and the block-volume/node topology', async () => {
    // Topology must be refetched on every tick too, not just copyset status: a copyset
    // finishing its synced_drained -> retired transition detaches both its members, and only
    // the topology fetch (blockVolumesById) observes that.
    listCopysets.mockResolvedValue([copyset({ state: 'draining', pendingSyncJobsA: 1, pendingSyncJobsB: 1 })])
    vi.useFakeTimers()
    try {
      render(BlockCopysets, { props: baseProps })
      await vi.advanceTimersByTimeAsync(0)
      expect(listCopysets).toHaveBeenCalledTimes(1)
      expect(listBlockVolumes).toHaveBeenCalledTimes(1)
      expect(serviceNodesList).toHaveBeenCalledTimes(1)

      vi.clearAllMocks()
      listCopysets.mockResolvedValue([copyset({ state: 'draining', pendingSyncJobsA: 2, pendingSyncJobsB: 2 })])
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS)

      expect(listCopysets).toHaveBeenCalledTimes(1)
      expect(listBlockVolumes).toHaveBeenCalledTimes(1)
      expect(serviceNodesList).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps polling through synced_drained (not just draining), so the eventual retirement is observed', async () => {
    listCopysets.mockResolvedValue([copyset({ state: 'synced_drained' })])
    vi.useFakeTimers()
    try {
      render(BlockCopysets, { props: baseProps })
      await vi.advanceTimersByTimeAsync(0)
      expect(listCopysets).toHaveBeenCalledTimes(1)

      vi.clearAllMocks()
      listCopysets.mockResolvedValue([]) // retired: no longer returned by the default listCopysets() call
      listBlockVolumes.mockResolvedValue([bv('bv-a', { memberState: 'detached', copysetId: undefined }), bv('bv-b', { memberState: 'detached', copysetId: undefined })])
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS)

      expect(listCopysets).toHaveBeenCalledTimes(1)
      expect(listBlockVolumes).toHaveBeenCalledTimes(1)
      await waitFor(() => expect(screen.getAllByText('Detached').length).toBe(2))
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
    listCopysets.mockResolvedValue([copyset({ state: 'draining', pendingSyncJobsA: 1, pendingSyncJobsB: 1 })])
    drainCopyset.mockResolvedValue({ id: 'copyset-1', state: 'draining' })

    await fireEvent.click(screen.getAllByRole('button', { name: 'Drain' })[0])
    await fireEvent.click(screen.getByRole('button', { name: 'Start drain' }))

    await waitFor(() => expect(screen.getByText(/Can't confirm blockserv node data right now/)).toBeInTheDocument())
    expect(screen.getByText('node-1')).toBeInTheDocument()
  })
})
