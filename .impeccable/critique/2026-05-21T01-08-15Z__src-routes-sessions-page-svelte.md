---
target: sessions list + detail
total_score: 24
p0_count: 1
p1_count: 2
timestamp: 2026-05-21T01-08-15Z
slug: src-routes-sessions-page-svelte
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | Poll selector + inert overlay good; refresh state silent on poll tick |
| 2 | Match System / Real World | 3 | Raw status enums (`disconnected`, `unhealthy`) shown without glossary |
| 3 | User Control and Freedom | 3 | Filter clearing OK; only `volumeId` persists in URL — refresh loses scope |
| 4 | Consistency and Standards | 2 | List uses bespoke `.session-*` chips; detail uses generic `Badge variant` — two vocabularies for the same nouns |
| 5 | Error Prevention | 3 | Inert during load prevents stale clicks |
| 6 | Recognition Rather Than Recall | 2 | Expanded row dumps 11 detail fields + 4 metric groups flat, no section heads |
| 7 | Flexibility and Efficiency | 2 | No keyboard shortcuts, no saved views, no column sort |
| 8 | Aesthetic and Minimalist Design | 2 | Summary strip + count-tags + filter row + result count + poll = 5 competing groups before the table |
| 9 | Error Recovery | 3 | Error card centered; no retry button — operator must reload route |
| 10 | Help and Documentation | 1 | Zero tooltip on σ/μ, status enums, "Inactive" toggle scope |
| **Total** | | **24 / 40** | **Moderate (room to ship craft)** |

## Anti-Patterns Verdict

**LLM assessment**: a Linear/Stripe-fluent operator trusts the list *mostly* — the filter bar, `.th-cyber` headers, and entity-coded pastel chips read native — but pauses at `SessionSummaryStrip` (2rem hero numerals + four lucide icons) which leans into the SaaS hero-metric template that **DESIGN.md §6 explicitly forbids**. The same page already has `.count-tag` styling 10 lines down that proves the operator-grade alternative exists.

**Deterministic scan**: `npx impeccable detect` returned `[]` for both files. No pattern-level slop — the 27 detector rules (gradient text, glassmorphism, side-stripe borders, hero-metric template heuristic, identical card grids) found nothing. The aesthetic violations are higher-order judgment calls the detector can't catch.

**Browser overlays**: skipped (no live dev server in this session).

## Overall Impression

Solidly cyberpunk-operator on the list itself — the filter row, table chrome, and inert-during-refresh interaction are calm and competent. The page falls apart at two seams: (1) the summary strip is a SaaS dashboard pretending to be an operator console; (2) the expanded-row + detail-page transition uses two visual languages for the same domain object. Single biggest opportunity: collapse the summary strip into the `.count-tag` vocabulary already on the page, and the whole surface stops competing with itself.

## What's Working

- **`+page.svelte:147-155`** — `.th-cyber` mono microlabels consistently applied; matches volumes/nodes pages.
- **`+page.svelte:184-188`** — inert overlay with cubic-bezier opacity transition. Calm, non-jittery refresh.
- **`+page.svelte:79-83`** — `sessionDuration()` falls back to `lastHeartbeat` for swept-unhealthy rows so the clock stops ticking forever. Correct operator semantics.

## Priority Issues

**[P0] SessionSummaryStrip violates hero-metric anti-pattern.** `SessionSummaryStrip.svelte:63` uses 2rem 700-weight numerals next to lucide icons — exactly what DESIGN.md §6 forbids ("Don't build the SaaS hero-metric template"). The same page has `.count-tag` styling 10 lines below it (`+page.svelte:111-116`) proving the operator-grade alternative.
**Why**: at 2am the operator wants the *table* to be the peak, not four trophy numerals. The hero numerals invite the eye away from the data.
**Fix**: collapse `SessionSummaryStrip` into the existing `.count-tag` vocabulary; unify both pre-table chip groups into one strip with consistent type scale.
**Suggested**: `/impeccable distill`

**[P1] List and detail use two badge vocabularies for the same nouns.** List uses bespoke outlined mono chips (`.session-platform`, `.session-os`, `.session-region`, `.session-cluster`). Detail (`[id]/+page.svelte:185-194`) uses generic `Badge variant=primary/secondary/default` filled chips.
**Why**: violates the Entity Pastel Lock (§2). Operator clicking through loses entity-color memory across the transition.
**Fix**: detail page adopts the list's chip vocabulary, or both adopt the entity pastels (`--pastel-session`, `--pastel-region`, `--pastel-mount`). One canonical Sessions aesthetic.
**Suggested**: `/impeccable clarify`

**[P1] Expanded row has no visual hierarchy.** `+page.svelte:240-297` stacks "View Details" button → 11-cell identity grid → divider → 4-group metric grid in one flat scroll. No section heads, no `.dashed-connector`, no `.card-cyber` frame on metrics — exactly where it belongs since metrics are the primary diagnostic read at 2am.
**Why**: 4 / 8 cognitive-load failures concentrate here. Expanded state is overwhelming.
**Fix**: wrap metrics in `.card-cyber` with `--accent-glow: var(--pastel-session)`; add `.dashed-connector` between identity and metrics; consider collapsing identity fields behind a "more" toggle.
**Suggested**: `/impeccable layout`

**[P2] Filter state not URL-persisted (except `volumeId`).** Operator refreshing after coffee loses status/platform/region/os filters.
**Why**: heuristic #3 (User Control). Multi-day incidents lose context across page reloads.
**Fix**: mirror the volume-filter URL pattern (`store.setVolumeIdFilter` already does this) for all four other filters.
**Suggested**: `/impeccable harden`

**[P2] "Inactive" checkbox is semantically opaque.** One-word label, no tooltip. Includes `terminated`? `unhealthy`? `disconnected`?
**Why**: heuristic #10 scores 1 across the page; this is the single most visible documentation gap.
**Fix**: rename to "Show closed" + `title=` enumerating included statuses, or pin to status-filter pill row.
**Suggested**: `/impeccable clarify`

## Persona Red Flags

**SRE on-call at 02:00 hunting a stuck session.** Lands on `/sessions`, wants `status=unhealthy` sorted by Heartbeat descending. **Failure**: no column sort; the operator must rely on default `updated_at DESC` and visually re-scan. Expands a row, scans for `connFailures`/`rpcErrors` — `text-destructive` only fires on nonzero, so a value of `12` in muted gray on an otherwise healthy-looking row gets missed in peripheral vision. Clicks "View Details", lands on a page with a *different* badge style — loses place. Peak-end is jittery.

**Multi-tenant admin reviewing cross-account session health.** Lands on `/sessions`, sees "247 / 312 Active" — but the account selector at the top silently scopes the entire view to one tenant. There's no breadcrumb, no scope chip near the H1, no signal that the numbers are one-account-deep. The volume-filter pill at `+page.svelte:93-98` proves the chip-pattern exists; **account scope deserves the same visible chip**.

## Minor Observations

- `+page.svelte:138` shows `·` when `loading && total === 0` but never shows count during a re-poll — total flickers between number and `·` on slow networks.
- `+page.svelte:111` `style="--tc: var(--primary)"` on N platform tags + primary button + focus ring routinely puts >3 rust elements onscreen, breaching the Rationed Color Rule.
- Expanded-row "View Details" button at `+page.svelte:241-244` is a *second* disclosure on an already-expanded row. Consider: row click expands, the `ExternalLink` icon navigates, drop the in-row button.
- `[id]/+page.svelte` runs four sibling `corner-brackets + tech-grid` panels on the detail route — violates DESIGN §6 "frame the primary content of a route, not every tile".

## Questions to Consider

1. If the operator's real job is "find the one broken session in 312," why is the default sort `updated_at DESC` and not `lastHeartbeat ASC where status != active`? The current page makes them work for the unhappy path.
2. The list and detail pages use *different* visual languages for the same domain object. Which one is canonical — and should the other be deleted as a refactor?
3. If you removed every icon from `SessionSummaryStrip` and shrank every number to `.count-tag` styling, would any operator notice — or would they thank you?
