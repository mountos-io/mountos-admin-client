import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/svelte'
import CopysetStateBadge from './CopysetStateBadge.svelte'

describe('CopysetStateBadge', () => {
  it.each([
    ['active', 'Active'],
    ['draining', 'Draining'],
    ['synced_drained', 'Synced'],
    ['retired', 'Retired'],
  ] as const)('renders the %s label for state=%s', (state, label) => {
    render(CopysetStateBadge, { props: { state } })
    expect(screen.getByText(label)).toBeInTheDocument()
  })
})
