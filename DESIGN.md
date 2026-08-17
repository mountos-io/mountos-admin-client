---
name: mountOS Admin Client
description: Operator console for mountOS infrastructure: accounts, regions, nodes, sessions, storage, alerts.
colors:
  background-light: "oklch(0.95 0.02 94.63)"
  background-dark: "oklch(0.07 0.005 200)"
  foreground-light: "oklch(0.12 0 0)"
  foreground-dark: "oklch(0.93 0.005 200)"
  card-light: "oklch(0.96 0.025 94.63)"
  card-dark: "oklch(0.03 0 0)"
  popover-light: "oklch(0.96 0.025 94.63)"
  popover-dark: "oklch(0.09 0.006 200)"
  primary-rust: "oklch(0.54 0.14 39)"
  primary-gold: "oklch(0.78 0.13 92)"
  secondary-light: "oklch(0.94 0 0)"
  secondary-dark: "oklch(0.15 0.005 200)"
  muted-light: "oklch(0.92 0.04 94.64)"
  muted-dark: "oklch(0.09 0.005 200)"
  muted-foreground-light: "oklch(0.42 0.05 70)"
  muted-foreground-dark: "oklch(0.55 0.01 200)"
  label-foreground-light: "oklch(0.42 0.05 70)"
  label-foreground-dark: "oklch(0.55 0.01 200)"
  accent-amber-tint: "oklch(0.92 0.06 80)"
  accent-dark: "oklch(0.16 0.008 200)"
  destructive-light: "oklch(0.54 0.24 24.42)"
  destructive-dark: "oklch(0.59 0.20 21)"
  warning-light: "oklch(0.45 0.16 55)"
  warning-dark: "oklch(0.78 0.15 75)"
  success-light: "oklch(0.49 0.17 155)"
  success-dark: "oklch(0.65 0.19 155)"
  border-light: "oklch(0.88 0 0)"
  border-dark: "oklch(0.21 0.008 200)"
  input-light: "oklch(0.96 0 0)"
  input-dark: "oklch(0.09 0.005 200)"
  ring-light: "oklch(0.61 0.14 39)"
  ring-dark: "oklch(0.78 0.13 92)"
  scrollbar-thumb-light: "oklch(0.61 0.14 39)"
  scrollbar-thumb-dark: "oklch(0.78 0.13 92)"
  chart-darkest-light: "oklch(0.30 0.04 50)"
  chart-lightest-light: "oklch(0.70 0.02 50)"
  pastel-user: "oklch(0.72 0.15 265)"
  pastel-volume: "oklch(0.72 0.15 155)"
  pastel-account: "oklch(0.75 0.14 55)"
  pastel-storage: "oklch(0.72 0.15 200)"
  pastel-role: "oklch(0.72 0.16 15)"
  pastel-region: "oklch(0.72 0.15 310)"
  pastel-mount: "oklch(0.75 0.14 90)"
  pastel-session: "oklch(0.72 0.15 175)"
  pastel-node: "oklch(0.72 0.15 125)"
  pastel-license: "oklch(0.75 0.14 40)"
  pastel-quota: "oklch(0.72 0.15 108)"
  fork-0: "oklch(0.65 0.15 45)"
  fork-1: "oklch(0.62 0.16 160)"
  fork-2: "oklch(0.58 0.16 250)"
typography:
  display:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
    fontFeature: "'cv02', 'cv03', 'cv04', 'cv11'"
  headline:
    fontFamily: "{typography.display.fontFamily}"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: "{typography.display.fontFamily}"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  body:
    fontFamily: "{typography.display.fontFamily}"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "-0.01em"
  body-sm:
    fontFamily: "{typography.display.fontFamily}"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "-0.01em"
  label:
    fontFamily: "{typography.display.fontFamily}"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: "-0.01em"
  mono:
    fontFamily: "ui-monospace, Menlo, monospace"
    fontSize: "0.7rem"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "0.2em"
rounded:
  sm: "0"
  md: "2px"
  lg: "4px"
  xl: "8px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-default:
    backgroundColor: "transparent"
    textColor: "{colors.foreground-light}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
    height: "36px"
  button-primary:
    backgroundColor: "{colors.primary-rust}"
    textColor: "{colors.card-light}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.ring-light}"
  button-destructive:
    backgroundColor: "transparent"
    textColor: "{colors.destructive-light}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
    height: "36px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.foreground-light}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
  button-sm:
    backgroundColor: "transparent"
    textColor: "{colors.foreground-light}"
    rounded: "{rounded.sm}"
    padding: "6px 12px"
    height: "32px"
  card:
    backgroundColor: "{colors.card-light}"
    textColor: "{colors.foreground-light}"
    rounded: "{rounded.md}"
    padding: "16px"
  input:
    backgroundColor: "{colors.input-light}"
    textColor: "{colors.foreground-light}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
    height: "36px"
---

# Design System: mountOS Admin Client

## 1. Overview

**Creative North Star: "The Operator's Console"**

This is a control surface for people who run infrastructure, not a marketing site for people who buy it. The visual language is borrowed from radar terminals, mission-control consoles, and the cyberpunk datacenter trope: warm-on-cold light mode, golden-on-deep-teal dark mode, near-zero radii, corner brackets that frame data without competing with it. Density is the goal. Every pixel either carries information or stays out of the way.

The system rejects the SaaS dashboard reflex of soft cards, rounded edges, decorative gradients, and "let me explain this to you" empty-state illustrations. Operators are experts; the interface treats them as such. There is no hand-holding, no animated mascots, no purple-to-cyan hero gradient. Type is dense, lines are thin, color is rationed. When color appears, it means something: rust-amber for the primary action in light, gold for the primary action in dark, a destructive red-orange that you notice the moment it lands, and entity-coded pastels reserved for tagging objects (nodes, regions, sessions, storage) consistently across the app.

The aesthetic is technical-cyberpunk on a foundation of editorial typography. Headlines tighten to -0.02em, body relaxes to 1.6 line-height, and the system-font stack runs with `cv02 cv03 cv04 cv11` OpenType features so digits and fractions stay legible at small sizes. Light mode reads in daylight; dark mode is built for the 1am incident.

**Key Characteristics:**
- Sharp geometry: `--radius` caps at 0.25rem (4px); `rounded-sm` computes to a true 0px, so buttons are square. Corner-bracket frames, not soft cards.
- OKLCH-only color, perceptually uniform across light and dark. No `#fff`, `#000`, `rgb()`, or `hsl()`.
- Warm-rust primary (light) and gold primary (dark): not blue, not teal.
- A 14-key entity-coded pastel system for object tagging (one hue per noun, paired `-text` value for legible labels on tints).
- Remapped type scale: the smallest step (`text-xs`) is 16px, so no UI text drops below the readable floor.
- Flat by default; depth comes from an inset top-edge glow on cyber cards, never drop shadows.
- Cyberpunk corner-bracket and clip-path utilities as the brand's visual signature.
- Dense data tables; no decorative whitespace.

## 2. Colors

A narrow OKLCH palette. Warm primary against cool neutrals in light mode; gold primary against deep blue-black neutrals in dark mode. Status colors hold steady (red-orange destructive, amber warning, green success) so muscle memory transfers between themes.

### Primary
- **Rust Amber** (`oklch(0.54 0.14 39)`, light): main interactive accent, focus rings (`--ring` `oklch(0.61 0.14 39)`), scrollbar thumb, primary buttons. Reads as warm metal, not orange juice.
- **Console Gold** (`oklch(0.78 0.13 92)`, dark): the dark-mode primary and ring. Higher lightness because dark backgrounds amplify perceived saturation; chroma stays moderate to avoid neon glare at 2am.

### Secondary
This system has no secondary accent by design. The `--secondary` token is a low-contrast neutral surface (`oklch(0.94 0 0)` light / `oklch(0.15 0.005 200)` dark), not a brand color. Resist the urge to add one.

### Tertiary (entity-coded pastels)
A 14-key pastel scale used exclusively to tag domain objects (`--pastel-user`, `--pastel-region`, `--pastel-node`, `--pastel-session`, `--pastel-storage`, `--pastel-mount`, `--pastel-volume`, `--pastel-account`, `--pastel-role`, `--pastel-license`, `--pastel-quota`, and the volume-key/stats/fork variants). Each key has a paired `-text` value at lower lightness for legible labels on tinted chips. Hues are spaced around the wheel so adjacent entity types stay visually distinct. **These are identifiers, not decoration**: a session pill is always cyan-leaning teal (`175`), a region pill is always magenta (`310`). Don't reassign. A separate 8-key `--fork-N` ramp colors volume-fork lineage.

### Neutral
- **Warm Cream** (`oklch(0.95 0.02 94.63)`, light bg): the page surface. Tinted toward the brand hue, never `#fff`.
- **Deep Teal-Black** (`oklch(0.07 0.005 200)`, dark bg): cool to balance the warm primary. Tinted, never `#000`.
- **Card Surface** (`oklch(0.96 0.025 94.63)` / `oklch(0.03 0 0)`): one step from background to lift content without shadow.
- **Border** (`oklch(0.88 0 0)` / `oklch(0.21 0.008 200)`): hairline divider; rarely thicker than 1px.
- **Muted / Label text** (`oklch(0.42 0.05 70)` / `oklch(0.55 0.01 200)`): body copy and field labels live here, not on `foreground`. The light value is tinted warm and dark enough to clear 4.5:1 on the cream surface.

### Status
- **Destructive** (`oklch(0.54 0.24 24.42)` / `oklch(0.59 0.20 21)`): red-orange that reads as alarm, not Bootstrap-danger pink.
- **Warning** (`oklch(0.45 0.16 55)` / `oklch(0.78 0.15 75)`): amber. Reserved for "needs attention" not "FYI".
- **Success** (`oklch(0.49 0.17 155)` / `oklch(0.65 0.19 155)`): green. Used for healthy node status and resolved alerts.

### Charts
Five-step ramp per theme (light `oklch(0.30 0.04 50)` → `oklch(0.70 0.02 50)`; dark gold-tinted `92`) for time-series and bars. Color in charts is reserved for categorical entity tags (the pastels). When exact values matter, a table beats a chart.

### Named Rules

**The Rationed Color Rule.** Saturated color carries meaning. Primary, destructive, warning, success, and the pastel entity tags are the only saturated families on the page. Everything else, including charts by default, lives in the warm/cool grayscale ramp. If a screen shows three rust-amber elements at once, two of them are wrong.

**The Entity Pastel Lock.** Pastel tokens are bound to entity types one-to-one. A `region` is always `--pastel-region` (magenta). Reusing `--pastel-session` (cyan-teal) for a status badge breaks the operator's mental model.

**The OKLCH-Only Rule.** All color tokens are authored in OKLCH. New colors are added in OKLCH or not at all. `#fff`, `#000`, `rgb()`, and `hsl()` are forbidden in product code, including the SVG diagram tokens.

## 3. Typography

**Display / Body / Label Font:** system stack (`ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`).
**Mono Font:** `ui-monospace, Menlo, monospace`.

**Character:** the system font does the heavy lifting because it's installed, fast, and operator-familiar. OpenType features (`cv02`, `cv03`, `cv04`, `cv11`) are enabled globally to swap in disambiguated digit and letter forms. Headings tighten (-0.02em), body relaxes (1.6 line-height, prose 1.7) for table-dense reading, mono goes wide (0.2em letter-spacing, uppercase) and is reserved for table-header microlabels. The Tailwind text scale is deliberately remapped so the smallest step still reads.

### Hierarchy
- **Display** (600, `text-2xl` 1.875rem / 30px, line-height 1.2, tracking -0.02em): page-level titles. One per route.
- **Headline** (600, `text-xl` 1.5rem / 24px, line-height 1.2, tracking -0.02em): card and section heads.
- **Title** (600, `text-lg` 1.25rem / 20px, line-height 1.2): subsection labels inside a card.
- **Body** (400, `text-base` 1.125rem / 18px, line-height 1.6, tracking -0.01em): default text. Cap line length at 65–75ch where prose appears (rare; this is a data UI).
- **Body Small** (400, `text-sm` 1.0625rem / 17px, line-height 1.5): table cells, dense lists, secondary text.
- **Label / Extra-small** (500, `text-xs` 1rem / 16px, line-height 1.5, tracking -0.01em): button text, form labels, callout microcopy. Note: `text-xs` is remapped to 16px, so even the smallest utility class clears the readable floor.
- **Mono Microlabel** (400, 0.7rem, tracking 0.2em, uppercase via `.th-cyber`): table column headers, technical metadata. Always paired with the scan-line underline on hover.

### Named Rules

**The 16px Floor Rule.** The type scale is remapped so `text-xs` = 16px and `text-sm` = 17px. No UI text is authored below 16px; operators read for hours and smaller bodies become hostile. The only exception is the 0.7rem mono microlabel on table headers, which is a technical label, not prose.

**The Mono-For-Microlabels-Only Rule.** Mono is reserved for column headers and technical IDs (endpoints, bucket names, volume IDs). It is forbidden in body copy, button labels, and headings. Decorative "console aesthetic" mono in headings is not allowed.

## 4. Elevation

Flat by default. The system avoids drop shadows; depth is signaled with a one-step background lift (background → card) and, on cyberpunk cards, a 1px inset top-edge glow tinted with the active accent (`--accent-glow`, mapped to `--primary`). Shadows on hover are tiny halos (24px blur, ~0.07 alpha), not elevation lifts.

### Shadow Vocabulary
- **Cyber Inset Glow** (`box-shadow: inset 0 1px 0 oklch(from var(--accent-glow) l c h / 0.2)`): the resting state of `.card-cyber`. A single hairline of warmth on the top edge, like ambient light caught on a panel. Dark mode drops to `/ 0.15`.
- **Cyber Hover Halo** (`inset 0 1px 0 oklch(from var(--accent-glow) l c h / 0.5), 0 0 24px oklch(from var(--accent-glow) l c h / 0.07)`): hover-only. Brightens the inset and adds a soft outer bloom. No translation, no scale.
- **LED Pulse** (`box-shadow: 0 0 6px var(--led)` cycling to `3px`): the only animated shadow, on `.led-ping` live-status dots. Respects `prefers-reduced-motion`.

### Named Rules

**The No-Drop-Shadow Rule.** Cards do not float. Standard `box-shadow: 0 N N rgba(0,0,0,...)` is prohibited on container surfaces. If a surface needs to feel "lifted", change its background tone, not its shadow.

**The Glow-Is-State Rule.** The cyber glow appears at rest only on opt-in `.card-cyber` surfaces. Everywhere else, glow signals interaction (hover, focus). It never decorates.

## 5. Components

### Buttons
- **Shape:** `rounded-sm`, which computes to **0px** (`calc(0.25rem - 4px)`). Buttons are genuinely square; this is intentional, not a bug.
- **Default:** transparent fill, 1px `--border`, foreground text. Hover swaps to `--accent` background and `--foreground/40` border. Active scales to 0.98, tints background `--primary/10` and border `--primary/30`. A quiet outlined affordance by design.
- **Primary:** solid `--primary` background (rust in light, gold in dark) with `--primary-foreground` text and matching border. Hover dims to 90%, active to 80%, then 0.98 scale. `shadow-none`.
- **Destructive:** outline-only with `--destructive` border and text. Hover fills at 10% destructive tint, active 20%. Solid red is reserved for irreversible actions expressed through this outline variant; there is no filled "destructive primary".
- **Outline / Secondary:** transparent with `--border`; hover `--accent` (outline picks up `--accent-foreground`; secondary uses `--accent/50`). Same active tint as default.
- **Ghost:** transparent with transparent border; hover `--accent` background + `--accent-foreground`. Used in toolbars and table-row actions.
- **Link:** `--primary` text, underline on hover, no border/background, active opacity 0.7.
- **Sizes:** `sm` h-8 (32px), `default` h-9 (36px), `lg` h-10 (40px), `icon` size-9 (36px). Base focus is a 2px `--ring` ring at 2px offset.
- **Tap targets:** intrinsic sizes fall below 44px, so interactive elements in dense tables and card footers add `min-h-[44px] min-w-[44px] sm:min-h-8 sm:min-w-8` to honor mobile touch density while staying compact on `sm+`.

### Cards
- **Corner Style:** `rounded-md` (2px). Sharp.
- **Background:** `--card` (one step lighter than `--background` in light, deeper in dark).
- **Shadow Strategy:** none by default. Opt into `.card-cyber` for the inset top-edge glow when a card is the canvas for a primary read. The `cornerBrackets` prop frames a card with the signature corner marks.
- **Border:** 1px hairline `--border`. Cards do not nest. For a sub-region inside a card, use a 1px divider or `--accent` background tint, never a second card.
- **Internal Padding:** 16px (`spacing.md`) by default, 24px (`spacing.lg`) for primary content cards.

### Inputs
- **Style:** `--input` background, 1px `--border`, `rounded-sm` (0px). Height matches button `default` (36px) so toolbars line up.
- **Focus:** global `:focus-visible` rule: 2px `--ring` outline at 2px offset. The ring color is the active accent (rust in light, gold in dark).
- **Error:** `aria-invalid` styling shifts ring to `--destructive/20` and border to `--destructive`. Inline error text uses `--destructive` on `--destructive/10`.
- **Autofill:** explicitly themed via `-webkit-text-fill-color` and an inset box-shadow so Chrome's blue autofill never appears.

### Navigation
- **Sidebar surface:** `--sidebar` (matches background in light, near-black `oklch(0.09 0 0)` in dark) with hairline `--sidebar-border`.
- **Items:** label-style typography, ghost hover treatment. Active item uses `--sidebar-accent` background and `--sidebar-accent-foreground` text. No icon-only collapsed mode.
- **Mobile:** full-screen overlay with solid `--background`; no glass blur.

### Signature: Corner Brackets and Cyberpunk Clip-Paths
The brand's visual signature, defined in `src/lib/styles/corner-brackets.css`. Bracket color maps to `--muted-foreground`, hover/active to `--primary`. Use deliberately and sparingly:
- `.corner-brackets`, `.corner-brackets-lg`, `.corner-brackets-lg-fixed`, `.corner-brackets-dynamic`: 2px right-angle marks at each corner, drawn with layered `linear-gradient` backgrounds so they stay crisp at any size. Color shifts from neutral to active accent on hover/focus-within.
- `.corner-plus` / `.corner-plus-bl`: a single `+` glyph in a 20px box at top-right (or bottom-left). The "system label" of an interactive surface.
- `.cyberpunk-skewed`, `-rskewed`, `-lskewed`, `-lg`, `-sm`: clip-path chamfers cutting corners off a panel. `-sm` (6px cuts) is for buttons; inner padding via `.cyberpunk-skewed-inner` (2rem). Hero panels and primary CTAs only; never inside dense lists.
- `.tech-grid`: 20×20px dual-gradient grid backdrop for empty states and topology canvases.
- `.dashed-connector`: 1px dashed top-border separator between paired stat groups.
- `.th-cyber`: mono microlabel (0.7rem, 0.2em tracking) + animated scan-line underline for table column heads. `thead:has(.th-cyber)` auto-renders the top-left and bottom-right thread brackets on the row.
- `.card-cyber` / `.stat-cyber` / `.led-ping`: inset glow, hover scan-line, and pulsing live-status dot respectively.

### Sanctioned Cyberpunk Patterns (NOT "decorative gradients")

The "no gradients" rule (§6) targets *gratuitous* gradients: hero-text fades, marketing color washes, multi-stop animated borders, purple-to-cyan splash. The patterns below use `linear-gradient`, `repeating-linear-gradient`, `clip-path`, or low-alpha `box-shadow` to *form* the cyberpunk visual language. They are STRUCTURAL, not decorative, and audits must not strip them:

- **Corner-bracket gradients** (`corner-brackets.css`): the 2px right-angle marks are gradient-painted. Don't replace with borders.
- **`.tech-grid` line patterns**: dual `linear-gradient` forming the 20×20 grid backdrop. Brand backdrop, keep.
- **Scan-line overlays** (`.th-cyber` underline, `.stat-cyber` hover line): `linear-gradient` sweeps that give surfaces the CRT scanline texture. Signature, keep.
- **Toast accent edges & corner stripes** (`src/lib/styles/toast.css`): partial top/bottom edge lines and diagonal corner stripes that communicate type-coded severity and frame the chamfered toast. Keep paired with the `clip-path` chamfer.
- **Striped "no data" cells**: `repeating-linear-gradient` at 45° on empty matrix cells is an absence-of-data state pattern, not decoration. Keep where it conveys state.
- **`.card-cyber` inset top-edge glow**: resting-state warmth on opt-in cyber cards. Hairline only; not a drop shadow.
- **LED ping shadows** (`.led-ping`): low-radius `box-shadow` glow on small live-status dots.
- **Connection-flow dash animations** (`stroke-dasharray` cycling on RAFT/topology paths): SVG-stroke animation conveying traffic direction. Functional, keep.
- **Off-pointer readout reveal** (`NodeStatsHistoryChart.svelte`): the all-metrics panel lands in a fixed screen corner, far from the chart under the pointer, so its arrival is announced by a 2px accent outline traced with `stroke-dashoffset` (720ms, then faded out) and a dashed accent tether from the scrubbed crosshair to the panel edge. Accent follows the hovered tile through the `--fork-N` ramp, matching the tile focus chips. Reveal only: the outline never rests on the panel, and the tether exists only while the pointer scrubs. Under `prefers-reduced-motion` the outline holds as a static frame and fades, an intentional override of the global 0.01ms clamp so the cue survives without travel.

**Audit rule:** any new `linear-gradient`, `repeating-linear-gradient`, animated SVG stroke, or low-alpha glow must either fit one of the sanctioned patterns above or earn an explicit entry here. Default-deny; add when justified.

### Diagrams
"How it works" schematics live in `src/lib/components/diagrams/*` with a self-contained `--d-*` OKLCH token set (light + dark) mirrored from `mountos-overview` for cross-repo parity. Each diagram is an SVG with `role="img"` and a full narrative `aria-label`; the shared `DiagramViewer` provides fit-to-width zoom (buttons + `+`/`-`/`0` keyboard on a focusable region). Diagram `--d-*` tokens follow the OKLCH-Only Rule; changing a shared token means mirroring the change back to `mountos-overview`.

## 6. Do's and Don'ts

### Do:
- **Do** author every color in OKLCH. Tint neutrals toward 94° (warm) in light or 200° (cool) in dark; never use `#fff` or `#000`, including in SVG diagram tokens.
- **Do** keep the page flat. If a surface needs separation, change its tone or add a hairline border, not a drop shadow.
- **Do** use entity-coded pastels (`--pastel-region`, `--pastel-node`, `--pastel-storage`, etc.) consistently across every screen for the same noun. The pastel is the entity's identity.
- **Do** treat corner brackets and `.cyberpunk-skewed` clip-paths as deliberate ornament: frame the primary content of a route, not every tile in a grid.
- **Do** use `.th-cyber` mono microlabels on table column heads. Tracking 0.2em, uppercase, paired with scan-line hover underline.
- **Do** keep body type at 17–18px and headings tightened to -0.02em. Operators read for hours.
- **Do** apply `min-h-[44px] min-w-[44px] sm:min-h-8 sm:min-w-8` to interactive elements in dense tables and card footers so mobile tap targets stay honest without bloating desktop.
- **Do** respect `prefers-reduced-motion`: the global rule collapses transitions to 0.01ms and disables `.led-ping`; don't override it on individual components. The single exception is a cue whose whole job is to report a state change the reader would otherwise miss (see the off-pointer readout reveal in §5): there the override replaces travel with a static, timed alternative, it never restores the motion.

### Don't:
- **Don't** use rounded, bubbly, or playful aesthetics. `--radius` caps at 0.25rem and `rounded-sm` is a true 0px for a reason.
- **Don't** add gratuitous gradients: hero-text fades, multi-stop animated borders, marketing color washes, purple-to-cyan splash. The sanctioned cyberpunk patterns in §5 are STRUCTURAL brand signature and must NOT be stripped by audits. Default-deny new gradients; add to the sanctioned list when justified.
- **Don't** add decorative illustrations. Empty states use a `.tech-grid` background and a one-line technical instruction, never an SVG mascot.
- **Don't** ship marketing-style hero sections. This is admin software; there is no "Get Started" splash.
- **Don't** use `border-left` or `border-right` greater than 1px as a colored stripe accent on cards, list items, callouts, or alerts. Use a full hairline border or a tinted background.
- **Don't** use `background-clip: text` with a gradient. Single solid color; weight or size for emphasis.
- **Don't** apply glassmorphism (`backdrop-filter: blur`) decoratively. The mobile sidebar is solid `--background`.
- **Don't** build the SaaS hero-metric template (giant gradient number + small label + supporting stats). Operators want tables.
- **Don't** repeat identical icon-headline-text card grids across a page. Vary density and structure.
- **Don't** reach for a modal as the first interaction pattern. Use inline disclosure, drawers, or full-page transitions; gate only operationally significant actions behind a `ConfirmDialog`.
- **Don't** drop UI text below 16px, and don't pad mono into headings or button labels.
- **Don't** nest cards. If you're wrapping a card inside another card, the outer one is the wrong abstraction.
- **Don't** use em dashes anywhere in product copy. Use commas, colons, semicolons, or periods.
- **Don't** introduce a "secondary brand color." This system has one accent; it changes between themes (rust → gold) and that is the entire palette story.
