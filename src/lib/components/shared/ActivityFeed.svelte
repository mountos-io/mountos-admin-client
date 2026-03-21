<script lang="ts">
  import { Button } from '$lib/components/ui/button'
  import { formatRelative } from '$lib/core/utils/format'
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
  import ChevronDown from '@lucide/svelte/icons/chevron-down'
  import XCircle from '@lucide/svelte/icons/x-circle'

  let {
    logs = [],
    loading = false,
    hasMore = false,
    onLoadMore,
  }: {
    logs: AuditLog[]
    loading: boolean
    hasMore: boolean
    onLoadMore?: () => void
  } = $props()

  let expanded = $state<Set<number>>(new Set())
  function toggle(id: number) {
    const next = new Set(expanded)
    next.has(id) ? next.delete(id) : next.add(id)
    expanded = next
  }

  const subjectMap: Record<string, { color: string; icon: typeof UserIcon }> = {
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
    return subjectMap[subject ?? ''] ?? { color: 'var(--muted-foreground)', icon: ServerIcon }
  }

  // group logs by date
  type Group = { label: string; logs: AuditLog[] }
  const grouped = $derived.by((): Group[] => {
    if (!logs.length) return []
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today.getTime() - 86400000)
    const weekAgo = new Date(today.getTime() - 7 * 86400000)
    const groups = new Map<string, AuditLog[]>()
    for (const log of logs) {
      const d = new Date(log.createdAt ?? '')
      let label: string
      if (d >= today) label = 'Today'
      else if (d >= yesterday) label = 'Yesterday'
      else if (d >= weekAgo) label = d.toLocaleDateString(undefined, { weekday: 'long' })
      else label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
      if (!groups.has(label)) groups.set(label, [])
      groups.get(label)!.push(log)
    }
    return [...groups.entries()].map(([label, logs]) => ({ label, logs }))
  })
</script>

<div class="activity-feed">
  {#each grouped as group}
    <div class="mb-6">
      <div class="feed-date-label font-mono text-xs uppercase tracking-[0.15em] text-muted-foreground mb-3 pl-8">{group.label}</div>
      <div class="space-y-0.5">
        {#each group.logs as log}
          {@const m = meta(log.subject)}
          {@const Icon = m.icon}
          {@const isOpen = expanded.has(log.id)}
          {@const hasData = log.description || log.data}
          <button
            type="button"
            class="feed-item group w-full text-left flex gap-3 py-2.5 px-3 rounded-sm transition-colors {isOpen ? 'bg-accent/50' : 'hover:bg-accent/30'}"
            onclick={() => hasData && toggle(log.id)}
          >
            <!-- icon -->
            <div class="feed-icon shrink-0 mt-0.5 flex items-center justify-center w-6 h-6 rounded-full border-2"
              style="border-color: {m.color}; color: {m.color}">
              <Icon class="w-3 h-3" />
            </div>
            <!-- content -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-sm font-medium truncate">{log.title}</span>
                {#if log.subject}
                  <span class="feed-subject rounded-sm px-1.5 py-px text-[0.6rem] font-mono uppercase tracking-wider border"
                    style="border-color: {m.color}; color: {m.color}">
                    {log.subject}
                  </span>
                {/if}
                {#if !log.success}
                  <XCircle class="w-3.5 h-3.5 text-destructive shrink-0" />
                {/if}
              </div>
              <div class="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground font-mono">
                {#if log.createdAt}
                  <span>{formatRelative(log.createdAt)}</span>
                {/if}
                {#if log.createdBy}
                  <span>&middot; {log.createdBy}</span>
                {/if}
              </div>
              {#if isOpen && hasData}
                <div class="mt-2 space-y-2">
                  {#if log.description}
                    <p class="text-sm text-muted-foreground">{log.description}</p>
                  {/if}
                  {#if log.data}
                    <pre class="text-xs font-mono bg-muted/50 rounded-sm p-2 overflow-x-auto max-h-48">{JSON.stringify(log.data, null, 2)}</pre>
                  {/if}
                </div>
              {/if}
            </div>
            <!-- expand indicator -->
            {#if hasData}
              <ChevronDown class="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-1 transition-transform duration-200 {isOpen ? 'rotate-180' : ''} opacity-0 group-hover:opacity-100" />
            {/if}
          </button>
        {/each}
      </div>
    </div>
  {/each}

  {#if logs.length === 0 && !loading}
    <div class="text-center py-8 text-sm text-muted-foreground">No activity recorded</div>
  {/if}

  {#if hasMore && onLoadMore}
    <div class="flex justify-center pt-2">
      <Button variant="ghost" size="sm" disabled={loading} onclick={onLoadMore}>
        {loading ? 'Loading...' : 'Load more'}
      </Button>
    </div>
  {/if}

  {#if loading && logs.length === 0}
    <div class="space-y-3 py-4">
      {#each { length: 5 } as _}
        <div class="flex gap-3 px-3 animate-pulse">
          <div class="w-6 h-6 rounded-full bg-muted shrink-0"></div>
          <div class="flex-1 space-y-2">
            <div class="h-3.5 bg-muted rounded w-3/4"></div>
            <div class="h-2.5 bg-muted rounded w-1/3"></div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .feed-item {
    position: relative;
  }
  .feed-item::before {
    content: '';
    position: absolute;
    left: 24px;
    top: 100%;
    width: 1px;
    height: 2px;
    background: var(--border);
  }
  .feed-item:last-child::before {
    display: none;
  }
</style>
