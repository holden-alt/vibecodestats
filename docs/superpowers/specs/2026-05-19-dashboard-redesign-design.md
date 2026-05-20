# cc-dashboard — Profile & Dashboard Redesign

**Date:** 2026-05-19
**Status:** Design — awaiting implementation plan

## Goal

Transform the cc-dashboard profile and analytics surfaces from hand-rolled SVG charts (no tooltips, no axis values, single-color bars) into a polished, dense-but-rhythmic "bento" layout that fits the terminal/CLI aesthetic, uses production-grade chart libraries with real interactivity, and reads as a live cockpit when someone lands on a profile from the leaderboard.

## Audience & North Star

- **Audience:** the vibe-coder community. Profile pages are public landing pages other users visit from leaderboards, group pages, and shared links.
- **First impression target:** "live cockpit" — big real-time numbers, what the user is working on right now, a current streak/rank, a sense of motion.
- **Hero metric:** `tokens today` (raw output volume). Everything else is satellite to that number.
- **Density:** dense, but with rhythmic variation tile-to-tile (bento composition, no two adjacent tiles the same span).
- **Liveness:** truly real-time via the existing Supabase realtime publication on `daily_stats`. The ingest pipeline already pushes after every Claude Code turn.
- **Motion:** cinematic — rolling numbers, sparklines that draw on load, soft pulse on the "now coding" pill.
- **Mobile:** has-to-not-suck. Single-column stack at `<768px`, no special mobile treatment beyond readable ordering.

## Library Stack

One library per tile type. Keeps the mental model simple.

| Tile / Chart type | Library | Notes |
|---|---|---|
| Hero ghosted sparkline | Recharts `<LineChart>` (raw) | Renders behind the hero number, no axes/tooltip |
| 30-day marquee area chart | shadcn Chart + Recharts `<AreaChart>` | Range pills (7d / 30d / 90d / all), full tooltip |
| Model mix donut | Recharts `<PieChart>` | Custom legend, no shadcn wrapper |
| Hour-of-day distribution | shadcn Chart + Recharts `<BarChart>` | 24 bars, hover values per hour |
| Day-of-week | shadcn Chart + Recharts `<BarChart>` | 7 bars |
| Top projects today | Tremor `<BarList>` | Built-in label + bar + value + entrance animation |
| Machines today | Plain JSX | List with sub-stats, no chart needed |
| 52-week activity heatmap | `@uiw/react-heat-map` | GitHub-style grid, configurable color ramp, tooltips |
| Below-the-fold StatsExplorer | shadcn Chart + Recharts | Replace existing hand-rolled tabs' charts |
| Head-to-head sparklines | Recharts `<LineChart>` (small) | Compact, with tooltips |

**Hard rule:** delete every hand-rolled chart. Specifically, replace:
- `components/charts/TokenTrendChart.tsx`
- `components/charts/TimeOfDayHistogram.tsx`
- `components/charts/DayOfWeekChart.tsx`
- `components/charts/ModelAreaChart.tsx`
- `components/charts/ModelDonut.tsx`
- `components/Heatmap.tsx`
- `components/RankedBarList.tsx`
- `components/head-to-head/Sparkline.tsx`

## Color / Theme System

Map existing palette to shadcn Chart slots so charts inherit the terminal look:

```css
/* app/globals.css — add inside :root */
--chart-1: #d97757;  /* orange — tokens, hero */
--chart-2: #6bbfd9;  /* cyan — machines, sonnet */
--chart-3: #8fbc8f;  /* green — sessions, haiku, positive deltas */
--chart-4: #c47cb8;  /* magenta — persona, "now" indicators */
--chart-5: #e3c466;  /* yellow — rank, ships */
```

Semantic usage stays consistent:
- **Orange** (`--chart-1`): primary metric (tokens, hero)
- **Cyan** (`--chart-2`): machines / sonnet model
- **Green** (`--chart-3`): quality metric (deep work, haiku, positive delta)
- **Magenta** (`--chart-4`): identity / persona / live indicators
- **Yellow** (`--chart-5`): ranking / achievement / ships
- **Red** (`#d97373`, unmapped): reserved for negative deltas / errors only

Heatmap keeps its 5-step ramp (`--color-heat-0..4`) passed to `react-heat-map` as `panelColors`.

Typography unchanged: monospace everywhere, `tnum` for tabular numbers, `ss01 cv01` feature settings.

## Profile Page Composition

**Above the fold (visible on first load on a 1440×900 laptop):**

1. **Identity strip** — avatar, handle, display_name, primary + secondary persona pills, rank pill, streak pill, live "now coding in: {project}" pill. Sign-in widget continues in top-right corner of the page (from the auth fix).
2. **Hero block** — full-width, left-accented with orange border-left. Ghosted 30-day sparkline as background. Contains:
   - Small uppercase label: `tokens today`
   - Giant number: `2,418,302` (orange, `--chart-1`)
   - Delta inline: `▲ +38% vs yesterday` (green if positive, red if negative)
   - Sub-line: `7 sessions · 6h 12m deep work · 23 ships · across 4 projects`
3. **Bento grid** (6-column base, varied spans):
   - **Row 1:** marquee 30d area chart (cols 1–4, rows 1–2) | rank tile (cols 5–6, row 1) | streak tile (cols 5–6, row 2)
   - **Row 2:** model donut (cols 1–2) | hour-of-day (cols 3–4) | day-of-week (cols 5–6)
   - **Row 3:** top projects today (cols 1–3) | machines today (cols 4–5) | ships count (col 6)
4. **52-week activity heatmap** — full-width row.

**Below the fold (scroll for the data nerds):**

5. **Trends section** — model area chart over 30 days, deltas by model.
6. **StatsExplorer** — existing tabbed drill-down: trends · model mix · time of day · day of week · projects · machines. Each tab's chart re-rendered with shadcn/Recharts.
7. **Per-machine breakdown** — same metrics, faceted by `machine_daily_stats.machine`.
8. **Head-to-head section** — friends + group members, compact sparklines comparing recent activity.

**Composition rules:**
- 6-column base grid.
- Tiles span 1–4 cols and 1–2 rows.
- No two adjacent tiles use the same span.
- Each tile follows the structure: `<label>` (small uppercase) → `<value>` (chart / number) → optional `<sub>`.
- Tile background: `#14110e`, border: `#2a2622`.

## Interactions

**Tooltips:**
- Every chart uses shadcn's `<ChartTooltip>` showing exact value(s) + the bucket label.
- Cursor crosshair on line/bar charts.
- Numbers formatted with `tnum` monospace and locale grouping (e.g. `2,418,302`).

**Tile hover:**
- Border brightens `#2a2622` → `#d97757`.
- `cursor: pointer` on clickable tiles.
- Subtle inset shadow on hover (200ms ease-out).

**Click-through targets** (all scroll-anchor or existing routes — no new pages built for this redesign):
- 30d marquee tile → scroll to StatsExplorer `trends` tab.
- Top projects tile → scroll to StatsExplorer `projects` tab.
- Hour-of-day bar → scroll to StatsExplorer `time of day` tab.
- Day-of-week bar → scroll to StatsExplorer `day of week` tab.
- Machines tile → scroll to StatsExplorer `machines` tab.
- Rank tile → links to `/leaderboard` (or `/groups/{slug}` if the rank is group-scoped) with the current user's row highlighted.
- Heatmap cell → hover-tooltip only in v1 (date + tokens). No click action.
- 30d marquee range pills (`7d / 30d / 90d / all`) → client-side filter on the chart's `data` array. No URL state.

**Out of scope:** drag, resize, custom layouts per user, new routes, day-detail modals.

## Motion (cinematic)

- **Rolling numbers** via a small `<RollingNumber>` component (digit-by-digit transform, ~600ms). Hero number is the showcase; secondary stats use the same component at smaller scale.
- **Recharts entrance:** `isAnimationActive={true}` with `animationDuration={1200}` on first mount, `400` on realtime updates.
- **Tile entrance:** stagger fade-up on initial mount — 50ms delay per tile in document order.
- **"Now coding" pulse:** soft 1.5s ease-in-out infinite pulse on the dot.
- **Hover ripple:** inset shadow grow (200ms ease-out).
- **Reduced motion:** `@media (prefers-reduced-motion: reduce)` disables all animations. Content stays functional and static.

## Other Surfaces

### Leaderboard `/leaderboard` and `/groups/[slug]`

- Keep existing metric × window × scope × view-mode controls.
- Replace `RankList` and `BarComparison` hand-rolled visuals with Tremor `<BarList>` for the value bars and a clean ranked row for list view.
- Each row: rank + avatar + handle + hero number + delta sparkline (Recharts, 80×20px).
- Group page (`/groups/[slug]`) uses the same leaderboard component, scoped via the existing `GroupLeaderboardSection`.

### Head-to-head `/[handle]/vs/[opponent]`

- Replace hand-rolled `Sparkline` with two thin Recharts `<LineChart>` sparklines (~120×30px) per metric row.
- Winner side gets a subtle background highlight + green checkmark.
- Tooltips show date + both users' values for that day.
- Keep existing 5-metric row layout.

### Mobile (`<768px`)

- Bento collapses to a single column.
- Tile order top-to-bottom: identity strip → hero → 30d marquee → rank → streak → model mix → hour-of-day → day-of-week → top projects → machines → ships → heatmap.
- Heatmap scrolls horizontally on mobile (52 weeks doesn't fit otherwise).
- Below-the-fold StatsExplorer keeps full functionality; tabs scroll horizontally if needed.

## Implementation Phasing (rough — detailed plan in writing-plans)

1. **Dependencies + theme tokens.** Install Recharts, shadcn chart components, Tremor, @uiw/react-heat-map. Add `--chart-1..5` CSS vars.
2. **Build the new primitive components.** `<RollingNumber>`, `<BentoTile>`, `<HeroBlock>`, `<ChartTooltip>` wrapper. Test in isolation.
3. **Rebuild each chart, one at a time.** TokenTrendChart → 30d marquee. ModelDonut → new donut. TimeOfDay/DayOfWeek → new bars. Heatmap → react-heat-map. RankedBarList → Tremor BarList. Sparkline → mini Recharts. Each goes behind the old until parity, then swap.
4. **Recompose ProfileLive** to the new bento layout. Hook real-time updates into the new tile structure.
5. **Update Leaderboard + Head-to-head + Groups.** Replace old visualizations.
6. **Mobile pass.** Single-column stack, horizontal heatmap scroll.
7. **Motion polish.** Tile stagger, hover ripple, rolling numbers across all big values.
8. **Cleanup.** Delete `components/charts/*` old files, `components/Heatmap.tsx`, `components/RankedBarList.tsx`, `components/head-to-head/Sparkline.tsx`.

## Out of Scope (explicit non-goals for this redesign)

- New metrics or new data ingestion (we use only what `daily_stats` and `machine_daily_stats` already store).
- New social features (DMs, posts, comments).
- User-customizable layouts (no drag-to-rearrange).
- A dedicated mobile design beyond stack-and-go.
- New routes beyond the existing `/[handle]`, `/[handle]/vs/[opponent]`, `/leaderboard`, `/groups/[slug]`.

## Open Questions

None known. Author of the brainstorm + implementer should flag anything ambiguous before the plan stage.

## Related

- Library research: result of a 2026-05-19 chart-library web survey.
- Recovery context: this design assumes the Supabase project `srexmxntzjdhbuicqvso` (recovered 2026-05-18) is the live target.
- Auth/UX context: the recently-added top-right auth widget (red `not signed in` / green `signed in as @handle`) stays as-is.
