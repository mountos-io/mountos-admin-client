import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/svelte'
import MountReportPanel from './MountReportPanel.svelte'
import { ApiError } from '#lib/core/api/errors.js'

const { requestMock } = vi.hoisted(() => ({ requestMock: vi.fn() }))
vi.mock('#lib/core/stores/client.svelte.js', () => ({ api: { clientSessions: { mountReport: requestMock, supportBundle: vi.fn() } } }))
vi.mock('#lib/core/utils/toast.js', () => ({ showErrorToast: vi.fn(), showSuccessToast: vi.fn() }))

beforeEach(() => { vi.clearAllMocks() })

describe('MountReportPanel', () => {
  it('renders sorted flags and the command line', async () => {
    requestMock.mockResolvedValue({
      mount: { command: 'mount', args: ['/mnt/v'], flags: [{ name: 'zeta', value: '1' }, { name: 'a', value: '2' }], mountOptions: ['ro'] },
      ageSeconds: 5,
    })
    render(MountReportPanel, { sessionId: 9 })
    await waitFor(() => expect(screen.getByText('Flags (2)')).toBeInTheDocument())
    expect(requestMock.mock.calls[0][0]).toBe(9)
    expect(screen.getByText('mountos mount -a=2 --zeta=1 -o ro /mnt/v')).toBeInTheDocument()
  })

  it('explains an empty report', async () => {
    requestMock.mockResolvedValue({ mount: null })
    render(MountReportPanel, { sessionId: 9 })
    await waitFor(() => expect(screen.getByText(/did not send a mount report/)).toBeInTheDocument())
  })

  it('handles 403 without an error alert', async () => {
    requestMock.mockRejectedValue(new ApiError('forbidden', 403))
    render(MountReportPanel, { sessionId: 9 })
    await waitFor(() => expect(screen.getByText('Your role cannot read mount reports.')).toBeInTheDocument())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('handles 404', async () => {
    requestMock.mockRejectedValue(new ApiError('nf', 404))
    render(MountReportPanel, { sessionId: 9 })
    await waitFor(() => expect(screen.getByText(/no record of this session/)).toBeInTheDocument())
  })
})
