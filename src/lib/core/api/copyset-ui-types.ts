// Runtime narrowing for Copyset.state (real `Copyset`/`CopysetState` from @mountos-io/admin-sdk,
// imported via $lib/core/api/types). CopysetState is a static TS type, not a validated
// runtime shape, so an unrecognized wire value would otherwise pass through silently.
import type { CopysetState } from '$lib/core/api/types'

const KNOWN_COPYSET_STATES: readonly string[] = ['active', 'draining', 'synced_drained', 'retired']

export function isCopysetState(state: string): state is CopysetState {
  return KNOWN_COPYSET_STATES.includes(state)
}
