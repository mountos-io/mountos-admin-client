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

function bv(id: string, overrides: Partial<BlockVolume> = {}): BlockVolume {
  return { id, name: id, isActive: true, memberState: 'active', copysetId: undefined, ...overrides } as unknown as BlockVolume
}

function sn(nodeId: string, status = 'up', overrides: Partial<ServiceNode> = {}): ServiceNode {
  return { id: 1, regionId: 2, serviceType: 'blockserv', nodeId, advertiseAddr: '10.0.0.1:9100', status, ...overrides } as unknown as ServiceNode
}

function copyset(overrides: Partial<Copyset> = {}): Copyset {
  return { id: 'copyset-1', storageId: 'storage-1', name: 'mos-block-a', state: 'active', memberA: 'bv-a', memberB: 'bv-b', volumeCount: 0, tags: [], ...overrides }
}

function baseProps(overrides: Record<string, unknown> = {}) {
  return {
    storageId: 1,
    copysets: [copyset()],
    blockVolumesById: new Map([['bv-a', bv('bv-a', { copysetId: 'copyset-1' })], ['bv-b', bv('bv-b', { copysetId: 'copyset-1' })]]),
    nodesByVolume: new Map(),
    canUpdate: true,
    activeCopysetCount: 1,
    onDrain: vi.fn(),
    onCancelDrain: vi.fn(),
    onRegisterCopyset: vi.fn(),
    onRegisterCopysetsBulk: vi.fn(),
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

  it('flags both rows of a copyset with a Build mismatch badge when member commits differ', () => {
    const nodesByVolume = new Map([
      ['bv-a', [sn('node-a1', 'up', { metadata: { commitHash: 'abc1234' } })]],
      ['bv-b', [sn('node-b1', 'up', { metadata: { commitHash: 'def5678' } })]],
    ])
    render(ServersList, { props: baseProps({ nodesByVolume }) })
    expect(screen.getAllByText('Build mismatch')).toHaveLength(2)
  })

  it('stays calm when both members of a copyset share the same commit', () => {
    const nodesByVolume = new Map([
      ['bv-a', [sn('node-a1', 'up', { metadata: { commitHash: 'abc1234' } })]],
      ['bv-b', [sn('node-b1', 'up', { metadata: { commitHash: 'abc1234' } })]],
    ])
    render(ServersList, { props: baseProps({ nodesByVolume }) })
    expect(screen.queryByText('Build mismatch')).not.toBeInTheDocument()
  })

  it('stays calm when a member\'s commit is unknown, even if the other member reports one', () => {
    const nodesByVolume = new Map([
      ['bv-a', [sn('node-a1', 'up', { metadata: { commitHash: 'abc1234' } })]],
      ['bv-b', [sn('node-b1')]],
    ])
    render(ServersList, { props: baseProps({ nodesByVolume }) })
    expect(screen.queryByText('Build mismatch')).not.toBeInTheDocument()
  })

  it('copies a row\'s BLOCK_VOLUME_ID and toasts', async () => {
    const { copyText } = await import('$lib/core/utils/clipboard')
    render(ServersList, { props: baseProps() })

    await fireEvent.click(screen.getByRole('button', { name: 'Copy ID for bv-a' }))
    await waitFor(() => expect(copyText).toHaveBeenCalledWith('bv-a'))
    await waitFor(() => expect(showSuccessToast).toHaveBeenCalledWith('Server ID copied'))
  })

  it('shows the unsynced badge regardless of directAccess: a real backlog matters during a normal drain too', () => {
    const nodesByVolume = new Map([
      ['bv-a', [sn('node-a', 'up', { metadata: { unsynced_objects: 4 } })]],
    ])
    const { rerender } = render(ServersList, { props: baseProps({ nodesByVolume, directAccess: false }) })
    expect(screen.getByText('4 unsynced')).toBeInTheDocument()

    rerender(baseProps({ nodesByVolume, directAccess: true }))
    expect(screen.getByText('4 unsynced')).toBeInTheDocument()
  })

  it('shows the drain-ready badge only under directAccess, and only once there is no unsynced backlog', () => {
    const nodesByVolume = new Map([
      ['bv-a', [sn('node-a', 'up', { metadata: { drain_ready: true } })]],
    ])
    const { rerender } = render(ServersList, { props: baseProps({ nodesByVolume, directAccess: false }) })
    expect(screen.queryByText(/drain.ready/)).not.toBeInTheDocument()

    rerender(baseProps({ nodesByVolume, directAccess: true }))
    expect(screen.getByText(/drain.ready/)).toBeInTheDocument()
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

  it('drain: warns that this is the storage\'s last active copyset when activeCopysetCount is 1', async () => {
    render(ServersList, { props: baseProps({ activeCopysetCount: 1 }) })

    await fireEvent.click(screen.getAllByRole('button', { name: 'Drain' })[0])
    expect(screen.getByText('Drain the last active copyset?')).toBeInTheDocument()
    expect(screen.getByText(/no other active copyset/)).toBeInTheDocument()
  })

  it('drain: shows the routine warning, not the last-copyset one, when other active copysets exist', async () => {
    render(ServersList, { props: baseProps({ activeCopysetCount: 3 }) })

    await fireEvent.click(screen.getAllByRole('button', { name: 'Drain' })[0])
    expect(screen.getByText('Drain this copyset')).toBeInTheDocument()
    expect(screen.queryByText('Drain the last active copyset?')).not.toBeInTheDocument()
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

  it('remove: disabled with an explanation while the detached server still has a live blockserv registered', async () => {
    const onRemove = vi.fn()
    const blockVolumesById = new Map([['bv-detached', bv('bv-detached', { memberState: 'detached', copysetId: undefined })]])
    const nodesByVolume = new Map([['bv-detached', [sn('node-a')]]])
    render(ServersList, { props: baseProps({ copysets: [], blockVolumesById, nodesByVolume, onRemove }) })

    const removeButton = screen.getByRole('button', { name: 'Remove' })
    expect(removeButton).toBeDisabled()
    expect(removeButton).toHaveAttribute('title', expect.stringContaining('Terminate its instance first'))
    expect(screen.getByText('Instance still reachable')).toBeInTheDocument()

    await fireEvent.click(removeButton)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(onRemove).not.toHaveBeenCalled()
  })

  it('remove: enabled once the detached server has no live blockserv reporting its id', async () => {
    const onRemove = vi.fn().mockResolvedValue(undefined)
    const blockVolumesById = new Map([['bv-detached', bv('bv-detached', { memberState: 'detached', copysetId: undefined })]])
    render(ServersList, { props: baseProps({ copysets: [], blockVolumesById, nodesByVolume: new Map(), onRemove }) })

    const removeButton = screen.getByRole('button', { name: 'Remove' })
    expect(removeButton).not.toBeDisabled()
    expect(screen.queryByText('Instance still reachable')).not.toBeInTheDocument()

    await fireEvent.click(removeButton)
    await fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(onRemove).toHaveBeenCalledWith('bv-detached'))
  })

  it('Add copyset: opens the dialog, submits one name, calls onRegisterCopyset, and shows the generated BLOCK_VOLUME_IDs', async () => {
    const onRegisterCopyset = vi.fn().mockResolvedValue({
      id: 'copyset-2', storageId: 'storage-1', name: 'replica', state: 'active', memberA: 'bv-new-a', memberB: 'bv-new-b', tags: [],
    })
    const blockVolumesById = new Map([
      ['bv-new-a', bv('bv-new-a', { copysetId: 'copyset-2' })],
      ['bv-new-b', bv('bv-new-b', { copysetId: 'copyset-2' })],
    ])
    render(ServersList, { props: baseProps({ copysets: [], blockVolumesById, onRegisterCopyset }) })

    await fireEvent.click(screen.getByRole('button', { name: 'Add copyset' }))
    await fireEvent.input(screen.getByLabelText('Copyset name'), { target: { value: 'replica' } })
    await fireEvent.click(screen.getByRole('button', { name: 'Register' }))

    await waitFor(() => expect(onRegisterCopyset).toHaveBeenCalledWith('replica'))
    expect(await screen.findByText('BLOCK_VOLUME_ID=bv-new-a')).toBeInTheDocument()
    expect(screen.getByText('BLOCK_VOLUME_ID=bv-new-b')).toBeInTheDocument()

    await fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('Add copyset: falls back to <copysetName>-a/-b labels when the member id is missing from blockVolumesById', async () => {
    const onRegisterCopyset = vi.fn().mockResolvedValue({
      id: 'copyset-2', storageId: 'storage-1', name: 'riveted-truss-4f2a', state: 'active', memberA: 'bv-new-a', memberB: 'bv-new-b', tags: [],
    })
    render(ServersList, { props: baseProps({ copysets: [], blockVolumesById: new Map(), onRegisterCopyset }) })

    await fireEvent.click(screen.getByRole('button', { name: 'Add copyset' }))
    await fireEvent.click(screen.getByRole('button', { name: 'Register' }))

    expect(await screen.findByText('riveted-truss-4f2a-a')).toBeInTheDocument()
    expect(screen.getByText('riveted-truss-4f2a-b')).toBeInTheDocument()
  })

  it('routes a failed Add copyset submit through handleApiError, keeping the dialog open', async () => {
    const onRegisterCopyset = vi.fn().mockRejectedValue(new Error('conflict'))
    render(ServersList, { props: baseProps({ copysets: [], blockVolumesById: new Map(), onRegisterCopyset }) })

    await fireEvent.click(screen.getByRole('button', { name: 'Add copyset' }))
    await fireEvent.click(screen.getByRole('button', { name: 'Register' }))

    await waitFor(() => expect(handleApiError).toHaveBeenCalled())
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('opens the same dialog when the caller sets registering externally, resetting the form', async () => {
    const { rerender } = render(ServersList, { props: baseProps({ copysets: [], blockVolumesById: new Map(), registering: false }) })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await rerender(baseProps({ copysets: [], blockVolumesById: new Map(), registering: true }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText('Copyset name')).toHaveValue('')
  })

  it('Add multiple: opens the bulk dialog, submits a count, calls onRegisterCopysetsBulk, and shows every generated BLOCK_VOLUME_ID', async () => {
    const onRegisterCopysetsBulk = vi.fn().mockResolvedValue([
      { id: 'copyset-3', storageId: 'storage-1', name: 'riveted-truss-1a2b', state: 'active', memberA: 'bv-3a', memberB: 'bv-3b', tags: [] },
      { id: 'copyset-4', storageId: 'storage-1', name: 'coupled-beam-3c4d', state: 'active', memberA: 'bv-4a', memberB: 'bv-4b', tags: [] },
    ])
    render(ServersList, { props: baseProps({ copysets: [], blockVolumesById: new Map(), onRegisterCopysetsBulk }) })

    await fireEvent.click(screen.getByRole('button', { name: 'Add multiple' }))
    await fireEvent.input(screen.getByLabelText('Count'), { target: { value: '2' } })
    await fireEvent.click(screen.getByRole('button', { name: 'Register' }))

    await waitFor(() => expect(onRegisterCopysetsBulk).toHaveBeenCalledWith(2))
    expect(await screen.findByText('BLOCK_VOLUME_ID=bv-3a')).toBeInTheDocument()
    expect(screen.getByText('BLOCK_VOLUME_ID=bv-3b')).toBeInTheDocument()
    expect(screen.getByText('BLOCK_VOLUME_ID=bv-4a')).toBeInTheDocument()
    expect(screen.getByText('BLOCK_VOLUME_ID=bv-4b')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Copy all 4 BLOCK_VOLUME_IDs/ })).toBeInTheDocument()

    await fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('Add multiple: disables Register when count is out of range or fractional', async () => {
    render(ServersList, { props: baseProps({ copysets: [], blockVolumesById: new Map() }) })

    await fireEvent.click(screen.getByRole('button', { name: 'Add multiple' }))
    await fireEvent.input(screen.getByLabelText('Count'), { target: { value: '101' } })
    expect(screen.getByRole('button', { name: 'Register' })).toBeDisabled()
    expect(screen.getByText(/Count must be between 1 and 100/)).toBeInTheDocument()

    await fireEvent.input(screen.getByLabelText('Count'), { target: { value: '0' } })
    expect(screen.getByRole('button', { name: 'Register' })).toBeDisabled()

    await fireEvent.input(screen.getByLabelText('Count'), { target: { value: '1.5' } })
    expect(screen.getByRole('button', { name: 'Register' })).toBeDisabled()
  })

  it('routes a failed Add multiple submit through handleApiError, keeping the dialog open', async () => {
    const onRegisterCopysetsBulk = vi.fn().mockRejectedValue(new Error('conflict'))
    render(ServersList, { props: baseProps({ copysets: [], blockVolumesById: new Map(), onRegisterCopysetsBulk }) })

    await fireEvent.click(screen.getByRole('button', { name: 'Add multiple' }))
    await fireEvent.click(screen.getByRole('button', { name: 'Register' }))

    await waitFor(() => expect(handleApiError).toHaveBeenCalled())
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('canUpdate=false hides every mutation control while keeping the servers list visible', () => {
    const blockVolumesById = new Map([
      ['bv-a', bv('bv-a', { copysetId: 'copyset-1' })],
      ['bv-b', bv('bv-b', { copysetId: 'copyset-1' })],
      ['bv-detached', bv('bv-detached', { memberState: 'detached', copysetId: undefined })],
    ])
    render(ServersList, { props: baseProps({ blockVolumesById, canUpdate: false }) })

    expect(screen.queryByRole('button', { name: 'Add copyset' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add multiple' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Drain' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument()
    expect(screen.getByText('bv-detached')).toBeInTheDocument()
  })

  it('shows the stale-status and node-staleness notices without clearing the servers list', () => {
    render(ServersList, { props: baseProps({ staleStatus: true, nodesStale: true }) })
    expect(screen.getByText(/Can't confirm copyset status right now/)).toBeInTheDocument()
    expect(screen.getByText(/Can't confirm blockserv node data right now/)).toBeInTheDocument()
    expect(screen.getByText('bv-a')).toBeInTheDocument()
  })

  describe('local name filter', () => {
    function multiRowProps() {
      const blockVolumesById = new Map([
        ['bv-a', bv('bv-a', { copysetId: 'copyset-1' })],
        ['bv-b', bv('bv-b', { copysetId: 'copyset-1' })],
        ['bv-unpaired', bv('bv-unpaired', { memberState: 'active', copysetId: undefined })],
        ['bv-detached', bv('bv-detached', { memberState: 'detached', copysetId: undefined })],
      ])
      return baseProps({ blockVolumesById })
    }

    it('typing a query narrows the visible rows to matching names', async () => {
      render(ServersList, { props: multiRowProps() })
      expect(screen.getByText('bv-unpaired')).toBeInTheDocument()

      await fireEvent.input(screen.getByLabelText('Filter servers by name'), { target: { value: 'unpaired' } })

      expect(screen.getByText('bv-unpaired')).toBeInTheDocument()
      expect(screen.queryByText('bv-a')).not.toBeInTheDocument()
      expect(screen.queryByText('bv-b')).not.toBeInTheDocument()
      expect(screen.queryByText('bv-detached')).not.toBeInTheDocument()
    })

    it('clearing the query restores the full list', async () => {
      render(ServersList, { props: multiRowProps() })
      const input = screen.getByLabelText('Filter servers by name')

      await fireEvent.input(input, { target: { value: 'unpaired' } })
      expect(screen.queryByText('bv-a')).not.toBeInTheDocument()

      await fireEvent.input(input, { target: { value: '' } })
      expect(screen.getByText('bv-a')).toBeInTheDocument()
      expect(screen.getByText('bv-b')).toBeInTheDocument()
      expect(screen.getByText('bv-unpaired')).toBeInTheDocument()
      expect(screen.getByText('bv-detached')).toBeInTheDocument()
    })

    it('a non-matching query shows a distinct "no matches" empty state, not the "no servers at all" one', async () => {
      render(ServersList, { props: multiRowProps() })

      await fireEvent.input(screen.getByLabelText('Filter servers by name'), { target: { value: 'no-such-server' } })

      expect(screen.getByText('No servers match "no-such-server".')).toBeInTheDocument()
      expect(screen.queryByText('No servers registered for this storage yet.')).not.toBeInTheDocument()
    })

    it('matches by BLOCK_VOLUME_ID as well as by name', async () => {
      render(ServersList, { props: multiRowProps() })

      await fireEvent.input(screen.getByLabelText('Filter servers by name'), { target: { value: 'bv-detached' } })

      expect(screen.getByText('bv-detached')).toBeInTheDocument()
      expect(screen.queryByText('bv-a')).not.toBeInTheDocument()
    })

    it('matching only one member by name keeps both of its copyset\'s rows together, not just the matching one', async () => {
      const blockVolumesById = new Map([
        ['bv-a', bv('bv-a', { name: 'mos-block-a-a', copysetId: 'copyset-1' })],
        ['bv-b', bv('bv-b', { name: 'mos-block-a-b', copysetId: 'copyset-1' })],
        ['bv-unpaired', bv('bv-unpaired', { memberState: 'active', copysetId: undefined })],
      ])
      render(ServersList, { props: baseProps({ blockVolumesById }) })

      await fireEvent.input(screen.getByLabelText('Filter servers by name'), { target: { value: 'mos-block-a-a' } })

      expect(screen.getByText('mos-block-a-a')).toBeInTheDocument()
      expect(screen.getByText('mos-block-a-b')).toBeInTheDocument()
      expect(screen.queryByText('bv-unpaired')).not.toBeInTheDocument()
    })

    it('matching by the copyset name keeps both member rows, even when member names don\'t contain the query', async () => {
      const blockVolumesById = new Map([
        ['bv-a', bv('bv-a', { name: 'server-one', copysetId: 'copyset-1' })],
        ['bv-b', bv('bv-b', { name: 'server-two', copysetId: 'copyset-1' })],
      ])
      // copyset() defaults to name 'mos-block-a'
      render(ServersList, { props: baseProps({ blockVolumesById }) })

      await fireEvent.input(screen.getByLabelText('Filter servers by name'), { target: { value: 'mos-block-a' } })

      expect(screen.getByText('server-one')).toBeInTheDocument()
      expect(screen.getByText('server-two')).toBeInTheDocument()
    })

    it('is case-insensitive', async () => {
      render(ServersList, { props: multiRowProps() })

      await fireEvent.input(screen.getByLabelText('Filter servers by name'), { target: { value: 'UNPAIRED' } })

      expect(screen.getByText('bv-unpaired')).toBeInTheDocument()
      expect(screen.queryByText('bv-a')).not.toBeInTheDocument()
    })

    it('does not render a filter input when there are no servers at all', () => {
      render(ServersList, { props: baseProps({ copysets: [], blockVolumesById: new Map() }) })
      expect(screen.queryByLabelText('Filter servers by name')).not.toBeInTheDocument()
    })
  })
})
