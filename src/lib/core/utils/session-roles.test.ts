import { describe, it, expect } from 'vitest'
import { isKnownRole, roleSpec, sessionRole, treeJobInfo, treeJobOutcomes, truncateForkPath } from './session-roles'
import { treeJobStateVariant } from './format'

describe('sessionRole', () => {
  it('reads absent, empty and malformed metadata as a mount', () => {
    expect(sessionRole(undefined)).toBe('mount')
    expect(sessionRole(null)).toBe('mount')
    expect(sessionRole('x')).toBe('mount')
    expect(sessionRole({})).toBe('mount')
    expect(sessionRole({ role: '' })).toBe('mount')
    expect(sessionRole({ role: 7 })).toBe('mount')
  })
  it('keeps a role string as reported', () => {
    expect(sessionRole({ role: 'clone' })).toBe('clone')
    expect(sessionRole({ role: 'future' })).toBe('future')
  })
})

describe('roleSpec', () => {
  it('knows the job roles of this build', () => {
    for (const r of ['gateway', 'utility', 'upload', 'download', 'sink', 'clone', 'rm']) expect(isKnownRole(r)).toBe(true)
    expect(roleSpec('clone').label).toBe('Clone')
    expect(roleSpec('rm').label).toBe('Remove')
    expect(roleSpec('clone').showsMountPath).toBe(false)
  })
  it('shows an unknown role as a neutral job badge, never as a mount', () => {
    const s = roleSpec('future')
    expect(s.label).toBe('Job (future)')
    expect(s.variant).toBe('outline')
    expect(s.showsMountPath).toBe(false)
    expect(s.showsFuseIo).toBe(false)
  })
  it('does not treat object prototype names as known roles', () => {
    expect(isKnownRole('constructor')).toBe(false)
    expect(roleSpec('toString').label).toBe('Job (toString)')
  })
  it('cleans and caps an unknown role text', () => {
    expect(roleSpec('a\u0007b\n').label).toBe('Job (ab)')
    expect(roleSpec('x'.repeat(40)).label).toBe(`Job (${'x'.repeat(24)}…)`)
    expect(roleSpec('\u0001').label).toBe('Job')
  })
  it('keeps the mount path for a mount and a utility only', () => {
    expect(roleSpec('mount').showsMountPath).toBe(true)
    expect(roleSpec('utility').showsMountPath).toBe(true)
    expect(roleSpec('gateway').showsMountPath).toBe(false)
  })
})

describe('truncateForkPath', () => {
  it('keeps the fork and cuts a long path', () => {
    expect(truncateForkPath('main://a/b')).toBe('main://a/b')
    expect(truncateForkPath(`dev://${'p'.repeat(60)}`)).toBe(`dev://${'p'.repeat(40)}…`)
  })
  it('cuts a long fork name and passes a value without a fork through the path rule', () => {
    expect(truncateForkPath(`${'f'.repeat(50)}://x`)).toBe(`${'f'.repeat(32)}…://x`)
    expect(truncateForkPath('plain')).toBe('plain')
  })
  it('returns undefined for an empty value', () => {
    expect(truncateForkPath(undefined)).toBeUndefined()
    expect(truncateForkPath('')).toBeUndefined()
  })
})

describe('tree job detail', () => {
  it('reads the block of its own role only', () => {
    const md = { role: 'clone', clone: { jobId: 'j', cloned: 3 }, rm: { removed: 9 } }
    expect(treeJobInfo(md, 'clone')?.cloned).toBe(3)
    expect(treeJobInfo(md, 'rm')?.removed).toBe(9)
    expect(treeJobInfo(md, 'upload')).toBeNull()
    expect(treeJobInfo(null, 'clone')).toBeNull()
    expect(treeJobInfo({ clone: 5 }, 'clone')).toBeNull()
  })
  it('lists the four outcomes of each role', () => {
    expect(treeJobOutcomes('clone', { cloned: 1, overwritten: 2, skipped: 3, failed: 4 }).map((o) => `${o.label}=${o.value}`))
      .toEqual(['Cloned=1', 'Overwritten=2', 'Skipped=3', 'Failed=4'])
    const rm = treeJobOutcomes('rm', { removed: 5, protected: 2 })
    expect(rm.map((o) => o.label)).toEqual(['Removed', 'Skipped', 'Protected', 'Failed'])
    expect(rm[3]!.tone).toBe('plain')
    expect(treeJobOutcomes('clone', { failed: 1 })[3]!.tone).toBe('bad')
  })
})

describe('treeJobStateVariant', () => {
  it('maps the job states and falls back to a neutral variant', () => {
    expect(treeJobStateVariant('completed')).toBe('success')
    expect(treeJobStateVariant('halted')).toBe('destructive')
    expect(treeJobStateVariant('resumable')).toBe('warning')
    expect(treeJobStateVariant('running')).toBe('primary')
    expect(treeJobStateVariant('odd')).toBe('outline')
  })
})
