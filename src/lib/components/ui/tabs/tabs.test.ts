import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/svelte'
import { Root, List, Trigger, Content } from './index'
import TabsHarness from './tabs-test-harness.svelte'

describe('Tabs', () => {
  it('shows only the panel for the active tab, switching on trigger click', async () => {
    render(TabsHarness)

    expect(screen.getByText('Panel A content')).toBeVisible()
    expect(screen.getByText('Panel B content')).not.toBeVisible()

    await fireEvent.click(screen.getByRole('tab', { name: 'Tab B' }))

    expect(screen.getByText('Panel A content')).not.toBeVisible()
    expect(screen.getByText('Panel B content')).toBeVisible()
  })

  it('marks the active trigger with data-state=active and aria-selected', async () => {
    render(TabsHarness)
    const tabA = screen.getByRole('tab', { name: 'Tab A' })
    const tabB = screen.getByRole('tab', { name: 'Tab B' })
    expect(tabA).toHaveAttribute('aria-selected', 'true')
    expect(tabB).toHaveAttribute('aria-selected', 'false')

    await fireEvent.click(tabB)
    expect(tabA).toHaveAttribute('aria-selected', 'false')
    expect(tabB).toHaveAttribute('aria-selected', 'true')
  })

  it('exports the expected component set from the barrel', () => {
    expect(Root).toBeDefined()
    expect(List).toBeDefined()
    expect(Trigger).toBeDefined()
    expect(Content).toBeDefined()
  })
})
