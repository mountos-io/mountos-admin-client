import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/svelte'
import { readable } from 'svelte/store'
import Page from './+page.svelte'
import type { ClientSession } from '$lib/core/api/types'

const { getSession, gotoMock } = vi.hoisted(() => ({
  getSession: vi.fn(),
  gotoMock: vi.fn(),
}))

vi.mock('$app/navigation', () => ({ goto: gotoMock }))
vi.mock('$app/stores', () => ({
  page: readable({ params: { id: '42' }, url: new URL('http://localhost/sessions/42') }),
}))
vi.mock('$lib/core/stores/auth.svelte', () => ({
  useAuth: () => ({ loading: false, can: () => true, isUserRole: false, userMountosUserId: null }),
}))
vi.mock('$lib/core/stores/client.svelte', () => ({
  api: { clientSessions: { get: getSession } },
}))
vi.mock('$lib/core/stores/sessions.svelte', () => ({
  getPlatform: (s: ClientSession) => (s.metadata as { platform?: string } | undefined)?.platform ?? '',
}))
vi.mock('$lib/core/utils/toast', () => ({ showErrorToast: vi.fn() }))

const baseSession: ClientSession = {
  id: 42,
  account: { id: 1, name: 'acme' },
  region: { id: 1, name: 'us-east' },
  volume: { id: 5, name: 'vol-block', type: 'block' },
  clientType: 'mfuse',
  osName: 'linux',
  ipAddr: '10.0.0.5',
  isTemporaryFork: false,
  status: 'connected',
  isActive: true,
  connectedAt: Date.now() - 60_000,
  lastHeartbeat: Date.now(),
  metadata: {},
  metrics: { reads: 10 },
}

beforeEach(() => { vi.clearAllMocks() })

describe('sessions/[id] block storage metrics', () => {
  it('shows the auto-degraded warning badge and both op counts while the breaker is open', async () => {
    getSession.mockResolvedValue({
      ...baseSession,
      metrics: { reads: 10, blockAutoDegraded: true, blockAutoDegradeOps: 1234, blockDirectFallbackOps: 56 },
    })
    render(Page)

    await waitFor(() => expect(screen.getByText('Block Storage')).toBeInTheDocument())
    expect(screen.getByText('Auto-Degraded')).toBeInTheDocument()
    expect(screen.queryByText('Normal')).not.toBeInTheDocument()
    expect(screen.getByText('Current Route')).toBeInTheDocument()
    expect(screen.getByText('Object')).toHaveClass('text-destructive')
    expect(screen.queryByText('Block')).not.toBeInTheDocument()
    expect(screen.getByText('Ops Served Degraded')).toBeInTheDocument()
    expect(screen.getByText((1234).toLocaleString())).toHaveClass('metric-value-pop')
    expect(screen.getByText('Direct S3 Fallback Ops')).toBeInTheDocument()
    expect(screen.getByText((56).toLocaleString())).toHaveClass('metric-value-pop')

    const degradedRow = screen.getByText('Ops Served Degraded').closest('.metric-row') as HTMLElement
    expect(within(degradedRow).getByLabelText('More info')).toBeInTheDocument()
    const fallbackRow = screen.getByText('Direct S3 Fallback Ops').closest('.metric-row') as HTMLElement
    expect(within(fallbackRow).getByLabelText('More info')).toBeInTheDocument()
  })

  it('shows a quiet normal state and still reports the fallback count when the breaker is closed', async () => {
    getSession.mockResolvedValue({
      ...baseSession,
      metrics: { reads: 10, blockAutoDegraded: false, blockAutoDegradeOps: 0, blockDirectFallbackOps: 12 },
    })
    render(Page)

    await waitFor(() => expect(screen.getByText('Block Storage')).toBeInTheDocument())
    expect(screen.getByText('Normal')).toBeInTheDocument()
    expect(screen.queryByText('Auto-Degraded')).not.toBeInTheDocument()
    expect(screen.getByText('Current Route')).toBeInTheDocument()
    expect(screen.getByText('Block')).not.toHaveClass('text-destructive')
    expect(screen.queryByText('Object')).not.toBeInTheDocument()
    expect(screen.getByText('Direct S3 Fallback Ops')).toBeInTheDocument()
    expect(screen.getByText((12).toLocaleString())).toBeInTheDocument()
  })

  it('omits the block storage card entirely when the client never reported the metadata', async () => {
    getSession.mockResolvedValue(baseSession)
    render(Page)

    await waitFor(() => expect(screen.getByText('Metrics')).toBeInTheDocument())
    expect(screen.queryByText('Block Storage')).not.toBeInTheDocument()
  })
})

describe('sessions/[id] network tuning', () => {
  it('flags a Linux client below target and shows its values', async () => {
    getSession.mockResolvedValue({
      ...baseSession,
      metrics: {
        reads: 10,
        netTuning: { os: 'linux', supported: true, cc: 'cubic', systemCc: 'cubic', ccOverride: false, rcvMax: 6291456, sndMax: 4194304, bbrApplied: false, tuned: false },
      },
    })
    render(Page)

    await waitFor(() => expect(screen.getByText('Network Tuning')).toBeInTheDocument())
    expect(screen.getByText('below target').closest('.metric-row')).toHaveClass('text-warning')
    // One congestion control row names the value and its source. cubic fails the target.
    const cc = screen.getByText('cubic (system default)')
    expect(cc.closest('.metric-row')).toHaveClass('text-warning')
    expect(screen.getAllByText(/Congestion Control/)).toHaveLength(1)
    expect(screen.queryByText('System Default')).not.toBeInTheDocument()
    expect(screen.queryByText('BBR Per Socket')).not.toBeInTheDocument()
    expect(screen.getByText('6 MB')).toBeInTheDocument()
    expect(screen.getByText('4 MB')).toBeInTheDocument()
  })

  it('shows Tuned as not supported on an OS with no detection', async () => {
    getSession.mockResolvedValue({ ...baseSession, metrics: { reads: 10, netTuning: { os: 'windows', supported: false } } })
    render(Page)

    await waitFor(() => expect(screen.getByText('Network Tuning')).toBeInTheDocument())
    expect(screen.queryByText('Congestion Control')).not.toBeInTheDocument()
    expect(screen.getByText('Tuned').nextElementSibling).toHaveTextContent('not supported on Windows')
  })

  it('shows Tuned as not reported when a macOS client read no value', async () => {
    getSession.mockResolvedValue({ ...baseSession, metrics: { reads: 10, netTuning: { os: 'darwin', supported: false } } })
    render(Page)

    await waitFor(() => expect(screen.getByText('Network Tuning')).toBeInTheDocument())
    expect(screen.getByText('Tuned').nextElementSibling).toHaveTextContent('not reported on macOS')
  })

  it('shows no override on a macOS client, which applies no per-socket choice', async () => {
    getSession.mockResolvedValue({
      ...baseSession,
      metrics: { reads: 10, netTuning: { os: 'darwin', supported: true, cc: 'cubic', ccOverride: true, rcvMax: 67108864, sndMax: 67108864, tuned: true } },
    })
    render(Page)

    await waitFor(() => expect(screen.getByText('Network Tuning')).toBeInTheDocument())
    expect(screen.getByText('Congestion Control').nextElementSibling).toHaveTextContent(/^cubic$/)
    expect(screen.getByText('Congestion Control').closest('.metric-row')).not.toHaveClass('text-warning')
    expect(screen.queryByText(/override/)).not.toBeInTheDocument()
  })

  it('names the per-socket source and a different system default', async () => {
    getSession.mockResolvedValue({
      ...baseSession,
      metrics: { reads: 10, netTuning: { os: 'linux', supported: true, cc: 'bbr', systemCc: 'cubic', socketCc: 'bbr', rcvMax: 67108864, sndMax: 67108864, bbrApplied: true, tuned: true } },
    })
    render(Page)

    await waitFor(() => expect(screen.getByText('Network Tuning')).toBeInTheDocument())
    expect(screen.getByText('bbr (per socket, system default cubic)')).toBeInTheDocument()
  })

  it('names a per-process override apart from the system default', async () => {
    getSession.mockResolvedValue({
      ...baseSession,
      metrics: {
        reads: 10,
        netTuning: { os: 'linux', supported: true, cc: 'cubic', systemCc: 'bbr', socketCc: 'cubic', ccOverride: true, rcvMax: 67108864, sndMax: 67108864, bbrApplied: false, tuned: false },
      },
    })
    render(Page)

    await waitFor(() => expect(screen.getByText('Network Tuning')).toBeInTheDocument())
    const cc = screen.getByText('cubic (per-socket override, system default bbr)')
    expect(cc.closest('.metric-row')).toHaveClass('text-warning')
    expect(screen.getAllByText(/Congestion Control/)).toHaveLength(1)
  })

  // An override that is off, or that the kernel did not accept, gives the sockets no
  // per-socket value. They run the system default, and the row warns only when that fails
  // the target.
  it.each([
    ['a system default that meets the target', { cc: 'bbr', systemCc: 'bbr', tuned: true }, 'bbr (system default, no per-socket setting)', false],
    ['a system default below the target', { cc: 'cubic', systemCc: 'cubic', tuned: false }, 'cubic (system default, no per-socket setting)', true],
  ])('names an override with no per-socket value on %s', async (_name, values, text, warns) => {
    getSession.mockResolvedValue({
      ...baseSession,
      metrics: {
        reads: 10,
        netTuning: { os: 'linux', supported: true, ccOverride: true, rcvMax: 67108864, sndMax: 67108864, bbrApplied: false, ...values },
      },
    })
    render(Page)

    await waitFor(() => expect(screen.getByText('Network Tuning')).toBeInTheDocument())
    const row = screen.getByText(text).closest('.metric-row') as HTMLElement
    if (warns) expect(row).toHaveClass('text-warning')
    else expect(row).not.toHaveClass('text-warning')
    expect(within(row).getByLabelText('More info')).toBeInTheDocument()
    expect(screen.queryByText(/per-socket override/)).not.toBeInTheDocument()
  })

  it('shows an unread buffer ceiling as unknown, never as 0 B', async () => {
    getSession.mockResolvedValue({
      ...baseSession,
      metrics: { reads: 10, netTuning: { os: 'linux', supported: true, cc: 'bbr', rcvMax: 67108864, bbrApplied: true } },
    })
    render(Page)

    await waitFor(() => expect(screen.getByText('Network Tuning')).toBeInTheDocument())
    expect(screen.getByText('Send Buffer Max').nextElementSibling).toHaveTextContent('·')
    expect(screen.getByText('Receive Buffer Max').nextElementSibling).toHaveTextContent('64 MB')
  })

  it('shows the verdict as not reported when the values read pass but one is missing', async () => {
    getSession.mockResolvedValue({
      ...baseSession,
      metrics: { reads: 10, netTuning: { os: 'linux', supported: true, cc: 'bbr', rcvMax: 67108864, bbrApplied: true } },
    })
    render(Page)

    await waitFor(() => expect(screen.getByText('Network Tuning')).toBeInTheDocument())
    const verdict = screen.getByText('not reported')
    expect(verdict.closest('.metric-row')).not.toHaveClass('text-warning')
    expect(screen.queryByText('below target')).not.toBeInTheDocument()
  })

  it('omits the section when the client never reported it', async () => {
    getSession.mockResolvedValue(baseSession)
    render(Page)

    await waitFor(() => expect(screen.getByText('Metrics')).toBeInTheDocument())
    expect(screen.queryByText('Network Tuning')).not.toBeInTheDocument()
  })
})
