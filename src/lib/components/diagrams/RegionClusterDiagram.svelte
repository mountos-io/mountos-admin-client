<script lang="ts">
  import './diagram.css'
</script>

<!-- Ported from mountos-overview RegionClusterTopology: HUB, region, and the
     clusters inside it. Uses the shared diagram.css tokens. -->
<svg
  class="diagram-svg"
  viewBox="-20 0 1240 806"
  width="1240"
  height="806"
  xmlns="http://www.w3.org/2000/svg"
  role="img"
  aria-label="mountOS hierarchical topology: a client resolves its volume at the global HUB, then talks to the owning region cluster. Each region owns its database and vault, points at S3-compatible or Azure object storage, and is partitioned into one or more clusters that run dataserv and gcserv. A region also runs block storage as independent 2-node copysets, admin-adjustable in count, backed by the object storage."
>
  <defs>
    <marker id="rc-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--d-stroke)" />
    </marker>
    <marker id="rc-arrow-muted" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--d-stroke-muted)" />
    </marker>
    <marker id="rc-arrow-accent" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--d-accent)" />
    </marker>
    <marker id="rc-bi-end" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--d-stroke)" />
    </marker>
    <marker id="rc-bi-start" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="5" markerHeight="5" orient="auto">
      <path d="M 10 0 L 0 5 L 10 10 z" fill="var(--d-stroke)" />
    </marker>
  </defs>

  <!-- ============ Tier 1: client + global HUB ============ -->

  <!-- Client -->
  <g transform="translate(20,40)">
    <rect class="n-client" x="0" y="0" width="250" height="98" rx="8" />
    <text x="20" y="30" class="t-title" style="font-size:15px">mountOS client</text>
    <text x="20" y="54" class="t-small">filesystem mount, S3, HDFS, CSI</text>
    <text x="20" y="74" class="t-small">resolves its volume once, then</text>
    <text x="20" y="90" class="t-small">pins to the owning cluster</text>
  </g>

  <!-- Global HUB: stacked cards = one logical HUB, replicated -->
  <g transform="translate(440,30)">
    <rect class="fill-surface" x="8" y="8" width="300" height="92" rx="8" stroke="var(--d-stroke-muted)" stroke-width="0.75" opacity="0.5" />
    <rect class="fill-surface-alt" x="4" y="4" width="300" height="92" rx="8" stroke="var(--d-stroke-muted)" stroke-width="0.75" />
    <rect class="n-provider" x="0" y="0" width="300" height="92" rx="8" stroke="var(--d-accent)" stroke-width="1.25" />
    <text x="20" y="30" class="t-title" style="font-size:16px">Global HUB</text>
    <text x="20" y="52" class="t-small">appserv</text>
    <text x="20" y="74" class="t-small">discovery, accounts, volumes, topology</text>
    <text x="288" y="30" text-anchor="end" class="t-small t-muted" style="font-size:10px">one logical HUB</text>
    <text x="288" y="48" text-anchor="end" class="t-small t-muted" style="font-size:10px">N instances, HA</text>
  </g>

  <!-- Admin DB -->
  <g transform="translate(792,34)">
    <rect x="0" y="0" width="206" height="84" rx="4" fill="var(--d-surface)" stroke="var(--d-stroke-muted)" stroke-width="1" stroke-dasharray="4 3" />
    <line x1="0" y1="16" x2="206" y2="16" stroke="var(--d-stroke-muted)" stroke-width="0.5" />
    <text x="14" y="36" class="t-title" style="font-size:13px">Admin DB</text>
    <text x="14" y="56" class="t-small" style="font-size:10px">regions, clusters,</text>
    <text x="14" y="72" class="t-small" style="font-size:10px">service nodes, volumes</text>
  </g>

  <!-- Hub vault -->
  <g transform="translate(1018,34)">
    <rect x="0" y="0" width="172" height="84" rx="8" fill="var(--d-surface)" stroke="var(--d-stroke-muted)" stroke-width="1" stroke-dasharray="5 3" />
    <text x="14" y="28" class="t-title" style="font-size:13px">Hub vault</text>
    <text x="14" y="50" class="t-small" style="font-size:10px">HUB signing keys</text>
    <text x="14" y="68" class="t-small" style="font-size:10px">service-verifier set</text>
  </g>

  <!-- HUB-tier edges -->
  <!-- client -> HUB (discovery, control) -->
  <path class="edge-muted" d="M 270 78 C 360 78, 380 76, 440 76" marker-end="url(#rc-arrow-muted)" />
  <text x="300" y="64" class="t-small t-muted" style="font-size:10px">discover: access key → owning cluster</text>
  <!-- HUB <-> Admin DB -->
  <path class="edge-muted" d="M 744 76 L 792 76" marker-end="url(#rc-arrow-muted)" />
  <!-- HUB -> Hub vault -->
  <path class="edge-muted" d="M 744 60 C 900 40, 960 50, 1018 56" marker-end="url(#rc-arrow-muted)" />

  <!-- HUB -> regions (register, resolve, heartbeat) -->
  <path class="edge-muted" d="M 560 122 C 480 170, 420 180, 400 208" marker-end="url(#rc-arrow-muted)" />
  <path class="edge-muted" d="M 640 122 C 840 170, 960 180, 1000 208" marker-end="url(#rc-arrow-muted)" />
  <text x="430" y="180" class="t-small t-muted" style="font-size:10px">register · resolve · heartbeat</text>

  <!-- client -> owning cluster (data plane, solid) -->
  <path class="edge" d="M 90 138 C 60 280, 70 320, 150 360" marker-end="url(#rc-arrow)" />
  <text x="100" y="166" class="t-small" style="font-size:10px">data: custom protocol</text>
  <text x="100" y="182" class="t-small" style="font-size:10px">to the owning cluster</text>

  <!-- ============ Tier 2+3: regions and their clusters ============ -->

  <!-- Region A (expanded) -->
  <g transform="translate(20,210)">
    <rect class="region-frame" x="0" y="0" width="772" height="502" rx="10" />
    <text x="20" y="30" class="t-title" style="font-size:14px">Region · eu-west-1</text>
    <text x="752" y="30" text-anchor="end" class="t-small t-muted">own database, vault · storages on S3-compatible or Azure</text>

    <!-- Cluster: default -->
    <g transform="translate(22,48)">
      <rect x="0" y="0" width="352" height="236" rx="8" fill="var(--d-surface-alt)" stroke="var(--d-accent)" stroke-width="1.25" stroke-dasharray="6 3" />
      <text x="18" y="28" class="t-title" style="font-size:13px">Cluster · default</text>
      <g transform="translate(248,12)">
        <rect x="0" y="0" width="86" height="20" rx="10" fill="var(--d-surface)" stroke="var(--d-stroke-muted)" stroke-width="0.75" />
        <text x="43" y="13.5" text-anchor="middle" class="t-small" style="font-size:9px; letter-spacing:0.1em; text-transform:uppercase">cluster id</text>
      </g>
      <text x="18" y="46" class="t-small" style="font-size:10px">serves only its shard of volumes</text>

      <!-- dataserv: stacked to show the replicated node cluster -->
      <g transform="translate(16,60)">
        <rect class="fill-surface" x="8" y="6" width="320" height="60" rx="6" stroke="var(--d-stroke-muted)" stroke-width="0.75" opacity="0.55" />
        <rect class="fill-surface" x="4" y="3" width="320" height="63" rx="6" stroke="var(--d-stroke-muted)" stroke-width="0.75" />
        <rect class="n-core" x="0" y="0" width="320" height="64" rx="6" />
        <text x="16" y="25" class="t-title" style="font-size:12px">dataserv (meta) · replicated cluster</text>
        <text x="16" y="45" class="t-small" style="font-size:10px">one owner per (volume, fork) · in-memory cache</text>
      </g>
      <!-- gcserv -->
      <g transform="translate(16,134)">
        <rect class="n-edge" x="0" y="0" width="320" height="58" rx="6" />
        <text x="16" y="24" class="t-title" style="font-size:12px">gcserv</text>
        <text x="16" y="44" class="t-small" style="font-size:10px">in dataserv by default · or own pool, per cluster</text>
      </g>
      <text x="176" y="216" text-anchor="middle" class="t-small t-muted" style="font-size:10px">cluster-scoped services</text>
    </g>

    <!-- Cluster: cluster-2 -->
    <g transform="translate(398,48)">
      <rect x="0" y="0" width="352" height="236" rx="8" fill="var(--d-surface)" stroke="var(--d-stroke-muted)" stroke-width="1" stroke-dasharray="6 3" />
      <text x="18" y="28" class="t-title" style="font-size:13px">Cluster · cluster-2</text>
      <text x="18" y="46" class="t-small" style="font-size:10px">independent volume-load partition</text>

      <g transform="translate(16,60)">
        <rect class="fill-surface" x="8" y="6" width="320" height="60" rx="6" stroke="var(--d-stroke-muted)" stroke-width="0.75" opacity="0.55" />
        <rect class="fill-surface" x="4" y="3" width="320" height="63" rx="6" stroke="var(--d-stroke-muted)" stroke-width="0.75" />
        <rect class="n-core" x="0" y="0" width="320" height="64" rx="6" />
        <text x="16" y="25" class="t-title" style="font-size:12px">dataserv (meta) · replicated cluster</text>
        <text x="16" y="45" class="t-small" style="font-size:10px">own shard of (volume, fork) owners</text>
      </g>
      <g transform="translate(16,134)">
        <rect class="n-edge" x="0" y="0" width="320" height="58" rx="6" />
        <text x="16" y="24" class="t-title" style="font-size:12px">gcserv</text>
        <text x="16" y="44" class="t-small" style="font-size:10px">per-cluster cleanup</text>
      </g>
      <text x="176" y="216" text-anchor="middle" class="t-small t-muted" style="font-size:10px">a volume moves between clusters via handover</text>
    </g>

    <!-- Shared regional infrastructure -->
    <g transform="translate(22,300)">
      <text x="0" y="0" class="t-small t-muted" style="font-size:10px">Shared by every cluster in this region</text>
      <!-- region DB -->
      <g transform="translate(0,10)">
        <rect x="0" y="0" width="236" height="64" rx="4" fill="var(--d-surface)" stroke="var(--d-stroke-muted)" stroke-width="1" stroke-dasharray="4 3" />
        <line x1="0" y1="16" x2="236" y2="16" stroke="var(--d-stroke-muted)" stroke-width="0.5" />
        <text x="16" y="38" class="t-title" style="font-size:12px">Region DB</text>
        <text x="16" y="54" class="t-small" style="font-size:9px">MySQL / PostgreSQL wire</text>
      </g>
      <!-- region vault -->
      <g transform="translate(248,10)">
        <rect x="0" y="0" width="236" height="64" rx="8" fill="var(--d-surface)" stroke="var(--d-stroke-muted)" stroke-width="1" stroke-dasharray="4 3" />
        <text x="16" y="28" class="t-title" style="font-size:12px">Region vault</text>
        <text x="16" y="48" class="t-small" style="font-size:9px">keys, verifiers, volume + object creds</text>
      </g>
      <!-- object storage -->
      <g transform="translate(496,10)">
        <rect class="n-storage" x="0" y="0" width="236" height="64" rx="6" />
        <text x="16" y="28" class="t-title" style="font-size:12px">Object storage</text>
        <text x="16" y="48" class="t-small" style="font-size:9px">S3 · GCS · B2 · MinIO · Azure · on-prem</text>
      </g>
    </g>

    <!-- cluster -> shared infra connectors -->
    <path class="edge-muted" d="M 198 284 L 160 310" marker-end="url(#rc-arrow-muted)" />
    <path class="edge-muted" d="M 386 284 C 360 297, 360 297, 360 310" marker-end="url(#rc-arrow-muted)" />
    <path class="edge-muted" d="M 574 284 L 612 310" marker-end="url(#rc-arrow-muted)" />

    <!-- Block storage: a region runs any number of them, each K independent
         2-node copysets; shown as a pile with one copyset as the example -->
    <g transform="translate(22,406)">
      <rect x="12" y="-8" width="730" height="68" rx="8" fill="var(--d-surface-alt)" stroke="var(--d-accent)" stroke-width="1.25" stroke-dasharray="6 3" />
      <rect x="6" y="-4" width="730" height="68" rx="8" fill="var(--d-surface-alt)" stroke="var(--d-accent)" stroke-width="1.25" stroke-dasharray="6 3" />
      <rect x="0" y="0" width="730" height="68" rx="8" fill="var(--d-surface-alt)" stroke="var(--d-accent)" stroke-width="1.25" stroke-dasharray="6 3" />
      <text x="14" y="22" class="t-title" style="font-size:12px">Block storage</text>
      <text x="716" y="22" text-anchor="end" class="t-small t-muted" style="font-size:10px">one copyset shown · admin sets K copysets per storage</text>
      <g transform="translate(14,30)">
        <rect class="n-edge" x="0" y="0" width="320" height="28" rx="5" />
        <text x="160" y="18" text-anchor="middle" class="t-small" style="font-size:10px">member a</text>
        <line x1="326" y1="14" x2="368" y2="14" class="edge-accent" marker-start="url(#rc-bi-start)" marker-end="url(#rc-bi-end)" />
        <rect class="n-edge" x="374" y="0" width="320" height="28" rx="5" />
        <text x="534" y="18" text-anchor="middle" class="t-small" style="font-size:10px">member b</text>
      </g>
    </g>
  </g>

  <!-- Region B (slim, same shape) -->
  <g transform="translate(812,210)">
    <rect class="region-frame" x="0" y="0" width="378" height="464" rx="10" />
    <text x="20" y="30" class="t-title" style="font-size:14px">Region · us-east-1</text>
    <text x="358" y="30" text-anchor="end" class="t-small t-muted">same shape</text>

    <g transform="translate(22,48)">
      <rect x="0" y="0" width="334" height="134" rx="8" fill="var(--d-surface-alt)" stroke="var(--d-accent)" stroke-width="1.25" stroke-dasharray="6 3" />
      <text x="18" y="28" class="t-title" style="font-size:13px">Clusters · 1..N</text>
      <g transform="translate(16,44)">
        <rect class="n-core" x="0" y="0" width="302" height="36" rx="5" />
        <text x="14" y="23" class="t-small" style="font-size:11px">dataserv (meta) · replicated per cluster</text>
      </g>
      <g transform="translate(16,88)">
        <rect class="n-edge" x="0" y="0" width="302" height="32" rx="5" />
        <text x="14" y="21" class="t-small" style="font-size:11px">gcserv</text>
      </g>
    </g>

    <g transform="translate(22,202)">
      <rect x="0" y="0" width="334" height="40" rx="4" fill="var(--d-surface)" stroke="var(--d-stroke-muted)" stroke-width="1" stroke-dasharray="4 3" />
      <text x="14" y="25" class="t-small" style="font-size:11px">Region DB</text>
    </g>
    <g transform="translate(22,252)">
      <rect x="0" y="0" width="334" height="40" rx="8" fill="var(--d-surface)" stroke="var(--d-stroke-muted)" stroke-width="1" stroke-dasharray="4 3" />
      <text x="14" y="25" class="t-small" style="font-size:11px">Region vault</text>
    </g>
    <g transform="translate(22,302)">
      <rect class="n-storage" x="0" y="0" width="334" height="40" rx="6" />
      <text x="14" y="25" class="t-small" style="font-size:11px">Object storage</text>
    </g>
    <g transform="translate(22,362)">
      <!-- block storage: many such groups, shown as a pile (mirrors Region A) -->
      <rect x="6" y="-6" width="334" height="34" rx="6" fill="var(--d-surface-alt)" stroke="var(--d-accent)" stroke-width="1.25" stroke-dasharray="6 3" />
      <rect x="3" y="-3" width="334" height="34" rx="6" fill="var(--d-surface-alt)" stroke="var(--d-accent)" stroke-width="1.25" stroke-dasharray="6 3" />
      <rect x="0" y="0" width="334" height="34" rx="6" fill="var(--d-surface-alt)" stroke="var(--d-accent)" stroke-width="1.25" stroke-dasharray="6 3" />
      <text x="14" y="22" class="t-small" style="font-size:11px">Block storage · K independent 2-node copysets</text>
    </g>
    <text x="189" y="414" text-anchor="middle" class="t-small t-muted" style="font-size:10px">independent DB, vault, and storage</text>
    <text x="189" y="430" text-anchor="middle" class="t-small t-muted" style="font-size:10px">no data crosses a region boundary</text>
  </g>

  <!-- Legend -->
  <g transform="translate(20,766)">
    <line x1="0" y1="0" x2="26" y2="0" class="edge" marker-end="url(#rc-arrow)" />
    <text x="34" y="4" class="t-small">data path (client → owning cluster)</text>
    <line x1="320" y1="0" x2="346" y2="0" class="edge-muted" marker-end="url(#rc-arrow-muted)" />
    <text x="354" y="4" class="t-small">control path (discovery, via HUB)</text>
    <rect x="660" y="-8" width="14" height="14" rx="2" fill="var(--d-surface-alt)" stroke="var(--d-accent)" stroke-width="1.25" stroke-dasharray="4 2" />
    <text x="682" y="4" class="t-small">region cluster</text>
  </g>
</svg>
