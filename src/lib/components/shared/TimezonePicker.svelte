<script lang="ts">
  import { tz, COMMON_TZ } from '$lib/core/stores/tz.svelte'
  import { Button } from '$lib/components/ui/button'
  import { Input } from '$lib/components/ui/input'
  import Globe from '@lucide/svelte/icons/globe'

  let open = $state(false)
  let custom = $state('')
  let focused = $state(-1)
  let trigger: HTMLButtonElement | null = $state(null)
  let panel: HTMLDivElement | null = $state(null)
  let optionRefs = $state<HTMLButtonElement[]>([])

  const localTz = $derived(tz.localTz)
  const options = $derived.by(() => {
    const seen = new Set<string>()
    const out: string[] = []
    const push = (z: string) => { if (z && !seen.has(z)) { seen.add(z); out.push(z) } }
    push(localTz)
    push('UTC')
    for (const z of COMMON_TZ) push(z)
    return out
  })

  function openPanel() {
    optionRefs = []
    open = true
    const sel = options.indexOf(tz.value)
    focused = sel >= 0 ? sel : 0
    queueMicrotask(() => optionRefs[focused]?.focus())
  }
  function closePanel(returnFocus = true) {
    open = false
    focused = -1
    if (returnFocus) trigger?.focus()
  }
  function pick(z: string) {
    tz.set(z)
    closePanel()
  }
  function applyCustom() {
    const v = custom.trim()
    if (!v) return
    tz.set(v)
    custom = ''
    closePanel()
  }
  function handlePanelKey(e: KeyboardEvent) {
    if (!open) return
    if (e.key === 'Escape') { e.preventDefault(); closePanel(); return }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      focused = Math.min(focused + 1, options.length - 1)
      optionRefs[focused]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      focused = Math.max(focused - 1, 0)
      optionRefs[focused]?.focus()
    } else if (e.key === 'Home') {
      e.preventDefault()
      focused = 0
      optionRefs[0]?.focus()
    } else if (e.key === 'End') {
      e.preventDefault()
      focused = options.length - 1
      optionRefs[focused]?.focus()
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
    <span class="text-foreground tracking-wider truncate max-w-[10ch]">{tz.label}</span>
  </button>

  {#if open}
    <div bind:this={panel}
      role="listbox"
      tabindex={-1}
      aria-label="Pick timezone"
      onkeydown={handlePanelKey}
      class="absolute right-0 z-50 mt-1 w-64 max-w-[calc(100vw-1rem)] rounded-sm border border-border/60 bg-popover shadow-md overflow-hidden">
      <div class="px-2 py-1.5 border-b border-border/40 text-[11px] uppercase tracking-wider text-muted-foreground/80">
        Display timezone
      </div>
      <ul class="max-h-64 overflow-y-auto py-1 text-xs">
        {#each options as z, i (z)}
          {@const sel = tz.value === z}
          {@const isLocal = z === localTz}
          <li>
            <button type="button"
              bind:this={optionRefs[i]}
              role="option"
              aria-selected={sel}
              onclick={() => pick(z)}
              onfocus={() => (focused = i)}
              tabindex={focused === i ? 0 : -1}
              class="w-full text-left px-2 py-1.5 min-h-[44px] sm:min-h-[36px] flex items-center justify-between gap-2 hover:bg-accent focus-visible:bg-accent focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring {sel ? 'bg-accent/60' : ''}">
              <span class="font-mono truncate">{z}</span>
              <span class="flex items-center gap-1 shrink-0">
                {#if isLocal}<span class="text-[10px] uppercase tracking-wider text-muted-foreground/70">local</span>{/if}
                {#if sel}<span class="text-primary text-[10px]">●</span>{/if}
              </span>
            </button>
          </li>
        {/each}
      </ul>
      <div class="border-t border-border/40 p-2 flex items-center gap-1.5">
        <Input
          type="text"
          placeholder="IANA zone (e.g. Europe/Madrid)"
          class="h-8 min-h-[44px] sm:min-h-[32px] text-xs"
          bind:value={custom}
          onkeydown={(e: KeyboardEvent) => {
            if (e.key === 'Enter') { e.preventDefault(); applyCustom() }
            else if (e.key === 'Escape') { e.preventDefault(); closePanel() }
          }}
          aria-label="Custom IANA timezone" />
        <Button variant="outline" size="sm" disabled={!custom.trim()} onclick={applyCustom} class="h-8 min-h-[44px] sm:min-h-[32px]">Set</Button>
      </div>
    </div>
  {/if}
</div>
