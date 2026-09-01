<script lang="ts">
  import { onMount } from 'svelte'
  import Pause from '@lucide/svelte/icons/pause'
  import Play from '@lucide/svelte/icons/play'
  // Only for the shared --d-flow-* particle-color tokens: everything else in this
  // diagram stays on its own local --sm-* namespace.
  import './diagram.css'

  let svgEl: SVGSVGElement
  let paused = $state(false)
  // false under prefers-reduced-motion: nothing animates, so hide the control
  let animated = $state(false)

  // Bound on the figure itself (not the window): the shortcut only fires while
// focus is inside this diagram, so it never fires while the reader is typing
// or dictating text elsewhere on the page.
  function onKeydown(e: KeyboardEvent) {
    if (!animated || e.metaKey || e.ctrlKey || e.altKey) return
    if (e.key === 'i' || e.key === 'I') {
      paused = !paused
      e.preventDefault()
    }
  }

  onMount(() => {
    // ball colors resolve through the theme tokens on .system-motion
    const SPEED = 0.6

    const COLORS = {
      meta: 'var(--d-flow-meta)',
      block: 'var(--d-flow-block)',
      object: 'var(--d-flow-object)',
      ctrl: 'var(--d-flow-ctrl)',
      repl: 'var(--d-flow-repl)',
      secret: 'var(--d-flow-secret)',
      gw: 'var(--d-flow-gw)',
    }

    // rr overrides the dot's core radius (halo scales with it) for a flow drawn
    // at a smaller scale than the diagram's regular boxes, e.g. the mini copysets.
    type Flow = { id: string; c: string; n: number; s: number; ph: number; op?: number; bidi?: boolean; rr?: number }

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
      { id: 'peer', c: COLORS.repl, n: 2, s: 70, ph: 0.0, bidi: true },
      { id: 'rdb1', c: COLORS.repl, n: 1, s: 50, ph: 0.0 },
      { id: 'rdb2', c: COLORS.repl, n: 1, s: 50, ph: 0.5 },
      { id: 'adb1', c: COLORS.repl, n: 1, s: 45, ph: 0.0 },
      { id: 'adb2', c: COLORS.repl, n: 1, s: 45, ph: 0.5 },
      // sync dot inside each mini copyset icon, scaled down to fit its size
      { id: 'mc1', c: COLORS.repl, n: 1, s: 10, ph: 0.0, bidi: true, rr: 1.3 },
      { id: 'mc2', c: COLORS.repl, n: 1, s: 10, ph: 0.2, bidi: true, rr: 1.3 },
      { id: 'mc3', c: COLORS.repl, n: 1, s: 10, ph: 0.4, bidi: true, rr: 1.3 },
      { id: 'mc4', c: COLORS.repl, n: 1, s: 10, ph: 0.6, bidi: true, rr: 1.3 },
      { id: 'mc5', c: COLORS.repl, n: 1, s: 10, ph: 0.8, bidi: true, rr: 1.3 },
      { id: 'mc6', c: COLORS.repl, n: 1, s: 10, ph: 0.1, bidi: true, rr: 1.3 },
    ]

    const NS = 'http://www.w3.org/2000/svg'
    const layer = svgEl.querySelector<SVGGElement>('.particles')!
    type Ball = { g: SVGGElement; path: SVGPathElement; len: number; speed: number; rev: boolean; offset: number }
    const balls: Ball[] = []

    function spawn(f: Flow, path: SVGPathElement, len: number, k: number, rev: boolean) {
      const g = document.createElementNS(NS, 'g')
      const coreR = f.rr ?? (rev ? 3.2 : 4)
      const haloR = f.rr ? f.rr * 2.2 : (rev ? 7 : 9)
      const halo = document.createElementNS(NS, 'circle')
      halo.setAttribute('r', String(haloR))
      halo.setAttribute('fill', f.c)
      halo.setAttribute('opacity', String(0.16 * (f.op ?? 1)))
      const core = document.createElementNS(NS, 'circle')
      core.setAttribute('r', String(coreR))
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
      animated = true
      // accumulate elapsed time so a pause freezes the clock instead of jumping
      let acc = 0
      let last = performance.now()
      const tick = (now: number) => {
        // while paused the clock freezes and positions are static: skip the recompute
        if (paused) {
          last = now
          raf = requestAnimationFrame(tick)
          return
        }
        acc += now - last
        last = now
        place(acc / 1000)
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

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<!-- The figure itself stays non-interactive; this only catches keydown bubbling up from the
     pause/play button below, so the "i" shortcut can never fire outside this diagram. -->
<figure class="system-motion" onkeydown={onKeydown}>
  {#if animated}
    <button
      type="button"
      class="ctl"
      aria-label={paused ? 'Resume motion' : 'Pause motion'}
      title={paused ? 'Resume motion (i)' : 'Pause motion (i)'}
      onclick={() => (paused = !paused)}
    >
      {#if paused}
        <Play aria-hidden="true" />
      {:else}
        <Pause aria-hidden="true" />
      {/if}
    </button>
  {/if}
  <svg
    bind:this={svgEl}
    viewBox="0 -130 1680 1075"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="Animated mountOS system diagram: partner systems and the admin system drive the HUB through the SDK, clients and apps reach the region services, a region holds dataserv, the region database, vaults, and block storage, all backed by object storage. Block storage is a fleet of copysets, shown as a pile with one copyset open: two blockserv nodes, each with its own SSD, with no primary. A volume draws its own working set of copysets from the fleet rather than the whole fleet, so volumes commonly share a copyset. Apps without a mount reach the same data through the optional gateway embedded in the client"
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
    <!-- block storage pile: a storage is a fleet of copysets, so the group
         frame is stacked (2 ghost layers behind the front, real one) -->
    <rect class="subframe" x="616" y="584" width="460" height="140" rx="10" opacity="0.35" />
    <rect class="subframe" x="608" y="592" width="460" height="140" rx="10" opacity="0.6" />
    <rect class="subframe" x="600" y="600" width="460" height="140" rx="10" />

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
      <path class="edge" d="M260,404 H400" />
      <path class="edge" d="M150,372 V338" />
      <path class="edge" d="M150,436 V462" />
      <path class="edge" d="M608,292 H1032 A20,20 0 0 1 1052,312 V362 A20,20 0 0 1 1032,382 H608 A20,20 0 0 1 588,362 V312 A20,20 0 0 1 608,292 Z" />
      <path class="edge" d="M700,657 H960" />
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
      <circle class="jdot" cx="400" cy="404" r="3" />
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
      <path data-g="gw" class="guide" d="M260,404 H400 V105 H600" />
      <path data-g="gwm" class="guide" d="M260,404 H400 V337 H588" />
      <path data-g="gwb" class="guide" d="M260,404 H400 V657 H600" />
      <path data-g="gwo" class="guide" d="M260,404 H400 V915 H1360 V490 H1464" />
      <path data-g="psdk" class="guide" d="M600,-46 H680" />
      <path data-g="apsdk" class="guide" d="M880,-46 H800" />
      <path data-g="pas" class="guide" d="M600,-80 H880" />
      <path data-g="sdkhub" class="guide" d="M740,-22 V50" />
      <path data-g="capp1" class="guide" d="M150,372 V332" />
      <path data-g="capp2" class="guide" d="M150,436 V468" />
      <path data-g="raft" class="guide" d="M608,292 H1032 A20,20 0 0 1 1052,312 V362 A20,20 0 0 1 1032,382 H608 A20,20 0 0 1 588,362 V312 A20,20 0 0 1 608,292 Z" />
      <path data-g="peer" class="guide" d="M700,657 H960" />
      <path data-g="mc1" class="guide" d="M656,600 H666" />
      <path data-g="mc2" class="guide" d="M726,600 H736" />
      <path data-g="mc3" class="guide" d="M796,600 H806" />
      <path data-g="mc4" class="guide" d="M866,600 H876" />
      <path data-g="mc5" class="guide" d="M936,600 H946" />
      <path data-g="mc6" class="guide" d="M1006,600 H1016" />
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
      <text class="t-box" x="740" y="-50" text-anchor="middle" style="font-size:0.7rem">SDK</text>
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
      <text class="t-box" x="150" y="395" text-anchor="middle">APPS</text>
      <text class="t-boxsm" x="150" y="412" text-anchor="middle">s3 sdk · webhdfs</text>
      <text class="t-boxsm" x="150" y="427" text-anchor="middle">via mountos gateway</text>
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
      <text class="t-box" x="660" y="322" text-anchor="middle" style="font-size:0.7rem">dataserv</text>
      <text class="t-boxsm" x="660" y="337" text-anchor="middle">meta</text>
      <path class="divider" d="M612,345 H708" />
      <text class="t-boxsm" x="660" y="360" text-anchor="middle">+ gcserv</text>

      <rect class="box-outer" x="760" y="303" width="120" height="68" rx="3" />
      <rect class="box-inner" x="764" y="307" width="112" height="60" rx="2" />
      <text class="t-box" x="820" y="322" text-anchor="middle" style="font-size:0.7rem">dataserv</text>
      <text class="t-boxsm" x="820" y="337" text-anchor="middle">meta</text>
      <path class="divider" d="M772,345 H868" />
      <text class="t-boxsm" x="820" y="360" text-anchor="middle">+ gcserv</text>

      <rect class="box-outer" x="920" y="303" width="120" height="68" rx="3" />
      <rect class="box-inner" x="924" y="307" width="112" height="60" rx="2" />
      <text class="t-box" x="980" y="322" text-anchor="middle" style="font-size:0.7rem">dataserv</text>
      <text class="t-boxsm" x="980" y="337" text-anchor="middle">meta</text>
      <path class="divider" d="M932,345 H1028" />
      <text class="t-boxsm" x="980" y="360" text-anchor="middle">+ gcserv</text>

      <text class="t-lbl" x="820" y="402" text-anchor="middle">one owner per (volume · fork)</text>
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

    <!-- block storage: a fleet of copysets (the pile), one copyset shown open.
         A copyset is 2 blockserv nodes, each with its own SSD, peer-syncing
         directly with each other (no primary). A volume draws its own working
         set of copysets from the fleet, so volumes commonly share one. -->
    <g>
      <!-- fleet: several mini copysets (each 2 nodes + SSD + sync, same
           shape as the full-size one below) standing for the pool; one is
           opened below into its full labeled detail -->
      <defs>
        <g id="sm-mini-copyset">
          <rect x="0" y="0" width="12" height="12" rx="1.5" class="box-outer" />
          <rect x="22" y="0" width="12" height="12" rx="1.5" class="box-outer" />
          <path d="M12,6 H22" class="rlink" />
          <rect x="1" y="14" width="10" height="4" rx="1" class="ssd" />
          <rect x="23" y="14" width="10" height="4" rx="1" class="ssd" />
        </g>
      </defs>
      <path class="edge" d="M661,600 H1011" />
      <use href="#sm-mini-copyset" x="644" y="594" />
      <use href="#sm-mini-copyset" x="714" y="594" />
      <use href="#sm-mini-copyset" x="784" y="594" />
      <use href="#sm-mini-copyset" x="854" y="594" />
      <use href="#sm-mini-copyset" x="924" y="594" />
      <use href="#sm-mini-copyset" x="994" y="594" />
      <path class="rlink" d="M801,612 V628" />

      <text class="t-lbl t-cyan" x="612" y="627">BLOCK STORAGE</text>

      <path class="attach" d="M700,684 V696" />
      <rect class="ssd" x="672" y="696" width="56" height="22" rx="3" />
      <text class="t-ssd" x="700" y="711" text-anchor="middle">SSD</text>

      <path class="attach" d="M960,684 V696" />
      <rect class="ssd" x="932" y="696" width="56" height="22" rx="3" />
      <text class="t-ssd" x="960" y="711" text-anchor="middle">SSD</text>

      <rect class="box-outer" x="640" y="630" width="120" height="54" rx="3" />
      <rect class="box-inner" x="644" y="634" width="112" height="46" rx="2" />
      <text class="t-box" x="700" y="652" text-anchor="middle" style="font-size:0.7rem">blockserv</text>
      <text class="t-boxsm" x="700" y="670" text-anchor="middle">placement a</text>

      <rect class="box-outer" x="900" y="630" width="120" height="54" rx="3" />
      <rect class="box-inner" x="904" y="634" width="112" height="46" rx="2" />
      <text class="t-box" x="960" y="652" text-anchor="middle" style="font-size:0.7rem">blockserv</text>
      <text class="t-boxsm" x="960" y="670" text-anchor="middle">placement b</text>

      <text class="t-lbl t-cyan" x="830" y="645" text-anchor="middle">COPYSET</text>
      <text class="t-lbl" x="830" y="670" text-anchor="middle" style="font-size:0.6rem">sync</text>
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
      <circle cx="46" cy="816" r="4" fill="var(--d-flow-meta)" />
      <text class="t-lbl" x="58" y="820">metadata</text>
      <circle cx="216" cy="816" r="4" fill="var(--d-flow-block)" />
      <text class="t-lbl" x="228" y="820">block i/o</text>
      <circle cx="46" cy="846" r="4" fill="var(--d-flow-object)" />
      <text class="t-lbl" x="58" y="850">object parts</text>
      <circle cx="216" cy="846" r="4" fill="var(--d-flow-ctrl)" opacity="0.6" />
      <text class="t-lbl" x="228" y="850">control · discovery</text>
      <circle cx="46" cy="876" r="4" fill="var(--d-flow-repl)" />
      <text class="t-lbl" x="58" y="880">replication</text>
      <circle cx="216" cy="876" r="4" fill="var(--d-flow-secret)" />
      <text class="t-lbl" x="228" y="880">secrets</text>
      <circle cx="46" cy="906" r="4" fill="var(--d-flow-gw)" />
      <text class="t-lbl" x="58" y="910">gateway api</text>
      <text class="t-lbl" x="216" y="910">cluster = logical group</text>
    </g>
  </svg>
</figure>

<style>
  .system-motion {
    /* light theme tokens */
    --sm-bg: oklch(0.98 0 0);
    --sm-ink: oklch(0.28 0.01 244);
    --sm-dim: oklch(0.52 0.02 246);
    --sm-line: oklch(0.74 0.02 251);
    --sm-dot: oklch(0.66 0.02 248);
    --sm-green: oklch(0.59 0.14 153);
    --sm-blue: oklch(0.57 0.15 259);
    --sm-amber: oklch(0.58 0.11 76);
    --sm-panel: oklch(1 0 0);
    --sm-hub-fill: oklch(0.97 0.01 158);
    --sm-cyl-fill: oklch(0.96 0.01 260);
    --sm-vault-fill: oklch(0.96 0.03 90);
    --sm-ssd-fill: oklch(0.95 0 0);
    --sm-frame: oklch(0.83 0.01 248);
    --sm-frame-fill: oklch(0.53 0.05 258 / 0.05);
    --sm-subframe: oklch(0.83 0.01 248);
    --sm-subframe-fill: oklch(0.59 0.1 213 / 0.04);
    --sm-box-stroke: oklch(0.7 0.02 248);
    --sm-box-inner: oklch(0.78 0.01 248);
    --sm-border: oklch(0.91 0.01 254);
    --sm-bright: oklch(0.42 0.02 248);
    --sm-cyan-lbl: oklch(0.51 0.09 215);
    position: relative;
    margin: 0 0 24px;
    padding: 8px;
    background: var(--sm-bg);
    border-radius: var(--radius-xl);
    border: 1px solid var(--sm-border);
  }
  :global(.dark) .system-motion {
    --sm-bg: oklch(0.15 0.01 258);
    --sm-ink: oklch(0.94 0.01 255);
    --sm-dim: oklch(0.66 0.02 254);
    --sm-line: oklch(0.43 0.01 248);
    --sm-dot: oklch(0.49 0.02 252);
    --sm-green: oklch(0.78 0.19 152);
    --sm-blue: oklch(0.72 0.13 256);
    --sm-amber: oklch(0.8 0.13 81);
    --sm-panel: oklch(0.18 0.01 254);
    --sm-hub-fill: oklch(0.19 0.02 162);
    --sm-cyl-fill: oklch(0.19 0.03 264);
    --sm-vault-fill: oklch(0.19 0.02 84);
    --sm-ssd-fill: oklch(0.2 0.01 254);
    --sm-frame: oklch(0.39 0.02 255);
    --sm-frame-fill: oklch(0.64 0.05 258 / 0.025);
    --sm-subframe: oklch(0.38 0.02 246);
    --sm-subframe-fill: oklch(0.82 0.11 208 / 0.02);
    --sm-box-stroke: oklch(0.47 0.01 260);
    --sm-box-inner: oklch(0.6 0.02 254);
    --sm-border: oklch(0.27 0.01 257);
    --sm-bright: oklch(0.76 0.02 254);
    --sm-cyan-lbl: oklch(0.74 0.07 208);
  }
  .system-motion svg {
    width: 100%;
    height: auto;
    display: block;
  }
  .ctl {
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 2;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    border-radius: 4px;
    border: 1px solid var(--sm-border);
    background: var(--sm-panel);
    color: var(--sm-dim);
    cursor: pointer;
  }
  .ctl:hover {
    color: var(--sm-ink);
  }
  .ctl:focus-visible {
    outline: 2px solid var(--sm-blue);
    outline-offset: 2px;
  }
  .ctl :global(svg) {
    width: 16px;
    height: 16px;
  }
  /* comfortable tap target on touch devices; this page is the mobile mirror */
  @media (pointer: coarse) {
    .ctl {
      width: 44px;
      height: 44px;
    }
    .ctl :global(svg) {
      width: 18px;
      height: 18px;
    }
  }
  text {
    font-family: ui-monospace, Menlo, monospace;
  }
  .t-title { fill: var(--sm-ink); font-size: 1.5rem; font-weight: 700; letter-spacing: 2px; }
  .t-sub   { fill: var(--sm-dim); font-size: 0.7rem; letter-spacing: 1px; }
  .t-box   { fill: var(--sm-ink); font-size: 1rem; font-weight: 600; letter-spacing: 2px; }
  .t-boxsm { fill: var(--sm-dim); font-size: 0.7rem; letter-spacing: 1px; }
  .t-lbl   { fill: var(--sm-dim); font-size: 0.7rem; letter-spacing: 1px; }
  .t-hub   { fill: var(--sm-green); font-size: 1rem; font-weight: 700; letter-spacing: 3px; }
  .t-ssd   { fill: var(--sm-dim); font-size: 0.7rem; letter-spacing: 2px; }
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
