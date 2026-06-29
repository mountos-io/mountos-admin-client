<script lang="ts">
  import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card'
  import { Badge } from '$lib/components/ui/badge'
  import InfoTip from '$lib/components/shared/InfoTip.svelte'
  import { formatBytes } from '$lib/core/utils/format'
  import { sv, formatUs, formatUptime, latencyColor, type MetricSection } from '$lib/core/utils/metrics'

  let { sections }: { sections: MetricSection[] } = $props()

  // Durability SLA: objects acked locally must reach the S3 floor within ~5-10 min.
  const DUR_WARN_SEC = 300
  const DUR_CRIT_SEC = 600

  // Read cache
  const cacheHit = $derived(sv(sections, 'Block Cache', 'cache_hit_total'))
  const cacheMiss = $derived(sv(sections, 'Block Cache', 'cache_miss_total'))
  const reads = $derived(cacheHit + cacheMiss)
  const hitRatio = $derived(reads > 0 ? cacheHit / reads : 0)

  // S3 floor latency (microseconds; 0 means no ops sampled yet)
  const s3Get = $derived(sv(sections, 'S3 Floor Latency', 's3_get_avg_micros'))
  const s3Put = $derived(sv(sections, 'S3 Floor Latency', 's3_put_avg_micros'))

  // Sync backlog (durability to-do)
  const unsyncedObjects = $derived(sv(sections, 'Sync Backlog', 'unsynced_objects'))
  const unsyncedBytes = $derived(sv(sections, 'Sync Backlog', 'unsynced_bytes'))
  const heldObjects = $derived(sv(sections, 'Sync Backlog', 'held_objects'))
  const oldestAgeSec = $derived(sv(sections, 'Sync Backlog', 'oldest_unsynced_age_seconds'))

  // Storage capacity (only emitted when statfs succeeded)
  const hasCap = $derived(sections.some((s) => s.name === 'Storage Capacity'))
  const capTotal = $derived(sv(sections, 'Storage Capacity', 'storage_total_bytes'))
  const capUsed = $derived(sv(sections, 'Storage Capacity', 'storage_used_bytes'))
  const capFree = $derived(sv(sections, 'Storage Capacity', 'storage_free_bytes'))
  const capPct = $derived(capTotal > 0 ? Math.round((capUsed / capTotal) * 100) : 0)

  // HA / replication health (the "HA State" section is present only once the block data plane is up)
  const hasHA = $derived(sections.some((s) => s.name === 'HA State'))
  const memberReady = $derived(sv(sections, 'HA State', 'member_ready') === 1)
  const haSynced = $derived(sv(sections, 'HA State', 'ha_synced') === 1)
  const peerCount = $derived(sv(sections, 'HA State', 'peer_count'))
  const replDegraded = $derived(sv(sections, 'HA State', 'replication_degraded') === 1)
  // Overload backpressure: connections refused pre-handshake because the accept-concurrency bound was full.
  const acceptDropped = $derived(sv(sections, 'Block Auth', 'accept_dropped_total'))
  // Inline degraded/bypass S3-floor PUTs in flight (peer-down fallback or disk-full bypass). Non-zero
  // means a write is going straight to S3; a sustained value above the upload gate width is queueing.
  const s3Inflight = $derived(sv(sections, 'Block S3 Floor', 's3_degraded_inflight'))

  type Sev = { color: string; variant: 'success' | 'warning' | 'destructive'; label: string }

  const replication = $derived.by<Sev>(() => {
    if (replDegraded) return { color: 'var(--destructive)', variant: 'destructive', label: 'Degraded' }
    if (peerCount === 0) return { color: 'var(--warning)', variant: 'warning', label: 'Single-node' }
    return { color: 'var(--success)', variant: 'success', label: `Replicating ×${peerCount}` }
  })

  const durability = $derived.by<Sev>(() => {
    if (oldestAgeSec >= DUR_CRIT_SEC) return { color: 'var(--destructive)', variant: 'destructive', label: 'At risk' }
    if (oldestAgeSec >= DUR_WARN_SEC) return { color: 'var(--warning)', variant: 'warning', label: 'Lagging' }
    return { color: 'var(--success)', variant: 'success', label: unsyncedObjects > 0 ? 'Healthy' : 'All synced' }
  })
  // Fill the bar against the SLA ceiling so an aging backlog visibly climbs toward the limit.
  const durFill = $derived(oldestAgeSec > 0 ? Math.min(oldestAgeSec / DUR_CRIT_SEC, 1) : 0)

  const capColor = $derived(capPct > 85 ? 'var(--destructive)' : capPct > 65 ? 'var(--warning)' : 'var(--success)')
  const cacheColor = $derived(
    reads === 0 ? 'var(--muted-foreground)' : hitRatio > 0.9 ? 'var(--success)' : hitRatio > 0.7 ? 'var(--warning)' : 'var(--destructive)',
  )

  function fmtNum(n: number): string { return n.toLocaleString() }
  function fmtRatio(r: number): string { return `${(r * 100).toFixed(1)}%` }
  function fmtLatency(us: number): string { return us > 0 ? formatUs(us) : '-' }
</script>

<Card cornerBrackets={false}>
  <CardHeader>
    <div class="flex items-center justify-between">
      <CardTitle class="text-base">Block Data Plane</CardTitle>
      <Badge variant={durability.variant}>{durability.label}</Badge>
    </div>
  </CardHeader>
  <CardContent class="pt-0 space-y-5">
    <!-- Durability: the operationally critical signal, surfaced first -->
    <div class="space-y-2">
      <div class="flex items-center justify-between gap-2">
        <span class="text-sm font-mono text-muted-foreground tracking-wider uppercase inline-flex items-center gap-1">
          Sync Backlog
          <InfoTip text="Objects acked locally but not yet durable on the shared S3 floor. The oldest age is the durability lag; alert when it exceeds the ~5-10 min sync SLA. Held objects are replica-side copies awaiting the owner's S3 upload." />
        </span>
        <span class="text-sm font-mono tabular-nums font-medium" style="color: {durability.color}">
          {unsyncedObjects === 0 ? 'all synced' : `oldest ${formatUptime(oldestAgeSec)}`}
        </span>
      </div>
      <div class="h-1.5 rounded-sm bg-muted overflow-hidden">
        <div class="h-full rounded-sm origin-left [transition:transform_700ms_ease,background-color_700ms_ease]"
          style="background: {durability.color}; transform: scaleX({durFill})"></div>
      </div>
      <div class="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-sm font-mono text-muted-foreground">
        <span>Unsynced <span class="text-foreground tabular-nums">{fmtNum(unsyncedObjects)}</span> objs</span>
        <span class="text-border">·</span>
        <span class="text-foreground tabular-nums">{formatBytes(unsyncedBytes)}</span>
        <span class="text-border">|</span>
        <span>Held <span class="text-foreground tabular-nums">{fmtNum(heldObjects)}</span></span>
      </div>
    </div>

    <div class="h-px bg-border/60"></div>

    <!-- Capacity (ring) + Read cache (ratio); drop to one column when statfs is unavailable -->
    <div class={hasCap ? 'grid gap-5 sm:grid-cols-2' : ''}>
      {#if hasCap}
        <div class="flex items-start gap-4">
          {@render ringGauge(capPct, 'Disk', capColor, formatBytes(capUsed))}
          <div class="flex-1 min-w-0 space-y-1.5">
            <div class="text-sm font-mono text-muted-foreground tracking-wider uppercase">Storage Capacity</div>
            <div class="flex justify-between text-sm font-mono text-muted-foreground">
              <span>{formatBytes(capUsed)} used</span>
              <span>{formatBytes(capFree)} free</span>
            </div>
            <div class="h-1.5 rounded-sm bg-muted overflow-hidden">
              <div class="h-full rounded-sm origin-left [transition:transform_700ms_ease,background-color_700ms_ease]"
                style="background: {capColor}; transform: scaleX({capPct / 100})"></div>
            </div>
            <div class="text-sm font-mono text-muted-foreground text-right">of {formatBytes(capTotal)}</div>
          </div>
        </div>
      {/if}

      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-sm font-mono text-muted-foreground tracking-wider uppercase">Read Cache</span>
          <span class="text-sm font-mono tabular-nums font-medium" style="color: {cacheColor}">
            {reads === 0 ? 'no reads' : `${fmtRatio(hitRatio)} hit`}
          </span>
        </div>
        <div class="h-1.5 rounded-sm bg-muted overflow-hidden">
          <div class="h-full rounded-sm origin-left [transition:transform_700ms_ease,background-color_700ms_ease]"
            style="background: {cacheColor}; transform: scaleX({hitRatio})"></div>
        </div>
        <div class="grid grid-cols-2 gap-x-6 gap-y-1 text-sm font-mono">
          <div class="flex justify-between">
            <span class="text-muted-foreground">Hits</span>
            <span class="tabular-nums">{fmtNum(cacheHit)}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-muted-foreground">Misses</span>
            <span class="tabular-nums">{fmtNum(cacheMiss)}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="h-px bg-border/60"></div>

    <!-- S3 floor latency -->
    <div class="space-y-1.5">
      <span class="text-sm font-mono text-muted-foreground tracking-wider uppercase">S3 Floor Latency</span>
      <div class="grid grid-cols-2 gap-2">
        {@render latencyTile('GET', s3Get)}
        {@render latencyTile('PUT', s3Put)}
      </div>
    </div>

    {#if hasHA}
      <div class="h-px bg-border/60"></div>

      <!-- HA / replication health: ready-to-serve, S3-history-synced, and whether sibling links are up -->
      <div class="space-y-2">
        <div class="flex items-center justify-between gap-2">
          <span class="text-sm font-mono text-muted-foreground tracking-wider uppercase inline-flex items-center gap-1">
            Replication
            <InfoTip text="Active-active HA health. Member ready = discovery routes client reads here. HA synced = this member's history is on the shared S3 floor. Degraded = a sibling replication link is down, so writes for its keys fall back to the S3 floor (one durable domain until it recovers)." />
          </span>
          <Badge variant={replication.variant}>{replication.label}</Badge>
        </div>
        <div class="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-sm font-mono text-muted-foreground">
          <span>Member <span class="tabular-nums" style="color: {memberReady ? 'var(--success)' : 'var(--warning)'}">{memberReady ? 'ready' : 'not ready'}</span></span>
          <span class="text-border">·</span>
          <span>HA sync <span style="color: {haSynced ? 'var(--success)' : 'var(--muted-foreground)'}">{haSynced ? 'yes' : 'no'}</span></span>
          {#if peerCount > 0}
            <span class="text-border">·</span>
            <span>Peers <span class="text-foreground tabular-nums">{peerCount}</span></span>
          {/if}
          {#if acceptDropped > 0}
            <span class="text-border">|</span>
            <span style="color: var(--destructive)">Conns dropped <span class="tabular-nums">{fmtNum(acceptDropped)}</span></span>
          {/if}
          {#if s3Inflight > 0}
            <span class="text-border">|</span>
            <span style="color: var(--warning)">S3 inflight <span class="tabular-nums">{fmtNum(s3Inflight)}</span></span>
          {/if}
        </div>
      </div>
    {/if}
  </CardContent>
</Card>

{#snippet latencyTile(label: string, us: number)}
  <div class="bg-muted rounded-sm p-2 flex items-center justify-between">
    <span class="text-sm font-mono text-muted-foreground">{label}</span>
    <span class="text-sm font-mono tabular-nums font-medium" style="color: {us > 0 ? latencyColor(us) : 'var(--muted-foreground)'}">
      {fmtLatency(us)}
    </span>
  </div>
{/snippet}

{#snippet ringGauge(pct: number, label: string, color: string, display: string)}
  {@const r = 32}
  {@const circ = 2 * Math.PI * r}
  {@const offset = circ * (1 - pct / 100)}
  <div class="flex flex-col items-center shrink-0">
    <div class="relative w-16 h-16">
      <svg viewBox="0 0 80 80" class="w-full h-full rotate-[-90deg]">
        <circle cx="40" cy="40" r={r} fill="none" stroke="var(--muted)" stroke-width="6" />
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
