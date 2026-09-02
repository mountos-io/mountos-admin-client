import { describe, it, expect } from 'vitest'
import { ApiError, isNodeUnreachableError } from './errors'

describe('isNodeUnreachableError', () => {
  it('treats a 502 (dial failure to the node process) as node-unreachable', () => {
    expect(isNodeUnreachableError(new ApiError('node unreachable', 502))).toBe(true)
  })

  it('treats a 404 (node row already deactivated/removed) as node-unreachable', () => {
    expect(isNodeUnreachableError(new ApiError('node not found', 404))).toBe(true)
  })

  it.each([500, 503, 401, 403, 400])(
    'does not treat a %d as node-unreachable (a genuine backend/auth error)',
    (status) => {
      expect(isNodeUnreachableError(new ApiError('failure', status))).toBe(false)
    },
  )

  it('returns false for a non-ApiError', () => {
    expect(isNodeUnreachableError(new Error('network blip'))).toBe(false)
    expect(isNodeUnreachableError('not an error')).toBe(false)
    expect(isNodeUnreachableError(undefined)).toBe(false)
  })
})
