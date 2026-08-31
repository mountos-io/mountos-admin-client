import { describe, it, expect } from 'vitest'
import { COPYSET_STATE_LABEL, COPYSET_STATE_VARIANT, COPYSET_STATE_TITLE } from './copyset-state'
import type { CopysetState } from '$lib/core/api/types'

const STATES: CopysetState[] = ['active', 'draining', 'synced_drained', 'retired']

describe('copyset-state maps', () => {
  it('defines a label, variant, and title for every CopysetState value', () => {
    for (const s of STATES) {
      expect(COPYSET_STATE_LABEL[s]).toBeTruthy()
      expect(COPYSET_STATE_VARIANT[s]).toBeTruthy()
      expect(COPYSET_STATE_TITLE[s]).toBeTruthy()
    }
  })

  it('gives active a success variant and retired/synced a calmer one, matching CopysetStateBadge', () => {
    expect(COPYSET_STATE_VARIANT.active).toBe('success')
    expect(COPYSET_STATE_VARIANT.draining).toBe('warning')
    expect(COPYSET_STATE_VARIANT.synced_drained).toBe('secondary')
    expect(COPYSET_STATE_VARIANT.retired).toBe('outline')
  })
})
