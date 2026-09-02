import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/svelte'
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
    expect(screen.getByText('Ops Served Degraded')).toBeInTheDocument()
    expect(screen.getByText((1234).toLocaleString())).toHaveClass('metric-value-pop')
    expect(screen.getByText('Direct S3 Fallback Ops')).toBeInTheDocument()
    expect(screen.getByText((56).toLocaleString())).toHaveClass('metric-value-pop')
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
