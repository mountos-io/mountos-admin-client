import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/svelte'
import ExclusiveGrantsPanel from './ExclusiveGrantsPanel.svelte'
import type { ExclusiveGrant, ExclusiveGrantsResponse } from '#lib/core/api/types.js'

const grant = (over: Partial<ExclusiveGrant> = {}): ExclusiveGrant => ({
  sessionId: '1', sessionName: 'host-a', fork: '', holderIp: '10.0.0.5', path: '/data', scopeInode: '7',
  kind: 'tree', state: 'active', windowSeconds: 30, sinceUnixMs: 1, role: 'primary', standbyPosition: 0,
  durability: 'writethrough', holderEpoch: 1, live: true, lastRenewAgeMs: 400, lastSeenAgeMs: 2500,
  takeOverText: 'took over 3 s ago', ...over,
})

const result = (over: Partial<ExclusiveGrantsResponse> = {}): ExclusiveGrantsResponse => ({
  ownerReachable: true, truncated: false, grants: [grant()], ...over,
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

  it('shows unknown clocks for the rows of a fork whose owner is not reachable', () => {
    const down = grant({ sessionId: '2', fork: 'dev', live: undefined, lastRenewAgeMs: undefined, lastSeenAgeMs: undefined })
    render(ExclusiveGrantsPanel, { result: result({ ownerReachable: false, grants: [grant({ fork: 'main' }), down] }) })
    expect(screen.getByText(/owner is not reachable/)).toBeInTheDocument()
    expect(screen.getAllByText('unknown')).toHaveLength(3)
    expect(screen.getAllByText('400 ms')).toHaveLength(1)
  })

  it('hides the fork column when every row is in the main fork', () => {
    render(ExclusiveGrantsPanel, { result: result({ grants: [grant({ fork: 'main' }), grant({ sessionId: '2', fork: 'main' })] }) })
    expect(screen.queryByRole('columnheader', { name: 'Fork' })).not.toBeInTheDocument()
    expect(screen.getByText('All forks. Includes standby places.')).toBeInTheDocument()
  })

  it('hides the fork column for rows that carry no fork name', () => {
    render(ExclusiveGrantsPanel, { result: result() })
    expect(screen.queryByRole('columnheader', { name: 'Fork' })).not.toBeInTheDocument()
  })

  it('shows the fork of each row when the volume has more than the main fork', () => {
    render(ExclusiveGrantsPanel, { result: result({ grants: [grant({ fork: 'main' }), grant({ sessionId: '2', fork: 'dev' })] }) })
    expect(screen.getByRole('columnheader', { name: 'Fork' })).toBeInTheDocument()
    expect(screen.getByText('dev')).toBeInTheDocument()
    expect(screen.getByText('main')).toBeInTheDocument()
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
