---
name: mountOS Admin Client
description: Operator console for mountOS infrastructure: accounts, regions, nodes, sessions, alerts.
colors:
  background-light: "oklch(0.95 0.02 94.63)"
  background-dark: "oklch(0.07 0.005 200)"
  foreground-light: "oklch(0.12 0 0)"
  foreground-dark: "oklch(0.93 0.005 200)"
  card-light: "oklch(0.96 0.025 94.63)"
  card-dark: "oklch(0.03 0 0)"
  primary-rust: "oklch(0.54 0.14 39)"
  primary-gold: "oklch(0.78 0.13 92)"
  muted-warm: "oklch(0.92 0.04 94.64)"
  accent-amber-tint: "oklch(0.92 0.06 80)"
  destructive-light: "oklch(0.54 0.24 24.42)"
  destructive-dark: "oklch(0.59 0.20 21)"
  warning-light: "oklch(0.45 0.16 55)"
  warning-dark: "oklch(0.78 0.15 75)"
  success-light: "oklch(0.49 0.17 155)"
  success-dark: "oklch(0.65 0.19 155)"
  border-light: "oklch(0.88 0 0)"
  border-dark: "oklch(0.21 0.008 200)"
  ring-light: "oklch(0.61 0.14 39)"
  ring-dark: "oklch(0.78 0.13 92)"
  bracket-light: "oklch(0.40 0.002 200)"
  bracket-dark: "oklch(0.35 0.002 200)"
  bracket-active-light: "oklch(0.61 0.14 39)"
  bracket-active-dark: "oklch(0.78 0.13 92)"
  grid-line: "oklch(0.30 0.002 200)"
  chart-grayscale-darkest: "oklch(0.30 0.04 50)"
  chart-grayscale-lightest: "oklch(0.70 0.02 50)"
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
  none: "0"
  xs: "calc(0.25rem - 4px)"
  sm: "calc(0.25rem - 2px)"
  md: "0.25rem"
  lg: "calc(0.25rem + 4px)"
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
  card:
    backgroundColor: "{colors.card-light}"
    textColor: "{colors.foreground-light}"
    rounded: "{rounded.md}"
    padding: "16px"
  input:
    backgroundColor: "{colors.card-light}"
    textColor: "{colors.foreground-light}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
    height: "36px"
---

# Design System: mountOS Admin Client

## 1. Overview

**Creative North Star: "The Operator's Console"**

This is a control surface for people who run infrastructure, not a marketing site for people who buy it. The visual language is borrowed from radar terminals, mission-control consoles, and the cyberpunk datacenter trope: warm-on-cold light mode, golden-on-deep-teal dark mode, near-zero radii, corner brackets that frame data without competing with it. Density is the goal. Every pixel either carries information or stays out of the way.

The system rejects the SaaS dashboard reflex of soft cards, rounded edges, decorative gradients, and "let me explain this to you" empty-state illustrations. Operators are experts; the interface treats them as such. There is no hand-holding, no animated mascots, no purple-to-cyan hero gradient. Type is dense, lines are thin, color is rationed. When color appears, it means something: rust-amber for the primary action in light, gold for the primary action in dark, a destructive red-orange that you notice the moment it lands, and entity-coded pastels reserved for tagging objects (nodes, regions, sessions) consistently across the app.

The aesthetic is technical-cyberpunk on a foundation of editorial typography. Headlines tighten to -0.02em, body relaxes to 1.6 line-height, and the system-font stack runs with `cv02 cv03 cv04 cv11` OpenType features so digits and fractions stay legible at small sizes. Light mode reads in daylight; dark mode is built for the 1am incident.

**Key Characteristics:**
- Sharp geometry: 0.25rem max radius, square cards, corner-bracket frames.
- OKLCH-only color, perceptually uniform across light and dark.
- Warm-rust primary (light) and gold primary (dark): not blue, not teal.
- Entity-coded pastels for object tagging (one hue per noun, dark-text-on-tint).
- Flat by default; depth comes from inset top-edge glow on cyber cards, never drop shadows.
- Cyberpunk corner-bracket and clip-path utilities as the brand's visual signature.
- Dense data tables; no decorative whitespace.

## 2. Colors

A narrow OKLCH palette. Warm primary against cool neutrals in light mode; gold primary against deep blue-black neutrals in dark mode. Status colors hold steady (red-orange destructive, amber warning, green success) so muscle memory transfers between themes.

### Primary
- **Rust Amber** (oklch(0.54 0.14 39), light): main interactive accent, focus rings, scrollbar thumb, primary buttons. Read as warm metal, not orange juice.
- **Console Gold** (oklch(0.78 0.13 92), dark): the dark-mode primary. Higher lightness because dark backgrounds amplify perceived saturation; chroma stays moderate to avoid neon glare at 2am.

### Secondary
This system has no secondary accent by design. The "secondary" CSS token is a low-contrast neutral surface, not a brand color. Resist the urge to add one.

### Tertiary (entity-coded pastels)
A 14-key pastel scale used exclusively to tag domain objects (`--pastel-user`, `--pastel-region`, `--pastel-node`, `--pastel-session`, `--pastel-mount`, etc.). Each key has a paired `-text` value at lower lightness for legible labels on tinted chips. Hues are spaced around the wheel so adjacent entity types stay visually distinct. **These are identifiers, not decoration**: a session pill is always cyan-leaning teal, a region pill is always magenta. Don't reassign.

### Neutral
- **Warm Cream** (oklch(0.95 0.02 94.63), light bg): the page surface. Tinted toward the brand hue, never `#fff`.
- **Deep Teal-Black** (oklch(0.07 0.005 200), dark bg): cool to balance the warm primary. Tinted, never `#000`.
- **Card Surface** (oklch(0.96 0.025 94.63) / oklch(0.03 0 0)): one step from background to lift content without shadow.
- **Border** (oklch(0.88 0 0) / oklch(0.21 0.008 200)): hairline divider; rarely thicker than 1px.
- **Muted text** (oklch(0.30 0.08 70) / oklch(0.55 0.01 200)): body copy lives here, not on `foreground`.

### Status
- **Destructive** (oklch(0.54 0.24 24.42) / oklch(0.59 0.20 21)): red-orange that reads as alarm, not Bootstrap-danger pink.
- **Warning** (oklch(0.45 0.16 55) / oklch(0.78 0.15 75)): amber. Reserved for "needs attention" not "FYI".
- **Success** (oklch(0.49 0.17 155) / oklch(0.65 0.19 155)): green. Used for healthy node status and resolved alerts.

### Charts
Five-step grayscale ramp (oklch(0.30 0.04 50) → oklch(0.70 0.02 50)) for time-series and bars. Color in charts is reserved for categorical entity tags (the pastels). When exact values matter, a table beats a chart.

### Named Rules

**The Rationed Color Rule.** Saturated color carries meaning. Primary, destructive, warning, success, and the pastel entity tags are the only saturated families on the page. Everything else, including charts by default, lives in the warm/cool grayscale ramp. If a screen shows three rust-amber elements at once, two of them are wrong.

**The Entity Pastel Lock.** Pastel tokens are bound to entity types one-to-one. A `region` is always `--pastel-region` (magenta). Reusing `--pastel-session` (cyan-teal) for a status badge breaks the operator's mental model.

**The OKLCH-Only Rule.** All color tokens are authored in OKLCH. New colors are added in OKLCH or not at all. `#fff`, `#000`, `rgb()`, and `hsl()` are forbidden in product code.

## 3. Typography

**Display / Body / Label Font:** system stack (`ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`).
**Mono Font:** `ui-monospace, Menlo, monospace`.

**Character:** the system font does the heavy lifting because it's installed, fast, and operator-familiar. OpenType features (`cv02`, `cv03`, `cv04`, `cv11`) are enabled globally to swap in disambiguated digit and letter forms. Headings tighten (-0.02em), body relaxes (1.6 line-height) for table-dense reading, mono goes wide (0.2em letter-spacing, uppercase) and is reserved for table-header microlabels.

### Hierarchy
- **Display** (600, 1.875rem / 30px, line-height 1.2, tracking -0.02em): page-level titles. One per route.
- **Headline** (600, 1.5rem / 24px, line-height 1.2, tracking -0.02em): card and section heads.
- **Title** (600, 1.25rem / 20px, line-height 1.2): subsection labels inside a card.
- **Body** (400, 1.125rem / 18px, line-height 1.6, tracking -0.01em): default text. Cap line length at 65–75ch where prose appears (rare; this is a data UI).
- **Body Small** (400, 1.0625rem / 17px, line-height 1.5): table cells, dense lists, secondary text.
- **Label** (500, 1rem / 16px, line-height 1.5, tracking -0.01em): button text, form labels.
- **Mono Microlabel** (400, 0.7rem, tracking 0.2em, uppercase via `.th-cyber`): table column headers, technical metadata. Always paired with the scan-line underline on hover.

### Named Rules

**The 18px Body Rule.** Body text never drops below 17px (1.0625rem). Operators read for hours; smaller bodies become hostile.

**The Mono-For-Microlabels-Only Rule.** Mono is reserved for column headers and technical IDs. It is forbidden in body copy, button labels, and headings. Code samples are rare; when they appear, mono is fine. Decorative "console aesthetic" mono in headings is not.

## 4. Elevation

Flat by default. The system avoids drop shadows; depth is signaled with a one-step background lift (background → card) and, on cyberpunk cards, a 1px inset top-edge glow tinted with the active accent. Shadows on hover are tiny halos (24px blur, ~0.07 alpha), not elevation lifts.

### Shadow Vocabulary
- **Cyber Inset Glow** (`box-shadow: inset 0 1px 0 oklch(from var(--accent-glow) l c h / 0.2)`): the resting state of `.card-cyber`. A single hairline of warmth on the top edge, like ambient light caught on a panel.
- **Cyber Hover Halo** (`inset 0 1px 0 oklch(from var(--accent-glow) l c h / 0.5), 0 0 24px oklch(from var(--accent-glow) l c h / 0.07)`): hover-only. Brightens the inset and adds a soft outer bloom. No translation, no scale.

### Named Rules

**The No-Drop-Shadow Rule.** Cards do not float. Standard `box-shadow: 0 N N rgba(0,0,0,...)` is prohibited on container surfaces. If a surface needs to feel "lifted", change its background tone, not its shadow.

**The Glow-Is-State Rule.** The cyber glow appears at rest only on opt-in `.card-cyber` surfaces. Everywhere else, glow signals interaction (hover, focus). It never decorates.

## 5. Components

### Buttons
- **Shape:** `rounded-sm` (≈2px). Square enough to feel built; not knife-edge.
- **Default:** transparent fill, 1px border, foreground text. Hover swaps to `--accent` background. Active scales to 0.98 and tints border with primary at 30% opacity. The default button is a quiet outlined affordance: this is intentional.
- **Primary:** solid `--primary` background (rust in light, gold in dark) with `--primary-foreground` text. Hover dims to 90%, active to 80%, then 0.98 scale. No shadow.
- **Destructive:** outline-only with `--destructive` border and text. Hover fills at 10% destructive tint. Solid red is reserved for irreversible actions, expressed by the destructive *outline* button being the only option in those flows; we don't ship a "destructive primary" filled variant by default.
- **Ghost:** transparent everywhere; hover gets `--accent` background. Used in toolbars and table-row actions.
- **Link:** primary-colored text, underline on hover. No border, no background.
- **Sizes:** `sm` h-32 (8 * 4), `default` h-36, `lg` h-40, `icon` square. Touch targets clear 44px in tap density (table row buttons retain `min-h-[44px] min-w-[44px]` on the parent control).

### Cards
- **Corner Style:** `rounded-md` (0.25rem). Sharp.
- **Background:** `--card` (one step lighter than `--background` in light, deeper in dark).
- **Shadow Strategy:** none by default. Opt into `.card-cyber` for the inset top-edge glow when a card is the canvas for a primary read (region detail header, alerts panel).
- **Border:** 1px hairline `--border`. Cards do not nest. If you need a sub-region inside a card, use a 1px divider or `--accent` background tint, never a second card.
- **Internal Padding:** 16px (`spacing.md`) by default, 24px (`spacing.lg`) for primary content cards.

### Inputs
- **Style:** `--input` background, 1px `--border`, `rounded-sm`. Height matches button `default` (36px) so toolbars line up.
- **Focus:** `--ring` outline at 2px with 2px offset (the global focus-visible rule). The ring color is the active accent; in light mode it's the rust glow, in dark it's gold.
- **Error:** the field gets `aria-invalid` styling: ring shifts to `--destructive/20` and border to `--destructive`. The inline error message uses `--destructive-foreground` on `--destructive/10` background.
- **Autofill:** explicitly themed via `-webkit-text-fill-color` so Chrome's blue autofill never appears.

### Navigation
- **Sidebar surface:** `--sidebar` (matches background in light, near-black in dark) with hairline border `--sidebar-border`.
- **Items:** label-style typography, ghost button hover treatment. Active item uses `--sidebar-accent` background and `--sidebar-accent-foreground` text. No icon-only collapsed mode.
- **Mobile:** full-screen overlay with `--background` solid; no glass blur.

### Signature: Corner Brackets and Cyberpunk Clip-Paths
The brand's visual signature, defined in `src/lib/styles/corner-brackets.css`. Use deliberately and sparingly:
- `.corner-brackets`, `.corner-brackets-lg`, `.corner-brackets-dynamic`: 2px right-angle marks at each corner, drawn with layered `linear-gradient` backgrounds so they stay crisp at any size. Color shifts from neutral to active accent on hover/focus-within.
- `.corner-plus` / `.corner-plus-bl`: a single `+` glyph in a 20px box at top-right (or bottom-left). The "system label" of an interactive surface.
- `.cyberpunk-skewed`, `.cyberpunk-rskewed`, `.cyberpunk-lskewed`, `-lg`, `-sm`: clip-path chamfers that cut opposite corners off a panel. Inner padding handled by `.cyberpunk-skewed-inner` (2rem). Use on hero panels and primary CTAs only; never inside dense lists.
- `.tech-grid`: 20×20px grid background, used as a backdrop for empty states or the topology view canvas.
- `.dashed-connector`: 1px dashed top-border for separator lines between paired stat groups.
- `.th-cyber`: mono microlabel + animated scan-line underline for table column heads. Pair with `thead:has(.th-cyber)` in the parent so the auto-rendered top-left and bottom-right thread brackets appear on the row.

### Sanctioned Cyberpunk Patterns (NOT "decorative gradients")

The "no gradients" rule (§6) targets *gratuitous* gradients: hero-text fades, marketing color washes, multi-stop animated borders, purple-to-cyan splash. The patterns below use `linear-gradient`, `repeating-linear-gradient`, `clip-path`, or low-alpha `box-shadow` to *form* the cyberpunk visual language. They are STRUCTURAL, not decorative, and audits must not strip them:

- **Corner-bracket gradients** (`src/lib/styles/corner-brackets.css`): the 2px right-angle marks themselves are gradient-painted. Don't replace with borders.
- **`.tech-grid` line patterns**: dual `linear-gradient` forming the 20×20 grid backdrop. Brand backdrop, keep.
- **Scan-line overlays** (`.scanlines` in topology, `.th-cyber` underline, `.stat-cyber` hover line): `repeating-linear-gradient` at very low alpha (≤0.04) that gives surfaces the CRT scanline texture. Signature, keep.
- **Toast accent edges & corner stripes** (`src/lib/styles/toast.css`): the partial top/bottom edge lines (`linear-gradient(to right ...) / 100% 1.5px`) and the diagonal corner stripes (`linear-gradient(135deg, currentColor 1px, transparent 1px) / 5px 5px` in the `::before`) are the toast equivalent of corner-brackets — they communicate type-coded severity and frame the chamfered toast. Keep paired with `clip-path` chamfer.
- **Striped "no data" cells**: `repeating-linear-gradient` at 45° on empty matrix cells is a state pattern (absence-of-data semantic), not decoration. Keep where it conveys state.
- **`.card-cyber` inset top-edge glow** (`box-shadow: inset 0 1px 0 ...`): the resting-state warmth on opt-in cyber cards. Hairline only; not a drop shadow.
- **LED ping shadows** (`.led-ping`, `.led-dot`, `.led-raft`): low-radius `box-shadow` glows on small status dots are live-status indicators, not container shadows.
- **Connection-flow dash animations** (`stroke-dasharray` cycling on RAFT topology paths): SVG-stroke animation that conveys traffic direction. Functional, keep.
- **Service-card inset glow** (`.svc-card`): 1px inset top-edge accent matching the `.card-cyber` pattern. Keep at 1px; do NOT inflate to soft 12px-blur depth shadows.

**Audit rule:** any new `linear-gradient`, `repeating-linear-gradient`, animated SVG stroke, or low-alpha glow must either fit one of the sanctioned patterns above or earn an explicit entry here. Default-deny; add when justified.

### Status Indicators
- **LED Ping** (`.led-ping`): a 2.5s ease-in-out pulse on a small dot. Reserved for live-status indicators (node "active polling", session "live"). Respects `prefers-reduced-motion`.
- **Stat Cyber** (`.stat-cyber`): a hover-only horizontal scan-line under a stat cell. Subtle.

## 6. Do's and Don'ts

### Do:
- **Do** author every color in OKLCH. Tint neutrals toward 94° (warm) in light or 200° (cool) in dark; never use `#fff` or `#000`.
- **Do** keep the page flat. If a surface needs separation, change its tone or add a hairline border, not a drop shadow.
- **Do** use entity-coded pastels (`--pastel-region`, `--pastel-node`, etc.) consistently across every screen for the same noun. The pastel is the entity's identity.
- **Do** treat corner brackets and `.cyberpunk-skewed` clip-paths as deliberate ornament: frame the primary content of a route, not every tile in a grid.
- **Do** use `.th-cyber` mono microlabels on table column heads. Tracking 0.2em, uppercase, paired with scan-line hover underline.
- **Do** keep body type at 17–18px and headings tightened to -0.02em. Operators read for hours.
- **Do** apply `min-h-[44px] min-w-[44px]` to interactive elements in dense tables to keep tap targets honest.
- **Do** respect `prefers-reduced-motion`: the global rule already collapses transitions to 0.01ms; don't override it on individual components.

### Don't:
- **Don't** use rounded, bubbly, or playful aesthetics (PRODUCT.md anti-pattern). `--radius` caps at 0.25rem for a reason.
- **Don't** add gratuitous gradients (PRODUCT.md anti-pattern): hero-text fades, multi-stop animated borders, marketing color washes, purple-to-cyan splash. The sanctioned cyberpunk patterns in §5 (corner brackets, tech-grid, scan-lines, toast accent edges & corner stripes, striped no-data cells, LED glows, `.card-cyber` inset, RAFT dash flow) are STRUCTURAL brand signature and must NOT be stripped by audits. Default-deny new gradients; add to the sanctioned list when justified.
- **Don't** add decorative illustrations (PRODUCT.md anti-pattern). Empty states use a `.tech-grid` background and a one-line technical instruction, never an SVG mascot.
- **Don't** ship marketing-style hero sections (PRODUCT.md anti-pattern). This is admin software; there is no "Get Started" splash.
- **Don't** use `border-left` or `border-right` greater than 1px as a colored stripe accent on cards, list items, callouts, or alerts. Use a full hairline border or a tinted background.
- **Don't** use `background-clip: text` with a gradient. Single solid color, weight or size for emphasis.
- **Don't** apply glassmorphism (`backdrop-filter: blur`) decoratively. Mobile sidebar is solid `--background`.
- **Don't** build the SaaS hero-metric template (giant gradient number + small label + supporting stats). Operators want tables.
- **Don't** repeat identical icon-headline-text card grids across a page. Vary density and structure.
- **Don't** reach for a modal as the first interaction pattern. Use inline disclosure, drawers, or full-page transitions.
- **Don't** drop body text below 17px. Don't pad mono into headings or button labels.
- **Don't** nest cards. If you find yourself wrapping a card inside another card, the outer one is the wrong abstraction.
- **Don't** use em dashes anywhere in product copy. Use commas, colons, semicolons, or periods.
- **Don't** introduce a "secondary brand color." This system has one accent; it changes between themes (rust → gold) and that is the entire palette story.
