import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/svelte'
import NodeGrid from './NodeGrid.svelte'
import type { Copyset, BlockVolume, ServiceNode } from '$lib/core/api/types'

const { statsHistory } = vi.hoisted(() => ({ statsHistory: vi.fn() }))

vi.mock('$lib/core/stores/client.svelte', () => ({
  api: { serviceNodes: { statsHistory } },
}))

function bv(id: string): BlockVolume {
  return { id, name: id, isActive: true, clusterUuid: `cluster-${id}`, clusterName: 'az-1', clusterReady: true } as unknown as BlockVolume
}

function sn(nodeId: string, status: string, regionId = 2): ServiceNode {
  return { id: 1, regionId, serviceType: 'blockserv', nodeId, advertiseAddr: '10.0.0.1:9100', status } as unknown as ServiceNode
}

function copyset(overrides: Partial<Copyset> = {}): Copyset {
  return { id: 'copyset-1', storageId: 'storage-1', name: 'mos-block-a', state: 'active', memberA: 'bv-a', memberB: 'bv-b', volumeCount: 0, tags: [], ...overrides }
}

// jsdom has no IntersectionObserver; this fake lets tests drive viewport enter/leave
// per observed element without a real layout engine.
class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = []
  callback: IntersectionObserverCallback
  elements: Element[] = []
  constructor(cb: IntersectionObserverCallback) {
    this.callback = cb
    FakeIntersectionObserver.instances.push(this)
  }
  observe(el: Element) { this.elements.push(el) }
  unobserve(el: Element) { this.elements = this.elements.filter(e => e !== el) }
  disconnect() { this.elements = [] }
  trigger(el: Element, isIntersecting: boolean) {
    this.callback([{ target: el, isIntersecting } as IntersectionObserverEntry], this as unknown as IntersectionObserver)
  }
}

function observerFor(el: Element): FakeIntersectionObserver | undefined {
  return FakeIntersectionObserver.instances.find(o => o.elements.includes(el))
}

const blockVolumesById = new Map([
  ['bv-a', bv('bv-a')],
  ['bv-b', bv('bv-b')],
])

beforeEach(() => {
  vi.clearAllMocks()
  FakeIntersectionObserver.instances = []
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
  Element.prototype.scrollIntoView = vi.fn()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('NodeGrid', () => {
  it('renders nothing when there are no copysets', () => {
    const { container } = render(NodeGrid, { props: { copysets: [], blockVolumesById, nodesByVolume: new Map(), storageId: 1 } })
    expect(container.textContent?.trim()).toBe('')
  })

  it('renders one grid cell per copyset, ordinal-labeled in list order', () => {
    const nodesByVolume = new Map([['bv-a', [sn('node-a', 'healthy')]], ['bv-b', [sn('node-b', 'healthy')]]])
    render(NodeGrid, { props: { copysets: [copyset(), copyset({ id: 'copyset-2', memberA: 'bv-c', memberB: 'bv-d' })], blockVolumesById, nodesByVolume, storageId: 1 } })
    expect(screen.getByRole('button', { name: /Copyset copyset-1/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Copyset copyset-2/ })).toBeInTheDocument()
    expect(screen.getByText('1', { selector: '.ng-cell span' })).toBeInTheDocument()
    expect(screen.getByText('2', { selector: '.ng-cell span' })).toBeInTheDocument()
  })

  describe('per-node health signal', () => {
    it('reports a healthy member as Healthy', () => {
      const nodesByVolume = new Map([['bv-a', [sn('node-a', 'healthy')]], ['bv-b', [sn('node-b', 'healthy')]]])
      render(NodeGrid, { props: { copysets: [copyset()], blockVolumesById, nodesByVolume, storageId: 1 } })
      const cell = screen.getByRole('button', { name: /Copyset copyset-1/ })
      expect(cell.title).toContain('Healthy')
      expect(cell.title).not.toContain('Unhealthy')
    })

    it('reports an unhealthy member distinctly from an uncertain one', () => {
      const nodesByVolume = new Map([['bv-a', [sn('node-a', 'unhealthy')]], ['bv-b', [sn('node-b', 'registered')]]])
      render(NodeGrid, { props: { copysets: [copyset()], blockVolumesById, nodesByVolume, storageId: 1 } })
      const cell = screen.getByRole('button', { name: /Copyset copyset-1/ })
      expect(cell.title).toContain('Unhealthy')
      expect(cell.title).toContain('uncertain')
    })

    it.each(['registered', 'draining', 'unknown'])('folds %s into the same uncertain bucket as an unassigned member', (status) => {
      const nodesByVolume = new Map([['bv-a', [sn('node-a', status)]], ['bv-b', [sn('node-b', 'healthy')]]])
      render(NodeGrid, { props: { copysets: [copyset()], blockVolumesById, nodesByVolume, storageId: 1 } })
      const cell = screen.getByRole('button', { name: /Copyset copyset-1/ })
      expect(cell.title).toContain('uncertain')
    })

    it('treats a member with no registered blockserv as uncertain, not healthy', () => {
      render(NodeGrid, { props: { copysets: [copyset()], blockVolumesById, nodesByVolume: new Map(), storageId: 1 } })
      const cell = screen.getByRole('button', { name: /Copyset copyset-1/ })
      expect(cell.title).toContain('no blockserv registered yet, uncertain')
    })
  })

  describe('copyset-state signal is independent of node health', () => {
    it('flags an active copyset with an unhealthy node: state says active, node says unhealthy, both visible at once', () => {
      const nodesByVolume = new Map([['bv-a', [sn('node-a', 'unhealthy')]], ['bv-b', [sn('node-b', 'healthy')]]])
      render(NodeGrid, { props: { copysets: [copyset({ state: 'active' })], blockVolumesById, nodesByVolume, storageId: 1 } })
      const cell = screen.getByRole('button', { name: /Copyset copyset-1/ })
      expect(cell.className).toContain('border-success/45') // copyset state: active
      expect(cell.title).toContain('Unhealthy') // node health: unhealthy, independently
    })

    it.each([
      ['active', 'border-success/45'],
      ['draining', 'border-warning/45'],
      ['synced_drained', 'border-border'],
      ['retired', 'border-border/60'],
    ] as const)('applies the %s copyset-state border class', (state, expectedClass) => {
      render(NodeGrid, { props: { copysets: [copyset({ state })], blockVolumesById, nodesByVolume: new Map(), storageId: 1 } })
      const cell = screen.getByRole('button', { name: /Copyset copyset-1/ })
      expect(cell.className).toContain(expectedClass)
    })
  })

  describe('click-to-detail', () => {
    it('scrolls to and flashes the matching server row anchor, without duplicating its detail', () => {
      const anchor = document.createElement('div')
      anchor.id = 'copyset-copyset-1'
      document.body.appendChild(anchor)
      try {
        render(NodeGrid, { props: { copysets: [copyset()], blockVolumesById, nodesByVolume: new Map(), storageId: 1 } })
        fireEvent.click(screen.getByRole('button', { name: /Copyset copyset-1/ }))
        expect(anchor.scrollIntoView).toHaveBeenCalled()
        expect(anchor.classList.contains('copyset-jump-highlight')).toBe(true)
      } finally {
        anchor.remove()
      }
    })

    it('does nothing when no matching anchor exists (never throws)', () => {
      render(NodeGrid, { props: { copysets: [copyset()], blockVolumesById, nodesByVolume: new Map(), storageId: 1 } })
      expect(() => fireEvent.click(screen.getByRole('button', { name: /Copyset copyset-1/ }))).not.toThrow()
    })

    it('also links each cell to its own copyset detail page, separately from the scroll button', () => {
      render(NodeGrid, { props: { copysets: [copyset()], blockVolumesById, nodesByVolume: new Map(), storageId: 42 } })
      const link = screen.getByRole('link', { name: 'Open detail page for copyset 1' })
      expect(link).toHaveAttribute('href', '/storages/42/copysets/copyset-1')
    })

    it('a click on the detail link does not also trigger the scroll-to-row behavior', () => {
      const anchor = document.createElement('div')
      anchor.id = 'copyset-copyset-1'
      document.body.appendChild(anchor)
      try {
        render(NodeGrid, { props: { copysets: [copyset()], blockVolumesById, nodesByVolume: new Map(), storageId: 1 } })
        fireEvent.click(screen.getByRole('link', { name: 'Open detail page for copyset 1' }))
        expect(anchor.scrollIntoView).not.toHaveBeenCalled()
      } finally {
        anchor.remove()
      }
    })
  })

  describe('expanded mode: viewport-gated traffic history fetch', () => {
    it('fetches nothing in compact mode (the default), even though nodes are resolvable', () => {
      const nodesByVolume = new Map([['bv-a', [sn('node-a', 'healthy')]], ['bv-b', [sn('node-b', 'healthy')]]])
      render(NodeGrid, { props: { copysets: [copyset()], blockVolumesById, nodesByVolume, storageId: 1 } })
      expect(statsHistory).not.toHaveBeenCalled()
      expect(FakeIntersectionObserver.instances).toHaveLength(0)
    })

    it('fetches history only for a cell that actually enters the viewport after switching to expanded', async () => {
      statsHistory.mockResolvedValue({ intervalMs: 5000, samples: [] })
      const nodesByVolume = new Map([['bv-a', [sn('node-a', 'healthy', 2)]], ['bv-b', [sn('node-b', 'healthy', 2)]]])
      render(NodeGrid, {
        props: {
          copysets: [copyset(), copyset({ id: 'copyset-2', memberA: 'bv-c', memberB: 'bv-d' })],
          blockVolumesById, nodesByVolume, storageId: 1,
        },
      })

      await fireEvent.click(screen.getByRole('button', { name: 'Traffic' }))
      expect(statsHistory).not.toHaveBeenCalled() // not visible yet, just expanded

      const cell1 = screen.getByRole('button', { name: /Copyset copyset-1/ })
      const observer = observerFor(cell1)
      expect(observer).toBeDefined()
      observer!.trigger(cell1, true)

      expect(statsHistory).toHaveBeenCalledWith(2, 'node-a', expect.anything())
      expect(statsHistory).toHaveBeenCalledWith(2, 'node-b', expect.anything())
      // copyset-2 never entered the viewport, so its nodes are never fetched.
      expect(statsHistory).not.toHaveBeenCalledWith(2, expect.stringContaining('node-c'), expect.anything())
    })

    it('aborts an in-flight request for a cell that scrolls out of view before the response lands', async () => {
      let capturedSignal: AbortSignal | undefined
      statsHistory.mockImplementation((_r: number, _n: string, signal: AbortSignal) => {
        capturedSignal = signal
        return new Promise(() => {}) // never resolves within the test
      })
      const nodesByVolume = new Map([['bv-a', [sn('node-a', 'healthy', 2)]], ['bv-b', [sn('node-b', 'healthy', 2)]]])
      render(NodeGrid, { props: { copysets: [copyset()], blockVolumesById, nodesByVolume, storageId: 1 } })

      await fireEvent.click(screen.getByRole('button', { name: 'Traffic' }))
      const cell = screen.getByRole('button', { name: /Copyset copyset-1/ })
      const observer = observerFor(cell)!
      observer.trigger(cell, true)
      expect(capturedSignal?.aborted).toBe(false)

      observer.trigger(cell, false)
      expect(capturedSignal?.aborted).toBe(true)
    })

    it('aborts every in-flight request when switching back to compact', async () => {
      let capturedSignal: AbortSignal | undefined
      statsHistory.mockImplementation((_r: number, _n: string, signal: AbortSignal) => {
        capturedSignal = signal
        return new Promise(() => {})
      })
      const nodesByVolume = new Map([['bv-a', [sn('node-a', 'healthy', 2)]], ['bv-b', [sn('node-b', 'healthy', 2)]]])
      render(NodeGrid, { props: { copysets: [copyset()], blockVolumesById, nodesByVolume, storageId: 1 } })

      await fireEvent.click(screen.getByRole('button', { name: 'Traffic' }))
      const cell = screen.getByRole('button', { name: /Copyset copyset-1/ })
      observerFor(cell)!.trigger(cell, true)
      expect(capturedSignal?.aborted).toBe(false)

      await fireEvent.click(screen.getByRole('button', { name: 'Compact' }))
      expect(capturedSignal?.aborted).toBe(true)
    })

    it('does not duplicate an in-flight fetch when a cell re-triggers visible before its response lands', async () => {
      statsHistory.mockImplementation(() => new Promise(() => {}))
      const nodesByVolume = new Map([['bv-a', [sn('node-a', 'healthy', 2)]], ['bv-b', [sn('node-b', 'healthy', 2)]]])
      render(NodeGrid, { props: { copysets: [copyset()], blockVolumesById, nodesByVolume, storageId: 1 } })

      await fireEvent.click(screen.getByRole('button', { name: 'Traffic' }))
      const cell = screen.getByRole('button', { name: /Copyset copyset-1/ })
      const observer = observerFor(cell)!
      observer.trigger(cell, true)
      observer.trigger(cell, true)
      expect(statsHistory).toHaveBeenCalledTimes(2) // once per member (A, B), not per re-trigger
    })
  })
})
