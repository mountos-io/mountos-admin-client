import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte'
import VolumeCopysetCountControl from './VolumeCopysetCountControl.svelte'

vi.mock('$lib/core/utils/toast', () => ({
  showSuccessToast: vi.fn(),
  showWarningToast: vi.fn(),
  handleApiError: vi.fn(),
}))
import { showSuccessToast, showWarningToast, handleApiError } from '$lib/core/utils/toast'

beforeEach(() => { vi.clearAllMocks() })

describe('VolumeCopysetCountControl', () => {
  it('shows the current target and opens an edit dialog pre-filled with it', async () => {
    render(VolumeCopysetCountControl, { props: { targetCopysetCount: 3, copysetCount: 3, canUpdate: true, onSave: vi.fn() } })
    expect(screen.getByText('3')).toBeInTheDocument()

    await fireEvent.click(screen.getByRole('button', { name: 'Edit volume copyset count' }))
    expect(screen.getByRole('spinbutton')).toHaveValue(3)
  })

  it('shows "not set" when the target has never been configured', () => {
    render(VolumeCopysetCountControl, { props: { targetCopysetCount: 0, copysetCount: 0, canUpdate: true, onSave: vi.fn() } })
    expect(screen.getByText('not set')).toBeInTheDocument()
  })

  it('shows the current copyset count for visibility, distinct from the editable target', () => {
    render(VolumeCopysetCountControl, { props: { targetCopysetCount: 5, copysetCount: 2, canUpdate: true, onSave: vi.fn() } })
    expect(screen.getByText('Currently using 2 of 5 target copyset(s).')).toBeInTheDocument()
  })

  it('omits the visibility line when the target has never been configured', () => {
    render(VolumeCopysetCountControl, { props: { targetCopysetCount: 0, copysetCount: 0, canUpdate: true, onSave: vi.fn() } })
    expect(screen.queryByText(/Currently using/)).not.toBeInTheDocument()
  })

  it('hides the edit control when canUpdate is false, keeping the display visible', () => {
    render(VolumeCopysetCountControl, { props: { targetCopysetCount: 3, copysetCount: 3, canUpdate: false, onSave: vi.fn() } })
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit volume copyset count' })).not.toBeInTheDocument()
  })

  it('full success: calls onSave and reports the server\'s authoritative post-update count, not a locally recomputed one', async () => {
    // A naive `before (1) + copysetsAdded (1)` would also read 2 here; use a server count that
    // would differ from that naive sum (e.g. a concurrent drain) to prove the real field is used.
    const onSave = vi.fn().mockResolvedValue({
      id: 1, targetCopysetCount: 2, copysetCountBefore: 1, copysetsAdded: 1, copysetsRemoved: 0, copysetCountAfter: 5, epoch: 4, partial: false,
    })
    render(VolumeCopysetCountControl, { props: { targetCopysetCount: 1, copysetCount: 1, canUpdate: true, onSave } })

    await fireEvent.click(screen.getByRole('button', { name: 'Edit volume copyset count' }))
    await fireEvent.input(screen.getByRole('spinbutton'), { target: { value: '2' } })
    await fireEvent.click(screen.getByRole('button', { name: 'Update' }))

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(2))
    await waitFor(() => expect(showSuccessToast).toHaveBeenCalledWith('Updated to 5 copyset(s).'))
    expect(showWarningToast).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('partial success: reports the server\'s authoritative count and the server reason verbatim', async () => {
    const onSave = vi.fn().mockResolvedValue({
      id: 1, targetCopysetCount: 5, copysetCountBefore: 1, copysetsAdded: 1, copysetsRemoved: 0, copysetCountAfter: 2, epoch: 3,
      partial: true, reason: 'Placement cluster B has no unused capacity.',
    })
    render(VolumeCopysetCountControl, { props: { targetCopysetCount: 1, copysetCount: 1, canUpdate: true, onSave } })

    await fireEvent.click(screen.getByRole('button', { name: 'Edit volume copyset count' }))
    await fireEvent.input(screen.getByRole('spinbutton'), { target: { value: '5' } })
    await fireEvent.click(screen.getByRole('button', { name: 'Update' }))

    await waitFor(() => expect(showWarningToast).toHaveBeenCalledWith(
      'Assigned 1 copyset(s); 2 of 5 target copysets now in use. Placement cluster B has no unused capacity.',
    ))
    expect(showSuccessToast).not.toHaveBeenCalled()
  })

  it('rejects a value below the minimum without calling onSave', async () => {
    const onSave = vi.fn()
    render(VolumeCopysetCountControl, { props: { targetCopysetCount: 2, copysetCount: 2, canUpdate: true, onSave } })

    await fireEvent.click(screen.getByRole('button', { name: 'Edit volume copyset count' }))
    await fireEvent.input(screen.getByRole('spinbutton'), { target: { value: '0' } })
    expect(screen.getByRole('button', { name: 'Update' })).toBeDisabled()

    await fireEvent.click(screen.getByRole('button', { name: 'Update' }))
    expect(onSave).not.toHaveBeenCalled()
  })

  it('rejects a value above the server-enforced maximum without calling onSave', async () => {
    const onSave = vi.fn()
    render(VolumeCopysetCountControl, { props: { targetCopysetCount: 2, copysetCount: 2, canUpdate: true, onSave } })

    await fireEvent.click(screen.getByRole('button', { name: 'Edit volume copyset count' }))
    await fireEvent.input(screen.getByRole('spinbutton'), { target: { value: '101' } })
    expect(screen.getByRole('button', { name: 'Update' })).toBeDisabled()

    await fireEvent.click(screen.getByRole('button', { name: 'Update' }))
    expect(onSave).not.toHaveBeenCalled()
  })

  it('accepts the server-enforced maximum itself', async () => {
    const onSave = vi.fn().mockResolvedValue({
      id: 1, targetCopysetCount: 100, copysetCountBefore: 2, copysetsAdded: 98, copysetsRemoved: 0, copysetCountAfter: 100, epoch: 2, partial: false,
    })
    render(VolumeCopysetCountControl, { props: { targetCopysetCount: 2, copysetCount: 2, canUpdate: true, onSave } })

    await fireEvent.click(screen.getByRole('button', { name: 'Edit volume copyset count' }))
    await fireEvent.input(screen.getByRole('spinbutton'), { target: { value: '100' } })
    expect(screen.getByRole('button', { name: 'Update' })).not.toBeDisabled()

    await fireEvent.click(screen.getByRole('button', { name: 'Update' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(100))
  })

  it('throttled (429) resize routes through handleApiError with the server\'s own message and keeps the dialog open', async () => {
    const throttled = Object.assign(new Error('copyset config update throttled, retry shortly'), { status: 429 })
    const onSave = vi.fn().mockRejectedValue(throttled)
    render(VolumeCopysetCountControl, { props: { targetCopysetCount: 2, copysetCount: 2, canUpdate: true, onSave } })

    await fireEvent.click(screen.getByRole('button', { name: 'Edit volume copyset count' }))
    await fireEvent.input(screen.getByRole('spinbutton'), { target: { value: '5' } })
    await fireEvent.click(screen.getByRole('button', { name: 'Update' }))

    await waitFor(() => expect(handleApiError).toHaveBeenCalledWith(throttled, 'Failed to update volume copyset count'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('routes a generic failed save through handleApiError and keeps the dialog open', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('network down'))
    render(VolumeCopysetCountControl, { props: { targetCopysetCount: 2, copysetCount: 2, canUpdate: true, onSave } })

    await fireEvent.click(screen.getByRole('button', { name: 'Edit volume copyset count' }))
    await fireEvent.input(screen.getByRole('spinbutton'), { target: { value: '5' } })
    await fireEvent.click(screen.getByRole('button', { name: 'Update' }))

    await waitFor(() => expect(handleApiError).toHaveBeenCalled())
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('Cancel closes the dialog without calling onSave', async () => {
    const onSave = vi.fn()
    render(VolumeCopysetCountControl, { props: { targetCopysetCount: 2, copysetCount: 2, canUpdate: true, onSave } })

    await fireEvent.click(screen.getByRole('button', { name: 'Edit volume copyset count' }))
    await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(onSave).not.toHaveBeenCalled()
  })
})
