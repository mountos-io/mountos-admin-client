// Single source of truth for Copyset.state -> label/variant/title.
// Shared by CopysetStateBadge (the pill) and NodeGrid (the copyset-group border tint) so both
// stay on the same four-state color scheme instead of drifting into a second one.
import type { CopysetState } from '$lib/core/api/types'

export const COPYSET_STATE_LABEL: Record<CopysetState, string> = {
  active: 'Active',
  draining: 'Draining',
  synced_drained: 'Synced',
  retired: 'Retired',
}

export const COPYSET_STATE_VARIANT: Record<CopysetState, 'success' | 'warning' | 'secondary' | 'outline'> = {
  active: 'success',
  draining: 'warning',
  synced_drained: 'secondary',
  retired: 'outline',
}

export const COPYSET_STATE_TITLE: Record<CopysetState, string> = {
  active: 'Serving writes and reads.',
  draining: 'Writes stopped. Serving reads until data is confirmed in object storage.',
  synced_drained: 'Fully synced. Reads stopped. Ready to retire.',
  retired: 'Members freed for reassignment.',
}
