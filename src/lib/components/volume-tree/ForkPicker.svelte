<script lang="ts">
  import { Input } from '$lib/components/ui/input'
  import GitFork from '@lucide/svelte/icons/git-fork'
  import ChevronDown from '@lucide/svelte/icons/chevron-down'

  let {
    options,
    value,
    onchange,
    placeholder = 'Fork',
  }: {
    options: { value: string; label: string }[]
    value: string
    onchange: (v: string | null) => void
    placeholder?: string
  } = $props()

  let open = $state(false)
  let filter = $state('')
  let focused = $state(-1)
  let trigger: HTMLButtonElement | null = $state(null)
  let panel: HTMLDivElement | null = $state(null)
  let filterInput: HTMLInputElement | null = $state(null)
  let optionRefs = $state<HTMLButtonElement[]>([])
  let panelPos = $state({ top: 0, left: 0, width: 288, openUp: false })

  const filtered = $derived.by(() => {
    const f = filter.trim().toLowerCase()
    if (!f) return options
    return options.filter(o => o.label.toLowerCase().includes(f))
  })
  const currentLabel = $derived(options.find(o => o.value === value)?.label ?? value)

  // Position the portalled panel under (or above) the trigger. We compute
  // viewport-relative coordinates from the trigger, then subtract the
  // dialog's own offset when the panel is portalled into a dialog —
  // bits-ui Dialog.Content uses `transform` for centering, which makes
  // `position: fixed` resolve against the dialog instead of the viewport.
  function computePanelPos() {
    if (!trigger) return
    const r = trigger.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const margin = 8
    const width = Math.min(288, vw - 2 * margin)
    let left = r.left
    if (left + width > vw - margin) left = Math.max(margin, vw - margin - width)
    const spaceBelow = vh - r.bottom
    const spaceAbove = r.top
    const openUp = spaceBelow < 280 && spaceAbove > spaceBelow
    let top = openUp ? Math.max(margin, r.top - 4) : r.bottom + 4
    const dialog = trigger.closest('[role=dialog]') as HTMLElement | null
    if (dialog) {
      const dr = dialog.getBoundingClientRect()
      top -= dr.top
      left -= dr.left
    }
    panelPos = { top, left, width, openUp }
  }

  function openPanel() {
    optionRefs = []
    filter = ''
    open = true
    const sel = filtered.findIndex(o => o.value === value)
    focused = sel >= 0 ? sel : 0
    computePanelPos()
    queueMicrotask(() => filterInput?.focus())
  }
  function closePanel(returnFocus = true) {
    open = false
    focused = -1
    filter = ''
    if (returnFocus) trigger?.focus()
  }
  function pick(v: string) {
    onchange(v)
    closePanel()
  }
  function commit() {
    if (filtered.length > 0) pick(filtered[focused >= 0 ? focused : 0]!.value)
  }
  function moveFocus(delta: number) {
    if (filtered.length === 0) return
    let next = focused + delta
    if (next < 0) next = 0
    if (next >= filtered.length) next = filtered.length - 1
    focused = next
    optionRefs[next]?.scrollIntoView({ block: 'nearest' })
  }
  function handlePanelKey(e: KeyboardEvent) {
    if (!open) return
    if (e.key === 'Escape') { e.preventDefault(); closePanel(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); moveFocus(1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moveFocus(-1) }
    else if (e.key === 'Home') { e.preventDefault(); focused = 0; optionRefs[0]?.scrollIntoView({ block: 'nearest' }) }
    else if (e.key === 'End') { e.preventDefault(); focused = filtered.length - 1; optionRefs[focused]?.scrollIntoView({ block: 'nearest' }) }
    else if (e.key === 'Enter' && e.target === filterInput) { e.preventDefault(); commit() }
  }
  function handlePointerOutside(e: PointerEvent) {
    if (!open) return
    const path = e.composedPath()
    if (panel && path.includes(panel)) return
    if (trigger && path.includes(trigger)) return
    closePanel(false)
  }

  function handleViewportChange() {
    if (open) computePanelPos()
  }

  // Portal action: hoists the panel out of clipped/scrolled ancestors so
  // it overlays cleanly. When the trigger lives inside a bits-ui Dialog,
  // we keep the panel INSIDE the dialog content — moving it to body
  // would make bits-ui's outside-click detector dismiss the dialog the
  // moment the operator clicks an option. The trigger search ascends
  // until it finds a [role=dialog] or falls through to document.body.
  function portal(node: HTMLElement) {
    let target: HTMLElement = document.body
    if (trigger) {
      const dialog = trigger.closest('[role=dialog]') as HTMLElement | null
      if (dialog) target = dialog
    }
    target.appendChild(node)
    return {
      destroy() {
        if (node.parentNode) node.parentNode.removeChild(node)
      },
    }
  }
</script>

<svelte:window onpointerdown={handlePointerOutside} onscroll={handleViewportChange} onresize={handleViewportChange} />

<div class="relative inline-block">
  <button bind:this={trigger} type="button"
    onclick={() => (open ? closePanel(false) : openPanel())}
    aria-expanded={open}
    aria-haspopup="listbox"
    title={`Fork: ${currentLabel}`}
    class="inline-flex items-center gap-1.5 h-9 min-h-[44px] sm:min-h-9 px-2.5 rounded-sm border border-border/40 bg-background/60 text-sm font-mono text-foreground hover:border-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
    <GitFork class="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
    <span class="truncate max-w-[16ch]">{currentLabel || placeholder}</span>
    <ChevronDown class="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
  </button>

  {#if open}
    <div use:portal bind:this={panel}
      role="listbox"
      tabindex={-1}
      aria-label="Pick fork"
      onkeydown={handlePanelKey}
      onpointerdown={(e) => e.stopPropagation()}
      onmousedown={(e) => e.stopPropagation()}
      onclick={(e) => e.stopPropagation()}
      style:position="fixed"
      style:top={`${panelPos.top}px`}
      style:left={`${panelPos.left}px`}
      style:width={`${panelPos.width}px`}
      style:transform={panelPos.openUp ? 'translateY(-100%)' : 'none'}
      class="z-[60] rounded-sm border border-border/60 bg-popover shadow-md overflow-hidden">
      <div class="px-2 py-1.5 border-b border-border/40 text-[11px] uppercase tracking-wider text-muted-foreground/80">
        Fork <span class="text-muted-foreground/60 normal-case">· {options.length} {options.length === 1 ? 'entry' : 'entries'}</span>
      </div>
      <div class="p-2 border-b border-border/40">
        <Input
          type="text"
          bind:ref={filterInput}
          placeholder="Filter forks"
          class="h-8 min-h-[44px] sm:min-h-[32px] text-sm"
          bind:value={filter}
          onkeydown={(e: KeyboardEvent) => {
            if (e.key.length === 1 || e.key === 'Backspace') focused = 0
          }}
          aria-label="Filter forks" />
      </div>
      <ul class="max-h-[min(60vh,360px)] overflow-y-auto py-1 text-sm">
        {#each filtered as o, i (o.value)}
          {@const sel = o.value === value}
          <li>
            <button type="button"
              bind:this={optionRefs[i]}
              role="option"
              aria-selected={sel}
              onclick={() => pick(o.value)}
              onfocus={() => (focused = i)}
              tabindex={focused === i ? 0 : -1}
              class="w-full text-left px-2 py-1.5 min-h-[44px] sm:min-h-[36px] flex items-center justify-between gap-2 hover:bg-accent focus-visible:bg-accent focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring {sel ? 'bg-accent/60' : ''} {focused === i ? 'bg-accent/40' : ''}">
              <span class="font-mono truncate">{o.label}</span>
              {#if sel}<span class="text-primary text-[10px] shrink-0">●</span>{/if}
            </button>
          </li>
        {:else}
          <li class="px-3 py-4 text-center text-xs text-muted-foreground">No forks match "{filter}"</li>
        {/each}
      </ul>
    </div>
  {/if}
</div>
