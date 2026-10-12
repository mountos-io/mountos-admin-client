import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/svelte'
import ExclusiveGrantsPanel from './ExclusiveGrantsPanel.svelte'
import type { ExclusiveGrant, ExclusiveGrantsResponse } from '$lib/core/api/types'

const grant = (over: Partial<ExclusiveGrant> = {}): ExclusiveGrant => ({
  sessionId: '1', sessionName: 'host-a', holderIp: '10.0.0.5', path: '/data', scopeInode: '7',
  kind: 'tree', state: 'active', windowSeconds: 30, sinceUnixMs: 1, role: 'primary', standbyPosition: 0,
  durability: 'writethrough', holderEpoch: 1, live: true, lastRenewAgeMs: 400, lastSeenAgeMs: 2500,
  takeOverText: 'took over 3 s ago', ...over,
})

const result = (over: Partial<ExclusiveGrantsResponse> = {}): ExclusiveGrantsResponse => ({
  fork: '', ownerReachable: true, truncated: false, grants: [grant()], ...over,
} as ExclusiveGrantsResponse)

describe('ExclusiveGrantsPanel', () => {
  it('shows the grant fields', () => {
    render(ExclusiveGrantsPanel, { result: result({ grants: [grant(), grant({ sessionId: '2', role: 'standby', standbyPosition: 2, holderIp: '10.0.0.6' })] }) })
    expect(screen.getByText('Exclusive grants (2)')).toBeInTheDocument()
    expect(screen.getByText('10.0.0.6')).toBeInTheDocument()
    expect(screen.getByText('standby #2')).toBeInTheDocument()
    expect(screen.getAllByText('/data (tree)')).toHaveLength(2)
    expect(screen.getAllByText('30 s')).toHaveLength(2)
    expect(screen.getAllByText('took over 3 s ago')).toHaveLength(2)
    expect(screen.getAllByText('400 ms')).toHaveLength(2)
  })

  it('shows unknown clocks when the owner is not reachable', () => {
    render(ExclusiveGrantsPanel, { result: result({ ownerReachable: false }) })
    expect(screen.getByText(/owner is not reachable/)).toBeInTheDocument()
    expect(screen.getAllByText('unknown')).toHaveLength(3)
    expect(screen.queryByText('400 ms')).not.toBeInTheDocument()
  })

  it('shows unknown for null clocks', () => {
    render(ExclusiveGrantsPanel, { result: result({ grants: [grant({ live: undefined, lastRenewAgeMs: undefined, lastSeenAgeMs: undefined })] }) })
    expect(screen.getAllByText('unknown')).toHaveLength(3)
  })

  it('flags a truncated list', () => {
    render(ExclusiveGrantsPanel, { result: result({ truncated: true }) })
    expect(screen.getByText('Exclusive grants (1+)')).toBeInTheDocument()
    expect(screen.getByText(/cut short/)).toBeInTheDocument()
  })
})
