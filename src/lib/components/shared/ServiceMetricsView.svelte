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
  import { formatBytes, formatUTCShort, formatRelative } from "$lib/core/utils/format";
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
    fmtScalar,
    interpolatePercentile,
    latencyVariant,
    latencyColor,
    cvClass,
    poolUtilColor,
    dbPingColor,
    gradientColor,
    bucketBarColor,
    recordFieldLabel,
    CV_TOOLTIP_TEXT,
    type MetricSection,
    type HistogramGroup,
    type SortCol,
    type SortDir,
  } from "$lib/core/utils/metrics";
  import InfoTip from "$lib/components/shared/InfoTip.svelte";
  import TextTooltip from "$lib/components/shared/TextTooltip.svelte";
  import BlockservStats from "$lib/components/shared/BlockservStats.svelte";
  import PfkitNetworkStats from "$lib/components/shared/PfkitNetworkStats.svelte";
  import { parseFlowStats } from "$lib/core/utils/pfkitNetwork";
  import ChevronRight from "@lucide/svelte/icons/chevron-right";
  import ChevronsDownUp from "@lucide/svelte/icons/chevrons-down-up";
  import ChevronsUpDown from "@lucide/svelte/icons/chevrons-up-down";
  import ArrowUp from "@lucide/svelte/icons/arrow-up";
  import ArrowDown from "@lucide/svelte/icons/arrow-down";
  import TriangleAlert from "@lucide/svelte/icons/triangle-alert";

  import type { Snippet } from 'svelte';

  let { raw, systemTab, instanceTab, alertsTab, alertsCount = 0, activityTab, workerEventsTab }: {
    raw: string;
    systemTab?: Snippet<[number]>;
    instanceTab?: Snippet;
    alertsTab?: Snippet;
    alertsCount?: number;
    activityTab?: Snippet;
    workerEventsTab?: Snippet;
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

  // Roving tabindex per the WAI-ARIA tabs pattern; selection follows focus.
  function onTabKeydown(e: KeyboardEvent, idx: number) {
    let next: number;
    if (e.key === "ArrowRight") next = (idx + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (idx - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    else return;
    e.preventDefault();
    activeTab = tabs[next].id;
    document.getElementById(`tab-${tabs[next].uiId}`)?.focus();
  }
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

  // Row-identifier column header for a per-label metrics table, derived from the
  // section name so a table of storages, peers, or ops isn't captioned "Query" (a
  // leftover default that only ever fit genuine SQL query-latency tables, which use
  // dbTab's own literal "Query" instead). Checked most-specific-first; a caller passes
  // its own fallback for anything this doesn't recognize (profileTab's per-method
  // histogram sections default to "Method", recordTable's arbitrary-entity sections
  // default to "Name").
  function rowLabel(sectionName: string, fallback = "Method"): string {
    if (/\bstorage\b/i.test(sectionName)) return "Storage";
    if (/\bpeer\b|\bsibling\b/i.test(sectionName)) return "Peer";
    if (/\bobject\b|\bs3\b/i.test(sectionName)) return "Operation";
    return fallback;
  }

  // Section-level explainer hints (lightbulb tooltip on the card title).
  // Keyed by section name; sections without an entry render no hint.
  const SCALAR_SECTION_HINTS: Record<string, string> = {
    'Segment Retry': "These signals show S3 retry and budget activity in the shared object-storage reader/writer.\n\n**Retry Throttled** and **Retry Exhausted** show real friction on the S3 side. **Budget Starved Fetches** counts operations that start with under 2 seconds left on the caller's deadline, for example a table's compaction budget. This count warns you before an operation fails.",
    'Iceberg Compact Circuit Breaker': "This count shows Iceberg tables paused from compaction. A table pauses after it fails its **5-minute per-table budget** on **3 consecutive passes**.\n\nCompaction skips a paused table until a **periodic reset** gives it another chance. This stops compaction from wasting a cycle on a table that cannot finish in time.",
    'TCP Backpressure': "This is self-tuning transport admission control, similar to TCP Vegas. The connection ceiling applies to the whole TCP server.\n\nThe per-connection RPS value normally protects only the authentication methods; authenticated data-plane RPCs bypass it and use their service-level admission controls. A license-expiry override is the deliberate exception and throttles all requests. The live **Effective RPS Scope** field shows which mode applies now.",
    'DB-Bound Admission Gate': "This gate uses a token bucket to limit requests that need the database. Cache-servable reads bypass this gate.\n\nUnlike TCP backpressure, which delays requests, this gate **rejects requests outright** once its budget is spent. The system never sets this rate manually. It recalculates the rate from Little's Law every 10s, then reduces it further by the end-to-end request-time gradient. See **Admission Target Rate** below for the exact formula.",
  }

  // Per-field explainer bulbs inside scalar cards, keyed by section → field.
  const SCALAR_FIELD_HINTS: Record<string, Record<string, string>> = {
    'Raft': {
      raft_cluster_nodes: "The ideal Raft cluster size is **3 instances** for quorum.\n\nFewer than 3 nodes reduces fault tolerance. More than 3 nodes adds coordination overhead, or means a node joined with the wrong cluster ID.",
    },
    'TCP Backpressure': {
      tcp_bp_enabled: "**true**: transport backpressure is active.\n**false**: neither its connection-pressure delays nor its per-connection authentication rate applies.",
      tcp_bp_adaptive_connections: "**true**: the ceiling self-tunes from the latency gradient.\n**false**: the ceiling uses a fixed, operator-set value.",
      tcp_bp_effective_max_connections: "This connection ceiling applies now.\n\nWhen latency degrades, the adaptive ceiling shrinks by the gradient, up to **10×**. It never drops below **10%** of the structural default of **10,000**. The server refuses connections beyond the ceiling at accept.",
      tcp_bp_adaptive_rps: "**true**: the per-connection authentication rate self-tunes from the latency gradient.\n**false**: an operator-set authentication rate is configured.\n\nThis setting does not cap normal authenticated data-plane RPCs. A license override may temporarily broaden its scope to all requests.",
      tcp_bp_effective_rps: "This is the effective per-connection authentication rate. The structural default is **1,000 RPS**.\n\nNormal authenticated data-plane RPCs bypass this limiter. If **Effective RPS Scope** says **all requests / license override**, the displayed rate temporarily applies to every request on the connection.",
      tcp_bp_effective_rps_scope: "**authentication only**: only AuthRequest and AuthScopeRequest use the displayed RPS limiter; authenticated data-plane RPCs bypass it.\n\n**all requests / license override**: an expired-license policy deliberately applies the displayed rate to every RPC.\n\n**disabled**: TCP backpressure is off and this rate is not enforced.",
      tcp_bp_gradient: "This is the ratio of the 1-minute EWMA of DB query latency to its 15-minute baseline. The system recomputes it every 10s.\n\n**≈1** stable · **>1** degrading, the connection ceiling and nominal authentication rate divide by the gradient, up to 10× · **<1** recovering, treated as neutral. It does not govern authenticated data-plane throughput.",
      tcp_bp_connections_rejected_total: "This counts TCP connections the server refused at accept because they crossed the effective max-connections ceiling. This is the only hard reject in this layer.\n\n**A nonzero value means the server turned clients away.**",
    },
    'DB-Bound Admission Gate': {
      db_admission_pool_size: "This is the live `max-open-connections` value of the SQL pool.\n\nThis is the concurrency term in the **Little's Law** rate derivation below.",
      db_admission_avg_latency_us: "This is the recent average DB query latency, measured by delta and covering SQL execution only.\n\nThis is the latency term in the **Little's Law** rate derivation below.",
      db_admission_request_latency_us: "This is the 1-minute EWMA of **end-to-end** request time. It includes lock waits, cache fills, and scheduling, not just SQL execution.\n\nThis value feeds the request gradient once it crosses the 50ms activation floor.",
      db_admission_request_gradient: "This is the 1-minute to 15-minute ratio of end-to-end request time.\n\nThis ratio further reduces the target rate while it stays **above 1** (degrading), up to a cap of 10×. It stays **neutral at 1** until the 1-minute average exceeds 50ms, so ratio alone never throttles a fast system.",
      db_admission_target_rate: "This is the admission rate for DB-bound requests per second, recomputed every 10s:\n\n**(pool size ÷ avg query latency) × 0.70 ÷ request gradient**\n\nThe ×0.70 factor gives a deliberate 30% headroom that keeps steady-state throughput below the pool's own saturation alert thresholds. The gradient term applies, and only divides the rate down, while it is above 1. At 1 or below, the gradient term stays neutral.",
      db_admission_burst: "This is the flat `token-bucket` burst size. The gate absorbs a spike of up to this many DB-bound requests before the steady rate applies.\n\nThis burst size is **not rate-proportional** by design, so it stays stable as the rate adapts.",
      db_admission_rejected_total: "This counts DB-bound requests the gate rejected because the token bucket was empty.\n\nEach rejection window also raises a backpressure alert. The alert self-resolves after 60s of quiet. **A nonzero value means the gate shed real load.**",
    },
  }

  // Anomaly color for specific scalar fields where a nonzero value signals
  // real friction or a stuck state, not just routine activity. Returns null
  // for the common case (default muted/foreground styling).
  function scalarAnomalyColor(sectionName: string, fieldName: string, value: number): string | null {
    if (fieldName.endsWith('_gradient')) return gradientColor(value)
    if (sectionName === 'Segment Retry') {
      if (fieldName === 'retry_exhausted' && value > 0) return 'var(--destructive)'
      if (fieldName === 'retry_throttled' && value > 0) return 'var(--warning)'
      if (fieldName === 'budget_starved_fetches' && value > 0) return 'var(--warning)'
    }
    if (sectionName === 'Iceberg Compact Circuit Breaker' && fieldName === 'iceberg_compact_circuit_open_tables' && value > 0) {
      return 'var(--destructive)'
    }
    // Rejects are shed work: connection-level refusal turns clients away
    // entirely (error), request-level admission shedding degrades but keeps
    // the connection alive (warn, matching the server's own alert severity).
    if (sectionName === 'TCP Backpressure' && fieldName === 'tcp_bp_connections_rejected_total' && value > 0) {
      return 'var(--destructive)'
    }
    if (sectionName === 'DB-Bound Admission Gate' && fieldName === 'db_admission_rejected_total' && value > 0) {
      return 'var(--warning)'
    }
    return null
  }

  // Fields in a section share an underscore-prefix (tcp_bp_*, db_admission_*)
  // that just repeats the section header; strip it from every entry's own
  // name so the card label carries only the distinguishing part.
  function sectionLabelPrefix(sec: MetricSection): string[] {
    const names = sec.scalars.map(s => s.name.split('_'))
    if (names.length < 2) return []
    const minLen = Math.min(...names.map(n => n.length))
    const prefix: string[] = []
    for (let i = 0; i < minLen - 1; i++) {
      const seg = names[0][i]
      if (names.every(n => n[i] === seg)) prefix.push(seg)
      else break
    }
    return prefix
  }

  // _us fields render their value via formatUs (µs/ms), so the label drops
  // the unit token instead of showing a redundant "us".
  function scalarLabel(name: string, prefix: string[] = []): string {
    const labelOverrides: Record<string, string> = {
      tcp_bp_adaptive_rps: 'adaptive auth throttle',
      tcp_bp_effective_rps: 'effective auth rps',
      tcp_bp_effective_rps_scope: 'effective rps scope',
    }
    if (labelOverrides[name]) return labelOverrides[name]
    const parts = (name.endsWith('_us') ? name.slice(0, -3) : name).split('_')
    const rest = prefix.length && prefix.length < parts.length && prefix.every((p, i) => parts[i] === p)
      ? parts.slice(prefix.length)
      : parts
    return rest.join(' ')
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

  // pfkit's "# Network (per peer)" section (see internal/pfkitclient.AppendFlowStats in
  // mountos-servers) rides in the same raw blob but is NOT one of the sections above: it
  // needs its own parser (see pfkitNetwork.ts's doc comment for why parseMetrics can't parse
  // it) and backs its own top-level "Packets" tab rather than folding into Overview or a
  // histogram-derived tab. null when the section is absent entirely (an older build, or a
  // service type pfkit enrichment was never wired into), not just when pfkit isn't running.
  const networkStats = $derived(parseFlowStats(raw));

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
  // Why the pool closed connections. Absent on servers older than these keys,
  // where sv yields 0 and the row reads as "no churn" rather than breaking.
  const dbMaxIdleClosed = $derived(sv(sections, "DB Pool", "db_max_idle_closed"));
  const dbMaxIdleTimeClosed = $derived(sv(sections, "DB Pool", "db_max_idle_time_closed"));
  const dbMaxLifetimeClosed = $derived(sv(sections, "DB Pool", "db_max_lifetime_closed"));
  // Node<->DB network round-trip (not query execution time), absent until
  // the first sample (the section simply won't have the key, sv yields 0,
  // so gate display on the section carrying the key at all, not just a
  // nonzero value).
  const dbPingAvgUs = $derived(sv(sections, "DB Pool", "db_ping_avg_us"));
  const hasDBPing = $derived(sections.some(s => s.name === "DB Pool" && s.scalars.some(sc => sc.name === "db_ping_avg_us")));

  const memAllocPct = $derived(
    memSys > 0 ? Math.round((memAlloc / memSys) * 100) : 0,
  );
  const poolUtilPct = $derived(
    dbMaxOpen > 0 ? Math.round((dbOpen / dbMaxOpen) * 100) : 0,
  );

  // MetaEngine Arena (mmap'd, not GC-managed)
  // region_size_bytes = total mmap budget, region_used_bytes = bytes handed
  // out as extents (shards grow/shrink on demand; one hot volume may take
  // the whole budget). Live usage: slot_occupied / slot_capacity.
  const arenaSection = $derived(sections.find(s => s.name === 'MetaEngine Arena' && s.kind === 'scalar'));
  const arenaShards = $derived(arenaSection ? numVal(arenaSection, 'shards') : 0);
  const slotCapacity = $derived(arenaSection ? numVal(arenaSection, 'slot_capacity') : 0);
  const slotOccupied = $derived(arenaSection ? numVal(arenaSection, 'slot_occupied') : 0);
  const occupancyPct = $derived(slotCapacity > 0 ? Math.round((slotOccupied / slotCapacity) * 100) : 0);
  const regionSize = $derived(arenaSection ? numVal(arenaSection, 'region_size_bytes') : 0);
  // capacity_evictions counts real pressure evictions; the legacy
  // evict_count key only ever tracked the external EvictN API.
  const evictCount = $derived(arenaSection ? numVal(arenaSection, 'capacity_evictions') : 0);

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

  // System RAM, read from the same live snapshot as regionSize, to flag an
  // undersized arena. METAENGINE_ARENA_SIZE is a fixed upfront allocation,
  // so at least 50% of total RAM is the suggested floor.
  const sysMemTotalBytes = $derived.by(() => {
    const sec = sections.find(s => s.name === 'System' && s.kind === 'scalar');
    return sec ? numVal(sec, 'sys_mem_total') : 0;
  });
  const arenaTooSmall = $derived(hasArena && sysMemTotalBytes > 0 && regionSize < sysMemTotalBytes * 0.5);
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

  // Dynamic tabs: overview + one per histogram section. Histogram tab ids
  // carry a 'sec:' namespace so a section name can never collide with the
  // fixed tab ids (system/alerts/activity) or their tab/panel DOM ids.
  const histogramSections = $derived(
    sections.filter(s => s.kind === 'histogram' && !overviewSections.has(s.name))
  )
  const tabs = $derived([
    { id: 'overview', label: 'Overview', count: 0, uiId: 'overview' },
    ...(systemTab ? [{ id: 'system', label: 'System Info', count: 0, uiId: 'system' }] : []),
    ...(instanceTab ? [{ id: 'instance', label: 'Instance Info', count: 0, uiId: 'instance' }] : []),
    ...histogramSections.map(s => ({
      id: `sec:${s.name}`,
      label: s.name,
      count: s.groups.length,
      uiId: `sec-${s.name.toLowerCase().replace(/\s+/g, '-')}`,
    })),
    ...(networkStats ? [{ id: 'packets', label: 'Packets', count: 0, uiId: 'packets' }] : []),
    ...(alertsTab ? [{ id: 'alerts', label: 'Alerts', count: alertsCount, uiId: 'alerts' }] : []),
    ...(activityTab ? [{ id: 'activity', label: 'Activity Log', count: 0, uiId: 'activity' }] : []),
    ...(workerEventsTab ? [{ id: 'worker-events', label: 'Worker Events', count: 0, uiId: 'worker-events' }] : []),
  ])
  // Optional tabs (instance/alerts/activity, histogram sections) come and go
  // per node; a selected tab that disappears must not strand the panel area
  // on a tab id no branch renders.
  $effect(() => {
    if (!tabs.some((t) => t.id === activeTab)) activeTab = 'overview'
  })
</script>

<div class="space-y-5">
  <!-- Tab Bar -->
  {@render tabBar()}

  <!-- Tab Panels -->
  {#if activeTab === "overview"}
    {@const extraSections = sections.filter(s => s.kind === 'scalar' && s.name !== 'Config' && !inlineSections.has(s.name) && !blockSections.has(s.name) && s.scalars.length > 0)}
    {@const recordSections = sections.filter(s => s.kind === 'record' && s.records.length > 0)}
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
              {#if arenaTooSmall}
                <Badge
                  variant="warning"
                  class="font-mono inline-flex items-center gap-1"
                  title="The arena size is {formatBytes(regionSize)}. Total RAM is {formatBytes(sysMemTotalBytes)}. Set METAENGINE_ARENA_SIZE to at least 50% of total RAM."
                >
                  <TriangleAlert class="size-3" aria-hidden="true" />
                  arena low
                </Badge>
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
                {#if hasDBPing}
                  <span class="flex items-center gap-1" style="color: {dbPingColor(dbPingAvgUs / 1000)}">
                    <span class="w-1.5 h-1.5 rounded-sm" style="background: currentColor"></span>
                    Ping {(dbPingAvgUs / 1000).toFixed(1)}ms
                  </span>
                {/if}
                {#if dbWaitCount > 0}
                  <span class="text-warning flex items-center gap-1">
                    <span class="w-1.5 h-1.5 rounded-full bg-warning animate-pulse"></span>
                    {dbWaitCount} waiting
                  </span>
                {/if}
              </div>
            </div>

            <!-- Why connections were closed. Idle-cap churn should stay 0: the
                 pool pins max-idle to max-open, so a non-zero value means
                 connections are being destroyed that could have been reused. -->
            <div class="space-y-1.5">
              <div class="text-sm font-mono text-muted-foreground tracking-wider uppercase">Closed</div>
              <div class="flex flex-wrap gap-x-3 gap-y-0.5 text-sm font-mono text-muted-foreground">
                <span class:text-warning={dbMaxIdleClosed > 0}>Idle cap {dbMaxIdleClosed}</span>
                <span>Idle timeout {dbMaxIdleTimeClosed}</span>
                <span>Lifetime {dbMaxLifetimeClosed}</span>
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
    <!-- Per-entity record sections (GC Goals, etc.): one row per entity -->
    {#each recordSections as sec}
      {@render recordTable(sec)}
    {/each}
    <!-- Extra scalar sections (TCP Connections, Raft, Semaphore, etc.) -->
    {#if extraSections.length > 0}
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {#each extraSections as sec}
          {@render scalarCard(sec)}
        {/each}
      </div>
    {/if}
    </div>
  {:else if activeTab.startsWith('sec:')}
    {@const section = histogramSections.find(s => `sec:${s.name}` === activeTab)}
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

  {#if activeTab === 'system' && systemTab}
    <div role="tabpanel" id="panel-system" aria-labelledby="tab-system">
      {@render systemTab(cpuCount)}
    </div>
  {/if}

  {#if activeTab === 'instance' && instanceTab}
    <div role="tabpanel" id="panel-instance" aria-labelledby="tab-instance">
      {@render instanceTab()}
    </div>
  {/if}

  {#if activeTab === 'packets' && networkStats}
    <div role="tabpanel" id="panel-packets" aria-labelledby="tab-packets">
      <!-- "Packets" is a category, not a single fixed view: Network is the first entrant.
           A future sibling (e.g. retransmit/DNS views) is another card here, or its own
           sub-tab if the category grows enough to need one. -->
      {#if networkStats.running}
        <PfkitNetworkStats stats={networkStats} />
      {:else}
        <Card cornerBrackets={false}>
          <CardHeader><CardTitle class="text-base">Network</CardTitle></CardHeader>
          <CardContent class="pt-0 space-y-1">
            <p class="text-sm text-muted-foreground">pfkit is not running on this node.</p>
            <p class="text-sm text-muted-foreground">
              pfkit is an optional add-on. It reports real OS-level network data per peer.
              It does not run by default. Install it from mountos.sh, then start it on this
              host to see data here.
            </p>
          </CardContent>
        </Card>
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

  {#if activeTab === 'worker-events' && workerEventsTab}
    <div role="tabpanel" id="panel-worker-events" aria-labelledby="tab-worker-events">
      {@render workerEventsTab()}
    </div>
  {/if}
</div>

<!-- Snippets -->

{#snippet tabBar()}
  {@const activeIdx = Math.max(0, tabs.findIndex((t) => t.id === activeTab))}
  <div
    class="tab-bar relative flex items-center gap-0.5 pb-3 pt-1 overflow-x-auto"
    role="tablist"
    aria-label="Metrics"
  >
    {#each tabs as t, i}
      {@const c = t.count}
      <button
        role="tab"
        id="tab-{t.uiId}"
        aria-selected={activeTab === t.id}
        aria-controls="panel-{t.uiId}"
        tabindex={i === activeIdx ? 0 : -1}
        class="tab-btn flex items-center gap-1.5 px-4 py-2 min-h-[44px] sm:min-h-0 transition-colors
          {activeTab === t.id ? 'font-medium' : 'text-muted-foreground'}"
        onclick={() => (activeTab = t.id)}
        onkeydown={(e) => onTabKeydown(e, i)}
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
        class="toggle-btn px-2.5 py-1 min-h-[44px] sm:min-h-0 transition-colors {layout === 'histogram'
          ? 'toggle-active'
          : 'text-muted-foreground'}"
        aria-pressed={layout === 'histogram'}
        onclick={() => (layout = "histogram")}>Histogram</button
      >
      <span class="text-border/40 select-none" aria-hidden="true">&vert;</span>
      <button
        class="toggle-btn px-2.5 py-1 min-h-[44px] sm:min-h-0 transition-colors {layout === 'table'
          ? 'toggle-active'
          : 'text-muted-foreground'}"
        aria-pressed={layout === 'table'}
        onclick={() => (layout = "table")}>Table</button
      >
    </div>
    <div class="toggle-group flex items-center overflow-hidden" role="group" aria-label="Metric mode">
      <button
        class="toggle-btn px-2.5 py-1 min-h-[44px] sm:min-h-0 transition-colors {metricMode ===
        'minMax'
          ? 'toggle-active'
          : 'text-muted-foreground'}"
        aria-pressed={metricMode === 'minMax'}
        onclick={() => (metricMode = "minMax")}>Min/Max</button
      >
      <span class="text-border/40 select-none" aria-hidden="true">&vert;</span>
      <button
        class="toggle-btn px-2.5 py-1 min-h-[44px] sm:min-h-0 transition-colors {metricMode ===
        'percentiles'
          ? 'toggle-active'
          : 'text-muted-foreground'}"
        aria-pressed={metricMode === 'percentiles'}
        onclick={() => (metricMode = "percentiles")}>Percentiles</button
      >
    </div>
    <button
      class="toggle-btn toggle-group flex items-center gap-1 px-2 py-1 min-h-[44px] sm:min-h-0 transition-colors {allOpen
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
  {@const rowLabelText = rowLabel(section.name)}
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
        {@render tableView(section.groups, maxUs, isHttp, rowLabelText, sectionKey, false)}
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
          {@render tableView(section.groups, maxUs, false, 'Query', section.name, true)}
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
      <CardTitle class="text-base inline-flex items-center gap-1">
        {sec.name}
        {#if SCALAR_SECTION_HINTS[sec.name]}
          <InfoTip text={SCALAR_SECTION_HINTS[sec.name]} width={400} />
        {/if}
      </CardTitle>
    </CardHeader>
    <CardContent class="pt-0">
      {@const labelPrefix = sectionLabelPrefix(sec)}
      <div class="grid grid-cols-1 gap-y-1.5 text-sm font-mono">
        {#each sec.scalars as entry}
          {@const isRaftNodes = sec.name === 'Raft' && entry.name === 'raft_cluster_nodes' && typeof entry.value === 'number'}
          {@const anomalyColor = typeof entry.value === 'number' ? scalarAnomalyColor(sec.name, entry.name, entry.value) : null}
          {@const fieldHint = SCALAR_FIELD_HINTS[sec.name]?.[entry.name]}
          <div class="flex justify-between gap-2">
            <span class="text-muted-foreground shrink-0 scalar-label inline-flex items-center gap-1">
              {scalarLabel(entry.name, labelPrefix)}
              {#if fieldHint}
                <InfoTip text={fieldHint} width={400} />
              {/if}
            </span>
            <span
              class="tabular-nums font-medium text-right truncate"
              style={isRaftNodes ? `color: ${raftNodesColor(entry.value as number)}` : anomalyColor ? `color: ${anomalyColor}` : ''}
            >{fmtScalar(entry.name, entry.value)}</span>
          </div>
        {/each}
      </div>
    </CardContent>
  </Card>
{/snippet}

{#snippet recordTable(sec: MetricSection)}
  <Card cornerBrackets={false}>
    <CardHeader>
      <div class="flex items-center gap-2">
        <CardTitle class="text-base">{sec.name}</CardTitle>
        <Badge variant="secondary" class="font-mono tabular-nums text-[0.7rem]"
          >{sec.records.length}</Badge
        >
      </div>
    </CardHeader>
    <CardContent class="pt-0">
      <div class="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead class="th-cyber">{rowLabel(sec.name, "Name")}</TableHead>
              {#each sec.recordFields as field}
                <TableHead class="th-cyber text-right">{recordFieldLabel(field)}</TableHead>
              {/each}
            </TableRow>
          </TableHeader>
          <TableBody>
            {#each sec.records as rec}
              <TableRow class="hover:bg-muted/50 transition-colors">
                <TableCell class="font-mono text-sm capitalize truncate">{rec.label}</TableCell>
                {#each sec.recordFields as field}
                  {@const val = rec.fields[field]}
                  <TableCell class="font-mono tabular-nums text-sm text-right">
                    {#if val === undefined}
                      <span class="text-muted-foreground">&mdash;</span>
                    {:else if field === 'errors' && typeof val === 'number'}
                      <span class={val > 0 ? 'text-destructive' : 'text-muted-foreground'}
                        >{val.toLocaleString()}</span
                      >
                    {:else if field === 'last_run_unix' && typeof val === 'number'}
                      <TextTooltip text={formatRelative(val)}>{formatUTCShort(val)}</TextTooltip>
                    {:else if field === 'last_duration_us' && typeof val === 'number'}
                      {formatUs(val)}
                    {:else if field === 'last_error'}
                      <TextTooltip text={String(val)} copyable align="left" class="text-destructive block max-w-lg truncate">{val}</TextTooltip>
                    {:else if typeof val === 'number'}
                      {val.toLocaleString()}
                    {:else}
                      {val}
                    {/if}
                  </TableCell>
                {/each}
              </TableRow>
            {/each}
          </TableBody>
        </Table>
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
  rowLabelText: string,
  sectionKey: string,
  showRollbacks: boolean,
)}
  {@const sorted = sortGroups(groups, sortCol, sortDir)}
  <div class="overflow-x-auto">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead class="th-cyber w-6"></TableHead>
          {@render sortableHead("label", rowLabelText)}
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
            class="relative {group.buckets.length > 0 ? 'cursor-pointer' : ''} hover:bg-muted/50 transition-colors {isOpen
              ? 'bg-muted/30'
              : ''}"
          >
            <TableCell class="w-6 px-1">
              {#if group.buckets.length > 0}
                <button
                  type="button"
                  class="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
                  aria-expanded={isOpen}
                  aria-label="{isOpen ? 'Collapse' : 'Expand'} {group.label}"
                  onclick={() => toggleExpand(key)}
                >
                  <ChevronRight
                    aria-hidden={true}
                    class="h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 {isOpen
                      ? 'rotate-90'
                      : ''}"
                  />
                </button>
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
                  variant="outline"
                  class="font-mono text-[0.7rem] px-1 py-0 {cvClass(cv)}"
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
    class="th-cyber select-none"
    aria-sort={sortCol === col ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
  >
    <div class="flex w-full items-center gap-1 {col !== 'label' ? 'justify-end' : ''}">
      <button
        type="button"
        class="flex items-center gap-1 cursor-pointer"
        onclick={() => toggleSort(col)}
      >
        <span class={col === 'cv' ? 'normal-case' : ''}>{label}</span>
        {#if sortCol === col}
          {#if sortDir === "asc"}
            <ArrowUp class="h-3 w-3" />
          {:else}
            <ArrowDown class="h-3 w-3" />
          {/if}
        {/if}
      </button>
      {#if col === 'cv'}<InfoTip text={CV_TOOLTIP_TEXT} width={420} />{/if}
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
            variant="outline"
            class="font-mono text-[0.7rem] px-1 py-0 {cvClass(cv)}">{cv.toFixed(2)}</Badge
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
    --_tab-line-active: var(--ring);
  }
  :global(.dark) .tab-bar {
    --_tab-bracket: oklch(0.35 0.002 200 / 0.5);
    --_tab-line: oklch(0.5 0.08 200);
    --_tab-line-hover: oklch(0.55 0.08 200);
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
    font-size: 0.7rem;
    display: inline-flex;
    align-items: center;
  }

  .toggle-btn:focus-visible {
    box-shadow: inset 0 0 0 1.5px var(--ring);
  }

  .toggle-active {
    color: var(--foreground);
    background: var(--_toggle-active-bg);
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
    font-size: 0.7rem;
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
    font-size: 0.7rem;
    color: var(--muted-foreground);
  }

  .scalar-label {
    text-transform: capitalize;
  }
</style>
