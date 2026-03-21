<script lang="ts">
  import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
  } from "$lib/components/ui/card";
  import { Badge } from "$lib/components/ui/badge";
  import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
  } from "$lib/components/ui/table";
  import { formatBytes } from "$lib/core/utils/format";
  import {
    parseMetrics,
    sv,
    ssv,
    latencyBands,
    sortGroups,
    formatUs,
    formatTotalTime,
    formatOpsPerSec,
    formatUptime,
    formatNs,
    estimateCV,
    fmtPercentile,
    latencyVariant,
    latencyColor,
    betaVariant,
    poolUtilColor,
    bucketBarColor,
    type MetricSection,
    type HistogramGroup,
    type SortCol,
    type SortDir,
  } from "$lib/core/utils/metrics";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import ChevronsDownUp from "@lucide/svelte/icons/chevrons-down-up";
  import ChevronsUpDown from "@lucide/svelte/icons/chevrons-up-down";
  import ArrowUp from "@lucide/svelte/icons/arrow-up";
  import ArrowDown from "@lucide/svelte/icons/arrow-down";

  let { raw }: { raw: string } = $props();

  let expanded = $state<Set<string>>(new Set());
  function toggleExpand(key: string) {
    const next = new Set(expanded);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    expanded = next;
  }

  type Layout = "histogram" | "table";
  type MetricMode = "latency" | "percentiles";

  // Sections rendered inside Overview (not as separate tabs)
  const overviewSections = new Set([
    'Overview', 'Runtime', 'DB Pool', 'Semaphore', 'TCP Connections',
    'Raft', 'MetaEngine Arena', 'MetaEngine Name Pool', 'MetaEngine Cache',
    'S3 Operations', 'RPC Operations', 'Cache', 'File Handles',
    'TCP Connection', 'TCP Events', 'System', 'Config',
  ])

  let activeTab = $state<string>("overview");
  let layout = $state<Layout>("table");
  let metricMode = $state<MetricMode>("latency");
  let sortCol = $state<SortCol>("avgLatencyUs");
  let sortDir = $state<SortDir>("desc");

  function expandAll(groups: HistogramGroup[], sectionKey: string) {
    const suffix = layout === "table" ? "-tbl-" : "-";
    const keys = groups
      .filter((g) => g.buckets.length > 0)
      .map((_, i) => `${sectionKey}${suffix}${i}`);
    const allExpanded = keys.every((k) => expanded.has(k));
    const next = new Set(expanded);
    for (const k of keys) allExpanded ? next.delete(k) : next.add(k);
    expanded = next;
  }

  function isAllExpanded(
    groups: HistogramGroup[],
    sectionKey: string,
  ): boolean {
    const suffix = layout === "table" ? "-tbl-" : "-";
    const keys = groups
      .filter((g) => g.buckets.length > 0)
      .map((_, i) => `${sectionKey}${suffix}${i}`);
    return keys.length > 0 && keys.every((k) => expanded.has(k));
  }

  function toggleSort(col: SortCol) {
    if (sortCol === col) sortDir = sortDir === "asc" ? "desc" : "asc";
    else {
      sortCol = col;
      sortDir = "desc";
    }
  }

  const byteKeys = new Set([
    'cache_size_bytes', 'cache_hit_bytes', 'cache_miss_bytes',
    'sys_mem_total', 'sys_mem_available',
  ])
  const idSuffixes = ['_port', '_id']

  const dateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  function fmtScalar(name: string, value: number | string): string {
    if (typeof value === 'string') {
      const d = Date.parse(value)
      if (!isNaN(d) && /^\d{4}-\d{2}-\d{2}/.test(value)) return dateFmt.format(d)
      return value
    }
    if (name.endsWith('_bytes') || byteKeys.has(name)) return formatBytes(value)
    if (name.endsWith('_pct')) return `${value}%`
    if (name.endsWith('_ratio')) return value.toFixed(4)
    if (name === 'pid' || name === 'view_mode' || idSuffixes.some(s => name.endsWith(s))) return String(value)
    return value.toLocaleString()
  }

  function numVal(sec: MetricSection, key: string): number {
    const e = sec.scalars.find(x => x.name === key)
    return typeof e?.value === 'number' ? e.value : 0
  }
  function strVal(sec: MetricSection, key: string): string {
    return String(sec.scalars.find(x => x.name === key)?.value ?? '')
  }

  const sections = $derived(parseMetrics(raw));

  const uptime = $derived(sv(sections, "Overview", "uptime_seconds"));
  const pid = $derived(sv(sections, "Overview", "pid"));
  const goroutines = $derived(sv(sections, "Runtime", "goroutines"));
  const memAlloc = $derived(sv(sections, "Runtime", "memory_alloc_bytes"));
  const memSys = $derived(sv(sections, "Runtime", "memory_sys_bytes"));
  const memHeap = $derived(sv(sections, "Runtime", "memory_heap_inuse_bytes"));
  const gcNum = $derived(sv(sections, "Runtime", "gc_num"));
  const gcPause = $derived(sv(sections, "Runtime", "gc_last_pause_ns"));
  const cpuCount = $derived(sv(sections, "Runtime", "cpu_count"));

  const dbDialect = $derived(ssv(sections, "DB Pool", "db_dialect"));
  const dbMaxOpen = $derived(sv(sections, "DB Pool", "db_max_open"));
  const dbOpen = $derived(sv(sections, "DB Pool", "db_open"));
  const dbInUse = $derived(sv(sections, "DB Pool", "db_in_use"));
  const dbIdle = $derived(sv(sections, "DB Pool", "db_idle"));
  const dbWaitCount = $derived(sv(sections, "DB Pool", "db_wait_count"));

  const memAllocPct = $derived(
    memSys > 0 ? Math.round((memAlloc / memSys) * 100) : 0,
  );
  const poolUtilPct = $derived(
    dbMaxOpen > 0 ? Math.round((dbOpen / dbMaxOpen) * 100) : 0,
  );

  const CIRC = 2 * Math.PI * 38;

  // Dynamic tabs: overview + one per histogram section
  const histogramSections = $derived(
    sections.filter(s => s.kind === 'histogram' && !overviewSections.has(s.name))
  )
  const tabs = $derived([
    { id: 'overview', label: 'Overview', count: 0 },
    ...histogramSections.map(s => ({
      id: s.name,
      label: s.name,
      count: s.groups.length,
    })),
  ])
</script>

<div class="space-y-5">
  <!-- Tab Bar -->
  {@render tabBar()}

  <!-- Tab Panels -->
  {#if activeTab === "overview"}
    <!-- Runtime Gauges — instrument panel -->
    <div class="">
      <div
        class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-px rounded-sm overflow-hidden bg-border/50"
      >
        <div class="gauge-cell bg-card px-4 py-3 corner-plus">
          <div class="gauge-lbl">Uptime</div>
          <div class="gauge-val">{formatUptime(uptime)}</div>
          <div class="gauge-sub">PID {pid}</div>
        </div>
        <div class="gauge-cell bg-card px-4 py-3 corner-plus">
          <div class="gauge-lbl">Goroutines</div>
          <div class="gauge-val">{goroutines}</div>
        </div>
        <div class="gauge-cell bg-card px-4 py-3 corner-plus">
          <div class="gauge-lbl">Heap Alloc</div>
          <div class="gauge-val">{formatBytes(memAlloc)}</div>
          <div class="gauge-sub">of {formatBytes(memSys)} sys</div>
        </div>
        <div class="gauge-cell bg-card px-4 py-3 corner-plus">
          <div class="gauge-lbl">GC Cycles</div>
          <div class="gauge-val">{gcNum}</div>
          <div class="gauge-sub">last {formatNs(gcPause)}</div>
        </div>
        <div class="gauge-cell bg-card px-4 py-3 corner-plus">
          <div class="gauge-lbl">CPU Cores</div>
          <div class="gauge-val">{cpuCount}</div>
        </div>
      </div>
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card cornerBrackets={false}>
        <CardHeader>
          <div class="flex items-center justify-between">
            <CardTitle class="text-base">Memory</CardTitle>
            <svg viewBox="0 0 100 100" class="w-12 h-12">
              <circle
                cx="50"
                cy="50"
                r="38"
                fill="none"
                stroke="var(--muted)"
                stroke-width="8"
              />
              <circle
                cx="50"
                cy="50"
                r="38"
                fill="none"
                stroke={poolUtilColor(memAllocPct)}
                stroke-width="8"
                stroke-dasharray="{(memAllocPct * CIRC) / 100} {CIRC}"
                stroke-dashoffset="0"
                transform="rotate(-90 50 50)"
                stroke-linecap="round"
              />
              <text
                x="50"
                y="50"
                text-anchor="middle"
                dominant-baseline="central"
                class="fill-foreground font-mono"
                style="font-size: 22px">{memAllocPct}%</text
              >
            </svg>
          </div>
        </CardHeader>
        <CardContent class="pt-0 space-y-3">
          {#each [{ label: "Allocated", value: memAlloc, color: "var(--success)" }, { label: "Heap In-Use", value: memHeap, color: "var(--primary)" }, { label: "System Total", value: memSys, color: "var(--chart-3)" }] as row}
            <div class="space-y-1">
              <div class="flex justify-between text-sm">
                <span class="text-muted-foreground">{row.label}</span>
                <span class="font-mono tabular-nums"
                  >{formatBytes(row.value)}</span
                >
              </div>
              <div class="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  class="h-full rounded-full transition-transform origin-left duration-700"
                  style="background: {row.color}; transform: scaleX({row.value /
                    memSys})"
                ></div>
              </div>
            </div>
          {/each}
        </CardContent>
      </Card>

      <Card cornerBrackets={false}>
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
                style="background: {i < dbInUse
                  ? 'var(--destructive)'
                  : i < dbOpen
                    ? 'var(--primary)'
                    : 'var(--muted)'};
                       border-color: {i < dbInUse
                  ? 'var(--destructive)'
                  : i < dbOpen
                    ? 'var(--primary)'
                    : 'var(--border)'};
                       opacity: {i < dbOpen ? 1 : 0.4}"
              ></div>
            {/each}
          </div>
          <div class="flex flex-wrap gap-x-5 gap-y-1 text-sm">
            <span class="flex items-center gap-1.5">
              <span
                class="inline-block w-3 h-3 rounded-sm"
                style="background: var(--destructive)"
              ></span>
              In use
              <span class="font-mono tabular-nums font-medium">{dbInUse}</span>
            </span>
            <span class="flex items-center gap-1.5">
              <span
                class="inline-block w-3 h-3 rounded-sm"
                style="background: var(--primary)"
              ></span>
              Idle
              <span class="font-mono tabular-nums font-medium">{dbIdle}</span>
            </span>
            <span class="flex items-center gap-1.5">
              <span
                class="inline-block w-3 h-3 rounded-sm border"
                style="background: var(--muted); opacity: 0.4"
              ></span>
              Free
              <span class="font-mono tabular-nums font-medium"
                >{dbMaxOpen - dbOpen}</span
              >
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
                style="background: {poolUtilColor(
                  poolUtilPct,
                )}; transform: scaleX({poolUtilPct / 100})"
              ></div>
            </div>
          </div>
          {#if dbWaitCount > 0}
            <div class="text-sm text-warning flex items-center gap-1.5">
              <span
                class="inline-block w-2 h-2 rounded-full bg-warning animate-pulse"
              ></span>
              {dbWaitCount} connection{dbWaitCount !== 1 ? "s" : ""} waiting
            </div>
          {/if}
        </CardContent>
      </Card>
    </div>
    <!-- System card (custom layout for load + memory) -->
    {@const sysSection = sections.find(s => s.name === 'System' && s.kind === 'scalar' && s.scalars.length > 0)}
    {#if sysSection}
      {@render systemCard(sysSection)}
    {/if}
    <!-- Extra scalar sections (TCP Connections, Raft, MetaEngine, Semaphore, etc.) -->
    {@const extraSections = sections.filter(s => s.kind === 'scalar' && !['Overview', 'Runtime', 'DB Pool', 'System'].includes(s.name) && s.scalars.length > 0)}
    {#if extraSections.length > 0}
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {#each extraSections as sec}
          {@render scalarCard(sec)}
        {/each}
      </div>
    {/if}
  {:else}
    {@const section = histogramSections.find(s => s.name === activeTab)}
    {#if section && section.groups.length > 0}
      {@const maxUs = Math.max(1, ...section.groups.map(g => g.maxUs))}
      {@const totalHits = section.groups.reduce((s, g) => s + g.total, 0)}
      {@const totalDuration = section.groups.reduce((s, g) => s + g.durationSec, 0)}
      {@const bands = latencyBands(section.groups)}
      {@const isHttp = section.name === 'HTTP Methods'}
      {@const isDb = section.name === 'DB Queries'}
      {#if isDb}
        {@render dbTab(section, maxUs, totalHits, totalDuration, bands)}
      {:else}
        {@render profileTab(section, maxUs, isHttp, totalHits, totalDuration, bands, section.name)}
      {/if}
    {:else}
      <Card cornerBrackets={false}><CardContent class="py-8 text-center text-sm text-muted-foreground">No data recorded</CardContent></Card>
    {/if}
  {/if}
</div>

<!-- Snippets -->

{#snippet tabBar()}
  <div
    class="tab-bar relative flex items-center gap-0.5 pb-3 pt-1"
    role="tablist"
    aria-label="Metrics"
  >
    {#each tabs as t}
      {@const c = t.count}
      <button
        role="tab"
        aria-selected={activeTab === t.id}
        class="tab-btn flex items-center gap-1.5 px-4 py-2 font-mono transition-colors
          {activeTab === t.id ? 'font-medium' : 'text-muted-foreground'}"
        onclick={() => (activeTab = t.id)}
      >
        {t.label}
        {#if c > 0}
          <span class="tabular-nums opacity-60">[{c}]</span>
        {/if}
      </button>
    {/each}
  </div>
{/snippet}

{#snippet toggleBar(groups: HistogramGroup[], sectionKey: string)}
  {@const allOpen = isAllExpanded(groups, sectionKey)}
  <div class="flex items-center gap-2">
    <div class="toggle-group flex items-center font-mono overflow-hidden">
      <button
        class="toggle-btn px-2.5 py-1 transition-colors {layout === 'histogram'
          ? 'toggle-active'
          : 'text-muted-foreground'}"
        onclick={() => (layout = "histogram")}>Histogram</button
      >
      <span class="text-border/40 select-none">&vert;</span>
      <button
        class="toggle-btn px-2.5 py-1 transition-colors {layout === 'table'
          ? 'toggle-active'
          : 'text-muted-foreground'}"
        onclick={() => (layout = "table")}>Table</button
      >
    </div>
    <div class="toggle-group flex items-center font-mono overflow-hidden">
      <button
        class="toggle-btn px-2.5 py-1 transition-colors {metricMode ===
        'latency'
          ? 'toggle-active'
          : 'text-muted-foreground'}"
        onclick={() => (metricMode = "latency")}>Latency</button
      >
      <span class="text-border/40 select-none">&vert;</span>
      <button
        class="toggle-btn px-2.5 py-1 transition-colors {metricMode ===
        'percentiles'
          ? 'toggle-active'
          : 'text-muted-foreground'}"
        onclick={() => (metricMode = "percentiles")}>Percentiles</button
      >
    </div>
    <button
      class="toggle-btn toggle-group flex items-center gap-1 px-2 py-1 font-mono transition-colors {allOpen
        ? 'toggle-active'
        : 'text-muted-foreground'}"
      onclick={() => expandAll(groups, sectionKey)}
      title="{allOpen ? 'Collapse' : 'Expand'} all buckets"
    >
      {#if allOpen}
        <ChevronsDownUp class="h-3 w-3" />
      {:else}
        <ChevronsUpDown class="h-3 w-3" />
      {/if}
    </button>
  </div>
{/snippet}

{#snippet profileTab(
  section: MetricSection,
  maxUs: number,
  isHttp: boolean,
  totalHits: number,
  totalDuration: number,
  bands: ReturnType<typeof latencyBands>,
  sectionKey: string,
)}
  <Card cornerBrackets={false}>
    <CardHeader>
      <div class="flex items-center justify-between flex-wrap gap-2">
        <div class="flex items-center gap-2">
          <CardTitle class="text-base font-mono">{section.name}</CardTitle>
          <Badge
            variant="secondary"
            class="font-mono tabular-nums text-[0.7rem]"
            >{section.groups.length} {isHttp ? "endpoints" : "methods"}</Badge
          >
          <Badge variant="outline" class="font-mono tabular-nums text-[0.7rem]"
            >{totalHits} hits</Badge
          >
          {#if totalDuration > 0}
            <Badge
              variant="outline"
              class="font-mono tabular-nums text-[0.7rem]"
              >{formatTotalTime(totalDuration)} total</Badge
            >
          {/if}
        </div>
        <div class="flex items-center gap-3">
          {@render bandPills(bands)}
          {@render toggleBar(section.groups, sectionKey)}
        </div>
      </div>
    </CardHeader>
    <CardContent class="pt-0">
      {#if section.groups.length === 0}
        <p class="text-sm text-muted-foreground">No traffic recorded</p>
      {:else if layout === "table"}
        {@render tableView(section.groups, maxUs, isHttp, sectionKey)}
      {:else}
        <div class="space-y-1">
          {#each section.groups as group, i}
            {@render histogramRow(group, maxUs, isHttp, `${sectionKey}-${i}`)}
          {/each}
        </div>
      {/if}
    </CardContent>
  </Card>
{/snippet}

{#snippet dbTab(section: MetricSection, maxUs: number, totalHits: number, totalDuration: number, bands: ReturnType<typeof latencyBands>)}
  <Card cornerBrackets={false}>
    <CardHeader>
      <div class="flex items-center justify-between flex-wrap gap-2">
        <div class="flex items-center gap-2">
          <CardTitle class="text-base font-mono">{section.name}</CardTitle>
          <Badge variant="secondary" class="font-mono tabular-nums text-[0.7rem]">{section.groups.length} queries</Badge>
          <Badge variant="outline" class="font-mono tabular-nums text-[0.7rem]">{totalHits} hits</Badge>
          {#if totalDuration > 0}
            <Badge variant="outline" class="font-mono tabular-nums text-[0.7rem]">{formatTotalTime(totalDuration)} total</Badge>
          {/if}
        </div>
        <div class="flex items-center gap-3">
          {@render bandPills(bands)}
          {@render toggleBar(section.groups, section.name)}
        </div>
      </div>
    </CardHeader>
    <CardContent class="pt-0">
      {#if section.groups.length === 0}
        <p class="text-sm text-muted-foreground">No queries recorded</p>
      {:else}
        <div class="mb-5 relative h-8 bg-muted rounded-sm overflow-hidden">
          {#each section.groups as group}
            {@const pos = (group.avgLatencyUs / maxUs) * 100}
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
            <span>{formatUs(maxUs / 2)}</span>
            <span>{formatUs(maxUs)}</span>
          </div>
        </div>
        {#if layout === 'table'}
          {@render tableView(section.groups, maxUs, false, section.name)}
        {:else}
          <div class="space-y-1">
            {#each section.groups as group, i}
              {@render histogramRow(group, maxUs, false, `${section.name}-${i}`)}
            {/each}
          </div>
        {/if}
      {/if}
    </CardContent>
  </Card>
{/snippet}

{#snippet scalarCard(sec: MetricSection)}
  <Card cornerBrackets={false}>
    <CardHeader>
      <CardTitle class="text-base font-mono">{sec.name}</CardTitle>
    </CardHeader>
    <CardContent class="pt-0">
      <div class="grid grid-cols-1 gap-y-1.5 text-sm font-mono">
        {#each sec.scalars as entry}
          <div class="flex justify-between gap-4">
            <span class="text-muted-foreground truncate scalar-label">{entry.name.replaceAll('_', ' ')}</span>
            <span class="tabular-nums font-medium shrink-0">{fmtScalar(entry.name, entry.value)}</span>
          </div>
        {/each}
      </div>
    </CardContent>
  </Card>
{/snippet}

{#snippet systemCard(sec: MetricSection)}
  {@const sysMemTotal = numVal(sec, 'sys_mem_total')}
  {@const sysMemAvail = numVal(sec, 'sys_mem_available')}
  {@const sysMemUsed = sysMemTotal - sysMemAvail}
  {@const memUsedPct = sysMemTotal > 0 ? Math.round((sysMemUsed / sysMemTotal) * 100) : 0}
  {@const load1 = numVal(sec, 'load_avg_1')}
  {@const load5 = numVal(sec, 'load_avg_5')}
  {@const load15 = numVal(sec, 'load_avg_15')}
  {@const cores = cpuCount > 0 ? cpuCount : 1}
  {@const osName = strVal(sec, 'os')}
  {@const kernel = strVal(sec, 'kernel')}
  {@const arch = strVal(sec, 'arch')}
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
    <Card cornerBrackets={false}>
      <CardHeader><CardTitle class="text-base font-mono">Platform</CardTitle></CardHeader>
      <CardContent class="pt-0 space-y-1.5 text-sm font-mono">
        <div class="flex justify-between gap-4">
          <span class="text-muted-foreground">OS</span>
          <span class="font-medium">{osName}</span>
        </div>
        <div class="flex justify-between gap-4">
          <span class="text-muted-foreground">Kernel</span>
          <span class="font-medium">{kernel}</span>
        </div>
        <div class="flex justify-between gap-4">
          <span class="text-muted-foreground">Arch</span>
          <span class="font-medium">{arch}</span>
        </div>
        <div class="flex justify-between gap-4">
          <span class="text-muted-foreground">Cores</span>
          <span class="font-medium">{cores}</span>
        </div>
      </CardContent>
    </Card>

    <Card cornerBrackets={false}>
      <CardHeader>
        <div class="flex items-center justify-between">
          <CardTitle class="text-base font-mono">Memory</CardTitle>
          <span class="font-mono tabular-nums text-sm" style="color: {memUsedPct > 85 ? 'var(--destructive)' : memUsedPct > 65 ? 'var(--warning)' : 'var(--success)'}">{memUsedPct}%</span>
        </div>
      </CardHeader>
      <CardContent class="pt-0 space-y-3">
        <div class="space-y-1">
          <div class="h-2.5 rounded-full bg-muted overflow-hidden">
            <div class="h-full rounded-full transition-transform origin-left duration-700"
              style="background: {memUsedPct > 85 ? 'var(--destructive)' : memUsedPct > 65 ? 'var(--warning)' : 'var(--success)'}; transform: scaleX({memUsedPct / 100})"
            ></div>
          </div>
        </div>
        <div class="flex flex-wrap gap-x-5 gap-y-1 text-sm font-mono">
          <span class="flex items-center gap-1.5">
            <span class="inline-block w-2.5 h-2.5 rounded-sm" style="background: {memUsedPct > 85 ? 'var(--destructive)' : memUsedPct > 65 ? 'var(--warning)' : 'var(--success)'}"></span>
            Used <span class="tabular-nums font-medium">{formatBytes(sysMemUsed)}</span>
          </span>
          <span class="flex items-center gap-1.5">
            <span class="inline-block w-2.5 h-2.5 rounded-sm bg-muted border"></span>
            Avail <span class="tabular-nums font-medium">{formatBytes(sysMemAvail)}</span>
          </span>
        </div>
        <div class="text-sm text-muted-foreground font-mono">
          Total <span class="tabular-nums">{formatBytes(sysMemTotal)}</span>
        </div>
      </CardContent>
    </Card>

    <Card cornerBrackets={false}>
      <CardHeader><CardTitle class="text-base font-mono">Load Average</CardTitle></CardHeader>
      <CardContent class="pt-0 space-y-3">
        {@render loadBar('1m', load1, cores)}
        {@render loadBar('5m', load5, cores)}
        {@render loadBar('15m', load15, cores)}
      </CardContent>
    </Card>
  </div>
{/snippet}

{#snippet loadBar(label: string, load: number, cores: number)}
  {@const ratio = cores > 0 ? load / cores : 0}
  {@const pct = Math.min(ratio * 100, 100)}
  {@const color = ratio > 1.0 ? 'var(--destructive)' : ratio > 0.7 ? 'var(--warning)' : 'var(--success)'}
  <div class="space-y-1">
    <div class="flex justify-between text-sm font-mono">
      <span class="text-muted-foreground">{label}</span>
      <span class="tabular-nums font-medium" style="color: {color}">{load.toFixed(2)}</span>
    </div>
    <div class="h-2 rounded-full bg-muted overflow-hidden">
      <div class="h-full rounded-full transition-transform origin-left duration-700"
        style="background: {color}; transform: scaleX({pct / 100})"
      ></div>
    </div>
  </div>
{/snippet}

{#snippet tableView(
  groups: HistogramGroup[],
  maxUs: number,
  isHttp: boolean,
  sectionKey: string,
)}
  {@const sorted = sortGroups(groups, sortCol, sortDir)}
  <div class="overflow-x-auto">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead class="th-cyber w-6"></TableHead>
          {@render sortableHead("label", isHttp ? "Method" : "Query")}
          {@render sortableHead("total", "Count")}
          {@render sortableHead("opsPerSec", "Ops/s")}
          {@render sortableHead("durationSec", "Total")}
          {@render sortableHead("avgLatencyUs", "Avg")}
          {@render sortableHead("cv", "\u03B2")}
          {#if metricMode === "latency"}
            {@render sortableHead("minUs", "Min")}
            {@render sortableHead("maxUs", "Max")}
          {:else}
            {@render sortableHead("p50", "p50")}
            {@render sortableHead("p95", "p95")}
            {@render sortableHead("p99", "p99")}
          {/if}
        </TableRow>
      </TableHeader>
      <TableBody>
        {#each sorted as group, i}
          {@const key = `${sectionKey}-tbl-${i}`}
          {@const isOpen = expanded.has(key)}
          {@const cv = estimateCV(group.buckets, group.avgLatencyUs)}
          {@const httpMatch = isHttp
            ? group.label.match(
                /^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s+(.+)$/,
              )
            : null}
          <TableRow
            class="cursor-pointer hover:bg-muted/50 transition-colors {isOpen
              ? 'bg-muted/30'
              : ''}"
            onclick={() => group.buckets.length > 0 && toggleExpand(key)}
          >
            <TableCell class="w-6 px-1">
              {#if group.buckets.length > 0}
                <ChevronRight
                  class="h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 {isOpen
                    ? 'rotate-90'
                    : ''}"
                />
              {/if}
            </TableCell>
            <TableCell class="font-mono text-sm">
              {#if httpMatch}
                <Badge
                  variant="outline"
                  class="font-mono text-[0.7rem] px-1.5 mr-1.5"
                  >{httpMatch[1]}</Badge
                ><span class="truncate">{httpMatch[2]}</span>
              {:else}
                <span class="truncate">{group.label}</span>
              {/if}
            </TableCell>
            <TableCell class="font-mono tabular-nums text-sm text-right"
              >{group.total}</TableCell
            >
            <TableCell class="font-mono tabular-nums text-sm text-right"
              >{formatOpsPerSec(group.avgLatencyUs)}</TableCell
            >
            <TableCell class="font-mono tabular-nums text-sm text-right"
              >{formatTotalTime(group.durationSec)}</TableCell
            >
            <TableCell class="font-mono tabular-nums text-sm text-right">
              <span style="color: {latencyColor(group.avgLatencyUs)}"
                >{formatUs(group.avgLatencyUs)}</span
              >
            </TableCell>
            <TableCell class="text-right">
              {#if cv > 0}
                <Badge
                  variant={betaVariant(cv)}
                  class="font-mono text-[0.65rem] px-1 py-0"
                  >{cv.toFixed(2)}</Badge
                >
              {/if}
            </TableCell>
            {#if metricMode === "latency"}
              <TableCell class="font-mono tabular-nums text-sm text-right">
                <span style="color: {latencyColor(group.minUs)}"
                  >{formatUs(group.minUs)}</span
                >
              </TableCell>
              <TableCell class="font-mono tabular-nums text-sm text-right">
                <span style="color: {latencyColor(group.maxUs)}"
                  >{formatUs(group.maxUs)}</span
                >
              </TableCell>
            {:else}
              <TableCell class="font-mono tabular-nums text-sm text-right"
                >{fmtPercentile(group.buckets, 50)}</TableCell
              >
              <TableCell class="font-mono tabular-nums text-sm text-right"
                >{fmtPercentile(group.buckets, 95)}</TableCell
              >
              <TableCell class="font-mono tabular-nums text-sm text-right"
                >{fmtPercentile(group.buckets, 99)}</TableCell
              >
            {/if}
          </TableRow>
          {#if isOpen && group.buckets.length > 0}
            {@const bucketTotal = group.buckets.reduce(
              (s, b) => s + b.count,
              0,
            )}
            <TableRow>
              <TableCell
                colspan={metricMode === "latency" ? 9 : 10}
                class="p-0"
              >
                <div
                  class="py-2 px-4 space-y-1 border-l-2 border-border/50 ml-4"
                >
                  {#each group.buckets as bkt, bi}
                    {@const bktPct =
                      bucketTotal > 0 ? (bkt.count / bucketTotal) * 100 : 0}
                    {@const cumCount = group.buckets
                      .slice(0, bi + 1)
                      .reduce((s, b) => s + b.count, 0)}
                    {@const cumPct =
                      bucketTotal > 0 ? (cumCount / bucketTotal) * 100 : 0}
                    <div
                      class="flex items-center gap-2 text-sm font-mono tabular-nums {bi %
                        2 ===
                      1
                        ? 'bg-muted/30'
                        : ''} rounded-sm px-2 py-0.5"
                    >
                      <span class="w-16 text-muted-foreground shrink-0"
                        >&le; {bkt.le}</span
                      >
                      <span class="w-10 text-right shrink-0">{bkt.count}</span>
                      <span
                        class="w-14 text-right text-muted-foreground shrink-0"
                        >{bktPct.toFixed(1)}%</span
                      >
                      <span
                        class="w-14 text-right text-muted-foreground shrink-0"
                        >{cumPct.toFixed(1)}%</span
                      >
                      <div
                        class="flex-1 h-3 rounded-sm bg-muted overflow-hidden"
                      >
                        <div
                          class="h-full rounded-sm transition-transform origin-left duration-500"
                          style="background: {bucketBarColor(
                            bkt.leUs,
                          )}; transform: scaleX({bktPct / 100})"
                        ></div>
                      </div>
                    </div>
                  {/each}
                </div>
              </TableCell>
            </TableRow>
          {/if}
        {/each}
      </TableBody>
    </Table>
  </div>
{/snippet}

{#snippet sortableHead(col: SortCol, label: string)}
  <TableHead
    class="th-cyber cursor-pointer select-none"
    onclick={() => toggleSort(col)}
  >
    <div class="flex items-center gap-1 {col !== 'label' ? 'justify-end' : ''}">
      <span>{label}</span>
      {#if sortCol === col}
        {#if sortDir === "asc"}
          <ArrowUp class="h-3 w-3" />
        {:else}
          <ArrowDown class="h-3 w-3" />
        {/if}
      {/if}
    </div>
  </TableHead>
{/snippet}

{#snippet bandPills(bands: ReturnType<typeof latencyBands>)}
  {#if bands.sub1ms > 0}
    <Badge variant="success" class="font-mono text-[0.7rem]"
      >&lt;1ms: {bands.sub1ms}</Badge
    >
  {/if}
  {#if bands.sub10ms > 0}
    <Badge variant="outline" class="font-mono text-[0.7rem]"
      >1-10ms: {bands.sub10ms}</Badge
    >
  {/if}
  {#if bands.sub100ms > 0}
    <Badge variant="warning" class="font-mono text-[0.7rem]"
      >10-100ms: {bands.sub100ms}</Badge
    >
  {/if}
  {#if bands.over100ms > 0}
    <Badge variant="destructive" class="font-mono text-[0.7rem]"
      >&gt;100ms: {bands.over100ms}</Badge
    >
  {/if}
{/snippet}

{#snippet histogramRow(
  group: HistogramGroup,
  maxUs: number,
  isHttp: boolean,
  key: string,
)}
  {@const pct = maxUs > 0 ? group.maxUs / maxUs : 0}
  {@const httpMatch = isHttp
    ? group.label.match(/^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s+(.+)$/)
    : null}
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
          <ChevronRight
            class="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200 {isOpen
              ? 'rotate-90'
              : ''}"
          />
        {:else}
          <span class="w-3.5"></span>
        {/if}
        {#if httpMatch}
          <Badge
            variant="outline"
            class="shrink-0 font-mono text-[0.7rem] px-1.5"
            >{httpMatch[1]}</Badge
          >
          <span
            class="font-mono text-sm truncate group-hover:text-primary transition-colors"
            >{httpMatch[2]}</span
          >
        {:else}
          <span
            class="font-mono text-sm truncate group-hover:text-primary transition-colors"
            >{group.label}</span
          >
        {/if}
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <Badge variant="secondary" class="font-mono tabular-nums text-[0.7rem]"
          >{group.total} hits</Badge
        >
        <Badge
          variant={latencyVariant(group.avgLatencyUs)}
          class="font-mono tabular-nums"
        >
          {formatUs(group.avgLatencyUs)}
        </Badge>
      </div>
    </button>

    <div class="mt-1.5 ml-5.5 h-1.5 rounded-full bg-muted overflow-hidden">
      <div
        class="h-full rounded-full transition-transform origin-left duration-700"
        style="background: {latencyColor(
          group.avgLatencyUs,
        )}; transform: scaleX({pct})"
      ></div>
    </div>

    <div
      class="mt-1.5 ml-5.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted-foreground font-mono tabular-nums"
    >
      <span>count {group.total}</span>
      <span class="text-border">|</span>
      <span>{formatOpsPerSec(group.avgLatencyUs)} ops/s</span>
      <span class="text-border">|</span>
      <span>total {formatTotalTime(group.durationSec)}</span>
      <span class="text-border">|</span>
      {#if metricMode === "latency"}
        <span
          >min <span style="color: {latencyColor(group.minUs)}"
            >{formatUs(group.minUs)}</span
          ></span
        >
        <span class="text-border">|</span>
        <span
          >avg <span style="color: {latencyColor(group.avgLatencyUs)}"
            >{formatUs(group.avgLatencyUs)}</span
          ></span
        >
        <span class="text-border">|</span>
        <span
          >max <span style="color: {latencyColor(group.maxUs)}"
            >{formatUs(group.maxUs)}</span
          ></span
        >
      {:else}
        <span
          >avg <span style="color: {latencyColor(group.avgLatencyUs)}"
            >{formatUs(group.avgLatencyUs)}</span
          ></span
        >
      {/if}
      {#if cv > 0}
        <span class="text-border">|</span>
        <span
          >&beta; <Badge
            variant={betaVariant(cv)}
            class="font-mono text-[0.65rem] px-1 py-0">{cv.toFixed(2)}</Badge
          ></span
        >
      {/if}
      {#if metricMode === "percentiles" && group.buckets.length > 0}
        <span class="text-border">|</span>
        <span>p50 {fmtPercentile(group.buckets, 50)}</span>
        <span>p95 {fmtPercentile(group.buckets, 95)}</span>
        <span>p99 {fmtPercentile(group.buckets, 99)}</span>
      {/if}
    </div>

    {#if isOpen && group.buckets.length > 0}
      <div class="mt-3 ml-5.5 space-y-1 border-l-2 border-border/50 pl-3">
        {#each group.buckets as bkt, bi}
          {@const bktPct =
            bucketTotal > 0 ? (bkt.count / bucketTotal) * 100 : 0}
          {@const cumCount = group.buckets
            .slice(0, bi + 1)
            .reduce((s, b) => s + b.count, 0)}
          {@const cumPct = bucketTotal > 0 ? (cumCount / bucketTotal) * 100 : 0}
          <div
            class="flex items-center gap-2 text-sm font-mono tabular-nums {bi %
              2 ===
            1
              ? 'bg-muted/30'
              : ''} rounded-sm px-2 py-0.5"
          >
            <span class="w-16 text-muted-foreground shrink-0"
              >&le; {bkt.le}</span
            >
            <span class="w-10 text-right shrink-0">{bkt.count}</span>
            <span class="w-14 text-right text-muted-foreground shrink-0"
              >{bktPct.toFixed(1)}%</span
            >
            <span class="w-14 text-right text-muted-foreground shrink-0"
              >{cumPct.toFixed(1)}%</span
            >
            <div class="flex-1 h-3 rounded-sm bg-muted overflow-hidden">
              <div
                class="h-full rounded-sm transition-transform origin-left duration-500"
                style="background: {bucketBarColor(
                  bkt.leUs,
                )}; transform: scaleX({bktPct / 100})"
              ></div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
{/snippet}

<style>
  /* Tab bar — scan-line border + corner brackets */
  .tab-bar::before {
    content: "";
    position: absolute;
    inset: -2px;
    background:
      linear-gradient(to right, currentColor 12px, transparent 12px) 0 0 / 12px
        1.5px,
      linear-gradient(to bottom, currentColor 12px, transparent 12px) 0 0 /
        1.5px 12px,
      linear-gradient(to left, currentColor 12px, transparent 12px) 100% 100% /
        12px 1.5px,
      linear-gradient(to top, currentColor 12px, transparent 12px) 100% 100% /
        1.5px 12px;
    background-repeat: no-repeat;
    color: oklch(0.4 0.002 200 / 0.5);
    pointer-events: none;
  }

  .tab-bar::after {
    content: "";
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent,
      oklch(0.4 0.08 200) 15%,
      oklch(0.4 0.08 200) 85%,
      transparent
    );
  }

  :global(.dark) .tab-bar::before {
    color: oklch(0.35 0.002 200 / 0.5);
  }

  :global(.dark) .tab-bar::after {
    background: linear-gradient(
      90deg,
      transparent,
      oklch(0.5 0.08 200) 15%,
      oklch(0.5 0.08 200) 85%,
      transparent
    );
  }

  /* Tab buttons — skewed corners + scan-line underline */
  .tab-btn {
    position: relative;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    font-size: 0.7rem;
    clip-path: polygon(
      0 5px,
      5px 0,
      100% 0,
      100% calc(100% - 5px),
      calc(100% - 5px) 100%,
      0 100%
    );
  }

  .tab-btn::after {
    content: "";
    position: absolute;
    bottom: 0;
    left: 10%;
    width: 80%;
    height: 1.5px;
    background: linear-gradient(
      90deg,
      transparent,
      oklch(0.45 0.08 200),
      transparent
    );
    transform: scaleX(0);
    transform-origin: center;
    transition: transform 0.35s ease;
  }

  .tab-btn:hover::after {
    transform: scaleX(1);
  }

  .tab-btn[aria-selected="true"] {
    color: var(--foreground);
    background: var(--accent);
  }

  .tab-btn[aria-selected="true"]::after {
    transform: scaleX(1);
    background: linear-gradient(
      90deg,
      transparent,
      oklch(0.65 0.18 45),
      transparent
    );
  }

  :global(.dark) .tab-btn::after {
    background: linear-gradient(
      90deg,
      transparent,
      oklch(0.55 0.08 200),
      transparent
    );
  }

  :global(.dark) .tab-btn[aria-selected="true"] {
    background: var(--accent);
  }

  :global(.dark) .tab-btn[aria-selected="true"]::after {
    background: linear-gradient(
      90deg,
      transparent,
      oklch(0.78 0.13 92),
      transparent
    );
  }

  /* Toggle groups — skewed micro-cuts */
  .toggle-group {
    clip-path: polygon(
      0 3px,
      3px 0,
      100% 0,
      100% calc(100% - 3px),
      calc(100% - 3px) 100%,
      0 100%
    );
    background: oklch(0.4 0.002 200 / 0.06);
  }

  .toggle-btn {
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 0.6rem;
  }

  .toggle-active {
    color: var(--foreground);
    background: oklch(0.45 0.08 200 / 0.12);
  }

  :global(.dark) .toggle-group {
    background: oklch(0.35 0.002 200 / 0.12);
  }

  :global(.dark) .toggle-active {
    background: oklch(0.5 0.08 200 / 0.15);
  }

  .gauge-cell {
    transition: background-color 0.25s ease;
  }

  .gauge-cell:hover {
    background: var(--accent);
  }

  .gauge-lbl {
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace;
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.15em;
    color: var(--muted-foreground);
  }

  .gauge-val {
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace;
    font-size: 1.5rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    margin-top: 2px;
  }

  .gauge-sub {
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace;
    font-size: 0.8rem;
    color: var(--muted-foreground);
  }

  .scalar-label {
    text-transform: capitalize;
  }
</style>
