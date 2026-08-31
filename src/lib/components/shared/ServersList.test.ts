import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/svelte'
import ServersList from './ServersList.svelte'
import type { Copyset, BlockVolume, ServiceNode } from '$lib/core/api/types'

vi.mock('$lib/core/utils/toast', () => ({
  showSuccessToast: vi.fn(),
  showErrorToast: vi.fn(),
  handleApiError: vi.fn(),
}))
import { showSuccessToast, handleApiError } from '$lib/core/utils/toast'

vi.mock('$lib/core/utils/clipboard', () => ({ copyText: vi.fn().mockResolvedValue(true) }))
import { copyText } from '$lib/core/utils/clipboard'

function bv(id: string, overrides: Partial<BlockVolume> = {}): BlockVolume {
  return {
    id, name: id, isActive: true, clusterUuid: `cluster-${id}`, clusterName: 'az-1', clusterReady: true,
    regionClusterId: 101, memberState: 'active', copysetId: undefined,
    ...overrides,
  } as unknown as BlockVolume
}

function sn(nodeId: string, status = 'up', overrides: Partial<ServiceNode> = {}): ServiceNode {
  return { id: 1, regionId: 2, serviceType: 'blockserv', nodeId, advertiseAddr: '10.0.0.1:9100', status, ...overrides } as unknown as ServiceNode
}

function copyset(overrides: Partial<Copyset> = {}): Copyset {
  return {
    id: 'copyset-1', storageId: 'storage-1', state: 'active',
    memberA: 'bv-a', memberB: 'bv-b', placementGroupA: 1, placementGroupB: 2, tags: [],
    ...overrides,
  }
}

const clusterOptions = [
  { value: '101', label: 'az-1 (default)' },
  { value: '102', label: 'az-2' },
]

function baseProps(overrides: Record<string, unknown> = {}) {
  return {
    storageId: 1,
    copysets: [copyset()],
    blockVolumesById: new Map([['bv-a', bv('bv-a', { copysetId: 'copyset-1' })], ['bv-b', bv('bv-b', { copysetId: 'copyset-1' })]]),
    nodesByVolume: new Map(),
    canUpdate: true,
    clusterOptions,
    onDrain: vi.fn(),
    onCancelDrain: vi.fn(),
    onReactivate: vi.fn(),
    onRegister: vi.fn(),
    onRemove: vi.fn(),
    ...overrides,
  }
}

beforeEach(() => { vi.clearAllMocks() })

describe('ServersList', () => {
  it('shows an empty-state message when there are no servers at all', () => {
    render(ServersList, { props: baseProps({ copysets: [], blockVolumesById: new Map() }) })
    expect(screen.getByText('No servers registered for this storage yet.')).toBeInTheDocument()
  })

  it('renders one row per copyset member, and one row per unpaired/detached server, in a single list', () => {
    const blockVolumesById = new Map([
      ['bv-a', bv('bv-a', { copysetId: 'copyset-1' })],
      ['bv-b', bv('bv-b', { copysetId: 'copyset-1' })],
      ['bv-unpaired', bv('bv-unpaired', { memberState: 'active', copysetId: undefined })],
      ['bv-detached', bv('bv-detached', { memberState: 'detached', copysetId: undefined })],
    ])
    render(ServersList, { props: baseProps({ blockVolumesById }) })

    expect(screen.getByText('bv-a')).toBeInTheDocument()
    expect(screen.getByText('bv-b')).toBeInTheDocument()
    expect(screen.getByText('bv-unpaired')).toBeInTheDocument()
    expect(screen.getByText('bv-detached')).toBeInTheDocument()
    expect(screen.getAllByText('Active').length).toBe(2) // copyset-active state badge, once per member row
    expect(screen.getByText('Unpaired')).toBeInTheDocument()
    expect(screen.getByText('Detached')).toBeInTheDocument()
  })

  it('a retired copyset contributes no row of its own: its members show once, as detached', () => {
    const blockVolumesById = new Map([
      ['bv-a', bv('bv-a', { memberState: 'detached', copysetId: undefined })],
      ['bv-b', bv('bv-b', { memberState: 'detached', copysetId: undefined })],
    ])
    render(ServersList, { props: baseProps({ copysets: [copyset({ state: 'retired' })], blockVolumesById }) })

    expect(screen.getAllByText('bv-a')).toHaveLength(1)
    expect(screen.getAllByText('Detached').length).toBe(2)
    expect(screen.queryByText('Retired')).not.toBeInTheDocument()
  })

  it('tags a copyset row with id="copyset-<id>" on its first member, for NodeGrid to scroll to', () => {
    const { container } = render(ServersList, { props: baseProps() })
    expect(container.querySelector('#copyset-copyset-1')).toBeInTheDocument()
  })

  it('shows the serving blockserv for each row, flagging more than one as a duplicate-registration risk', () => {
    const nodesByVolume = new Map([
      ['bv-a', [sn('node-a1'), sn('node-a2')]],
      ['bv-b', [sn('node-b1', 'down')]],
    ])
    render(ServersList, { props: baseProps({ nodesByVolume }) })
    expect(screen.getByText('node-a1')).toBeInTheDocument()
    expect(screen.getByText('node-a2')).toBeInTheDocument()
    expect(screen.getByTitle(/2 blockserv processes are serving this server/)).toBeInTheDocument()
    // The icon carrying that title is aria-hidden; a sr-only sibling must carry the same
    // warning as real accessible text, or a screen-reader operator gets no anomaly signal at all.
    expect(screen.getByText('2 blockserv processes are serving this server; each server should have exactly one')).toBeInTheDocument()
  })

  it('copies the region cluster ID (REGION_CLUSTER_ID) for a row that has one, and toasts', async () => {
    render(ServersList, { props: baseProps() })

    await fireEvent.click(screen.getByRole('button', { name: 'Copy region cluster ID for bv-a' }))
    await waitFor(() => expect(copyText).toHaveBeenCalledWith('cluster-bv-a'))
    await waitFor(() => expect(showSuccessToast).toHaveBeenCalledWith('Region cluster ID copied'))
  })

  it('hides the region cluster ID copy button for a row with no clusterUuid', () => {
    const blockVolumesById = new Map([
      ['bv-a', bv('bv-a', { copysetId: 'copyset-1', clusterUuid: undefined })],
      ['bv-b', bv('bv-b', { copysetId: 'copyset-1' })],
    ])
    render(ServersList, { props: baseProps({ blockVolumesById }) })
    expect(screen.queryByRole('button', { name: 'Copy region cluster ID for bv-a' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy region cluster ID for bv-b' })).toBeInTheDocument()
  })

  it('shows unsynced/drain-ready badges only under directAccess', () => {
    const nodesByVolume = new Map([
      ['bv-a', [sn('node-a', 'up', { metadata: { unsynced_objects: 4 } })]],
    ])
    const { rerender } = render(ServersList, { props: baseProps({ nodesByVolume, directAccess: false }) })
    expect(screen.queryByText(/unsynced/)).not.toBeInTheDocument()

    rerender(baseProps({ nodesByVolume, directAccess: true }))
    expect(screen.getByText('4 unsynced')).toBeInTheDocument()
  })

  it('drain: opens a confirm dialog, then calls onDrain and toasts on confirm', async () => {
    const onDrain = vi.fn().mockResolvedValue(undefined)
    render(ServersList, { props: baseProps({ onDrain }) })

    await fireEvent.click(screen.getAllByRole('button', { name: 'Drain' })[0])
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await fireEvent.click(screen.getByRole('button', { name: 'Start drain' }))

    await waitFor(() => expect(onDrain).toHaveBeenCalledWith('copyset-1'))
    await waitFor(() => expect(showSuccessToast).toHaveBeenCalledWith(expect.stringContaining('Drain started')))
  })

  it('cancel-drain: opens a confirm dialog, then calls onCancelDrain and toasts on confirm', async () => {
    const onCancelDrain = vi.fn().mockResolvedValue(undefined)
    render(ServersList, { props: baseProps({ copysets: [copyset({ state: 'draining', pendingSyncJobsA: 1, pendingSyncJobsB: 1 })], onCancelDrain }) })

    await fireEvent.click(screen.getAllByRole('button', { name: 'Cancel drain' })[0])
    const dialog = screen.getByRole('dialog')
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel drain' }))

    await waitFor(() => expect(onCancelDrain).toHaveBeenCalledWith('copyset-1'))
  })

  it('shows the pending-sync count on both rows of a draining copyset', () => {
    render(ServersList, { props: baseProps({ copysets: [copyset({ state: 'draining', pendingSyncJobsA: 2, pendingSyncJobsB: 5 })] }) })
    expect(screen.getByText('2 pending')).toBeInTheDocument()
    expect(screen.getByText('5 pending')).toBeInTheDocument()
  })

  it('reactivate: calls onReactivate with the server id and toasts', async () => {
    const onReactivate = vi.fn().mockResolvedValue(undefined)
    const blockVolumesById = new Map([['bv-detached', bv('bv-detached', { memberState: 'detached', copysetId: undefined })]])
    render(ServersList, { props: baseProps({ copysets: [], blockVolumesById, onReactivate }) })

    await fireEvent.click(screen.getByRole('button', { name: 'Reactivate' }))
    await waitFor(() => expect(onReactivate).toHaveBeenCalledWith('bv-detached'))
    await waitFor(() => expect(showSuccessToast).toHaveBeenCalled())
  })

  it('routes a failed reactivate through handleApiError', async () => {
    const onReactivate = vi.fn().mockRejectedValue(new Error('conflict'))
    const blockVolumesById = new Map([['bv-detached', bv('bv-detached', { memberState: 'detached', copysetId: undefined })]])
    render(ServersList, { props: baseProps({ copysets: [], blockVolumesById, onReactivate }) })

    await fireEvent.click(screen.getByRole('button', { name: 'Reactivate' }))
    await waitFor(() => expect(handleApiError).toHaveBeenCalled())
  })

  it('remove: opens a confirm dialog, then calls onRemove and toasts on confirm', async () => {
    const onRemove = vi.fn().mockResolvedValue(undefined)
    const blockVolumesById = new Map([['bv-detached', bv('bv-detached', { memberState: 'detached', copysetId: undefined })]])
    render(ServersList, { props: baseProps({ copysets: [], blockVolumesById, onRemove }) })

    await fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remove' }))

    await waitFor(() => expect(onRemove).toHaveBeenCalledWith('bv-detached'))
    await waitFor(() => expect(showSuccessToast).toHaveBeenCalled())
  })

  it('routes a failed remove through handleApiError', async () => {
    const onRemove = vi.fn().mockRejectedValue(new Error('conflict'))
    const blockVolumesById = new Map([['bv-detached', bv('bv-detached', { memberState: 'detached', copysetId: undefined })]])
    render(ServersList, { props: baseProps({ copysets: [], blockVolumesById, onRemove }) })

    await fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    await fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(handleApiError).toHaveBeenCalled())
  })

  it('Add server: opens the dialog, submits name + cluster, and calls onRegister', async () => {
    const onRegister = vi.fn().mockResolvedValue(undefined)
    render(ServersList, { props: baseProps({ copysets: [], blockVolumesById: new Map(), onRegister }) })

    await fireEvent.click(screen.getByRole('button', { name: 'Add server' }))
    expect(screen.getByRole('button', { name: 'Register' })).toBeDisabled()

    await fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'replica-3' } })
    await fireEvent.click(screen.getByRole('button', { name: 'Availability / placement' }))
    await fireEvent.click(await screen.findByRole('option', { name: 'az-2' }))
    expect(screen.getByRole('button', { name: 'Register' })).not.toBeDisabled()

    await fireEvent.click(screen.getByRole('button', { name: 'Register' }))
    await waitFor(() => expect(onRegister).toHaveBeenCalledWith('replica-3', 102))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('opens the same dialog when the caller sets registering externally, resetting the form', async () => {
    const { rerender } = render(ServersList, { props: baseProps({ copysets: [], blockVolumesById: new Map(), registering: false }) })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await rerender(baseProps({ copysets: [], blockVolumesById: new Map(), registering: true }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveValue('')
  })

  it('disables Add server when no cluster is ready', () => {
    render(ServersList, { props: baseProps({ copysets: [], blockVolumesById: new Map(), clusterOptions: [] }) })
    expect(screen.getByRole('button', { name: 'Add server' })).toBeDisabled()
  })

  it('canUpdate=false hides every mutation control while keeping the servers list visible', () => {
    const blockVolumesById = new Map([
      ['bv-a', bv('bv-a', { copysetId: 'copyset-1' })],
      ['bv-b', bv('bv-b', { copysetId: 'copyset-1' })],
      ['bv-detached', bv('bv-detached', { memberState: 'detached', copysetId: undefined })],
    ])
    render(ServersList, { props: baseProps({ blockVolumesById, canUpdate: false }) })

    expect(screen.queryByRole('button', { name: 'Add server' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Drain' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reactivate' })).not.toBeInTheDocument()
    expect(screen.getByText('bv-detached')).toBeInTheDocument()
  })

  it('shows the stale-status and node-staleness notices without clearing the servers list', () => {
    render(ServersList, { props: baseProps({ staleStatus: true, nodesStale: true }) })
    expect(screen.getByText(/Can't confirm copyset status right now/)).toBeInTheDocument()
    expect(screen.getByText(/Can't confirm blockserv node data right now/)).toBeInTheDocument()
    expect(screen.getByText('bv-a')).toBeInTheDocument()
  })
})
