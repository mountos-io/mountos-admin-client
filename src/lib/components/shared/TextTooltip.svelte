<script lang="ts" module>
  let _counter = 0
</script>

<script lang="ts">
  import type { Snippet } from 'svelte'
  import { cn } from '$lib/utils.js'
  import { copyText } from '$lib/core/utils/clipboard'
  import CopyIcon from '@lucide/svelte/icons/copy'
  import CheckIcon from '@lucide/svelte/icons/check'

  // Hover/focus tooltip for content that reveals itself (e.g. truncated
  // table cells) rather than InfoTip's dedicated lightbulb trigger -- the
  // wrapped content itself is the trigger. Shares InfoTip's portal/position/
  // dismiss mechanics (WCAG 1.4.13: hoverable, dismissible via Escape, closes
  // on scroll/resize instead of following stale coordinates).
  // align is a prop (applied via inline style), not a `text-left`-style
  // Tailwind class in `class` -- the trigger renders as a <button>, and
  // browsers default buttons to `text-align: center` (Preflight resets
  // font/color inheritance for form elements but not this), so simply
  // omitting an alignment class would NOT fall through to the ambient
  // table-cell alignment the way a plain <span> would. An inline style is
  // also the only reliable way to force it back to the caller's ambient
  // alignment: tailwind-merge doesn't treat an arbitrary `[text-align:...]`
  // class as conflicting with `text-left`/`text-right`, so both would
  // survive in the merged class list with an unpredictable winner.
  let { text, class: className, copyable = false, align = 'inherit', children }: { text: string; class?: string; copyable?: boolean; align?: 'inherit' | 'left' | 'right' | 'center'; children: Snippet } = $props()

  let show = $state(false)
  let copied = $state(false)
  let copyTimer: ReturnType<typeof setTimeout> | undefined
  let pos = $state({ left: '0px', top: '0px', transform: 'translate(-50%, -100%)' })
  const tipId = `text-tooltip-${++_counter}`
  const width = 360

  function open(e: PointerEvent | FocusEvent) {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const vw = window.innerWidth
    const pad = 12
    const pw = Math.min(width, vw - pad * 2)
    let left = r.left + r.width / 2
    let top = r.top - 8
    let transform = 'translate(-50%, -100%)'
    if (left - pw / 2 < pad) left = pad + pw / 2
    else if (left + pw / 2 > vw - pad) left = vw - pad - pw / 2
    if (top - 80 < pad) { top = r.bottom + 8; transform = 'translate(-50%, 0)' }
    pos = { left: `${left}px`, top: `${top}px`, transform }
    show = true
  }

  function close() { show = false }

  async function handleClick() {
    if (!copyable) return
    await copyText(text)
    copied = true
    if (copyTimer) clearTimeout(copyTimer)
    copyTimer = setTimeout(() => { copied = false }, 2000)
  }

  $effect(() => () => { if (copyTimer) clearTimeout(copyTimer) })

  $effect(() => {
    if (!show) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    const onScrollOrResize = () => close()
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
    }
  })

  // Portal to document.body so `position: fixed` resolves to the viewport
  // even when an ancestor (e.g. a scrolling table wrapper) has a transform.
  function portal(node: HTMLElement) {
    document.body.appendChild(node)
    return {
      destroy() {
        if (node.parentNode) node.parentNode.removeChild(node)
      },
    }
  }
</script>

<button
  type="button"
  class={cn('bg-transparent border-none p-0 m-0 text-inherit', copyable ? 'cursor-pointer' : 'cursor-help', className)}
  style:text-align={align}
  aria-describedby={show ? tipId : undefined}
  onpointerenter={open}
  onpointerleave={close}
  onfocus={open}
  onblur={close}
  onclick={handleClick}
>
  {@render children()}
</button>

{#if show}
  <div
    use:portal
    id={tipId}
    role="tooltip"
    class="fixed z-50 pointer-events-none rounded-sm border border-border bg-card px-3 py-2 space-y-1.5"
    style:left={pos.left}
    style:top={pos.top}
    style:transform={pos.transform}
    style:max-width="min({width}px, calc(100vw - 1.5rem))"
  >
    <p class="text-sm leading-relaxed text-foreground break-words">{text}</p>
    {#if copyable}
      <p class="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider {copied ? 'text-primary' : 'text-muted-foreground'}">
        {#if copied}
          <CheckIcon class="w-3.5 h-3.5" />Copied
        {:else}
          <CopyIcon class="w-3.5 h-3.5" />Click to copy
        {/if}
      </p>
    {/if}
  </div>
{/if}
