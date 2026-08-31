import { describe, it, expect } from 'vitest'
import { nodeHealthVariant, nodeHealthLabel, worstNodeHealthVariant } from './node-health'

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
