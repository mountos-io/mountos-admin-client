<script lang="ts">
  import './diagram.css'
</script>

<!-- High-level only: one name goes in, two paired servers come out. No
     backing infrastructure (client, discovery, object storage) shown here -
     that's covered by the block-storage explainer, not this one. -->
<svg
  class="diagram-svg"
  viewBox="0 0 700 300"
  width="700"
  height="300"
  xmlns="http://www.w3.org/2000/svg"
  role="img"
  aria-label="Registering a copyset: give it a name (or leave it blank to auto-generate one), and two paired servers, each with its own SSD, are created together, named from it. Add multiple registers several such pairs in one step, every name auto-generated."
>
  <defs>
    <marker id="crd-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--d-stroke)" />
    </marker>
    <marker id="crd-bi-start" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M 10 0 L 0 5 L 10 10 z" fill="var(--d-accent)" />
    </marker>
    <marker id="crd-bi-end" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--d-accent)" />
    </marker>
  </defs>

  <!-- Name input -->
  <g transform="translate(20,110)">
    <rect class="n-client" x="0" y="0" width="150" height="70" rx="8" />
    <text x="16" y="28" class="t-title" style="font-size:13px">Copyset name</text>
    <text x="16" y="48" class="t-small">e.g. web-tier-1</text>
    <text x="16" y="62" class="t-small t-muted">(optional)</text>
  </g>

  <!-- Arrow: name -> registration -->
  <path class="edge" d="M 170 145 H 230" marker-end="url(#crd-arrow)" />
  <text x="200" y="135" text-anchor="middle" class="t-small t-muted">register</text>

  <!-- The copyset: two servers, paired, each with its own SSD -->
  <g transform="translate(230,20)">
    <rect x="0" y="0" width="260" height="250" rx="10" fill="var(--d-surface-alt)"
      stroke="var(--d-accent)" stroke-width="1.25" stroke-dasharray="6 3" />
    <text x="18" y="26" class="t-title" style="font-size:13px">Copyset</text>

    <g transform="translate(16,44)">
      <rect class="n-core" x="0" y="0" width="106" height="50" rx="6" />
      <text x="53" y="22" text-anchor="middle" class="t-title" style="font-size:12px">Server</text>
      <text x="53" y="40" text-anchor="middle" class="t-mono" style="font-size:10px">web-tier-1-a</text>
      <line class="edge" x1="53" y1="50" x2="53" y2="60" />
      <rect class="n-storage" x="18" y="60" width="70" height="32" rx="5" />
      <text x="53" y="80" text-anchor="middle" class="t-label" style="font-size:11px">SSD</text>
    </g>
    <g transform="translate(138,44)">
      <rect class="n-core" x="0" y="0" width="106" height="50" rx="6" />
      <text x="53" y="22" text-anchor="middle" class="t-title" style="font-size:12px">Server</text>
      <text x="53" y="40" text-anchor="middle" class="t-mono" style="font-size:10px">web-tier-1-b</text>
      <line class="edge" x1="53" y1="50" x2="53" y2="60" />
      <rect class="n-storage" x="18" y="60" width="70" height="32" rx="5" />
      <text x="53" y="80" text-anchor="middle" class="t-label" style="font-size:11px">SSD</text>
    </g>
    <line class="edge-accent" x1="122" y1="69" x2="138" y2="69" marker-start="url(#crd-bi-start)" marker-end="url(#crd-bi-end)" />
    <text x="130" y="178" text-anchor="middle" class="t-small t-muted">paired together,</text>
    <text x="130" y="192" text-anchor="middle" class="t-small t-muted">always</text>
  </g>

  <!-- Bulk hint: a faint stack behind/beside, "many at once" -->
  <g transform="translate(520,75)" opacity="0.55">
    <rect x="10" y="10" width="150" height="120" rx="10" fill="var(--d-surface-alt)" stroke="var(--d-stroke-muted)" stroke-width="1" stroke-dasharray="5 3" />
    <rect x="5" y="5" width="150" height="120" rx="10" fill="var(--d-surface-alt)" stroke="var(--d-stroke-muted)" stroke-width="1" stroke-dasharray="5 3" />
    <rect x="0" y="0" width="150" height="120" rx="10" fill="var(--d-surface-alt)" stroke="var(--d-stroke-muted)" stroke-width="1" stroke-dasharray="5 3" />
    <text x="75" y="30" text-anchor="middle" class="t-title" style="font-size:12px">Copyset</text>
    <text x="75" y="60" text-anchor="middle" class="t-mono" style="font-size:9px">···-a</text>
    <text x="75" y="76" text-anchor="middle" class="t-mono" style="font-size:9px">···-b</text>
  </g>
  <path class="edge-muted" d="M 490 145 C 500 120, 510 110, 520 110" />
  <text x="595" y="230" text-anchor="middle" class="t-small t-muted">"Add multiple":</text>
  <text x="595" y="246" text-anchor="middle" class="t-small t-muted">many pairs, one step</text>
</svg>
