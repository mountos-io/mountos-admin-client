<script lang="ts">
  import type { AuditLog } from '$lib/core/api/types'
  import { getSubjectMeta, allSubjects as allSubjectKeys } from '$lib/core/utils/subjects'
  import CopyIcon from '@lucide/svelte/icons/copy'
  import CheckIcon from '@lucide/svelte/icons/check'

  type TimeRange = 'full' | 'morning' | 'afternoon' | 'evening' | 'night'
  let { logs = [], timeRange = $bindable<TimeRange>('full') }: { logs: AuditLog[]; timeRange?: TimeRange } = $props()

  interface PlottedLog extends AuditLog {
    x: number; y: number; date: Date; timeMinutes: number
  }

  let hoveredLog = $state<PlottedLog | null>(null)
  let popupPosition = $state({ left: '0px', top: '0px', transform: 'translate(-50%, -100%)' })
  let copiedId = $state<number | null>(null)
  let disabledSubjects = $state<Set<string>>(new Set())

  async function handleCopy(log: PlottedLog) {
    const obj: Record<string, unknown> = { title: log.title }
    if (log.description) obj.description = log.description
    if (log.subject) obj.subject = log.subject
    obj.success = log.success
    obj.date = log.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    obj.time = fmtTime(log.timeMinutes)
    if (log.createdBy) obj.createdBy = log.createdBy
    if (log.data) obj.data = log.data
    await navigator.clipboard.writeText(JSON.stringify(obj, null, 2))
    copiedId = log.id
    setTimeout(() => { copiedId = null }, 2000)
  }

  const timeRanges: Record<TimeRange, { start: number; end: number }> = {
    full:      { start: 0,    end: 1440 },
    morning:   { start: 0,    end: 720 },
    afternoon: { start: 720,  end: 1080 },
    evening:   { start: 1080, end: 1320 },
    night:     { start: 1320, end: 1440 },
  }

  function meta(subject?: string) { return getSubjectMeta(subject) }

  const plottedLogs = $derived.by((): PlottedLog[] => {
    if (!logs.length) return []
    const range = timeRanges[timeRange]
    const rangeMins = range.end - range.start
    const dates = logs.map(l => new Date(l.createdAt ?? '').getTime())
    const minD = Math.min(...dates), maxD = Math.max(...dates)
    const span = maxD - minD || 1

    return logs.map(log => {
      const date = new Date(log.createdAt ?? '')
      const timeMinutes = date.getHours() * 60 + date.getMinutes()
      return { ...log, x: 0, y: 0, date, timeMinutes }
    })
    .filter(l => l.timeMinutes >= range.start && l.timeMinutes < range.end)
    .map(l => ({
      ...l,
      x: ((l.date.getTime() - minD) / span) * 100,
      y: 100 - ((l.timeMinutes - range.start) / rangeMins) * 100,
    }))
  })

  const allSubjects = allSubjectKeys

  const presentSubjects = $derived(
    new Set(logs.map(l => l.subject).filter(Boolean))
  )

  function hasData(subject: string) {
    return presentSubjects.has(subject)
  }

  function isActive(subject?: string) {
    return hasData(subject ?? '') && !disabledSubjects.has(subject ?? '')
  }

  function toggleSubject(s: string) {
    if (!hasData(s)) return
    const next = new Set(disabledSubjects)
    if (next.has(s)) next.delete(s)
    else next.add(s)
    disabledSubjects = next
  }

  const dateLabels = $derived.by(() => {
    if (!logs.length) return []
    const dates = logs.map(l => new Date(l.createdAt ?? ''))
    const minD = new Date(Math.min(...dates.map(d => d.getTime())))
    const maxD = new Date(Math.max(...dates.map(d => d.getTime())))
    const days = Math.ceil((maxD.getTime() - minD.getTime()) / 86400000)
    if (days <= 1) return [{ label: minD.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), x: 50 }]
    const n = Math.min(days + 1, 7)
    return Array.from({ length: n }, (_, i) => {
      const d = new Date(minD.getTime() + (i / (n - 1)) * (maxD.getTime() - minD.getTime()))
      return { label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), x: (i / (n - 1)) * 100 }
    })
  })

  const timeLabels = $derived.by(() => {
    const range = timeRanges[timeRange]
    const span = range.end - range.start
    return Array.from({ length: 5 }, (_, i) => {
      const ri = 4 - i
      const mins = range.start + (ri / 4) * span
      const h = Math.floor(mins / 60), m = Math.floor(mins % 60)
      return { label: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`, y: 100 - (ri / 4) * 100 }
    })
  })

  function handleEnter(log: PlottedLog, event: MouseEvent) {
    hoveredLog = log
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    const vw = window.innerWidth, vh = window.innerHeight
    let left = rect.left + rect.width / 2
    let top = rect.top - 14
    let transform = 'translate(-50%, -100%)'
    const pw = 448, ph = 360, pad = 16
    if (left - pw / 2 < pad) left = pad + pw / 2
    else if (left + pw / 2 > vw - pad) left = vw - pad - pw / 2
    if (top - ph < pad) { top = rect.bottom + 14; transform = 'translate(-50%, 0)' }
    if (top + ph > vh - pad) top = vh - pad - ph
    popupPosition = { left: `${left}px`, top: `${top}px`, transform }
  }

  function fmtTime(mins: number) {
    return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`
  }
</script>

<div class="relative w-full">
  <!-- Chart -->
  <div class="relative border border-border rounded-sm bg-background overflow-hidden" style="padding: 1.5rem 1.5rem 3rem 4rem; height: min(400px, 50vh); contain: layout;">
    <div class="tech-grid absolute inset-0 pointer-events-none opacity-20"></div>
    <!-- Y-axis labels -->
    <div class="absolute left-2 top-6 bottom-10 w-14 flex flex-col justify-between text-[1rem] font-mono text-muted-foreground">
      {#each timeLabels as { label }}
        <div class="text-right pr-1">{label}</div>
      {/each}
    </div>

    <!-- Plot area -->
    <div class="absolute left-[4.5rem] right-4 top-6 bottom-10 border-l border-b border-border/50 overflow-visible">
      <!-- Grid -->
      {#each timeLabels as { y }}
        <div class="absolute left-0 right-0 border-t border-border/20" style="top: {y}%"></div>
      {/each}
      {#each dateLabels as { x }}
        <div class="absolute top-0 bottom-0 border-l border-border/20" style="left: {x}%"></div>
      {/each}

      <!-- Inactive points (rendered first, behind) -->
      {#each plottedLogs.filter(l => !isActive(l.subject)) as log}
        {@const m = meta(log.subject)}
        {@const Icon = m.icon}
        <div class="absolute"
          style="left: {log.x}%; top: {log.y}%; opacity: 0.15;">
          <div class="flex items-center justify-center w-7 h-7 rounded-full shadow-sm text-white/90"
            style="background: {m.color}; transform: translate(-50%, -50%);">
            <Icon class="w-3.5 h-3.5" />
          </div>
        </div>
      {/each}
      <!-- Active points (rendered last, on top) -->
      {#each plottedLogs.filter(l => isActive(l.subject)) as log}
        {@const m = meta(log.subject)}
        {@const Icon = m.icon}
        <div class="absolute cursor-pointer will-change-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-full"
          style="left: {log.x}%; top: {log.y}%;"
          onmouseenter={(e) => handleEnter(log, e)}
          onmouseleave={() => hoveredLog = null}
          onclick={() => handleCopy(log)}
          onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), handleCopy(log))}
          role="button" tabindex="0"
          aria-label="{log.title}{log.subject ? ` — ${log.subject}` : ''}, {log.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} {fmtTime(log.timeMinutes)}">
          <div class="flex items-center justify-center w-7 h-7 rounded-full shadow-sm text-white/90 transition-transform hover:scale-[1.8]"
            style="background: {m.color}; transform: translate(-50%, -50%);">
            <Icon class="w-3.5 h-3.5" />
          </div>
        </div>
      {/each}
    </div>

    <!-- X-axis labels -->
    <div class="absolute left-[4.5rem] right-4 bottom-2 flex justify-between text-[1rem] font-mono text-muted-foreground">
      {#each dateLabels as { label }}
        <div class="text-center">{label}</div>
      {/each}
    </div>
  </div>

  <!-- Hover popup -->
  {#if hoveredLog}
    {@const m = meta(hoveredLog.subject)}
    <div class="fixed z-50 w-[28rem] rounded-sm border border-border bg-background shadow-lg p-4 space-y-2.5"
      style="left: {popupPosition.left}; top: {popupPosition.top}; transform: {popupPosition.transform};">
      <h4 class="text-[1rem] font-medium leading-snug break-words">{hoveredLog.title}</h4>
      <div class="flex items-center flex-wrap gap-2">
        {#if hoveredLog.subject}
          <span class="rounded-sm border px-2 py-0.5 text-[1rem] font-mono uppercase tracking-wider whitespace-nowrap"
            style="border-color: {m.color}; color: {m.color};">{hoveredLog.subject}</span>
        {/if}
        {#if !hoveredLog.success}
          <span class="rounded-sm border border-destructive text-destructive px-2 py-0.5 text-[1rem] font-mono uppercase whitespace-nowrap">fail</span>
        {/if}
        <span class="rounded-sm border px-2 py-0.5 text-[1rem] font-mono uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap
          {copiedId === hoveredLog.id ? 'border-primary text-primary bg-primary/10' : 'border-muted-foreground/30 text-muted-foreground'}">
          {#if copiedId === hoveredLog.id}
            <CheckIcon class="w-4 h-4" />Copied
          {:else}
            <CopyIcon class="w-4 h-4" />Click to copy
          {/if}
        </span>
      </div>
      {#if hoveredLog.description}
        <p class="text-[1rem] text-muted-foreground leading-snug">{hoveredLog.description}</p>
      {/if}
      <div class="flex items-center flex-wrap gap-x-3 gap-y-1 text-[1rem] text-muted-foreground font-mono">
        <span class="whitespace-nowrap">{hoveredLog.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
        <span class="whitespace-nowrap">{fmtTime(hoveredLog.timeMinutes)}</span>
        {#if hoveredLog.createdBy}
          <span class="break-all">&middot; {hoveredLog.createdBy}</span>
        {/if}
      </div>
      {#if hoveredLog.data}
        <pre class="overflow-x-auto rounded-sm border border-border bg-muted/30 p-2 text-[1rem] font-mono leading-relaxed max-h-52">{JSON.stringify(hoveredLog.data, null, 2)}</pre>
      {/if}
    </div>
  {/if}

  <!-- Legend -->
  <div class="relative border border-border/30 rounded-sm px-5 py-3 mt-3 mx-auto w-fit max-w-full">
    <div class="tech-grid absolute inset-0 pointer-events-none opacity-20"></div>
    <div class="relative flex flex-wrap items-center justify-center gap-3">
      {#each allSubjects as s}
        {@const m = meta(s)}
        {@const Icon = m.icon}
        {@const has = hasData(s)}
        {@const on = isActive(s)}
        {#if has}
          <button
            class="legend-chip"
            class:legend-dimmed={!on}
            style="--chip-accent: {m.color};"
            onclick={() => toggleSubject(s)}
            aria-pressed={on}
            title={s}
          >
            <span class="inline-flex items-center justify-center w-5 h-5 text-white/90" style="background: {m.color}; border-radius: 4px; border: 2px solid {m.color};">
              <Icon class="w-3 h-3" />
            </span>
            <span class="legend-label">{s}</span>
          </button>
        {:else}
          <span class="legend-chip legend-inert" title="{s} — no data">
            <span class="inline-flex items-center justify-center w-5 h-5 text-white/40" style="background: var(--muted-foreground, gray); opacity: 0.3; border-radius: 4px; border: 2px solid var(--muted-foreground, gray);">
              <Icon class="w-3 h-3" />
            </span>
            <span class="legend-label">{s}</span>
          </span>
        {/if}
      {/each}
    </div>
  </div>
</div>

<style>
  .legend-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border: 1px solid var(--chip-accent, color-mix(in oklch, var(--muted-foreground) 20%, transparent));
    border-radius: 4px;
    font-size: 1rem;
    cursor: pointer;
    transition: opacity 0.2s, filter 0.2s, border-color 0.2s;
    user-select: none;
    background: transparent;
    color: inherit;
  }

  .legend-chip:hover {
    background: color-mix(in oklch, var(--chip-accent, var(--muted-foreground)) 6%, transparent);
  }

  .legend-label {
    font-weight: 500;
    letter-spacing: 0.02em;
  }

  .legend-dimmed {
    opacity: 0.35;
    filter: saturate(0.2);
    border-color: color-mix(in oklch, var(--muted-foreground) 15%, transparent);
  }

  .legend-inert {
    cursor: default;
    opacity: 0.25;
    border-color: color-mix(in oklch, var(--muted-foreground) 10%, transparent);
  }

</style>
