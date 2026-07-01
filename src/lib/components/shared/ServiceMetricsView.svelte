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
    interpolatePercentile,
    latencyVariant,
    latencyColor,
    cvVariant,
    poolUtilColor,
    bucketBarColor,
    type MetricSection,
    type HistogramGroup,
    type SortCol,
    type SortDir,
  } from "$lib/core/utils/metrics";
  import InfoTip from "$lib/components/shared/InfoTip.svelte";
  import BlockservStats from "$lib/components/shared/BlockservStats.svelte";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import ChevronsDownUp from "@lucide/svelte/icons/chevrons-down-up";
  import ChevronsUpDown from "@lucide/svelte/icons/chevrons-up-down";
  import ArrowUp from "@lucide/svelte/icons/arrow-up";
  import ArrowDown from "@lucide/svelte/icons/arrow-down";

  import type { Snippet } from 'svelte';

  let { raw, alertsTab, alertsCount = 0, activityTab }: {
    raw: string;
    alertsTab?: Snippet;
    alertsCount?: number;
    activityTab?: Snippet;
  } = $props();

  let expanded = $state<Set<string>>(new Set());
  function toggleExpand(key: string) {
    const next = new Set(expanded);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    expanded = next;
  }

  type Layout = "histogram" | "table";
  type MetricMode = "minMax" | "percentiles";

  // Sections rendered inside Overview (not as separate tabs)
  const overviewSections = new Set([
    'Overview', 'Runtime', 'DB Pool', 'Semaphore', 'TCP Connections',
    'Raft', 'MetaEngine Arena', 'MetaEngine Name Pool', 'MetaEngine Cache',
    'Object Operations', 'RPC Operations', 'Cache', 'File Handles',
    'TCP Connection', 'TCP Events', 'System', 'Config',
  ])

  let activeTab = $state<string>("overview");
  let layout = $state<Layout>("table");
  let metricMode = $state<MetricMode>("percentiles");
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

  let lastParsedRaw = '';
  let lastParsedSections: MetricSection[] = [];
  const sections = $derived.by(() => {
    if (raw === lastParsedRaw) return lastParsedSections;
    lastParsedRaw = raw;
    lastParsedSections = parseMetrics(raw);
    return lastParsedSections;
  });

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

  // MetaEngine Arena (mmap'd, not GC-managed)
  // region_size_bytes = total mmap allocation (static), region_used_bytes = bump allocator pos (frozen after init)
  // Actual live usage: slot_occupied / slot_capacity (occupancy_pct)
  const arenaSection = $derived(sections.find(s => s.name === 'MetaEngine Arena' && s.kind === 'scalar'));
  const arenaShards = $derived(arenaSection ? numVal(arenaSection, 'shards') : 0);
  const slotCapacity = $derived(arenaSection ? numVal(arenaSection, 'slot_capacity') : 0);
  const slotOccupied = $derived(arenaSection ? numVal(arenaSection, 'slot_occupied') : 0);
  const occupancyPct = $derived(slotCapacity > 0 ? Math.round((slotOccupied / slotCapacity) * 100) : 0);
  const regionSize = $derived(arenaSection ? numVal(arenaSection, 'region_size_bytes') : 0);
  const evictCount = $derived(arenaSection ? numVal(arenaSection, 'evict_count') : 0);

  // MetaEngine Name Pool
  const poolSection = $derived(sections.find(s => s.name === 'MetaEngine Name Pool' && s.kind === 'scalar'));
  const namepoolUsed = $derived(poolSection ? numVal(poolSection, 'namepool_used_bytes') : 0);
  const namepoolCap = $derived(poolSection ? numVal(poolSection, 'namepool_cap_bytes') : 0);

  // MetaEngine Cache
  const cacheSection = $derived(sections.find(s => s.name === 'MetaEngine Cache' && s.kind === 'scalar'));
  const lookupHits = $derived(cacheSection ? numVal(cacheSection, 'lookup_hits') : 0);
  const lookupMisses = $derived(cacheSection ? numVal(cacheSection, 'lookup_misses') : 0);
  const statHits = $derived(cacheSection ? numVal(cacheSection, 'stat_hits') : 0);
  const statMisses = $derived(cacheSection ? numVal(cacheSection, 'stat_misses') : 0);
  const cacheHitRatio = $derived(cacheSection ? numVal(cacheSection, 'hit_ratio') : 0);
  const readdirCount = $derived(cacheSection ? numVal(cacheSection, 'readdir_count') : 0);
  const upsertCount = $derived(cacheSection ? numVal(cacheSection, 'upsert_count') : 0);
  const removeCount = $derived(cacheSection ? numVal(cacheSection, 'remove_count') : 0);

  const hasArena = $derived(arenaSection != null && slotCapacity > 0);
  const totalProcess = $derived(memSys + regionSize);
  const cacheTotal = $derived(lookupHits + lookupMisses + statHits + statMisses);
  const hitColor = $derived(cacheTotal === 0 ? 'var(--muted-foreground)' : cacheHitRatio > 0.9 ? 'var(--success)' : cacheHitRatio > 0.7 ? 'var(--warning)' : 'var(--destructive)');

  function loadColor(load: number, cores: number): string {
    const ratio = cores > 0 ? load / cores : 0;
    return ratio > 1.25 ? 'var(--destructive)' : ratio > 1.0 ? 'var(--warning)' : 'var(--success)';
  }

  function fmtNum(n: number): string { return n.toLocaleString() }
  function fmtRatio(n: number): string { return `${(n * 100).toFixed(1)}%` }

  // Raft quorum: 3 instances is ideal; fewer warns, more is over-provisioned.
  const RAFT_NODES_IDEAL = 3;
  function raftNodesColor(n: number): string {
    if (n === RAFT_NODES_IDEAL) return 'var(--success)';
    return n < RAFT_NODES_IDEAL ? 'var(--warning)' : 'var(--destructive)';
  }

  // Sections rendered inline in the new Process/System cards
  const inlineSections = new Set([
    'Overview', 'Runtime', 'DB Pool', 'System',
    'MetaEngine Arena', 'MetaEngine Name Pool', 'MetaEngine Cache',
  ]);

  // blockserv data-plane sections get a dedicated, severity-aware card instead of the
  // generic scalar cards, so they are excluded from extraSections below.
  const blockSections = new Set([
    'Block Cache', 'S3 Floor Latency', 'Sync Backlog', 'Storage Capacity', 'HA State',
  ]);
  const hasBlockStats = $derived(sections.some((s) => blockSections.has(s.name)));

  // Dynamic tabs: overview + one per histogram section
  const histogramSections = $derived(
    sections.filter(s => s.kind === 'histogram' && !overviewSections.has(s.name))
  )
  const tabs = $derived([
    { id: 'overview', label: 'Overview', count: 0, uiId: 'overview' },
    ...histogramSections.map(s => ({
      id: s.name,
      label: s.name,
      count: s.groups.length,
      uiId: s.name.toLowerCase().replace(/\s+/g, '-'),
    })),
    ...(alertsTab ? [{ id: 'alerts', label: 'Alerts', count: alertsCount, uiId: 'alerts' }] : []),
    ...(activityTab ? [{ id: 'activity', label: 'Activity Log', count: 0, uiId: 'activity' }] : []),
  ])
</script>

<div class="space-y-5">
  <!-- Tab Bar -->
  {@render tabBar()}

  <!-- Tab Panels -->
  {#if activeTab === "overview"}
    {@const extraSections = sections.filter(s => s.kind === 'scalar' && !inlineSections.has(s.name) && !blockSections.has(s.name) && s.scalars.length > 0)}
    {@const sysSection = sections.find(s => s.name === 'System' && s.kind === 'scalar' && s.scalars.length > 0)}
    <div role="tabpanel" id="panel-overview" aria-labelledby="tab-overview">
    <!-- Runtime Gauges; instrument panel -->
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
          <div class="gauge-sub">of {formatBytes(memSys)} sys{#if hasArena}{' '}+ {formatBytes(regionSize)} arena{/if}</div>
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
      <!-- Process Card -->
      <Card cornerBrackets={false}>
        <CardHeader>
          <div class="flex items-center justify-between">
            <CardTitle class="text-base">Process</CardTitle>
            <div class="flex items-center gap-2">
              {#if hasArena}
                <Badge variant="outline" class="font-mono">{formatBytes(totalProcess)} total</Badge>
              {/if}
              {#if dbDialect}
                <Badge variant="outline" class="font-mono">{dbDialect}</Badge>
              {/if}
            </div>
          </div>
        </CardHeader>
        <CardContent class="pt-0 space-y-4">
          <!-- Ring gauges -->
          <div class="flex items-start gap-3 justify-around">
            {@render ringGauge(memAllocPct, 'Go Heap', poolUtilColor(memAllocPct), formatBytes(memAlloc), 'var(--chart-3)')}
            {#if hasArena}
              {@render ringGauge(occupancyPct, 'Arena', poolUtilColor(occupancyPct), formatBytes(regionSize), 'var(--pastel-volume)')}
            {/if}
            {#if dbMaxOpen > 0}
              {@render ringGauge(poolUtilPct, 'DB Pool', poolUtilColor(poolUtilPct), `${dbOpen}/${dbMaxOpen}`, 'var(--muted)')}
            {/if}
          </div>
          <!-- Go memory breakdown -->
          <div class="space-y-1.5">
            <div class="text-sm font-mono text-muted-foreground tracking-wider uppercase">Go Runtime</div>
            {#each [
              { label: 'Alloc', value: memAlloc, ratio: memAlloc / memSys, color: 'var(--success)' },
              { label: 'Heap', value: memHeap, ratio: memHeap / memSys, color: 'var(--primary)' },
              { label: 'Sys', value: memSys, ratio: 1, color: 'var(--chart-3)' },
            ] as row}
              <div class="flex items-center gap-2 text-sm font-mono">
                <span class="text-muted-foreground w-12 shrink-0">{row.label}</span>
                <div class="flex-1 h-1 rounded-sm bg-muted overflow-hidden">
                  <div class="h-full rounded-sm transition-transform origin-left duration-700"
                    style="background: {row.color}; transform: scaleX({row.ratio})"></div>
                </div>
                <span class="tabular-nums w-24 text-right shrink-0">{formatBytes(row.value)}</span>
              </div>
            {/each}
          </div>
          <!-- Arena breakdown -->
          {#if hasArena}
            <div class="space-y-1.5">
              <div class="flex items-center justify-between">
                <div class="text-sm font-mono text-muted-foreground tracking-wider uppercase">
                  Arena <span class="normal-case tracking-normal">({arenaShards} shards, {fmtNum(slotCapacity)} slots)</span>
                </div>
                {#if evictCount > 0}
                  <span class="text-sm font-mono text-warning">{fmtNum(evictCount)} evictions</span>
                {/if}
              </div>
              <div class="flex items-center gap-2 text-sm font-mono">
                <span class="text-muted-foreground w-12 shrink-0">Slots</span>
                <div class="flex-1 h-1 rounded-sm bg-muted overflow-hidden">
                  <div class="h-full rounded-sm transition-transform origin-left duration-700"
                    style="background: var(--pastel-volume); transform: scaleX({slotOccupied / slotCapacity})"></div>
                </div>
                <span class="tabular-nums w-24 text-right shrink-0">{fmtNum(slotOccupied)}</span>
              </div>
              {#if namepoolCap > 0}
                <div class="flex items-center gap-2 text-sm font-mono">
                  <span class="text-muted-foreground w-12 shrink-0">Pool</span>
                  <div class="flex-1 h-1 rounded-sm bg-muted overflow-hidden">
                    <div class="h-full rounded-sm transition-transform origin-left duration-700"
                      style="background: var(--pastel-volume); opacity: 0.6; transform: scaleX({namepoolUsed / namepoolCap})"></div>
                  </div>
                  <span class="tabular-nums w-24 text-right shrink-0">{formatBytes(namepoolUsed)}</span>
                </div>
              {/if}
            </div>
          {/if}
          <!-- DB Pool breakdown -->
          {#if dbMaxOpen > 0}
            <div class="space-y-1.5">
              <div class="text-sm font-mono text-muted-foreground tracking-wider uppercase">DB Connections</div>
              <div class="flex flex-wrap gap-x-3 gap-y-0.5 text-sm font-mono text-muted-foreground">
                <span class="flex items-center gap-1">
                  <span class="w-1.5 h-1.5 rounded-sm" style="background: var(--destructive)"></span>
                  Active {dbInUse}
                </span>
                <span class="flex items-center gap-1">
                  <span class="w-1.5 h-1.5 rounded-sm" style="background: var(--primary)"></span>
                  Idle {dbIdle}
                </span>
                <span class="flex items-center gap-1">
                  <span class="w-1.5 h-1.5 rounded-sm bg-muted border" style="opacity: 0.4"></span>
                  Free {dbMaxOpen - dbOpen}
                </span>
                {#if dbWaitCount > 0}
                  <span class="text-warning flex items-center gap-1">
                    <span class="w-1.5 h-1.5 rounded-full bg-warning animate-pulse"></span>
                    {dbWaitCount} waiting
                  </span>
                {/if}
              </div>
            </div>
          {/if}
        </CardContent>
      </Card>
      {#if sysSection}
        {@render systemCard(sysSection)}
      {/if}
    </div>
    {#if hasBlockStats}
      <BlockservStats {sections} />
    {/if}
    <!-- Extra scalar sections (TCP Connections, Raft, Semaphore, etc.) -->
    {#if extraSections.length > 0}
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {#each extraSections as sec}
          {@render scalarCard(sec)}
        {/each}
      </div>
    {/if}
    </div>
  {:else if activeTab !== 'alerts'}
    {@const section = histogramSections.find(s => s.name === activeTab)}
    {@const activeTabObj = tabs.find(t => t.id === activeTab)}
    <div role="tabpanel" id="panel-{activeTabObj?.uiId}" aria-labelledby="tab-{activeTabObj?.uiId}">
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
    </div>
  {/if}

  {#if activeTab === 'alerts' && alertsTab}
    <div role="tabpanel" id="panel-alerts" aria-labelledby="tab-alerts">
      {@render alertsTab()}
    </div>
  {/if}

  {#if activeTab === 'activity' && activityTab}
    <div role="tabpanel" id="panel-activity" aria-labelledby="tab-activity">
      {@render activityTab()}
    </div>
  {/if}
</div>

<!-- Snippets -->

{#snippet tabBar()}
  <div
    class="tab-bar relative flex items-center gap-0.5 pb-3 pt-1 overflow-x-auto"
    role="tablist"
    aria-label="Metrics"
  >
    {#each tabs as t}
      {@const c = t.count}
      <button
        role="tab"
        id="tab-{t.uiId}"
        aria-selected={activeTab === t.id}
        aria-controls="panel-{t.uiId}"
        class="tab-btn flex items-center gap-1.5 px-4 py-2 transition-colors
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
    <div class="toggle-group flex items-center overflow-hidden" role="group" aria-label="Layout">
      <button
        class="toggle-btn px-2.5 py-1 transition-colors {layout === 'histogram'
          ? 'toggle-active'
          : 'text-muted-foreground'}"
        aria-pressed={layout === 'histogram'}
        onclick={() => (layout = "histogram")}>Histogram</button
      >
      <span class="text-border/40 select-none" aria-hidden="true">&vert;</span>
      <button
        class="toggle-btn px-2.5 py-1 transition-colors {layout === 'table'
          ? 'toggle-active'
          : 'text-muted-foreground'}"
        aria-pressed={layout === 'table'}
        onclick={() => (layout = "table")}>Table</button
      >
    </div>
    <div class="toggle-group flex items-center overflow-hidden" role="group" aria-label="Metric mode">
      <button
        class="toggle-btn px-2.5 py-1 transition-colors {metricMode ===
        'minMax'
          ? 'toggle-active'
          : 'text-muted-foreground'}"
        aria-pressed={metricMode === 'minMax'}
        onclick={() => (metricMode = "minMax")}>Min/Max</button
      >
      <span class="text-border/40 select-none" aria-hidden="true">&vert;</span>
      <button
        class="toggle-btn px-2.5 py-1 transition-colors {metricMode ===
        'percentiles'
          ? 'toggle-active'
          : 'text-muted-foreground'}"
        aria-pressed={metricMode === 'percentiles'}
        onclick={() => (metricMode = "percentiles")}>Percentiles</button
      >
    </div>
    <button
      class="toggle-btn toggle-group flex items-center gap-1 px-2 py-1 transition-colors {allOpen
        ? 'toggle-active'
        : 'text-muted-foreground'}"
      aria-pressed={allOpen}
      aria-label="{allOpen ? 'Collapse' : 'Expand'} all buckets"
      onclick={() => expandAll(groups, sectionKey)}
    >
      {#if allOpen}
        <ChevronsDownUp class="h-3 w-3" aria-hidden={true} />
      {:else}
        <ChevronsUpDown class="h-3 w-3" aria-hidden={true} />
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
          <CardTitle class="text-base">{section.name}</CardTitle>
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
        {@render tableView(section.groups, maxUs, isHttp, sectionKey, false)}
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
          <CardTitle class="text-base">{section.name}</CardTitle>
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
        {#if layout === 'table'}
          {@render tableView(section.groups, maxUs, false, section.name, true)}
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
      <CardTitle class="text-base">{sec.name}</CardTitle>
    </CardHeader>
    <CardContent class="pt-0">
      <div class="grid grid-cols-1 gap-y-1.5 text-sm font-mono">
        {#each sec.scalars as entry}
          {@const isRaftNodes = sec.name === 'Raft' && entry.name === 'raft_cluster_nodes' && typeof entry.value === 'number'}
          <div class="flex justify-between gap-2">
            <span class="text-muted-foreground shrink-0 scalar-label inline-flex items-center gap-1">
              {entry.name.replaceAll('_', ' ')}
              {#if isRaftNodes}
                <InfoTip text="Ideal Raft cluster size is **3 instances** for quorum. Fewer than 3 reduces fault tolerance; more than 3 adds coordination overhead or signals nodes joined under a wrong cluster ID." />
              {/if}
            </span>
            <span
              class="tabular-nums font-medium text-right truncate"
              style={isRaftNodes ? `color: ${raftNodesColor(entry.value as number)}` : ''}
            >{fmtScalar(entry.name, entry.value)}</span>
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
  {@const memColor = memUsedPct > 85 ? 'var(--destructive)' : memUsedPct > 65 ? 'var(--warning)' : 'var(--success)'}
  {@const load1 = numVal(sec, 'load_avg_1')}
  {@const load5 = numVal(sec, 'load_avg_5')}
  {@const load15 = numVal(sec, 'load_avg_15')}
  {@const cores = cpuCount > 0 ? cpuCount : 1}
  {@const osName = strVal(sec, 'os')}
  {@const kernel = strVal(sec, 'kernel')}
  {@const arch = strVal(sec, 'arch')}
  <Card cornerBrackets={false}>
    <CardHeader>
      <div class="flex items-center justify-between">
        <CardTitle class="text-base">System</CardTitle>
        <span class="font-mono text-xs text-muted-foreground">{osName}/{arch} &middot; {kernel} &middot; {cores} cores</span>
      </div>
    </CardHeader>
    <CardContent class="pt-0 space-y-4">
      <div class="flex items-start gap-6">
        <div class="shrink-0">
          {@render ringGauge(memUsedPct, 'Memory', memColor, formatBytes(sysMemUsed), 'var(--muted)')}
        </div>
        <div class="flex-1 space-y-4 min-w-0">
          <!-- Memory detail -->
          <div class="space-y-1">
            <div class="flex justify-between text-sm font-mono text-muted-foreground">
              <span>{formatBytes(sysMemUsed)} used</span>
              <span>{formatBytes(sysMemAvail)} avail / {formatBytes(sysMemTotal)}</span>
            </div>
            <div class="h-1.5 rounded-sm bg-muted overflow-hidden">
              <div class="h-full rounded-sm origin-left [transition:transform_700ms_ease,background-color_700ms_ease]"
                style="background: {memColor}; transform: scaleX({memUsedPct / 100})"></div>
            </div>
          </div>
          <!-- Load Average -->
          <div class="space-y-1.5">
            <span class="text-sm font-mono text-muted-foreground">Load Average</span>
            {#if osName === 'windows'}
              <div class="bg-muted rounded-sm p-2 text-center">
                <span class="text-sm font-mono text-muted-foreground">Not available for this operating system</span>
              </div>
            {:else}
              <div class="grid grid-cols-3 gap-1.5 sm:gap-2">
                {#each [{ label: '1m', val: load1 }, { label: '5m', val: load5 }, { label: '15m', val: load15 }] as l}
                  {@const ratio = l.val / cores}
                  {@const pct = Math.round(ratio * 100)}
                  {@const color = loadColor(l.val, cores)}
                  <div class="relative bg-muted rounded-sm p-2 text-center overflow-hidden">
                    <div class="absolute inset-0 transition-opacity duration-700"
                      style="background: {color}; opacity: {Math.min(ratio * 0.15, 0.3)}"></div>
                    <div class="relative font-mono">
                      <div class="text-sm text-muted-foreground">{l.label}</div>
                      <div class="text-sm tabular-nums font-medium" style="color: {color}">{l.val.toFixed(2)} <span class="text-xs opacity-70">({pct}%)</span></div>
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </div>
      </div>
      <!-- Cache Stats -->
      {#if cacheSection}
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-sm font-mono text-muted-foreground tracking-wider uppercase">MetaEngine Cache</span>
            <span class="text-sm font-mono tabular-nums font-medium" style="color: {hitColor}">{fmtRatio(cacheHitRatio)} hit</span>
          </div>
          <div class="h-1.5 rounded-sm bg-muted overflow-hidden">
            <div class="h-full rounded-sm origin-left [transition:transform_700ms_ease,background-color_700ms_ease]"
              style="background: {hitColor}; transform: scaleX({cacheHitRatio})"></div>
          </div>
          <div class="grid grid-cols-2 gap-x-6 gap-y-1 text-sm font-mono">
            <div class="flex justify-between">
              <span class="text-muted-foreground">Lookup</span>
              <span class="tabular-nums">{fmtNum(lookupHits)} <span class="text-muted-foreground">/</span> {fmtNum(lookupHits + lookupMisses)}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted-foreground">Stat</span>
              <span class="tabular-nums">{fmtNum(statHits)} <span class="text-muted-foreground">/</span> {fmtNum(statHits + statMisses)}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted-foreground">Readdir</span>
              <span class="tabular-nums">{fmtNum(readdirCount)}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted-foreground">Upsert</span>
              <span class="tabular-nums">{fmtNum(upsertCount)}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted-foreground">Remove</span>
              <span class="tabular-nums">{fmtNum(removeCount)}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted-foreground">Evict</span>
              <span class="tabular-nums text-warning">{fmtNum(evictCount)}</span>
            </div>
          </div>
        </div>
      {/if}
    </CardContent>
  </Card>
{/snippet}

{#snippet ringGauge(pct: number, label: string, color: string, display: string, trackColor: string)}
  {@const r = 32}
  {@const circ = 2 * Math.PI * r}
  {@const offset = circ * (1 - pct / 100)}
  <div class="flex flex-col items-center">
    <div class="relative w-16 h-16 sm:w-20 sm:h-20">
      <svg viewBox="0 0 80 80" class="w-full h-full rotate-[-90deg]">
        <circle cx="40" cy="40" r={r} fill="none" stroke={trackColor} stroke-width="6" />
        <circle cx="40" cy="40" r={r} fill="none" stroke={color} stroke-width="6"
          stroke-dasharray={circ} stroke-dashoffset={offset}
          stroke-linecap="round" class="[transition:stroke-dashoffset_700ms_ease]" />
      </svg>
      <div class="absolute inset-0 flex items-center justify-center">
        <span class="text-sm font-mono tabular-nums font-semibold" style="color: {color}">{pct}%</span>
      </div>
    </div>
    <div class="text-sm font-mono text-muted-foreground">{label}</div>
    <div class="text-sm font-mono tabular-nums">{display}</div>
  </div>
{/snippet}

{#snippet tableView(
  groups: HistogramGroup[],
  maxUs: number,
  isHttp: boolean,
  sectionKey: string,
  showRollbacks: boolean,
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
          {@render sortableHead("cv", "\u03C3/\u03BC")}
          {#if metricMode === "minMax"}
            {@render sortableHead("minUs", "Min")}
            {@render sortableHead("maxUs", "Max")}
          {:else}
            {@render sortableHead("p50", "p50")}
            {@render sortableHead("p95", "p95")}
            {@render sortableHead("p99", "p99")}
          {/if}
          {#if showRollbacks}{@render sortableHead("rollbacks", "Rollbk")}{/if}
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
                  variant={cvVariant(cv)}
                  class="font-mono text-[0.65rem] px-1 py-0"
                  >{cv.toFixed(2)}</Badge
                >
              {/if}
            </TableCell>
            {#if metricMode === "minMax"}
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
              {@const p50 = interpolatePercentile(group.buckets, 50)}
              {@const p95 = interpolatePercentile(group.buckets, 95)}
              {@const p99 = interpolatePercentile(group.buckets, 99)}
              <TableCell class="font-mono tabular-nums text-sm text-right">
                <span style="color: {latencyColor(p50)}">{formatUs(p50)}</span>
              </TableCell>
              <TableCell class="font-mono tabular-nums text-sm text-right">
                <span style="color: {latencyColor(p95)}">{formatUs(p95)}</span>
              </TableCell>
              <TableCell class="font-mono tabular-nums text-sm text-right">
                <span style="color: {latencyColor(p99)}">{formatUs(p99)}</span>
              </TableCell>
            {/if}
            {#if showRollbacks}
              <TableCell class="font-mono tabular-nums text-sm text-right">
                {#if group.rollbacks > 0}
                  <span class="text-warning">{group.rollbacks}</span>
                {:else}
                  <span class="text-muted-foreground">&mdash;</span>
                {/if}
              </TableCell>
            {/if}
          </TableRow>
          {#if isOpen && group.buckets.length > 0}
            {@const bucketTotal = group.buckets.reduce(
              (s, b) => s + b.count,
              0,
            )}
            <TableRow>
              <TableCell
                colspan={(metricMode === "minMax" ? 9 : 10) + (showRollbacks ? 1 : 0)}
                class="p-0"
              >
                <div
                  class="py-2 px-4 space-y-1 ml-6"
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
    aria-sort={sortCol === col ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
    onclick={() => toggleSort(col)}
  >
    <div class="flex items-center gap-1 {col !== 'label' ? 'justify-end' : ''}">
      <span class={col === 'cv' ? 'normal-case' : ''}>{label}</span>
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
      aria-expanded={group.buckets.length > 0 ? isOpen : undefined}
      onclick={() => group.buckets.length > 0 && toggleExpand(key)}
    >
      <div class="flex items-center gap-2 min-w-0">
        {#if group.buckets.length > 0}
          <ChevronRight
            aria-hidden={true}
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

    <div class="mt-1.5 ml-5.5 h-1.5 rounded-sm bg-muted overflow-hidden">
      <div
        class="h-full rounded-sm transition-transform origin-left duration-700"
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
      {#if metricMode === "minMax"}
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
          >σ/μ <Badge
            variant={cvVariant(cv)}
            class="font-mono text-[0.65rem] px-1 py-0">{cv.toFixed(2)}</Badge
          ></span
        >
      {/if}
      {#if metricMode === "percentiles" && group.buckets.length > 0}
        {@const hp50 = interpolatePercentile(group.buckets, 50)}
        {@const hp95 = interpolatePercentile(group.buckets, 95)}
        {@const hp99 = interpolatePercentile(group.buckets, 99)}
        <span class="text-border">|</span>
        <span>p50 <span style="color: {latencyColor(hp50)}">{formatUs(hp50)}</span></span>
        <span>p95 <span style="color: {latencyColor(hp95)}">{formatUs(hp95)}</span></span>
        <span>p99 <span style="color: {latencyColor(hp99)}">{formatUs(hp99)}</span></span>
      {/if}
    </div>

    {#if isOpen && group.buckets.length > 0}
      <div class="mt-3 ml-8 space-y-1">
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
  /* ── Component-level design tokens ── */
  .tab-bar {
    --_tab-bracket: oklch(0.4 0.002 200 / 0.5);
    --_tab-line: oklch(0.4 0.08 200);
    --_tab-line-hover: oklch(0.45 0.08 200);
    --_tab-line-active: oklch(0.65 0.18 45);
  }
  :global(.dark) .tab-bar {
    --_tab-bracket: oklch(0.35 0.002 200 / 0.5);
    --_tab-line: oklch(0.5 0.08 200);
    --_tab-line-hover: oklch(0.55 0.08 200);
    --_tab-line-active: oklch(0.78 0.13 92);
  }
  .toggle-group {
    --_toggle-bg: oklch(0.4 0.002 200 / 0.06);
    --_toggle-active-bg: oklch(0.45 0.08 200 / 0.12);
  }
  :global(.dark) .toggle-group {
    --_toggle-bg: oklch(0.35 0.002 200 / 0.12);
    --_toggle-active-bg: oklch(0.5 0.08 200 / 0.15);
  }

  /* Tab bar; overflow scroll fade */
  .tab-bar {
    mask-image: linear-gradient(to right, black calc(100% - 2.5rem), transparent);
    -webkit-mask-image: linear-gradient(to right, black calc(100% - 2.5rem), transparent);
  }

  /* Tab bar; scan-line border + corner brackets */
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
    color: var(--_tab-bracket);
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
      var(--_tab-line) 15%,
      var(--_tab-line) 85%,
      transparent
    );
  }

  /* Tab buttons; skewed corners + scan-line underline */
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
    background: linear-gradient(90deg, transparent, var(--_tab-line-hover), transparent);
    transform: scaleX(0);
    transform-origin: center;
    transition: transform 0.35s ease;
  }

  .tab-btn:hover::after,
  .tab-btn:focus-visible::after {
    transform: scaleX(1);
  }

  .tab-btn:focus-visible {
    outline: 1.5px solid var(--_tab-line-active);
    outline-offset: 2px;
  }

  .tab-btn[aria-selected="true"] {
    color: var(--foreground);
    background: var(--accent);
  }

  .tab-btn[aria-selected="true"]::after {
    transform: scaleX(1);
    background: linear-gradient(90deg, transparent, var(--_tab-line-active), transparent);
  }

  /* Toggle groups; skewed micro-cuts */
  .toggle-group {
    clip-path: polygon(
      0 3px,
      3px 0,
      100% 0,
      100% calc(100% - 3px),
      calc(100% - 3px) 100%,
      0 100%
    );
    background: var(--_toggle-bg);
  }

  .toggle-btn {
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 0.6rem;
    display: inline-flex;
    align-items: center;
  }

  .toggle-btn:focus-visible {
    box-shadow: inset 0 0 0 1.5px var(--_tab-line-active, oklch(0.65 0.18 45));
  }

  .toggle-active {
    color: var(--foreground);
    background: var(--_toggle-active-bg);
  }

  /* Touch targets; coarse pointer devices (touch screens, tablets) */
  @media (pointer: coarse) {
    .tab-btn {
      min-height: 2.75rem;
    }
    .toggle-btn {
      min-height: 2.75rem;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      transition-duration: 0.01ms !important;
      animation-duration: 0.01ms !important;
    }
  }

  .gauge-cell {
    transition: background-color 0.25s ease;
  }

  .gauge-cell:hover {
    background: var(--accent);
  }

  .gauge-lbl {
    font-family: var(--font-mono);
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.15em;
    color: var(--muted-foreground);
  }

  .gauge-val {
    font-family: var(--font-mono);
    font-size: 1.5rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    margin-top: 2px;
  }

  .gauge-sub {
    font-family: var(--font-mono);
    font-size: 0.8rem;
    color: var(--muted-foreground);
  }

  .scalar-label {
    text-transform: capitalize;
  }
</style>
