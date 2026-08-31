import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte'
import CopysetCountControl from './CopysetCountControl.svelte'

vi.mock('$lib/core/utils/toast', () => ({
  showSuccessToast: vi.fn(),
  showWarningToast: vi.fn(),
  handleApiError: vi.fn(),
}))
import { showSuccessToast, showWarningToast, handleApiError } from '$lib/core/utils/toast'

beforeEach(() => { vi.clearAllMocks() })

describe('CopysetCountControl', () => {
  it('shows the current K and opens an edit dialog pre-filled with it', async () => {
    render(CopysetCountControl, { props: { k: 3, canUpdate: true, onSave: vi.fn() } })
    expect(screen.getByText('3')).toBeInTheDocument()

    await fireEvent.click(screen.getByRole('button', { name: 'Edit copyset count' }))
    expect(screen.getByRole('spinbutton')).toHaveValue(3)
  })

  it('shows "not set" when K has never been configured', () => {
    render(CopysetCountControl, { props: { k: 0, canUpdate: true, onSave: vi.fn() } })
    expect(screen.getByText('not set')).toBeInTheDocument()
  })

  it('hides the edit control when canUpdate is false, keeping the K display visible', () => {
    render(CopysetCountControl, { props: { k: 3, canUpdate: false, onSave: vi.fn() } })
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit copyset count' })).not.toBeInTheDocument()
  })

  it('full success: calls onSave and reports the server\'s authoritative post-update count, not a locally recomputed one', async () => {
    // A naive `before (1) + copysetsFormed (1)` would also read 2 here; use a server count that
    // would differ from that naive sum (e.g. a concurrent drain) to prove the real field is used.
    const onSave = vi.fn().mockResolvedValue({
      id: 1, copysetsFormed: 1, targetK: 2, partial: false, activeCopysetCountBefore: 1, activeCopysetCountAfter: 5,
    })
    render(CopysetCountControl, { props: { k: 1, canUpdate: true, onSave } })

    await fireEvent.click(screen.getByRole('button', { name: 'Edit copyset count' }))
    await fireEvent.input(screen.getByRole('spinbutton'), { target: { value: '2' } })
    await fireEvent.click(screen.getByRole('button', { name: 'Update' }))

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(2))
    await waitFor(() => expect(showSuccessToast).toHaveBeenCalledWith('Updated to 5 copyset(s).'))
    expect(showWarningToast).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('partial success: reports the server\'s authoritative count and the server reason verbatim', async () => {
    const onSave = vi.fn().mockResolvedValue({
      id: 1, copysetsFormed: 1, targetK: 3, partial: true, reason: 'Placement cluster B has no unused members.',
      activeCopysetCountBefore: 1, activeCopysetCountAfter: 2,
    })
    render(CopysetCountControl, { props: { k: 1, canUpdate: true, onSave } })

    await fireEvent.click(screen.getByRole('button', { name: 'Edit copyset count' }))
    await fireEvent.input(screen.getByRole('spinbutton'), { target: { value: '3' } })
    await fireEvent.click(screen.getByRole('button', { name: 'Update' }))

    await waitFor(() => expect(showWarningToast).toHaveBeenCalledWith(
      'Formed 1 copyset(s); 2 of 3 target copysets now provisioned. Placement cluster B has no unused members.',
    ))
    expect(showSuccessToast).not.toHaveBeenCalled()
  })

  it('rejects a non-positive value without calling onSave', async () => {
    const onSave = vi.fn()
    render(CopysetCountControl, { props: { k: 2, canUpdate: true, onSave } })

    await fireEvent.click(screen.getByRole('button', { name: 'Edit copyset count' }))
    await fireEvent.input(screen.getByRole('spinbutton'), { target: { value: '0' } })
    expect(screen.getByRole('button', { name: 'Update' })).toBeDisabled()

    await fireEvent.click(screen.getByRole('button', { name: 'Update' }))
    expect(onSave).not.toHaveBeenCalled()
  })

  it('relabels the submit control to Reconcile at an unchanged K, and back to Update once changed', async () => {
    const onSave = vi.fn()
    render(CopysetCountControl, { props: { k: 3, canUpdate: true, onSave } })

    await fireEvent.click(screen.getByRole('button', { name: 'Edit copyset count' }))
    expect(screen.getByRole('button', { name: 'Reconcile' })).not.toBeDisabled()

    await fireEvent.input(screen.getByRole('spinbutton'), { target: { value: '4' } })
    expect(screen.getByRole('button', { name: 'Update' })).not.toBeDisabled()

    await fireEvent.input(screen.getByRole('spinbutton'), { target: { value: '3' } })
    expect(screen.getByRole('button', { name: 'Reconcile' })).not.toBeDisabled()
  })

  // RER-013: the API defines calling updateConfig at the current K as the sanctioned way to
  // re-run auto-copyset-forming (form copysets from newly-registered pool members) without a
  // two-step change-away-and-back workaround. The UI must not block that call.
  it('reconcile at unchanged K: dispatches onSave with the current K and reports the outcome', async () => {
    const onSave = vi.fn().mockResolvedValue({
      id: 1, copysetsFormed: 1, targetK: 3, partial: false, activeCopysetCountBefore: 2, activeCopysetCountAfter: 3,
    })
    render(CopysetCountControl, { props: { k: 3, canUpdate: true, onSave } })

    await fireEvent.click(screen.getByRole('button', { name: 'Edit copyset count' }))
    expect(screen.getByRole('spinbutton')).toHaveValue(3)
    await fireEvent.click(screen.getByRole('button', { name: 'Reconcile' }))

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(3))
    await waitFor(() => expect(showSuccessToast).toHaveBeenCalledWith(
      'Reconciled: formed 1 new copyset(s), 3 copyset(s) now provisioned.',
    ))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('reconcile at unchanged K with nothing to form: reports zero formed without implying failure', async () => {
    const onSave = vi.fn().mockResolvedValue({
      id: 1, copysetsFormed: 0, targetK: 2, partial: false, activeCopysetCountBefore: 2, activeCopysetCountAfter: 2,
    })
    render(CopysetCountControl, { props: { k: 2, canUpdate: true, onSave } })

    await fireEvent.click(screen.getByRole('button', { name: 'Edit copyset count' }))
    await fireEvent.click(screen.getByRole('button', { name: 'Reconcile' }))

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(2))
    await waitFor(() => expect(showSuccessToast).toHaveBeenCalledWith(
      'Reconciled: no new copysets possible, 2 copyset(s) already provisioned.',
    ))
  })

  it('routes a failed save through handleApiError and keeps the dialog open', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('network down'))
    render(CopysetCountControl, { props: { k: 2, canUpdate: true, onSave } })

    await fireEvent.click(screen.getByRole('button', { name: 'Edit copyset count' }))
    await fireEvent.input(screen.getByRole('spinbutton'), { target: { value: '5' } })
    await fireEvent.click(screen.getByRole('button', { name: 'Update' }))

    await waitFor(() => expect(handleApiError).toHaveBeenCalled())
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('Cancel closes the dialog without calling onSave', async () => {
    const onSave = vi.fn()
    render(CopysetCountControl, { props: { k: 2, canUpdate: true, onSave } })

    await fireEvent.click(screen.getByRole('button', { name: 'Edit copyset count' }))
    await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(onSave).not.toHaveBeenCalled()
  })
})
