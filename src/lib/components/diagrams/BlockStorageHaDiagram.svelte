<script lang="ts">
  import './diagram.css'

  // Three members in a peer mesh. Each member is a "Block Volume": a blockserv
  // node with its own attached volume, placed in a distinct cluster. Members are
  // equal active-active peers (no primary / failover). 2 HA members means 3 volumes.
  const members = [
    { key: 'A', tx: 350, ty: 150, cluster: 'A' },
    { key: 'B', tx: 70,  ty: 400, cluster: 'B' },
    { key: 'C', tx: 630, ty: 400, cluster: 'C' },
  ]
</script>

<!-- HA mesh: one block storage = up to 3 active-active members, each a blockserv
     node + its own block volume, in distinct clusters, peer-to-peer replicated.
     Discovery via appserv (no DNS). Object storage is the durable floor. -->
<svg
  class="diagram-svg"
  viewBox="0 0 1000 684"
  xmlns="http://www.w3.org/2000/svg"
  role="img"
  aria-label="A block storage has up to three active-active members, each a blockserv node with its own attached block volume in a distinct region cluster. Members replicate peer-to-peer (so two HA members means three volumes). A client discovers the members via appserv and connects directly to any node. Every member is backed by the region's object storage."
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
    <text x="18" y="72" class="t-small">discovers via appserv, connects to any node</text>
  </g>

  <!-- appserv: discovery endpoint -->
  <g transform="translate(640,28)">
    <rect class="n-provider" x="0" y="0" width="320" height="86" rx="8" />
    <text x="18" y="30" class="t-title" style="font-size:14px">appserv · discovery endpoint</text>
    <text x="18" y="52" class="t-small">access key → owning region</text>
    <text x="18" y="72" class="t-small">+ member node addresses (no DNS)</text>
  </g>

  <!-- Peer mesh links (active-active, bidirectional) -->
  <line class="edge-accent" x1="430" y1="300" x2="300" y2="400" marker-start="url(#ha-bi-start)" marker-end="url(#ha-bi-end)" />
  <line class="edge-accent" x1="570" y1="300" x2="700" y2="400" marker-start="url(#ha-bi-start)" marker-end="url(#ha-bi-end)" />
  <line class="edge-accent" x1="370" y1="470" x2="630" y2="470" marker-start="url(#ha-bi-start)" marker-end="url(#ha-bi-end)" />
  <text x="500" y="360" text-anchor="middle" class="t-small" style="fill:var(--d-accent)">active-active peer replication</text>

  <!-- Members -->
  {#each members as m (m.key)}
    <g transform="translate({m.tx},{m.ty})">
      <rect x="0" y="0" width="300" height="150" rx="10" fill="var(--d-surface-alt)"
        stroke="var(--d-accent)" stroke-width="1.25" stroke-dasharray="6 3" />
      <text x="18" y="28" class="t-title" style="font-size:13px">Block Volume</text>
      <text x="282" y="28" text-anchor="end" class="t-small t-muted" style="font-size:11px">Cluster {m.cluster}</text>

      <!-- node (blockserv) -->
      <g transform="translate(16,44)">
        <rect class="n-core" x="0" y="0" width="150" height="76" rx="6" />
        <text x="14" y="26" class="t-title" style="font-size:12px">blockserv</text>
        <text x="14" y="44" class="t-small" style="font-size:10px">service node</text>
        <text x="14" y="62" class="t-small" style="font-size:10px">raw block-device cache</text>
      </g>
      <!-- attach -->
      <line class="edge" x1="166" y1="82" x2="182" y2="82" />
      <!-- attached volume -->
      <g transform="translate(182,44)">
        <rect class="fill-surface" x="0" y="0" width="102" height="76" rx="6" stroke="var(--d-stroke-muted)" stroke-width="1" />
        <text x="12" y="34" class="t-label" style="font-size:11px">volume</text>
        <text x="12" y="54" class="t-mono" style="font-size:10px">BLOCK_VOLUME_ID</text>
      </g>
      <text x="18" y="140" class="t-small t-muted" style="font-size:10px">REGION_CLUSTER_ID = cluster {m.cluster}</text>
    </g>
  {/each}

  <!-- Object storage -->
  <g transform="translate(70,580)">
    <rect class="n-storage" x="0" y="0" width="860" height="48" rx="8" />
    <text x="20" y="20" class="t-title" style="font-size:12px">Backing object storage · the durable source of truth behind every member's cache</text>
    <text x="20" y="38" class="t-small" style="font-size:10px">S3 · GCS · B2 · Azure · MinIO · on-prem</text>
  </g>

  <!-- client -> appserv (discover) -->
  <path class="edge-muted" d="M 290 64 L 640 64" marker-end="url(#ha-arrow-muted)" />
  <text x="400" y="52" class="t-small t-muted">1 · discover</text>

  <!-- client -> members (connect to any node) -->
  <path class="edge-accent" d="M 220 114 C 320 130, 430 138, 480 150" marker-end="url(#ha-arrow-accent)" />
  <text x="300" y="132" class="t-small">2 · connect to any node</text>

  <!-- members -> object storage -->
  <path class="edge-muted" d="M 500 540 L 500 580" marker-end="url(#ha-arrow-muted)" />
  <text x="510" y="566" class="t-small t-muted">persist &amp; fetch parts</text>

  <!-- Legend -->
  <g transform="translate(70,656)">
    <line x1="0" y1="0" x2="26" y2="0" class="edge-accent" marker-start="url(#ha-bi-start)" marker-end="url(#ha-bi-end)" />
    <text x="34" y="4" class="t-small">active-active peers</text>
    <rect x="200" y="-8" width="14" height="14" rx="2" fill="var(--d-surface-alt)" stroke="var(--d-accent)" stroke-width="1.25" stroke-dasharray="4 2" />
    <text x="222" y="4" class="t-small">cluster (fault domain)</text>
    <line x1="420" y1="0" x2="446" y2="0" class="edge-muted" marker-end="url(#ha-arrow-muted)" />
    <text x="454" y="4" class="t-small">discovery / object storage</text>
  </g>
</svg>
