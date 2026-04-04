<script lang="ts">
  import Lightbulb from '@lucide/svelte/icons/lightbulb'

  let { text }: { text: string } = $props()

  let show = $state(false)
  let pos = $state({ left: '0px', top: '0px', transform: 'translate(-50%, -100%)' })
  let el: HTMLButtonElement | undefined = $state()
  const tipId = `infotip-${Math.random().toString(36).slice(2, 9)}`

  function open(e: PointerEvent | FocusEvent) {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const vw = window.innerWidth
    const pad = 12
    const pw = Math.min(260, vw - pad * 2)
    let left = r.left + r.width / 2
    let top = r.top - 8
    let transform = 'translate(-50%, -100%)'
    if (left - pw / 2 < pad) left = pad + pw / 2
    else if (left + pw / 2 > vw - pad) left = vw - pad - pw / 2
    if (top - 120 < pad) { top = r.bottom + 8; transform = 'translate(-50%, 0)' }
    pos = { left: `${left}px`, top: `${top}px`, transform }
    show = true
  }

  function close() { show = false }
</script>

<button
  type="button"
  bind:this={el}
  class="inline-flex cursor-help bg-transparent border-none px-1 py-2.5 items-center justify-center"
  aria-label="More info"
  aria-describedby={show ? tipId : undefined}
  onpointerenter={open}
  onpointerleave={close}
  onfocus={open}
  onblur={close}
>
  <Lightbulb class="size-3.5 text-warning" aria-hidden="true" />
  <span class="sr-only">More info</span>
</button>

{#if show}
  <div
    id={tipId}
    role="tooltip"
    class="fixed z-50 pointer-events-none rounded-sm border border-border bg-card shadow-lg px-3 py-2"
    style:left={pos.left}
    style:top={pos.top}
    style:transform={pos.transform}
    style:max-width="min(260px, calc(100vw - 1.5rem))"
  >
    <p class="text-xs leading-relaxed text-foreground whitespace-pre-line">{text}</p>
  </div>
{/if}
