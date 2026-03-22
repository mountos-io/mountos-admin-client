<script lang="ts">
  import type { AuditLog } from '$lib/core/api/types'
  import UserIcon from '@lucide/svelte/icons/user'
  import DatabaseIcon from '@lucide/svelte/icons/database'
  import BuildingIcon from '@lucide/svelte/icons/building'
  import HardDriveIcon from '@lucide/svelte/icons/hard-drive'
  import ShieldIcon from '@lucide/svelte/icons/shield'
  import GlobeIcon from '@lucide/svelte/icons/globe'
  import KeyIcon from '@lucide/svelte/icons/key'
  import MonitorIcon from '@lucide/svelte/icons/monitor'
  import ServerIcon from '@lucide/svelte/icons/server'
  import ScrollIcon from '@lucide/svelte/icons/scroll'
  import ClockIcon from '@lucide/svelte/icons/clock'
  import SunriseIcon from '@lucide/svelte/icons/sunrise'
  import SunIcon from '@lucide/svelte/icons/sun'
  import SunsetIcon from '@lucide/svelte/icons/sunset'
  import MoonIcon from '@lucide/svelte/icons/moon'
  import CopyIcon from '@lucide/svelte/icons/copy'
  import CheckIcon from '@lucide/svelte/icons/check'

  let { logs = [] }: { logs: AuditLog[] } = $props()

  interface PlottedLog extends AuditLog {
    x: number; y: number; date: Date; timeMinutes: number
  }

  let hoveredLog = $state<PlottedLog | null>(null)
  let popupPosition = $state({ left: '0px', top: '0px', transform: 'translate(-50%, -100%)' })
  let selectedTimeRange = $state<'full' | 'morning' | 'afternoon' | 'evening' | 'night'>('full')
  let copiedId = $state<number | null>(null)

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

  const timeRanges = {
    full:      { start: 0,    end: 1440, label: 'Full Day', icon: ClockIcon },
    morning:   { start: 0,    end: 720,  label: '00–12',    icon: SunriseIcon },
    afternoon: { start: 720,  end: 1080, label: '12–18',    icon: SunIcon },
    evening:   { start: 1080, end: 1320, label: '18–22',    icon: SunsetIcon },
    night:     { start: 1320, end: 1440, label: '22–24',    icon: MoonIcon },
  }

  const subjectMeta: Record<string, { color: string; icon: typeof UserIcon }> = {
    user:    { color: 'var(--pastel-user)',    icon: UserIcon },
    volume:  { color: 'var(--pastel-volume)',  icon: DatabaseIcon },
    account: { color: 'var(--pastel-account)', icon: BuildingIcon },
    storage: { color: 'var(--pastel-storage)', icon: HardDriveIcon },
    role:    { color: 'var(--pastel-role)',    icon: ShieldIcon },
    region:  { color: 'var(--pastel-region)',  icon: GlobeIcon },
    mount:   { color: 'var(--pastel-mount)',   icon: HardDriveIcon },
    key:     { color: 'var(--pastel-key)',     icon: KeyIcon },
    session: { color: 'var(--pastel-session)', icon: MonitorIcon },
    node:    { color: 'var(--pastel-node)',    icon: ServerIcon },
    license: { color: 'var(--pastel-license)', icon: ScrollIcon },
  }

  function meta(subject?: string) {
    return subjectMeta[subject ?? ''] ?? { color: 'var(--muted-foreground)', icon: ServerIcon }
  }

  const plottedLogs = $derived.by((): PlottedLog[] => {
    if (!logs.length) return []
    const range = timeRanges[selectedTimeRange]
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
    const range = timeRanges[selectedTimeRange]
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
    const vw = window.innerWidth
    let left = rect.left + rect.width / 2
    let top = rect.top - 10
    let transform = 'translate(-50%, -100%)'
    const pw = 320, pad = 12
    if (left - pw / 2 < pad) left = pad + pw / 2
    else if (left + pw / 2 > vw - pad) left = vw - pad - pw / 2
    if (top - 200 < pad) { top = rect.bottom + 10; transform = 'translate(-50%, 0)' }
    popupPosition = { left: `${left}px`, top: `${top}px`, transform }
  }

  function fmtTime(mins: number) {
    return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`
  }
</script>

<div class="relative w-full">
  <!-- Time range selector -->
  <div class="flex items-center gap-1 mb-3 flex-wrap">
    {#each Object.entries(timeRanges) as [key, { label, icon }]}
      {@const k = key as keyof typeof timeRanges}
      {@const Icon = icon}
      <button type="button"
        class="chart-range-btn flex items-center gap-1 px-2.5 py-1 rounded-sm border text-base font-mono transition-colors
          {selectedTimeRange === k ? 'border-primary text-primary bg-primary/10' : 'border-border text-muted-foreground hover:border-foreground/40'}"
        onclick={() => selectedTimeRange = k}>
        <Icon class="w-3 h-3" />{label}
      </button>
    {/each}
  </div>

  <!-- Chart -->
  <div class="relative border border-border rounded-sm bg-background overflow-hidden" style="padding: 1.5rem 1.5rem 3rem 4rem; height: 400px; contain: layout;">
    <!-- Y-axis labels -->
    <div class="absolute left-2 top-6 bottom-10 w-14 flex flex-col justify-between text-base font-mono text-muted-foreground">
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

      <!-- Data points -->
      {#each plottedLogs as log}
        {@const m = meta(log.subject)}
        {@const Icon = m.icon}
        <div class="absolute cursor-pointer will-change-transform"
          style="left: {log.x}%; top: {log.y}%;"
          onmouseenter={(e) => handleEnter(log, e)}
          onmouseleave={() => hoveredLog = null}
          onclick={() => handleCopy(log)}
          onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), handleCopy(log))}
          role="button" tabindex="0">
          <div class="flex items-center justify-center w-5 h-5 rounded-full bg-background border-2 shadow-sm transition-transform hover:scale-[1.8]"
            style="border-color: {m.color}; color: {m.color}; transform: translate(-50%, -50%);">
            <Icon class="w-2.5 h-2.5" />
          </div>
        </div>
      {/each}
    </div>

    <!-- X-axis labels -->
    <div class="absolute left-[4.5rem] right-4 bottom-2 flex justify-between text-base font-mono text-muted-foreground">
      {#each dateLabels as { label }}
        <div class="text-center">{label}</div>
      {/each}
    </div>
  </div>

  <!-- Hover popup -->
  {#if hoveredLog}
    {@const m = meta(hoveredLog.subject)}
    <div class="fixed z-50 w-80 rounded-sm border border-border bg-background shadow-lg p-3 space-y-2"
      style="left: {popupPosition.left}; top: {popupPosition.top}; transform: {popupPosition.transform};">
      <div class="flex items-center gap-2">
        <h4 class="text-sm font-medium truncate flex-1">{hoveredLog.title}</h4>
        {#if hoveredLog.subject}
          <span class="rounded-sm border px-1.5 py-0.5 text-[0.6rem] font-mono uppercase tracking-wider"
            style="border-color: {m.color}; color: {m.color};">{hoveredLog.subject}</span>
        {/if}
        {#if !hoveredLog.success}
          <span class="rounded-sm border border-destructive text-destructive px-1.5 py-0.5 text-[0.6rem] font-mono uppercase">fail</span>
        {/if}
        <span class="rounded-sm border px-1.5 py-0.5 text-[0.6rem] font-mono uppercase tracking-wider flex items-center gap-1
          {copiedId === hoveredLog.id ? 'border-primary text-primary bg-primary/10' : 'border-muted-foreground/30 text-muted-foreground'}">
          {#if copiedId === hoveredLog.id}
            <CheckIcon class="w-2.5 h-2.5" />Copied
          {:else}
            <CopyIcon class="w-2.5 h-2.5" />Click to copy
          {/if}
        </span>
      </div>
      {#if hoveredLog.description}
        <p class="text-xs text-muted-foreground">{hoveredLog.description}</p>
      {/if}
      <div class="flex items-center gap-3 text-[0.6rem] text-muted-foreground font-mono">
        <span>{hoveredLog.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
        <span>{fmtTime(hoveredLog.timeMinutes)}</span>
        {#if hoveredLog.createdBy}
          <span>&middot; {hoveredLog.createdBy}</span>
        {/if}
      </div>
      {#if hoveredLog.data}
        <pre class="overflow-x-auto rounded-sm border border-border bg-muted/30 p-2 text-[0.6rem] font-mono leading-relaxed max-h-36">{JSON.stringify(hoveredLog.data, null, 2)}</pre>
      {/if}
    </div>
  {/if}

  <!-- Legend -->
  {#if plottedLogs.length > 0}
    {@const subjects = [...new Set(plottedLogs.map(l => l.subject).filter(Boolean))] as string[]}
    {#if subjects.length > 1}
      <div class="flex flex-wrap gap-3 mt-3 text-base font-mono text-muted-foreground">
        {#each subjects as s}
          {@const m = meta(s)}
          {@const Icon = m.icon}
          <span class="flex items-center gap-1">
            <span class="inline-flex items-center justify-center w-4 h-4 rounded-full border-2" style="border-color: {m.color}; color: {m.color};">
              <Icon class="w-2 h-2" />
            </span>
            {s}
          </span>
        {/each}
      </div>
    {/if}
  {/if}
</div>
