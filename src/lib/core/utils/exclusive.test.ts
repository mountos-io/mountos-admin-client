import { describe, it, expect } from 'vitest'
import { ApiError } from '../api/errors'
import type { ExclusiveGrant } from '../api/types'
import {
  classifyFailure, commandLine, formatClockMs, grantRoleLabel,
  grantStateVariant, hasReportContent, liveLabel, sortFlags,
} from './exclusive'

const grant = (over: Partial<ExclusiveGrant> = {}): ExclusiveGrant => ({
  sessionId: '1', sessionName: 'host-a', fork: '', holderIp: '10.0.0.5', path: '/data', scopeInode: '7',
  kind: 'tree', state: 'active', windowSeconds: 30, sinceUnixMs: 1, role: 'primary', standbyPosition: 0,
  durability: 'writethrough', holderEpoch: 1, live: true, lastRenewAgeMs: 10, lastSeenAgeMs: 10,
  takeOverText: '', ...over,
})

describe('classifyFailure', () => {
  it('maps 403 and 404 and treats the rest as errors', () => {
    expect(classifyFailure(new ApiError('no', 403))).toBe('forbidden')
    expect(classifyFailure(new ApiError('no', 404))).toBe('not-found')
    expect(classifyFailure(new ApiError('no', 500))).toBe('error')
    expect(classifyFailure(new Error('net'))).toBe('error')
  })
})

describe('mount report formatting', () => {
  it('sorts flags by name', () => {
    expect(sortFlags([{ name: 'b', value: '1' }, { name: 'a', value: '2' }]).map((f) => f.name)).toEqual(['a', 'b'])
    expect(sortFlags(undefined)).toEqual([])
  })

  it('builds a quoted command line', () => {
    const line = commandLine({
      command: 'mount', args: ['vol one', '/mnt/v'],
      flags: [{ name: 'cache-dir', value: '/var/c' }, { name: 'a', value: 'true' }],
      mountOptions: ['ro', 'allow_other'],
    })
    expect(line).toBe("mountos mount -a --cache-dir=/var/c -o ro,allow_other 'vol one' /mnt/v")
  })

  it('detects an empty report', () => {
    expect(hasReportContent(null)).toBe(false)
    expect(hasReportContent({})).toBe(false)
    expect(hasReportContent({ flags: [{ name: 'x', value: '' }] })).toBe(true)
  })
})

describe('clocks', () => {
  it('never reads a missing clock as dead', () => {
    expect(formatClockMs(null)).toBe('unknown')
    expect(formatClockMs(undefined)).toBe('unknown')
    expect(liveLabel(null)).toBe('unknown')
    expect(liveLabel(false)).toBe('not live')
  })
  it('formats ages', () => {
    expect(formatClockMs(400)).toBe('400 ms')
    expect(formatClockMs(2500)).toBe('2.5 s')
    expect(formatClockMs(125_000)).toBe('2 min 5 s')
  })
})

describe('grants', () => {
  it('labels role and state', () => {
    expect(grantRoleLabel(grant())).toBe('primary')
    expect(grantRoleLabel(grant({ role: 'standby', standbyPosition: 2 }))).toBe('standby #2')
    expect(grantStateVariant('fenced')).toBe('destructive')
    expect(grantStateVariant('unknown')).toBe('secondary')
  })
})
