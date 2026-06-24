<script lang="ts">
  import './diagram.css'
</script>

<!-- Storage type contrast. The object store is the SAME in both rows. The only
     difference is that block hides it behind a block-volume facade (blockserv
     members), so the client never reaches the object store directly. -->
<svg
  class="diagram-svg"
  viewBox="0 0 960 312"
  xmlns="http://www.w3.org/2000/svg"
  role="img"
  aria-label="Two storage types over the same S3-compatible object store. Object: the client reads and writes objects directly against the object store. Block: the client does block I/O against a block-volume facade (the blockserv members), which hides the same object store behind it. The client never reaches the object store directly in block mode."
>
  <defs>
    <marker id="st-bi-start" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M 10 0 L 0 5 L 10 10 z" fill="var(--d-accent)" />
    </marker>
    <marker id="st-bi-end" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--d-accent)" />
    </marker>
    <marker id="st-mbi-start" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M 10 0 L 0 5 L 10 10 z" fill="var(--d-stroke-muted)" />
    </marker>
    <marker id="st-mbi-end" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--d-stroke-muted)" />
    </marker>
  </defs>

  <!-- ===== Object ===== -->
  <text x="24" y="28" class="t-title" style="font-size:14px">Object</text>
  <text x="96" y="28" class="t-small">client reads and writes objects directly</text>

  <g transform="translate(24,44)">
    <rect class="n-client" x="0" y="0" width="200" height="72" rx="8" />
    <text x="16" y="30" class="t-title" style="font-size:13px">mountOS client</text>
    <text x="16" y="52" class="t-small">filesystem · S3 · HDFS · CSI</text>
  </g>

  <!-- Object store: identical box in both rows -->
  <g transform="translate(620,44)">
    <rect class="n-storage" x="0" y="0" width="316" height="72" rx="8" />
    <text x="18" y="30" class="t-title" style="font-size:13px">Object storage (S3-compatible)</text>
    <text x="18" y="52" class="t-small">S3 · GCS · B2 · Azure · MinIO · on-prem</text>
  </g>

  <line class="edge-accent" x1="224" y1="80" x2="620" y2="80" marker-start="url(#st-bi-start)" marker-end="url(#st-bi-end)" />
  <text x="422" y="70" text-anchor="middle" class="t-small">S3-compatible API · direct</text>

  <!-- divider -->
  <line x1="24" y1="150" x2="936" y2="150" stroke="var(--d-stroke-muted)" stroke-width="1" stroke-dasharray="3 4" />

  <!-- ===== Block ===== -->
  <text x="24" y="178" class="t-title" style="font-size:14px">Block</text>
  <text x="84" y="178" class="t-small">same object store, hidden behind a block-volume facade</text>

  <g transform="translate(24,196)">
    <rect class="n-client" x="0" y="0" width="200" height="72" rx="8" />
    <text x="16" y="30" class="t-title" style="font-size:13px">mountOS client</text>
    <text x="16" y="52" class="t-small">filesystem · S3 · HDFS · CSI</text>
  </g>

  <g transform="translate(300,188)">
    <rect class="n-core" x="0" y="0" width="240" height="88" rx="8" />
    <text x="16" y="28" class="t-title" style="font-size:13px">Block volume</text>
    <text x="16" y="50" class="t-small" style="font-size:10px">blockserv members · active-active</text>
    <text x="16" y="70" class="t-small" style="font-size:10px">fronts object store · caches parts</text>
  </g>

  <!-- Same object store box as the object row -->
  <g transform="translate(620,196)">
    <rect class="n-storage" x="0" y="0" width="316" height="72" rx="8" />
    <text x="18" y="30" class="t-title" style="font-size:13px">Object storage (S3-compatible)</text>
    <text x="18" y="52" class="t-small">S3 · GCS · B2 · Azure · MinIO · on-prem</text>
  </g>

  <line class="edge-accent" x1="224" y1="232" x2="300" y2="232" marker-start="url(#st-bi-start)" marker-end="url(#st-bi-end)" />
  <text x="262" y="222" text-anchor="middle" class="t-small">block I/O</text>

  <line class="edge-muted" x1="540" y1="232" x2="620" y2="232" marker-start="url(#st-mbi-start)" marker-end="url(#st-mbi-end)" />
  <text x="580" y="222" text-anchor="middle" class="t-small t-muted">served via</text>

  <text x="24" y="302" class="t-small t-muted">Same object store in both. Block hides it behind the facade, so the client never reaches it directly.</text>
</svg>
