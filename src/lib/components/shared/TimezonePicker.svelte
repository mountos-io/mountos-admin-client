<script lang="ts">
  import { tz, ALL_TZ } from '$lib/core/stores/tz.svelte'
  import { Input } from '$lib/components/ui/input'
  import Globe from '@lucide/svelte/icons/globe'

  // GMT-offset short label per IANA zone. Cached because Intl construction is
  // not cheap and we render up to ~420 rows; the offset only changes at DST
  // boundaries which the operator can dismiss-and-reopen if needed.
  const tzAbbrCache = new Map<string, string>()
  function tzAbbr(z: string, now: Date = new Date()): string {
    const cached = tzAbbrCache.get(z)
    if (cached !== undefined) return cached
    let out = ''
    try {
      const parts = new Intl.DateTimeFormat('en', { timeZone: z, timeZoneName: 'short' }).formatToParts(now)
      out = parts.find(p => p.type === 'timeZoneName')?.value ?? ''
    } catch { out = '' }
    tzAbbrCache.set(z, out)
    return out
  }

  let open = $state(false)
  let filter = $state('')
  let focused = $state(-1)
  let trigger: HTMLButtonElement | null = $state(null)
  let panel: HTMLDivElement | null = $state(null)
  let filterInput: HTMLInputElement | null = $state(null)
  let optionRefs = $state<HTMLButtonElement[]>([])

  const localTz = $derived(tz.localTz)

  // Always show local + UTC at the top; the rest of the IANA list is filtered
  // by substring (case-insensitive) so the user can type "kolkata" or "berlin"
  // and narrow down without scrolling 400+ zones.
  const options = $derived.by(() => {
    const seen = new Set<string>()
    const head: string[] = []
    const push = (z: string) => { if (z && !seen.has(z)) { seen.add(z); head.push(z) } }
    push(localTz)
    push('UTC')
    const f = filter.trim().toLowerCase()
    const rest: string[] = []
    for (const z of ALL_TZ) {
      if (seen.has(z)) continue
      if (!f || z.toLowerCase().includes(f)) rest.push(z)
    }
    // Hide head entries that don't match the filter once one is set.
    const headFiltered = f ? head.filter(z => z.toLowerCase().includes(f)) : head
    return [...headFiltered, ...rest]
  })

  function openPanel() {
    optionRefs = []
    filter = ''
    open = true
    const sel = options.indexOf(tz.value)
    focused = sel >= 0 ? sel : 0
    queueMicrotask(() => filterInput?.focus())
  }
  function closePanel(returnFocus = true) {
    open = false
    focused = -1
    filter = ''
    if (returnFocus) trigger?.focus()
  }
  function pick(z: string) {
    tz.set(z)
    closePanel()
  }
  function applyFilterCommit() {
    if (options.length > 0) pick(options[focused >= 0 ? focused : 0]!)
  }
  function moveFocus(delta: number) {
    if (options.length === 0) return
    let next = focused + delta
    if (next < 0) next = 0
    if (next >= options.length) next = options.length - 1
    focused = next
    optionRefs[next]?.scrollIntoView({ block: 'nearest' })
  }
  function handlePanelKey(e: KeyboardEvent) {
    if (!open) return
    if (e.key === 'Escape') { e.preventDefault(); closePanel(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); moveFocus(1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moveFocus(-1) }
    else if (e.key === 'Home') { e.preventDefault(); focused = 0; optionRefs[0]?.scrollIntoView({ block: 'nearest' }) }
    else if (e.key === 'End') { e.preventDefault(); focused = options.length - 1; optionRefs[focused]?.scrollIntoView({ block: 'nearest' }) }
    else if (e.key === 'Enter') {
      // Enter on the filter input commits the focused match; on an option it
      // commits that option (via onclick).
      if (e.target === filterInput) { e.preventDefault(); applyFilterCommit() }
    }
  }
  function handlePointerOutside(e: PointerEvent) {
    if (!open) return
    const path = e.composedPath()
    if (panel && path.includes(panel)) return
    if (trigger && path.includes(trigger)) return
    closePanel(false)
  }
</script>

<svelte:window onpointerdown={handlePointerOutside} />

<div class="relative inline-block">
  <button bind:this={trigger} type="button"
    onclick={() => (open ? closePanel(false) : openPanel())}
    aria-expanded={open}
    aria-haspopup="listbox"
    title={`Display timezone: ${tz.value}`}
    class="inline-flex items-center gap-1 h-9 min-h-[44px] sm:min-h-9 px-2 rounded-sm border border-border/40 bg-background/60 text-xs font-mono text-muted-foreground hover:text-foreground hover:border-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
    <Globe class="h-3 w-3" aria-hidden="true" />
    <span class="text-foreground tracking-wider truncate max-w-[12ch]">{tz.label}</span>
  </button>

  {#if open}
    <div bind:this={panel}
      role="listbox"
      tabindex={-1}
      aria-label="Pick timezone"
      onkeydown={handlePanelKey}
      class="absolute right-0 z-50 mt-1 w-72 max-w-[calc(100vw-1rem)] rounded-sm border border-border/60 bg-popover shadow-md overflow-hidden">
      <div class="px-2 py-1.5 border-b border-border/40 text-xs uppercase tracking-wider text-muted-foreground/80">
        Display timezone <span class="text-muted-foreground/60 normal-case">· {ALL_TZ.length} zones</span>
      </div>
      <div class="p-2 border-b border-border/40">
        <Input
          type="text"
          bind:ref={filterInput}
          placeholder="Filter (e.g. Madrid, Asia)"
          class="h-8 min-h-[44px] sm:min-h-[32px] text-sm"
          bind:value={filter}
          onkeydown={(e: KeyboardEvent) => {
            // Reset focused row on filter typing so Enter picks the first match.
            if (e.key.length === 1 || e.key === 'Backspace') focused = 0
          }}
          aria-label="Filter timezones" />
      </div>
      <ul class="max-h-[min(80vh,640px)] overflow-y-auto py-1 text-sm">
        {#each options as z, i (z)}
          {@const sel = tz.value === z}
          {@const isLocal = z === localTz}
          {@const abbr = tzAbbr(z)}
          <li>
            <button type="button"
              bind:this={optionRefs[i]}
              role="option"
              aria-selected={sel}
              onclick={() => pick(z)}
              onfocus={() => (focused = i)}
              tabindex={focused === i ? 0 : -1}
              class="w-full text-left px-2 py-1.5 min-h-[44px] sm:min-h-[36px] flex items-center justify-between gap-2 hover:bg-accent focus-visible:bg-accent focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring {sel ? 'bg-accent/60' : ''} {focused === i ? 'bg-accent/40' : ''}">
              <span class="font-mono truncate">{z}</span>
              <span class="flex items-center gap-1 shrink-0">
                {#if abbr}
                  <span class="px-1.5 py-0.5 rounded-sm border border-border/40 bg-muted/40 text-[0.7rem] font-mono tabular-nums text-muted-foreground">{abbr}</span>
                {/if}
                {#if isLocal}<span class="text-xs uppercase tracking-wider text-muted-foreground/70">local</span>{/if}
                {#if sel}<span class="text-primary text-[0.7rem]" aria-hidden="true">●</span>{/if}
              </span>
            </button>
          </li>
        {:else}
          <li class="px-3 py-4 text-center text-xs text-muted-foreground">No zones match "{filter}"</li>
        {/each}
      </ul>
    </div>
  {/if}
</div>
