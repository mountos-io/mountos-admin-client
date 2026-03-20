<script lang="ts">
  import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card'
  import { Badge } from '$lib/components/ui/badge'
  import { formatBytes } from '$lib/core/utils/format'
  import {
    parseMetrics, sv, ssv, latencyBands,
    formatUs, formatTotalTime, formatOpsPerSec, formatUptime, formatNs,
    estimateCV, fmtPercentile,
    latencyVariant, latencyColor, betaVariant, poolUtilColor, bucketBarColor,
    type MetricSection, type HistogramGroup,
  } from '$lib/core/utils/metrics'
  import ChevronRight from '@lucide/svelte/icons/chevron-right'

  let { raw }: { raw: string } = $props()

  let expanded = $state<Set<string>>(new Set())
  function toggleExpand(key: string) {
    const next = new Set(expanded)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    expanded = next
  }

  const sections = $derived(parseMetrics(raw))

  const uptime = $derived(sv(sections, 'Overview', 'uptime_seconds'))
  const pid = $derived(sv(sections, 'Overview', 'pid'))
  const goroutines = $derived(sv(sections, 'Runtime', 'goroutines'))
  const memAlloc = $derived(sv(sections, 'Runtime', 'memory_alloc_bytes'))
  const memSys = $derived(sv(sections, 'Runtime', 'memory_sys_bytes'))
  const memHeap = $derived(sv(sections, 'Runtime', 'memory_heap_inuse_bytes'))
  const gcNum = $derived(sv(sections, 'Runtime', 'gc_num'))
  const gcPause = $derived(sv(sections, 'Runtime', 'gc_last_pause_ns'))
  const cpuCount = $derived(sv(sections, 'Runtime', 'cpu_count'))

  const dbDialect = $derived(ssv(sections, 'DB Pool', 'db_dialect'))
  const dbMaxOpen = $derived(sv(sections, 'DB Pool', 'db_max_open'))
  const dbOpen = $derived(sv(sections, 'DB Pool', 'db_open'))
  const dbInUse = $derived(sv(sections, 'DB Pool', 'db_in_use'))
  const dbIdle = $derived(sv(sections, 'DB Pool', 'db_idle'))
  const dbWaitCount = $derived(sv(sections, 'DB Pool', 'db_wait_count'))

  const httpSection = $derived(sections.find(s => s.name === 'HTTP Methods'))
  const srpcSection = $derived(sections.find(s => s.name === 'SRPC Methods'))
  const dbQuerySection = $derived(sections.find(s => s.name === 'DB Queries'))

  const httpMaxUs = $derived(Math.max(1, ...(httpSection?.groups.map(g => g.maxUs) ?? [1])))
  const dbMaxUs = $derived(Math.max(1, ...(dbQuerySection?.groups.map(g => g.maxUs) ?? [1])))

  const httpTotalHits = $derived(httpSection?.groups.reduce((s, g) => s + g.total, 0) ?? 0)
  const httpTotalDuration = $derived(httpSection?.groups.reduce((s, g) => s + g.durationSec, 0) ?? 0)
  const dbTotalHits = $derived(dbQuerySection?.groups.reduce((s, g) => s + g.total, 0) ?? 0)
  const dbTotalDuration = $derived(dbQuerySection?.groups.reduce((s, g) => s + g.durationSec, 0) ?? 0)
  const srpcTotalHits = $derived(srpcSection?.groups.reduce((s, g) => s + g.total, 0) ?? 0)

  const memAllocPct = $derived(memSys > 0 ? Math.round((memAlloc / memSys) * 100) : 0)
  const poolUtilPct = $derived(dbMaxOpen > 0 ? Math.round((dbOpen / dbMaxOpen) * 100) : 0)

  const httpBands = $derived(latencyBands(httpSection?.groups ?? []))
  const dbBands = $derived(latencyBands(dbQuerySection?.groups ?? []))

  const CIRC = 2 * Math.PI * 38
</script>

<div class="space-y-5">
  <!-- Runtime Gauges -->
  <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
    <div class="border rounded-sm bg-card p-4 space-y-1">
      <div class="text-sm text-muted-foreground">Uptime</div>
      <div class="text-2xl font-bold font-mono tabular-nums">{formatUptime(uptime)}</div>
      <div class="text-sm text-muted-foreground font-mono">PID {pid}</div>
    </div>
    <div class="border rounded-sm bg-card p-4 space-y-1">
      <div class="text-sm text-muted-foreground">Goroutines</div>
      <div class="text-2xl font-bold font-mono tabular-nums">{goroutines}</div>
    </div>
    <div class="border rounded-sm bg-card p-4 space-y-1">
      <div class="text-sm text-muted-foreground">Heap Alloc</div>
      <div class="text-2xl font-bold font-mono tabular-nums">{formatBytes(memAlloc)}</div>
      <div class="text-sm text-muted-foreground">of {formatBytes(memSys)} sys</div>
    </div>
    <div class="border rounded-sm bg-card p-4 space-y-1">
      <div class="text-sm text-muted-foreground">GC Cycles</div>
      <div class="text-2xl font-bold font-mono tabular-nums">{gcNum}</div>
      <div class="text-sm text-muted-foreground">last {formatNs(gcPause)}</div>
    </div>
    <div class="border rounded-sm bg-card p-4 space-y-1">
      <div class="text-sm text-muted-foreground">CPU Cores</div>
      <div class="text-2xl font-bold font-mono tabular-nums">{cpuCount}</div>
    </div>
  </div>

  <!-- Memory + DB Pool -->
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
    <Card>
      <CardHeader>
        <div class="flex items-center justify-between">
          <CardTitle class="text-base">Memory</CardTitle>
          <svg viewBox="0 0 100 100" class="w-12 h-12">
            <circle cx="50" cy="50" r="38" fill="none" stroke="var(--muted)" stroke-width="8" />
            <circle cx="50" cy="50" r="38" fill="none"
              stroke={poolUtilColor(memAllocPct)}
              stroke-width="8"
              stroke-dasharray="{memAllocPct * CIRC / 100} {CIRC}"
              stroke-dashoffset="0"
              transform="rotate(-90 50 50)"
              stroke-linecap="round"
            />
            <text x="50" y="50" text-anchor="middle" dominant-baseline="central"
              class="fill-foreground font-mono" style="font-size: 22px">{memAllocPct}%</text>
          </svg>
        </div>
      </CardHeader>
      <CardContent class="pt-0 space-y-3">
        {#each [
          { label: 'Allocated', value: memAlloc, color: 'var(--success)' },
          { label: 'Heap In-Use', value: memHeap, color: 'var(--primary)' },
          { label: 'System Total', value: memSys, color: 'var(--chart-3)' },
        ] as row}
          <div class="space-y-1">
            <div class="flex justify-between text-sm">
              <span class="text-muted-foreground">{row.label}</span>
              <span class="font-mono tabular-nums">{formatBytes(row.value)}</span>
            </div>
            <div class="h-2 rounded-full bg-muted overflow-hidden">
              <div
                class="h-full rounded-full transition-transform origin-left duration-700"
                style="background: {row.color}; transform: scaleX({row.value / memSys})"
              ></div>
            </div>
          </div>
        {/each}
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <div class="flex items-center justify-between">
          <CardTitle class="text-base">DB Pool</CardTitle>
          <Badge variant="outline" class="font-mono">{dbDialect}</Badge>
        </div>
      </CardHeader>
      <CardContent class="pt-0 space-y-4">
        <div class="flex gap-1.5 flex-wrap">
          {#each { length: dbMaxOpen } as _, i}
            <div
              class="w-4 h-4 rounded-sm border transition-colors duration-300"
              style="background: {i < dbInUse ? 'var(--destructive)' : i < dbOpen ? 'var(--primary)' : 'var(--muted)'};
                     border-color: {i < dbInUse ? 'var(--destructive)' : i < dbOpen ? 'var(--primary)' : 'var(--border)'};
                     opacity: {i < dbOpen ? 1 : 0.4}"
            ></div>
          {/each}
        </div>
        <div class="flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <span class="flex items-center gap-1.5">
            <span class="inline-block w-3 h-3 rounded-sm" style="background: var(--destructive)"></span>
            In use <span class="font-mono tabular-nums font-medium">{dbInUse}</span>
          </span>
          <span class="flex items-center gap-1.5">
            <span class="inline-block w-3 h-3 rounded-sm" style="background: var(--primary)"></span>
            Idle <span class="font-mono tabular-nums font-medium">{dbIdle}</span>
          </span>
          <span class="flex items-center gap-1.5">
            <span class="inline-block w-3 h-3 rounded-sm border" style="background: var(--muted); opacity: 0.4"></span>
            Free <span class="font-mono tabular-nums font-medium">{dbMaxOpen - dbOpen}</span>
          </span>
        </div>
        <div class="space-y-1">
          <div class="flex justify-between text-sm text-muted-foreground">
            <span>Pool utilization</span>
            <span class="font-mono tabular-nums">{dbOpen}/{dbMaxOpen}</span>
          </div>
          <div class="h-2 rounded-full bg-muted overflow-hidden">
            <div
              class="h-full rounded-full transition-transform origin-left duration-700"
              style="background: {poolUtilColor(poolUtilPct)}; transform: scaleX({poolUtilPct / 100})"
            ></div>
          </div>
        </div>
        {#if dbWaitCount > 0}
          <div class="text-sm text-warning flex items-center gap-1.5">
            <span class="inline-block w-2 h-2 rounded-full bg-warning animate-pulse"></span>
            {dbWaitCount} connection{dbWaitCount !== 1 ? 's' : ''} waiting
          </div>
        {/if}
      </CardContent>
    </Card>
  </div>

  <!-- HTTP Methods -->
  {#if httpSection}
    {@render histogramSection(httpSection, httpMaxUs, true, httpTotalHits, httpTotalDuration, httpBands)}
  {/if}

  <!-- SRPC Methods -->
  {#if srpcSection}
    {@render histogramSection(srpcSection, Math.max(1, ...srpcSection.groups.map(g => g.maxUs), 1), false, srpcTotalHits, 0, latencyBands(srpcSection.groups))}
  {/if}

  <!-- DB Queries -->
  {#if dbQuerySection}
    <Card>
      <CardHeader>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <CardTitle class="text-base font-mono">{dbQuerySection.name}</CardTitle>
            <Badge variant="secondary" class="font-mono tabular-nums text-[0.7rem]">{dbQuerySection.groups.length} queries</Badge>
            <Badge variant="outline" class="font-mono tabular-nums text-[0.7rem]">{dbTotalHits} hits</Badge>
            {#if dbTotalDuration > 0}
              <Badge variant="outline" class="font-mono tabular-nums text-[0.7rem]">{formatTotalTime(dbTotalDuration)} total</Badge>
            {/if}
          </div>
          <div class="flex items-center gap-1">
            {@render bandPills(dbBands)}
          </div>
        </div>
      </CardHeader>
      <CardContent class="pt-0">
        {#if dbQuerySection.groups.length === 0}
          <p class="text-sm text-muted-foreground">No queries recorded</p>
        {:else}
          <div class="mb-5 relative h-8 bg-muted rounded-sm overflow-hidden">
            {#each dbQuerySection.groups as group}
              {@const pos = (group.avgLatencyUs / dbMaxUs) * 100}
              <div
                class="absolute top-0 h-full w-0.5 transition-all duration-500"
                style="left: {pos}%; background: {latencyColor(group.avgLatencyUs)}"
                title="{group.label}: {formatUs(group.avgLatencyUs)}"
              ></div>
              <div
                class="absolute top-1 w-2 h-2 rounded-full -translate-x-1 transition-all duration-500"
                style="left: {pos}%; background: {latencyColor(group.avgLatencyUs)}"
              ></div>
            {/each}
            <div class="absolute bottom-0 left-0 right-0 flex justify-between px-2 text-[0.625rem] text-muted-foreground font-mono">
              <span>0</span>
              <span>{formatUs(dbMaxUs / 2)}</span>
              <span>{formatUs(dbMaxUs)}</span>
            </div>
          </div>
          <div class="space-y-1">
            {#each dbQuerySection.groups as group, i}
              {@render histogramRow(group, dbMaxUs, false, `db-${i}`)}
            {/each}
          </div>
        {/if}
      </CardContent>
    </Card>
  {/if}
</div>

<!-- Snippets -->

{#snippet bandPills(bands: ReturnType<typeof latencyBands>)}
  {#if bands.sub1ms > 0}
    <Badge variant="success" class="font-mono text-[0.7rem]">&lt;1ms: {bands.sub1ms}</Badge>
  {/if}
  {#if bands.sub10ms > 0}
    <Badge variant="outline" class="font-mono text-[0.7rem]">1-10ms: {bands.sub10ms}</Badge>
  {/if}
  {#if bands.sub100ms > 0}
    <Badge variant="warning" class="font-mono text-[0.7rem]">10-100ms: {bands.sub100ms}</Badge>
  {/if}
  {#if bands.over100ms > 0}
    <Badge variant="destructive" class="font-mono text-[0.7rem]">&gt;100ms: {bands.over100ms}</Badge>
  {/if}
{/snippet}

{#snippet histogramSection(section: MetricSection, maxUs: number, isHttp: boolean, totalHits: number, totalDuration: number, bands: ReturnType<typeof latencyBands>)}
  <Card>
    <CardHeader>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <CardTitle class="text-base font-mono">{section.name}</CardTitle>
          <Badge variant="secondary" class="font-mono tabular-nums text-[0.7rem]">{section.groups.length} {isHttp ? 'endpoints' : 'methods'}</Badge>
          <Badge variant="outline" class="font-mono tabular-nums text-[0.7rem]">{totalHits} hits</Badge>
          {#if totalDuration > 0}
            <Badge variant="outline" class="font-mono tabular-nums text-[0.7rem]">{formatTotalTime(totalDuration)} total</Badge>
          {/if}
        </div>
        <div class="flex items-center gap-1">
          {@render bandPills(bands)}
        </div>
      </div>
    </CardHeader>
    <CardContent class="pt-0">
      {#if section.groups.length === 0}
        <p class="text-sm text-muted-foreground">No traffic recorded</p>
      {:else}
        <div class="space-y-1">
          {#each section.groups as group, i}
            {@render histogramRow(group, maxUs, isHttp, `${section.name}-${i}`)}
          {/each}
        </div>
      {/if}
    </CardContent>
  </Card>
{/snippet}

{#snippet histogramRow(group: HistogramGroup, maxUs: number, isHttp: boolean, key: string)}
  {@const pct = maxUs > 0 ? group.maxUs / maxUs : 0}
  {@const httpMatch = isHttp ? group.label.match(/^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s+(.+)$/) : null}
  {@const cv = estimateCV(group.buckets, group.avgLatencyUs)}
  {@const isOpen = expanded.has(key)}
  {@const bucketTotal = group.buckets.reduce((s, b) => s + b.count, 0)}
  <div class="border-b border-border/40 last:border-b-0 py-3 first:pt-0">
    <button
      class="w-full flex items-center justify-between gap-3 text-left group"
      onclick={() => group.buckets.length > 0 && toggleExpand(key)}
    >
      <div class="flex items-center gap-2 min-w-0">
        {#if group.buckets.length > 0}
          <ChevronRight class="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200 {isOpen ? 'rotate-90' : ''}" />
        {:else}
          <span class="w-3.5"></span>
        {/if}
        {#if httpMatch}
          <Badge variant="outline" class="shrink-0 font-mono text-[0.7rem] px-1.5">{httpMatch[1]}</Badge>
          <span class="font-mono text-sm truncate group-hover:text-primary transition-colors">{httpMatch[2]}</span>
        {:else}
          <span class="font-mono text-sm truncate group-hover:text-primary transition-colors">{group.label}</span>
        {/if}
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <Badge variant="secondary" class="font-mono tabular-nums text-[0.7rem]">{group.total} hits</Badge>
        <Badge variant={latencyVariant(group.avgLatencyUs)} class="font-mono tabular-nums">
          {formatUs(group.avgLatencyUs)}
        </Badge>
      </div>
    </button>

    <div class="mt-1.5 ml-5.5 h-1.5 rounded-full bg-muted overflow-hidden">
      <div
        class="h-full rounded-full transition-transform origin-left duration-700"
        style="background: {latencyColor(group.avgLatencyUs)}; transform: scaleX({pct})"
      ></div>
    </div>

    <div class="mt-1.5 ml-5.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted-foreground font-mono tabular-nums">
      <span>count {group.total}</span>
      <span class="text-border">|</span>
      <span>{formatOpsPerSec(group.avgLatencyUs)} ops/s</span>
      <span class="text-border">|</span>
      <span>total {formatTotalTime(group.durationSec)}</span>
      <span class="text-border">|</span>
      <span>min <span style="color: {latencyColor(group.minUs)}">{formatUs(group.minUs)}</span></span>
      <span class="text-border">|</span>
      <span>avg <span style="color: {latencyColor(group.avgLatencyUs)}">{formatUs(group.avgLatencyUs)}</span></span>
      <span class="text-border">|</span>
      <span>max <span style="color: {latencyColor(group.maxUs)}">{formatUs(group.maxUs)}</span></span>
      {#if cv > 0}
        <span class="text-border">|</span>
        <span>&beta; <Badge variant={betaVariant(cv)} class="font-mono text-[0.65rem] px-1 py-0">{cv.toFixed(2)}</Badge></span>
      {/if}
      {#if group.buckets.length > 0}
        <span class="text-border">|</span>
        <span>p50 {fmtPercentile(group.buckets, 50)}</span>
        <span>p95 {fmtPercentile(group.buckets, 95)}</span>
        <span>p99 {fmtPercentile(group.buckets, 99)}</span>
      {/if}
    </div>

    {#if isOpen && group.buckets.length > 0}
      <div class="mt-3 ml-5.5 space-y-1 border-l-2 border-border/50 pl-3">
        {#each group.buckets as bkt, bi}
          {@const bktPct = bucketTotal > 0 ? bkt.count / bucketTotal * 100 : 0}
          {@const cumCount = group.buckets.slice(0, bi + 1).reduce((s, b) => s + b.count, 0)}
          {@const cumPct = bucketTotal > 0 ? cumCount / bucketTotal * 100 : 0}
          <div class="flex items-center gap-2 text-sm font-mono tabular-nums {bi % 2 === 1 ? 'bg-muted/30' : ''} rounded-sm px-2 py-0.5">
            <span class="w-16 text-muted-foreground shrink-0">&le; {bkt.le}</span>
            <span class="w-10 text-right shrink-0">{bkt.count}</span>
            <span class="w-14 text-right text-muted-foreground shrink-0">{bktPct.toFixed(1)}%</span>
            <span class="w-14 text-right text-muted-foreground shrink-0">{cumPct.toFixed(1)}%</span>
            <div class="flex-1 h-3 rounded-sm bg-muted overflow-hidden">
              <div
                class="h-full rounded-sm transition-transform origin-left duration-500"
                style="background: {bucketBarColor(bkt.leUs)}; transform: scaleX({bktPct / 100})"
              ></div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
{/snippet}
