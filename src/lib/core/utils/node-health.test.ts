import { describe, it, expect } from 'vitest'
import { nodeHealthVariant, nodeHealthLabel, worstNodeHealthVariant, nodeConverging } from './node-health'

describe('nodeHealthVariant', () => {
  it('maps healthy to success', () => {
    expect(nodeHealthVariant('healthy')).toBe('success')
  })

  it('maps unhealthy to destructive', () => {
    expect(nodeHealthVariant('unhealthy')).toBe('destructive')
  })

  it.each(['registered', 'draining', 'unknown', 'something-unrecognized', ''])(
    'maps %s to warning (uncertain/transitional, not a clean pass or fail)',
    (status) => {
      expect(nodeHealthVariant(status)).toBe('warning')
    },
  )

  it('downgrades a healthy status to warning while still converging', () => {
    expect(nodeHealthVariant('healthy', true)).toBe('warning')
  })

  it('leaves a healthy status as success once converging is false (the default)', () => {
    expect(nodeHealthVariant('healthy', false)).toBe('success')
  })

  it('does not downgrade an already-bad status just because converging is true', () => {
    expect(nodeHealthVariant('unhealthy', true)).toBe('destructive')
  })
})

describe('nodeHealthLabel', () => {
  it('labels healthy and unhealthy plainly', () => {
    expect(nodeHealthLabel('healthy')).toBe('Healthy')
    expect(nodeHealthLabel('unhealthy')).toBe('Unhealthy')
  })

  it('marks every other status as uncertain', () => {
    expect(nodeHealthLabel('registered')).toBe('Registered (uncertain)')
    expect(nodeHealthLabel('draining')).toBe('Draining (uncertain)')
    expect(nodeHealthLabel('')).toBe('Unknown')
  })

  it('annotates a healthy-but-converging node distinctly from a fully healthy one', () => {
    expect(nodeHealthLabel('healthy', true)).toBe('Healthy (converging)')
    expect(nodeHealthLabel('healthy', false)).toBe('Healthy')
  })
})

describe('nodeConverging', () => {
  it('is false for a non-healthy status regardless of metadata', () => {
    expect(nodeConverging({ status: 'unhealthy', metadata: {} })).toBe(false)
    expect(nodeConverging({ status: 'registered' })).toBe(false)
  })

  it('is false once both ready and ha_synced are true', () => {
    expect(nodeConverging({ status: 'healthy', metadata: { ready: true, ha_synced: true } })).toBe(false)
  })

  it('is true when healthy but ready is missing or false', () => {
    expect(nodeConverging({ status: 'healthy', metadata: { ha_synced: true } })).toBe(true)
    expect(nodeConverging({ status: 'healthy', metadata: { ready: false, ha_synced: true } })).toBe(true)
  })

  it('is true when healthy but ha_synced is missing or false', () => {
    expect(nodeConverging({ status: 'healthy', metadata: { ready: true } })).toBe(true)
    expect(nodeConverging({ status: 'healthy', metadata: { ready: true, ha_synced: false } })).toBe(true)
  })

  it('is true when healthy with no metadata at all', () => {
    expect(nodeConverging({ status: 'healthy' })).toBe(true)
  })
})

describe('worstNodeHealthVariant', () => {
  it('returns warning (uncertain) for an empty list: no servers is not a clean pass', () => {
    expect(worstNodeHealthVariant([])).toBe('warning')
  })

  it('returns success only when every input is success', () => {
    expect(worstNodeHealthVariant(['success', 'success'])).toBe('success')
  })

  it('destructive outranks warning and success', () => {
    expect(worstNodeHealthVariant(['success', 'warning', 'destructive'])).toBe('destructive')
    expect(worstNodeHealthVariant(['destructive', 'success'])).toBe('destructive')
  })

  it('warning outranks success when nothing is destructive', () => {
    expect(worstNodeHealthVariant(['success', 'warning'])).toBe('warning')
  })
})
