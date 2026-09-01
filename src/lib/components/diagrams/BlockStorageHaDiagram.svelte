<script lang="ts">
  import './diagram.css'

  // Deterministic copyset placement: a block storage is served by K independent
  // 2-node copysets (K admin-adjustable after creation), each created directly as a
  // pair. Placing a copyset's two members on separate racks or availability zones is
  // advised, not enforced or tracked. Copysets replicate peer-to-peer within themselves
  // only; there is no cross-copyset replication or mesh. A volume does not use the whole
  // pool: it draws its own configurable working set of copysets from it (3 by
  // default), so volumes commonly share a copyset. A write hashes deterministically,
  // client-side, to exactly one copyset within the volume's working set.
  const copysets = [
    { key: 1, x: 40, memberA: 'A', memberB: 'B' },
    { key: 2, x: 520, memberA: 'A', memberB: 'B' },
  ]
  const COPYSET_W = 440
  const copysetBottomX: Record<number, number> = { 1: 260, 2: 740 }

  // Illustrative slice of two volumes on this storage: Volume A's working set
  // spans both copysets shown, Volume B's spans only Copyset 2, so Copyset 2
  // is shared between them, the common case.
  const volumes = [
    { key: 'A', x: 60, targets: [1, 2] as const, note: 'working set: 2 shown' },
    { key: 'B', x: 620, targets: [2] as const, note: 'working set: 1 shown · shares Copyset 2' },
  ]
</script>

<!-- Copysets: one block storage = K independent 2-node copysets (2 shown here),
     each two blockserv nodes + attached volumes, created directly as a pair.
     Peer-replicated within the copyset only. A volume draws its own working set
     of copysets from that pool (not the whole pool), so volumes commonly share
     a copyset, illustrated below with two example volumes. Discovery via
     appserv resolves a write to one copyset within the volume's working set.
     Object storage is the durable floor. -->
<svg
  class="diagram-svg"
  viewBox="0 0 1000 850"
  width="1000"
  height="850"
  xmlns="http://www.w3.org/2000/svg"
  role="img"
  aria-label="A block storage is served by K independent 2-node copysets, admin-adjustable in count; two copysets are shown. Each copyset's two blockserv nodes, each with its own attached volume, replicate only within that copyset; copysets never replicate with each other. A volume does not draw on the whole pool: each volume sets its own working-set copyset count, 3 by default and admin-editable, so volumes commonly share a copyset. Two example volumes are shown below the pool: Volume A's working set spans both copysets pictured, Volume B's spans only Copyset 2, so Copyset 2 is shared between them. A client discovers its volume's working-set endpoints via appserv, then resolves each write to one copyset in that working set. Every copyset is backed by the region's object storage."
>
  <defs>
    <marker id="ha-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--d-stroke)" />
    </marker>
    <marker id="ha-arrow-muted" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--d-stroke-muted)" />
    </marker>
    <marker id="ha-arrow-accent" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--d-accent)" />
    </marker>
    <marker id="ha-bi-start" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M 10 0 L 0 5 L 10 10 z" fill="var(--d-accent)" />
    </marker>
    <marker id="ha-bi-end" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--d-accent)" />
    </marker>
  </defs>

  <!-- Client -->
  <g transform="translate(30,28)">
    <rect class="n-client" x="0" y="0" width="260" height="86" rx="8" />
    <text x="18" y="30" class="t-title" style="font-size:14px">mountOS client</text>
    <text x="18" y="52" class="t-small">filesystem · S3 · HDFS · CSI</text>
    <text x="18" y="72" class="t-small">discovers via appserv, connects to its copyset</text>
  </g>

  <!-- appserv: discovery endpoint -->
  <g transform="translate(640,28)">
    <rect class="n-provider" x="0" y="0" width="320" height="86" rx="8" />
    <text x="18" y="30" class="t-title" style="font-size:14px">appserv · discovery endpoint</text>
    <text x="18" y="52" class="t-small">access key → owning region</text>
    <text x="18" y="72" class="t-small">+ this volume's working-set endpoints</text>
  </g>

  <text x="500" y="142" text-anchor="middle" class="t-small t-muted">Block storage pool: K independent copysets, admin-adjustable (2 of K shown)</text>

  <!-- Copysets: the shared pool -->
  {#each copysets as p (p.key)}
    <g transform="translate({p.x},160)">
      <rect x="0" y="20" width={COPYSET_W} height="230" rx="10" fill="var(--d-surface-alt)"
        stroke="var(--d-accent)" stroke-width="1.25" stroke-dasharray="6 3" />
      <text x="16" y="14" class="t-title" style="font-size:13px">Copyset {p.key}</text>

      <!-- Member A -->
      <g transform="translate(20,50)">
        <text x="180" y="-6" text-anchor="end" class="t-small t-muted" style="font-size:10px">Member {p.memberA}</text>
        <g class="n-core">
          <rect x="0" y="0" width="180" height="58" rx="6" />
          <text x="12" y="22" class="t-title" style="font-size:12px">blockserv</text>
          <text x="12" y="40" class="t-small" style="font-size:10px">service node</text>
        </g>
        <line class="edge" x1="90" y1="58" x2="90" y2="70" />
        <rect x="0" y="70" width="180" height="58" rx="6" class="fill-surface" stroke="var(--d-stroke-muted)" stroke-width="1" />
        <text x="12" y="92" class="t-label" style="font-size:11px">volume</text>
        <text x="12" y="110" class="t-mono" style="font-size:10px">BLOCK_VOLUME_ID</text>
      </g>

      <!-- Member B -->
      <g transform="translate(240,50)">
        <text x="180" y="-6" text-anchor="end" class="t-small t-muted" style="font-size:10px">Member {p.memberB}</text>
        <g class="n-core">
          <rect x="0" y="0" width="180" height="58" rx="6" />
          <text x="12" y="22" class="t-title" style="font-size:12px">blockserv</text>
          <text x="12" y="40" class="t-small" style="font-size:10px">service node</text>
        </g>
        <line class="edge" x1="90" y1="58" x2="90" y2="70" />
        <rect x="0" y="70" width="180" height="58" rx="6" class="fill-surface" stroke="var(--d-stroke-muted)" stroke-width="1" />
        <text x="12" y="92" class="t-label" style="font-size:11px">volume</text>
        <text x="12" y="110" class="t-mono" style="font-size:10px">BLOCK_VOLUME_ID</text>
      </g>

      <!-- Peer replication within this copyset only -->
      <line class="edge-accent" x1="204" y1="99" x2="236" y2="99" marker-start="url(#ha-bi-start)" marker-end="url(#ha-bi-end)" />
    </g>
  {/each}

  <!-- client -> appserv (discover) -->
  <path class="edge-muted" d="M 290 64 L 640 64" marker-end="url(#ha-arrow-muted)" />
  <text x="400" y="52" class="t-small t-muted">1 · discover</text>

  <!-- client -> resolved copyset (connect) -->
  <path class="edge-accent" d="M 200 114 C 260 150, 320 170, 380 200" marker-end="url(#ha-arrow-accent)" />
  <text x="255" y="170" class="t-small">2 · connect to resolved copyset</text>

  <text x="500" y="430" text-anchor="middle" class="t-small t-muted">A volume draws its own working set from the pool (3 by default, admin-editable), so volumes commonly share a copyset</text>

  <!-- Volumes: each draws its own working set from the shared pool above -->
  {#each volumes as v (v.key)}
    <g transform="translate({v.x},445)">
      <rect x="0" y="0" width="320" height="80" rx="8" fill="var(--d-surface)"
        stroke="var(--d-stroke-muted)" stroke-width="1" stroke-dasharray="4 3" />
      <text x="16" y="24" class="t-title" style="font-size:12px">Volume {v.key}</text>
      <text x="16" y="44" class="t-small" style="font-size:10px">{v.note}</text>
      <text x="16" y="62" class="t-small t-muted" style="font-size:9px">BLOCK_VOLUME_ID (own copysets, not the whole pool)</text>
    </g>
    {#each v.targets as t (t)}
      <path class="edge-muted" d="M {v.x + 160} 445 L {copysetBottomX[t]} 412" marker-end="url(#ha-arrow-muted)" />
    {/each}
  {/each}
  <text x="500" y="440" text-anchor="middle" class="t-small t-muted" style="font-size:9px">draws from</text>

  <!-- copysets -> object storage: both persist to the same shared floor -->
  <path class="edge-muted" d="M 480 410 L 500 430 L 520 410" />
  <path class="edge-muted" d="M 500 430 L 500 704" marker-end="url(#ha-arrow-muted)" />
  <text x="510" y="580" class="t-small t-muted">persist &amp; fetch parts</text>

  <!-- Object storage -->
  <g transform="translate(70,704)">
    <rect class="n-storage" x="0" y="0" width="860" height="48" rx="8" />
    <text x="20" y="20" class="t-title" style="font-size:12px">Backing object storage · the durable source of truth behind every copyset's cache</text>
    <text x="20" y="38" class="t-small" style="font-size:10px">S3 · GCS · B2 · Azure · MinIO · on-prem</text>
  </g>

  <!-- Legend -->
  <g transform="translate(70,780)">
    <rect x="0" y="-8" width="14" height="14" rx="2" fill="var(--d-surface-alt)" stroke="var(--d-accent)" stroke-width="1.25" stroke-dasharray="4 2" />
    <text x="22" y="4" class="t-small">copyset (shared pool)</text>
    <line x1="190" y1="0" x2="216" y2="0" class="edge-accent" marker-start="url(#ha-bi-start)" marker-end="url(#ha-bi-end)" />
    <text x="224" y="4" class="t-small">peer replication (within a copyset)</text>
    <rect x="530" y="-8" width="14" height="14" rx="2" fill="var(--d-surface)" stroke="var(--d-stroke-muted)" stroke-width="1" stroke-dasharray="3 2" />
    <text x="552" y="4" class="t-small">volume working set</text>
  </g>
  <g transform="translate(70,804)">
    <line x1="0" y1="0" x2="26" y2="0" class="edge-muted" marker-end="url(#ha-arrow-muted)" />
    <text x="34" y="4" class="t-small">draws from / discovery / object storage</text>
  </g>
</svg>
