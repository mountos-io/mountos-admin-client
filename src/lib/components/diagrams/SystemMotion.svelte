<script lang="ts">
  import { onMount } from 'svelte'

  let svgEl: SVGSVGElement

  onMount(() => {
    // ball colors resolve through the theme tokens on .system-motion
    const SPEED = 0.6

    const COLORS = {
      meta: 'var(--sm-c-meta)',
      block: 'var(--sm-c-block)',
      object: 'var(--sm-c-object)',
      ctrl: 'var(--sm-c-ctrl)',
      repl: 'var(--sm-c-repl)',
      secret: 'var(--sm-c-secret)',
      gw: 'var(--sm-c-gw)',
    }

    type Flow = { id: string; c: string; n: number; s: number; ph: number; op?: number; bidi?: boolean }

    // n = concurrent balls, s = px/sec, ph = phase offset (fraction of path)
    const FLOWS: Flow[] = [
      { id: 'dis1', c: COLORS.ctrl, n: 1, s: 55, ph: 0.0, op: 0.6 },
      { id: 'dis2', c: COLORS.ctrl, n: 1, s: 55, ph: 0.33, op: 0.6 },
      { id: 'dis3', c: COLORS.ctrl, n: 1, s: 55, ph: 0.66, op: 0.6 },
      { id: 'meta1', c: COLORS.meta, n: 2, s: 115, ph: 0.0, bidi: true },
      { id: 'meta2', c: COLORS.meta, n: 2, s: 115, ph: 0.33, bidi: true },
      { id: 'meta3', c: COLORS.meta, n: 2, s: 115, ph: 0.66, bidi: true },
      { id: 'blk1', c: COLORS.block, n: 2, s: 115, ph: 0.15, bidi: true },
      { id: 'blk2', c: COLORS.block, n: 2, s: 115, ph: 0.48, bidi: true },
      { id: 'blk3', c: COLORS.block, n: 2, s: 115, ph: 0.81, bidi: true },
      { id: 'dir1', c: COLORS.object, n: 3, s: 135, ph: 0.0, bidi: true },
      { id: 'dir2', c: COLORS.object, n: 3, s: 135, ph: 0.4, bidi: true },
      { id: 'dir3', c: COLORS.object, n: 3, s: 135, ph: 0.7, bidi: true },
      { id: 'bo1', c: COLORS.object, n: 2, s: 110, ph: 0.0, bidi: true },
      { id: 'bo2', c: COLORS.object, n: 2, s: 110, ph: 0.5, bidi: true },
      { id: 'dsdb', c: COLORS.object, n: 1, s: 70, ph: 0.0, bidi: true },
      { id: 'hb', c: COLORS.ctrl, n: 1, s: 45, ph: 0.0, op: 0.6, bidi: true },
      { id: 'psdk', c: COLORS.ctrl, n: 1, s: 60, ph: 0.0, op: 0.7, bidi: true },
      { id: 'apsdk', c: COLORS.ctrl, n: 1, s: 60, ph: 0.5, op: 0.7, bidi: true },
      { id: 'pas', c: COLORS.ctrl, n: 1, s: 60, ph: 0.25, op: 0.7 },
      { id: 'sdkhub', c: COLORS.ctrl, n: 1, s: 60, ph: 0.25, op: 0.7, bidi: true },
      { id: 'capp1', c: COLORS.gw, n: 1, s: 60, ph: 0.0, bidi: true },
      { id: 'capp2', c: COLORS.gw, n: 1, s: 60, ph: 0.5, bidi: true },
      { id: 'hadb', c: COLORS.object, n: 1, s: 55, ph: 0.0, bidi: true },
      { id: 'hv', c: COLORS.secret, n: 1, s: 45, ph: 0.0, bidi: true },
      { id: 'rv1', c: COLORS.secret, n: 1, s: 50, ph: 0.0, bidi: true },
      { id: 'rv2', c: COLORS.secret, n: 1, s: 50, ph: 0.5, bidi: true },
      { id: 'gw', c: COLORS.gw, n: 2, s: 100, ph: 0.2, bidi: true },
      { id: 'gwm', c: COLORS.meta, n: 1, s: 80, ph: 0.0, bidi: true },
      { id: 'gwb', c: COLORS.block, n: 1, s: 90, ph: 0.0, bidi: true },
      { id: 'gwo', c: COLORS.object, n: 2, s: 110, ph: 0.3, bidi: true },
      { id: 'raft', c: COLORS.repl, n: 3, s: 70, ph: 0.0 },
      { id: 'peer', c: COLORS.repl, n: 3, s: 70, ph: 0.0 },
      { id: 'rdb1', c: COLORS.repl, n: 1, s: 50, ph: 0.0 },
      { id: 'rdb2', c: COLORS.repl, n: 1, s: 50, ph: 0.5 },
      { id: 'adb1', c: COLORS.repl, n: 1, s: 45, ph: 0.0 },
      { id: 'adb2', c: COLORS.repl, n: 1, s: 45, ph: 0.5 },
    ]

    const NS = 'http://www.w3.org/2000/svg'
    const layer = svgEl.querySelector<SVGGElement>('.particles')!
    type Ball = { g: SVGGElement; path: SVGPathElement; len: number; speed: number; rev: boolean; offset: number }
    const balls: Ball[] = []

    function spawn(f: Flow, path: SVGPathElement, len: number, k: number, rev: boolean) {
      const g = document.createElementNS(NS, 'g')
      const halo = document.createElementNS(NS, 'circle')
      halo.setAttribute('r', rev ? '7' : '9')
      halo.setAttribute('fill', f.c)
      halo.setAttribute('opacity', String(0.16 * (f.op ?? 1)))
      const core = document.createElementNS(NS, 'circle')
      core.setAttribute('r', rev ? '3.2' : '4')
      core.setAttribute('fill', f.c)
      core.setAttribute('opacity', String(f.op ?? 1))
      g.appendChild(halo)
      g.appendChild(core)
      layer.appendChild(g)
      balls.push({ g, path, len, speed: f.s * SPEED, rev, offset: (f.ph + (rev ? 0.5 : 0) + k / f.n) * len })
    }

    for (const f of FLOWS) {
      const path = svgEl.querySelector<SVGPathElement>(`[data-g="${f.id}"]`)!
      const len = path.getTotalLength()
      for (let k = 0; k < f.n; k++) {
        spawn(f, path, len, k, false)
        if (f.bidi) spawn(f, path, len, k, true)
      }
    }

    function place(t: number) {
      for (const b of balls) {
        const d = (t * b.speed + b.offset) % b.len
        const p = b.path.getPointAtLength(b.rev ? b.len - d : d)
        b.g.setAttribute('transform', `translate(${p.x.toFixed(1)},${p.y.toFixed(1)})`)
      }
    }

    let raf = 0
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      place(0)
    } else {
      const t0 = performance.now()
      const tick = (now: number) => {
        place((now - t0) / 1000)
        raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }

    return () => {
      cancelAnimationFrame(raf)
      layer.replaceChildren()
    }
  })
</script>

<figure class="system-motion">
  <svg
    bind:this={svgEl}
    viewBox="0 -130 1680 1075"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="Animated mountOS system diagram: partner systems and the admin system drive the HUB through the SDK, clients and apps reach the region services, a region holds the dataserv raft cluster, region database, vaults, gateways, and block storage peer mesh, all backed by object storage"
  >
    <defs>
      <marker id="sm-arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0,1 L8,5 L0,9" fill="none" stroke="var(--sm-dot)" stroke-width="1.6" />
      </marker>
      <marker id="sm-arr-s" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
        <path d="M0,1 L8,5 L0,9" fill="none" stroke="var(--sm-dot)" stroke-width="2" />
      </marker>
    </defs>

    <!-- frames (bottom layer) -->
    <rect class="frame" x="556" y="224" width="760" height="630" rx="14" opacity="0.3" />
    <rect class="frame" x="548" y="232" width="760" height="630" rx="14" opacity="0.55" />
    <rect class="frame" x="540" y="240" width="760" height="630" rx="14" />
    <rect class="subframe" x="600" y="600" width="460" height="230" rx="10" />

    <!-- visible edges -->
    <g>
      <path class="edge" d="M260,300 H400" />
      <path class="edge" d="M260,500 H400" />
      <path class="edge" d="M260,700 H400" />
      <path class="edge" d="M400,105 V915" />
      <path class="edge" d="M400,105 H592" />
      <path class="edge" d="M400,337 H582" />
      <path class="edge" d="M400,657 H592" />
      <path class="edge" d="M400,915 H1360" />
      <path class="edge" d="M1360,230 V915" />
      <path class="edge" d="M1360,230 H1456" />
      <path class="edge" d="M1360,360 H1456" />
      <path class="edge" d="M1360,490 H1456" />
      <path class="edge" d="M1360,620 H1456" />
      <path class="edge" d="M1060,657 H1360" />
      <path class="edge" d="M1052,337 H1118" />
      <path class="edge" d="M760,240 V168" />
      <path class="edge" d="M880,75 H951" />
      <path class="edge" d="M1100,131 H888" />
      <path class="edge" d="M1120,505 H820 V386" />
      <path class="edge" d="M1120,527 H960 V592" />
      <path class="edge" d="M260,404 H520 V462 H592" />
      <path class="edge" d="M150,372 V338" />
      <path class="edge" d="M150,436 V462" />
      <path class="edge" d="M680,430 V386" />
      <path class="edge" d="M680,494 V592" />
      <path class="edge" d="M760,462 H1360" />
      <path class="edge" d="M608,292 H1032 A20,20 0 0 1 1052,312 V362 A20,20 0 0 1 1032,382 H608 A20,20 0 0 1 588,362 V312 A20,20 0 0 1 608,292 Z" />
      <path class="edge" d="M700,657 L960,657 L830,767 Z" />
      <path class="edge" d="M600,-46 H672" />
      <path class="edge" d="M880,-46 H808" />
      <path class="edge" d="M600,-80 H872" marker-end="url(#sm-arr)" />
      <path class="edge" d="M740,-22 V42" />
      <path class="rlink" d="M1015,66 H1028" marker-end="url(#sm-arr-s)" />
      <path class="rlink" d="M1015,84 H1022 V102 H1028" marker-end="url(#sm-arr-s)" />
      <path class="rlink" d="M1198,325 H1210 V312 H1226" marker-end="url(#sm-arr-s)" />
      <path class="rlink" d="M1198,345 H1210 V364 H1226" marker-end="url(#sm-arr-s)" />
    </g>

    <!-- junction dots -->
    <g>
      <circle class="jdot" cx="400" cy="105" r="3" />
      <circle class="jdot" cx="400" cy="300" r="3" />
      <circle class="jdot" cx="400" cy="337" r="3" />
      <circle class="jdot" cx="400" cy="500" r="3" />
      <circle class="jdot" cx="400" cy="657" r="3" />
      <circle class="jdot" cx="400" cy="700" r="3" />
      <circle class="jdot" cx="400" cy="915" r="3" />
      <circle class="jdot" cx="1360" cy="230" r="3" />
      <circle class="jdot" cx="1360" cy="360" r="3" />
      <circle class="jdot" cx="1360" cy="490" r="3" />
      <circle class="jdot" cx="1360" cy="620" r="3" />
      <circle class="jdot" cx="1360" cy="657" r="3" />
      <circle class="jdot" cx="1360" cy="915" r="3" />
      <circle class="jdot" cx="820" cy="505" r="3" />
      <circle class="jdot" cx="960" cy="527" r="3" />
      <circle class="jdot" cx="520" cy="404" r="3" />
      <circle class="jdot" cx="520" cy="462" r="3" />
      <circle class="jdot" cx="1360" cy="462" r="3" />
    </g>

    <!-- particle guide paths (invisible) -->
    <g>
      <path data-g="dis1" class="guide" d="M260,300 H400 V105 H600" />
      <path data-g="dis2" class="guide" d="M260,500 H400 V105 H600" />
      <path data-g="dis3" class="guide" d="M260,700 H400 V105 H600" />
      <path data-g="meta1" class="guide" d="M260,300 H400 V337 H588" />
      <path data-g="meta2" class="guide" d="M260,500 H400 V337 H588" />
      <path data-g="meta3" class="guide" d="M260,700 H400 V337 H588" />
      <path data-g="blk1" class="guide" d="M260,300 H400 V657 H600" />
      <path data-g="blk2" class="guide" d="M260,500 H400 V657 H600" />
      <path data-g="blk3" class="guide" d="M260,700 H400 V657 H600" />
      <path data-g="dir1" class="guide" d="M260,300 H400 V915 H1360 V490 H1464" />
      <path data-g="dir2" class="guide" d="M260,500 H400 V915 H1360 V620 H1464" />
      <path data-g="dir3" class="guide" d="M260,700 H400 V915 H1360 V490 H1464" />
      <path data-g="bo1" class="guide" d="M1060,657 H1360 V230 H1464" />
      <path data-g="bo2" class="guide" d="M1060,657 H1360 V360 H1464" />
      <path data-g="dsdb" class="guide" d="M1052,337 H1126" />
      <path data-g="hb" class="guide" d="M760,240 V160" />
      <path data-g="hadb" class="guide" d="M880,75 H959" />
      <path data-g="hv" class="guide" d="M1100,131 H880" />
      <path data-g="rv1" class="guide" d="M1120,505 H820 V382" />
      <path data-g="rv2" class="guide" d="M1120,527 H960 V600" />
      <path data-g="gw" class="guide" d="M260,404 H520 V462 H600" />
      <path data-g="gwm" class="guide" d="M680,430 V382" />
      <path data-g="gwb" class="guide" d="M680,494 V600" />
      <path data-g="gwo" class="guide" d="M760,462 H1360 V490 H1464" />
      <path data-g="psdk" class="guide" d="M600,-46 H680" />
      <path data-g="apsdk" class="guide" d="M880,-46 H800" />
      <path data-g="pas" class="guide" d="M600,-80 H880" />
      <path data-g="sdkhub" class="guide" d="M740,-22 V50" />
      <path data-g="capp1" class="guide" d="M150,372 V332" />
      <path data-g="capp2" class="guide" d="M150,436 V468" />
      <path data-g="raft" class="guide" d="M608,292 H1032 A20,20 0 0 1 1052,312 V362 A20,20 0 0 1 1032,382 H608 A20,20 0 0 1 588,362 V312 A20,20 0 0 1 608,292 Z" />
      <path data-g="peer" class="guide" d="M700,657 L960,657 L830,767 Z" />
      <path data-g="rdb1" class="guide" d="M1198,325 H1210 V312 H1234" />
      <path data-g="rdb2" class="guide" d="M1198,345 H1210 V364 H1234" />
      <path data-g="adb1" class="guide" d="M1015,66 H1034" />
      <path data-g="adb2" class="guide" d="M1015,84 H1022 V102 H1034" />
    </g>

    <!-- particles live here, above wires, below boxes (nodes absorb them) -->
    <g class="particles"></g>

    <!-- title -->
    <text class="t-title" x="40" y="60">mountOS</text>
    <text class="t-sub" x="40" y="84">overview</text>

    <!-- partner / admin layer -->
    <g>
      <rect class="box-outer" x="380" y="-96" width="220" height="64" rx="3" />
      <rect class="box-inner" x="385" y="-91" width="210" height="54" rx="2" />
      <text class="t-box" x="490" y="-69" text-anchor="middle">PARTNER SYSTEM</text>
      <text class="t-boxsm" x="490" y="-49" text-anchor="middle">platform · integrations</text>

      <rect class="box-outer" x="880" y="-96" width="220" height="64" rx="3" />
      <rect class="box-inner" x="885" y="-91" width="210" height="54" rx="2" />
      <text class="t-box" x="990" y="-69" text-anchor="middle">ADMIN SYSTEM</text>
      <text class="t-boxsm" x="990" y="-49" text-anchor="middle">portal · backend</text>

      <rect class="box-outer" x="680" y="-70" width="120" height="48" rx="3" />
      <rect class="box-inner" x="684" y="-66" width="112" height="40" rx="2" />
      <text class="t-box" x="740" y="-50" text-anchor="middle" style="font-size:12px">SDK</text>
      <text class="t-boxsm" x="740" y="-34" text-anchor="middle">ts · go · rust</text>

      <text class="t-lbl" x="736" y="-88" text-anchor="middle">delegation · ?token=xxx</text>
      <text class="t-lbl" x="752" y="16">admin api</text>
    </g>

    <!-- clients -->
    <g>
      <rect class="box-outer" x="40" y="268" width="220" height="64" rx="3" />
      <rect class="box-inner" x="45" y="273" width="210" height="54" rx="2" />
      <text class="t-box" x="150" y="295" text-anchor="middle">MOUNT CLIENT</text>
      <text class="t-boxsm" x="150" y="315" text-anchor="middle">macOS · FSKit / FUSE</text>

      <rect class="box-outer" x="40" y="468" width="220" height="64" rx="3" />
      <rect class="box-inner" x="45" y="473" width="210" height="54" rx="2" />
      <text class="t-box" x="150" y="495" text-anchor="middle">MOUNT CLIENT</text>
      <text class="t-boxsm" x="150" y="515" text-anchor="middle">Linux · FUSE · CSI</text>

      <rect class="box-outer" x="40" y="668" width="220" height="64" rx="3" />
      <rect class="box-inner" x="45" y="673" width="210" height="54" rx="2" />
      <text class="t-box" x="150" y="695" text-anchor="middle">MOUNT CLIENT</text>
      <text class="t-boxsm" x="150" y="715" text-anchor="middle">Windows · kernel driver</text>

      <rect class="box-outer" x="40" y="372" width="220" height="64" rx="3" />
      <rect class="box-inner" x="45" y="377" width="210" height="54" rx="2" />
      <text class="t-box" x="150" y="399" text-anchor="middle">APPS</text>
      <text class="t-boxsm" x="150" y="419" text-anchor="middle">s3 sdk · webhdfs</text>
    </g>

    <!-- optional gateways -->
    <g>
      <rect class="box-outer" x="600" y="430" width="160" height="64" rx="3" />
      <rect class="box-inner" x="604" y="434" width="152" height="56" rx="2" />
      <text class="t-box" x="680" y="452" text-anchor="middle" style="font-size:12px">GATEWAY</text>
      <text class="t-boxsm" x="680" y="468" text-anchor="middle">s3 · webhdfs</text>
      <text class="t-boxsm" x="680" y="483" text-anchor="middle">optional</text>
    </g>

    <!-- hub -->
    <g>
      <rect class="hub-outer" x="600" y="50" width="280" height="110" rx="4" />
      <rect class="hub-inner" x="606" y="56" width="268" height="98" rx="3" />
      <text class="t-hub" x="740" y="92" text-anchor="middle">HUB</text>
      <text class="t-boxsm" x="740" y="114" text-anchor="middle">appserv × N · DNS</text>
      <text class="t-boxsm" x="740" y="132" text-anchor="middle">discovery · control</text>
    </g>

    <!-- admin db (primary + replicas) -->
    <g>
      <path class="cyl" d="M959,60 v30 a26,9 0 0 0 52 0 v-30" />
      <ellipse class="cyl" cx="985" cy="60" rx="26" ry="9" />
      <path class="cyl" d="M1034,56 v20 a18,6 0 0 0 36 0 v-20" />
      <ellipse class="cyl" cx="1052" cy="56" rx="18" ry="6" />
      <path class="cyl" d="M1034,92 v20 a18,6 0 0 0 36 0 v-20" />
      <ellipse class="cyl" cx="1052" cy="92" rx="18" ry="6" />
      <text class="t-lbl" x="985" y="148" text-anchor="middle">ADMIN DB · HA</text>
    </g>

    <!-- hub vault (ha) -->
    <g>
      <rect class="vault-box" x="1106" y="104" width="120" height="42" rx="3" opacity="0.55" />
      <rect class="vault-box" x="1100" y="110" width="120" height="42" rx="3" />
      <text class="t-lbl t-amber" x="1160" y="128" text-anchor="middle">VAULT</text>
      <text class="t-boxsm" x="1160" y="143" text-anchor="middle">hub · ha</text>
    </g>

    <!-- region frame labels -->
    <text class="t-lbl t-bright" x="560" y="264">REGION · one of N</text>
    <text class="t-lbl" x="1290" y="264" text-anchor="end">all clusters share db · vault</text>

    <!-- dataserv cluster -->
    <g>
      <rect class="box-outer" x="600" y="303" width="120" height="68" rx="3" />
      <rect class="box-inner" x="604" y="307" width="112" height="60" rx="2" />
      <text class="t-box" x="660" y="322" text-anchor="middle" style="font-size:12px">dataserv</text>
      <text class="t-boxsm" x="660" y="337" text-anchor="middle">meta</text>
      <path class="divider" d="M612,345 H708" />
      <text class="t-boxsm" x="660" y="360" text-anchor="middle">+ gcserv</text>

      <rect class="box-outer" x="760" y="303" width="120" height="68" rx="3" />
      <rect class="box-inner" x="764" y="307" width="112" height="60" rx="2" />
      <text class="t-box" x="820" y="322" text-anchor="middle" style="font-size:12px">dataserv</text>
      <text class="t-boxsm" x="820" y="337" text-anchor="middle">meta</text>
      <path class="divider" d="M772,345 H868" />
      <text class="t-boxsm" x="820" y="360" text-anchor="middle">+ gcserv</text>

      <rect class="box-outer" x="920" y="303" width="120" height="68" rx="3" />
      <rect class="box-inner" x="924" y="307" width="112" height="60" rx="2" />
      <text class="t-box" x="980" y="322" text-anchor="middle" style="font-size:12px">dataserv</text>
      <text class="t-boxsm" x="980" y="337" text-anchor="middle">meta</text>
      <path class="divider" d="M932,345 H1028" />
      <text class="t-boxsm" x="980" y="360" text-anchor="middle">+ gcserv</text>

      <text class="t-lbl" x="820" y="402" text-anchor="middle">raft · ownership sync · one owner per (volume · fork)</text>
    </g>

    <!-- region db (primary + replicas) -->
    <g>
      <path class="cyl" d="M1126,318 v38 a34,11 0 0 0 68 0 v-38" />
      <ellipse class="cyl" cx="1160" cy="318" rx="34" ry="11" />
      <path class="cyl" d="M1234,300 v24 a22,7 0 0 0 44 0 v-24" />
      <ellipse class="cyl" cx="1256" cy="300" rx="22" ry="7" />
      <path class="cyl" d="M1234,352 v24 a22,7 0 0 0 44 0 v-24" />
      <ellipse class="cyl" cx="1256" cy="352" rx="22" ry="7" />
      <text class="t-lbl" x="1200" y="404" text-anchor="middle">REGION DB · HA</text>
    </g>

    <!-- region vault (ha) -->
    <g>
      <rect class="vault-box" x="1126" y="487" width="130" height="44" rx="3" opacity="0.55" />
      <rect class="vault-box" x="1120" y="493" width="130" height="44" rx="3" />
      <text class="t-lbl t-amber" x="1185" y="512" text-anchor="middle">VAULT</text>
      <text class="t-boxsm" x="1185" y="528" text-anchor="middle">region · ha</text>
      <text class="t-boxsm" x="1185" y="556" text-anchor="middle">aws sm · azure kv · gcp · hashicorp</text>
    </g>

    <!-- block storage -->
    <g>
      <text class="t-lbl t-cyan" x="612" y="622">BLOCK STORAGE</text>
      <text class="t-lbl" x="1048" y="850" text-anchor="end">active-active</text>

      <path class="attach" d="M700,684 V696" />
      <rect class="ssd" x="672" y="696" width="56" height="22" rx="3" />
      <text class="t-ssd" x="700" y="711" text-anchor="middle">SSD</text>

      <path class="attach" d="M960,684 V696" />
      <rect class="ssd" x="932" y="696" width="56" height="22" rx="3" />
      <text class="t-ssd" x="960" y="711" text-anchor="middle">SSD</text>

      <path class="attach" d="M830,794 V804" />
      <rect class="ssd" x="802" y="804" width="56" height="22" rx="3" />
      <text class="t-ssd" x="830" y="819" text-anchor="middle">SSD</text>

      <rect class="box-outer" x="640" y="630" width="120" height="54" rx="3" />
      <rect class="box-inner" x="644" y="634" width="112" height="46" rx="2" />
      <text class="t-box" x="700" y="652" text-anchor="middle" style="font-size:12px">BLOCK VOL</text>
      <text class="t-boxsm" x="700" y="670" text-anchor="middle">cluster a</text>

      <rect class="box-outer" x="900" y="630" width="120" height="54" rx="3" />
      <rect class="box-inner" x="904" y="634" width="112" height="46" rx="2" />
      <text class="t-box" x="960" y="652" text-anchor="middle" style="font-size:12px">BLOCK VOL</text>
      <text class="t-boxsm" x="960" y="670" text-anchor="middle">cluster b</text>

      <rect class="box-outer" x="770" y="740" width="120" height="54" rx="3" />
      <rect class="box-inner" x="774" y="744" width="112" height="46" rx="2" />
      <text class="t-box" x="830" y="762" text-anchor="middle" style="font-size:12px">BLOCK VOL</text>
      <text class="t-boxsm" x="830" y="780" text-anchor="middle">cluster c</text>
    </g>

    <!-- object storage -->
    <g>
      <text class="t-lbl t-bright" x="1500" y="172" text-anchor="middle">OBJECT STORAGE</text>
      <text class="t-boxsm" x="1500" y="190" text-anchor="middle">s3 compatible · azure</text>

      <path class="cyl" d="M1464,212 v36 a36,12 0 0 0 72 0 v-36" />
      <ellipse class="cyl" cx="1500" cy="212" rx="36" ry="12" />

      <path class="cyl" d="M1464,342 v36 a36,12 0 0 0 72 0 v-36" />
      <ellipse class="cyl" cx="1500" cy="342" rx="36" ry="12" />

      <path class="cyl" d="M1464,472 v36 a36,12 0 0 0 72 0 v-36" />
      <ellipse class="cyl" cx="1500" cy="472" rx="36" ry="12" />

      <path class="cyl" d="M1464,602 v36 a36,12 0 0 0 72 0 v-36" />
      <ellipse class="cyl" cx="1500" cy="602" rx="36" ry="12" />
    </g>

    <!-- flow labels -->
    <text class="t-lbl" x="452" y="97">discovery</text>
    <text class="t-lbl" x="452" y="329">metadata</text>
    <text class="t-lbl" x="452" y="649">block i/o</text>
    <text class="t-lbl" x="660" y="907">chunks · direct to object storage</text>
    <text class="t-lbl" x="1190" y="649" text-anchor="end">persist chunks</text>

    <!-- legend -->
    <g>
      <circle cx="46" cy="816" r="4" fill="var(--sm-c-meta)" />
      <text class="t-lbl" x="58" y="820">metadata</text>
      <circle cx="216" cy="816" r="4" fill="var(--sm-c-block)" />
      <text class="t-lbl" x="228" y="820">block i/o</text>
      <circle cx="46" cy="846" r="4" fill="var(--sm-c-object)" />
      <text class="t-lbl" x="58" y="850">object parts</text>
      <circle cx="216" cy="846" r="4" fill="var(--sm-c-ctrl)" opacity="0.6" />
      <text class="t-lbl" x="228" y="850">control · discovery</text>
      <circle cx="46" cy="876" r="4" fill="var(--sm-c-repl)" />
      <text class="t-lbl" x="58" y="880">replication</text>
      <circle cx="216" cy="876" r="4" fill="var(--sm-c-secret)" />
      <text class="t-lbl" x="228" y="880">secrets</text>
      <circle cx="46" cy="906" r="4" fill="var(--sm-c-gw)" />
      <text class="t-lbl" x="58" y="910">gateway api</text>
      <text class="t-lbl" x="216" y="910">cluster = logical group</text>
    </g>
  </svg>
</figure>

<style>
  .system-motion {
    /* light theme tokens */
    --sm-bg: #f6f7f9;
    --sm-ink: #22292f;
    --sm-dim: #5f6a74;
    --sm-line: #a3abb4;
    --sm-dot: #8a939c;
    --sm-green: #159552;
    --sm-blue: #3b76d1;
    --sm-amber: #a1701a;
    --sm-panel: #ffffff;
    --sm-hub-fill: #ecf7f0;
    --sm-cyl-fill: #edf2fa;
    --sm-vault-fill: #faf3e0;
    --sm-ssd-fill: #eef0f3;
    --sm-frame: #bfc7cf;
    --sm-frame-fill: rgba(90, 110, 140, 0.05);
    --sm-subframe: #c2c9d0;
    --sm-subframe-fill: rgba(14, 140, 160, 0.04);
    --sm-box-stroke: #98a1aa;
    --sm-box-inner: #b0b8c0;
    --sm-border: #dfe3e8;
    --sm-bright: #444e58;
    --sm-cyan-lbl: #0f7285;
    --sm-c-meta: #414c57;
    --sm-c-block: #0b93a6;
    --sm-c-object: #2f6fdb;
    --sm-c-ctrl: #189948;
    --sm-c-repl: #7443e0;
    --sm-c-secret: #cf8a0a;
    --sm-c-gw: #dd2e5e;
    position: relative;
    margin: 0 0 24px;
    padding: 8px;
    background: var(--sm-bg);
    border-radius: 10px;
    border: 1px solid var(--sm-border);
  }
  :global(.dark) .system-motion {
    --sm-bg: #0a0c0f;
    --sm-ink: #e7eaee;
    --sm-dim: #8a929c;
    --sm-line: #4a5158;
    --sm-dot: #5a6169;
    --sm-green: #2bd877;
    --sm-blue: #6aa7f8;
    --sm-amber: #e8b34b;
    --sm-panel: #0f1318;
    --sm-hub-fill: #0d1712;
    --sm-cyl-fill: #0e1420;
    --sm-vault-fill: #17130b;
    --sm-ssd-fill: #12161b;
    --sm-frame: #3e454e;
    --sm-frame-fill: rgba(120, 140, 170, 0.025);
    --sm-subframe: #39434c;
    --sm-subframe-fill: rgba(90, 215, 232, 0.02);
    --sm-box-stroke: #565b63;
    --sm-box-inner: #7a828c;
    --sm-border: #22272e;
    --sm-bright: #aab2bc;
    --sm-cyan-lbl: #79b8c2;
    --sm-c-meta: #edf1f5;
    --sm-c-block: #5ad7e8;
    --sm-c-object: #6aa7f8;
    --sm-c-ctrl: #4ade80;
    --sm-c-repl: #a78bfa;
    --sm-c-secret: #e8b34b;
    --sm-c-gw: #fb7185;
  }
  .system-motion svg {
    width: 100%;
    height: auto;
    display: block;
  }
  text {
    font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  }
  .t-title { fill: var(--sm-ink); font-size: 24px; font-weight: 700; letter-spacing: 2px; }
  .t-sub   { fill: var(--sm-dim); font-size: 11px; letter-spacing: 1px; }
  .t-box   { fill: var(--sm-ink); font-size: 14px; font-weight: 600; letter-spacing: 2px; }
  .t-boxsm { fill: var(--sm-dim); font-size: 10px; letter-spacing: 1px; }
  .t-lbl   { fill: var(--sm-dim); font-size: 10px; letter-spacing: 1px; }
  .t-hub   { fill: var(--sm-green); font-size: 16px; font-weight: 700; letter-spacing: 3px; }
  .t-ssd   { fill: var(--sm-dim); font-size: 9px; letter-spacing: 2px; }
  .t-amber { fill: var(--sm-amber); }
  .t-bright { fill: var(--sm-bright); }
  .t-cyan  { fill: var(--sm-cyan-lbl); }
  .edge  { stroke: var(--sm-line); stroke-width: 1.6; fill: none; stroke-dasharray: 7 7; }
  .rlink { stroke: var(--sm-line); stroke-width: 1.3; fill: none; stroke-dasharray: 3 3; }
  .frame { stroke: var(--sm-frame); stroke-width: 1.5; fill: var(--sm-frame-fill); stroke-dasharray: 10 8; }
  .subframe { stroke: var(--sm-subframe); stroke-width: 1.2; fill: var(--sm-subframe-fill); stroke-dasharray: 6 6; }
  .jdot  { fill: var(--sm-dot); }
  .guide { fill: none; stroke: none; }
  .box-outer { fill: var(--sm-panel); stroke: var(--sm-box-stroke); stroke-width: 1.4; }
  .box-inner { fill: none; stroke: var(--sm-box-inner); stroke-width: 1; stroke-dasharray: 6 5; }
  .hub-outer { fill: var(--sm-hub-fill); stroke: var(--sm-green); stroke-width: 1.6; }
  .hub-inner { fill: none; stroke: var(--sm-green); stroke-width: 1; stroke-dasharray: 6 5; opacity: 0.7; }
  .vault-box { fill: var(--sm-vault-fill); stroke: var(--sm-amber); stroke-width: 1.3; stroke-dasharray: 6 5; }
  .cyl { fill: var(--sm-cyl-fill); stroke: var(--sm-blue); stroke-width: 1.4; }
  .ssd { fill: var(--sm-ssd-fill); stroke: var(--sm-box-stroke); stroke-width: 1.2; }
  .attach { stroke: var(--sm-box-stroke); stroke-width: 1.4; fill: none; }
  .divider { stroke: var(--sm-box-inner); stroke-width: 1; stroke-dasharray: 3 3; opacity: 0.7; fill: none; }
</style>
