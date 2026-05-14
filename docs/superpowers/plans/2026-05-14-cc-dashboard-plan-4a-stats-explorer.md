# cc-dashboard Plan 4a — Stats Explorer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Plan 3's static `ChartsSection` with an interactive, tabbed **Stats Explorer** — a window-aware multi-chart view on the profile where the user switches between six chart tabs (trends, model mix, time of day, day of week, projects, machines) and six time windows (today / week / month / quarter / year / all).

**Architecture:** Plan 3 already built the five chart components and four aggregation helpers. Plan 4a adds the *interactive layer* on top: a generic `SegmentedControl` for tab + window selection, a `RankedBarList` for the two new label→value views (projects, machines), window-filtering + ranked-breakdown aggregation functions, and a `StatsExplorer` client component that holds `tab`/`window` state and routes to the right chart. The data layer is extended once — `getProfileData` also fetches the user's `machine_daily_stats` rows so the "machines" tab has a real per-machine token breakdown. No schema changes, no new routes, no seed data — this plan is pure frontend + data-read work on data that already exists.

**Tech Stack:** Next.js 15 + React 19 (client component with `useState`), TypeScript strict (`noUncheckedIndexedAccess` on), Tailwind v4, Vitest + Testing Library (`fireEvent` for interaction tests).

**Spec reference:** `docs/superpowers/specs/2026-05-13-cc-dashboard-design.md` §3 (item 8 "Stats explorer"), §4 (view catalog — metrics, time windows, visualizations), §11 ("stats explorer with 5+ chart types").

**Prereqs from Plan 3 (all shipped to `main`):** `lib/stats/aggregations.ts` exports `classifyModel`, `ModelClass`, `modelTotals`, `ModelTotals`, `last30Days`, `TrendDay`, `dayOfWeekAverages`, `hourlyTotals`, plus a module-level `MS_PER_DAY` const. `components/charts/` has `TokenTrendChart` (`{ days: { date: string; tokens: number }[] }`), `ModelAreaChart` (`{ days: TrendDay[] }`), `ModelDonut` (`{ totals: ModelTotals }`), `DayOfWeekChart` (`{ averages: number[] }`), `TimeOfDayHistogram` (`{ hourly: number[] }`). `components/TrendsSection.tsx` + `components/ChartsSection.tsx` are wired into `components/ProfileLive.tsx`. `lib/types/database.ts` types the `machine_daily_stats` table (with `hourly_tokens`).

---

## Key engineering decisions (made during planning — Holden can veto)

1. **Plan 4 is split; this is Plan 4a.** Plan 4 as specced spans two independent subsystems. 4a = the Stats Explorer (pure frontend on existing data). 4b = Leaderboard + Groups + Head-to-head (new tables, seed data, new routes). 4a ships first because it has zero infra risk and builds directly on Plan 3.

2. **Six tabs, not seven — the "skills" tab is deferred to Plan 6.** Spec §3 item 8 lists seven tabs including "skills". There is no skills data anywhere in the schema — skills tracking is a whole Plan 6 subsystem (parsing which skills were invoked from session JSONL). Building a skills tab now means either an empty placeholder or pulling Plan 6's pipeline forward. Plan 4a ships the six tabs that have real backing data; the skills tab is added in Plan 6.

3. **`StatsExplorer` replaces `ChartsSection`.** Plan 3's `ChartsSection` was explicitly the "interim home" for the donut / day-of-week / time-of-day charts, to be superseded by Plan 4's tabbed explorer. Plan 4a deletes `components/ChartsSection.tsx` and `tests/components/ChartsSection.test.tsx`. `components/TrendsSection.tsx` stays — it is the dedicated, always-visible "Trends · 30d" section (spec §3 item 3), a separate surface from the explorer (spec §3 item 8).

4. **The "machines" tab needs a new data fetch.** `daily_stats.machines` is only a `string[]` of which machines were active — no per-machine token totals. The real breakdown lives in `machine_daily_stats`. `getProfileData` is extended once to also fetch the user's `machine_daily_stats` rows; they flow through `ProfileData.machineStats` as a **static** prop (not in `ProfileLive`'s realtime `useState`). The machines tab therefore updates on page reload, not live — an acceptable v1 tradeoff; the spec's realtime requirement (§10) is about the token counter and heatmap, not the machines breakdown.

5. **The interactive control is window-switching, not the full §4 matrix.** Spec §4 describes a metric × window × scope × visualization catalog. Plan 4a builds the concrete tab list from §3 item 8 (each tab IS a metric/visualization) with a time-window selector as the live control. The full combinatorial matrix is aspirational catalog, not v1 UI. "Scope" (global/groups/persona/friends) is a leaderboard concept and belongs to Plan 4b.

6. **Default view: `trends` tab, `all` window.** `all` makes the explorer's default visibly distinct from the fixed 30-day `TrendsSection` above it, and shows off the "explore your whole history" capability. Both are easily changed in `StatsExplorer`'s `useState` initializers.

7. **One generic `SegmentedControl` for both tabs and windows.** Both controls are "pick one of N labelled options" — a single reusable component, used twice.

---

## File Structure (after Plan 4a)

```
cc-dashboard/
  lib/
    stats/
      profile-data.ts                MODIFIED — MachineDailyStat type, fetch machine_daily_stats, ProfileData.machineStats
      aggregations.ts                MODIFIED — StatsWindow, filterByWindow, trendForWindow (last30Days delegates to it),
                                                RankedItem, projectTotals, machineTotals
  components/
    SegmentedControl.tsx             NEW — generic pick-one-of-N control (tabs + windows)
    RankedBarList.tsx                NEW — horizontal label→value bar list (projects + machines tabs)
    StatsExplorer.tsx                NEW — tabbed, window-aware container (client component)
    ProfileLive.tsx                  MODIFIED — render StatsExplorer, drop ChartsSection, pass machineStats
    ChartsSection.tsx                DELETED — superseded by StatsExplorer
  tests/
    stats/
      profile-data.test.ts           MODIFIED — machine_daily_stats fetch
      aggregations.test.ts           MODIFIED — window + ranked-breakdown tests
    components/
      SegmentedControl.test.tsx      NEW
      RankedBarList.test.tsx         NEW
      StatsExplorer.test.tsx         NEW
      ProfileLive.test.tsx           MODIFIED — machineStats in fixtures, assert StatsExplorer renders
      ChartsSection.test.tsx         DELETED
```

---

## Phase 1 — Data layer: fetch `machine_daily_stats`

### Task 1.1: `MachineDailyStat` type + extend `getProfileData`

**Files:**
- Modify: `lib/stats/profile-data.ts`
- Test: `tests/stats/profile-data.test.ts`

- [ ] **Step 1: Write the failing test**

Replace the entire contents of `tests/stats/profile-data.test.ts` with:

```ts
import { describe, it, expect, vi } from 'vitest';
import { getProfileData } from '@/lib/stats/profile-data';

function mockSupabase(userRow: unknown, statsRows: unknown[], machineRows: unknown[] = []) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'users') {
        return {
          select: () => ({ eq: () => ({ maybeSingle: vi.fn(async () => ({ data: userRow, error: null })) }) }),
        };
      }
      if (table === 'machine_daily_stats') {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: vi.fn(async () => ({ data: machineRows, error: null })),
              }),
            }),
          }),
        };
      }
      // daily_stats
      return {
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: vi.fn(async () => ({ data: statsRows, error: null })),
            }),
          }),
        }),
      };
    }),
  };
}

describe('getProfileData', () => {
  it('returns null when the user does not exist', async () => {
    const supabase = mockSupabase(null, []);
    const result = await getProfileData(supabase as never, 'ghost');
    expect(result).toBeNull();
  });

  it('returns the user and their daily_stats rows', async () => {
    const user = { id: 'u1', github_handle: 'holden-alt', display_name: 'Holden',
      avatar_url: null, primary_persona: null, secondary_personas: [] };
    const stats = [
      { date: '2026-05-14', tokens_total: 487231, tokens_by_model: { 'claude-opus-4-7': 487231 },
        sessions: 6, deep_work_minutes: 240, machines: ['iMac'],
        projects_touched: {}, ships: { commits: 12, repos: 3 }, hourly_tokens: {}, source_synced_at: null },
    ];
    const supabase = mockSupabase(user, stats);
    const result = await getProfileData(supabase as never, 'holden-alt');
    expect(result).not.toBeNull();
    expect(result?.user.github_handle).toBe('holden-alt');
    expect(result?.dailyStats).toHaveLength(1);
    expect(result?.dailyStats[0]?.tokens_total).toBe(487231);
  });

  it('returns the user machine_daily_stats rows', async () => {
    const user = { id: 'u1', github_handle: 'holden-alt', display_name: 'Holden',
      avatar_url: null, primary_persona: null, secondary_personas: [] };
    const machines = [
      { user_id: 'u1', date: '2026-05-14', machine: 'iMac', tokens_total: 300000,
        tokens_by_model: {}, sessions: 3, deep_work_minutes: 120, projects_touched: {},
        ships: {}, hourly_tokens: {}, updated_at: '2026-05-14T12:00:00Z' },
      { user_id: 'u1', date: '2026-05-14', machine: 'MacBook-Air', tokens_total: 187231,
        tokens_by_model: {}, sessions: 3, deep_work_minutes: 120, projects_touched: {},
        ships: {}, hourly_tokens: {}, updated_at: '2026-05-14T12:00:00Z' },
    ];
    const supabase = mockSupabase(user, [], machines);
    const result = await getProfileData(supabase as never, 'holden-alt');
    expect(result?.machineStats).toHaveLength(2);
    expect(result?.machineStats[0]?.machine).toBe('iMac');
    expect(result?.machineStats[1]?.tokens_total).toBe(187231);
  });

  it('defaults machineStats to [] when the query returns null', async () => {
    const user = { id: 'u1', github_handle: 'holden-alt', display_name: 'Holden',
      avatar_url: null, primary_persona: null, secondary_personas: [] };
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'users') {
          return { select: () => ({ eq: () => ({ maybeSingle: vi.fn(async () => ({ data: user, error: null })) }) }) };
        }
        return {
          select: () => ({
            eq: () => ({
              order: () => ({ limit: vi.fn(async () => ({ data: null, error: null })) }),
            }),
          }),
        };
      }),
    };
    const result = await getProfileData(supabase as never, 'holden-alt');
    expect(result?.machineStats).toEqual([]);
    expect(result?.dailyStats).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/stats/profile-data.test.ts`
Expected: FAIL — `result.machineStats` is `undefined` (the field doesn't exist yet).

- [ ] **Step 3: Extend `profile-data.ts`**

In `lib/stats/profile-data.ts`:

Add `MachineDailyStat` to the type exports, right after the existing `DailyStat` type line:

```ts
export type DailyStat = Database['public']['Tables']['daily_stats']['Row'];
export type MachineDailyStat = Database['public']['Tables']['machine_daily_stats']['Row'];
```

Add `machineStats` to the `ProfileData` type:

```ts
export type ProfileData = {
  user: ProfileUser;
  dailyStats: DailyStat[];
  machineStats: MachineDailyStat[];
};
```

In `getProfileData`, after the `dailyStats` query and before the `return`, add the machine-stats query:

```ts
  const { data: machineStats } = await supabase
    .from('machine_daily_stats')
    .select('*')
    .eq('user_id', user.id)
    .order('date', { ascending: false })
    .limit(HISTORY_DAYS * 3);

  return {
    user,
    dailyStats: dailyStats ?? [],
    machineStats: machineStats ?? [],
  };
```

(`HISTORY_DAYS` is the existing const, `366`. `* 3` leaves headroom for up to ~3 machines per day.)

- [ ] **Step 4: Run test + typecheck to verify they pass**

Run: `pnpm test tests/stats/profile-data.test.ts && pnpm typecheck`
Expected: test PASS (4 tests), typecheck clean.

> Note: making `machineStats` a required field on `ProfileData` will break typecheck in any test fixture that builds a `ProfileData` object — those are fixed in Task 4.2. If `pnpm typecheck` flags `tests/components/ProfileLive.test.tsx` here, that is expected; leave it for Task 4.2. (If you want a green typecheck at this step, you may add `machineStats: []` to the `baseData` fixture in `ProfileLive.test.tsx` now — but Task 4.2 covers it regardless.)

- [ ] **Step 5: Commit**

```bash
git add lib/stats/profile-data.ts tests/stats/profile-data.test.ts
git commit -m "feat: fetch machine_daily_stats in getProfileData"
```

---

## Phase 2 — Aggregations: windows + ranked breakdowns

All of Phase 2 appends to the existing `lib/stats/aggregations.ts` and `tests/stats/aggregations.test.ts` (15 tests already pass there from Plan 3 — do not modify them, except the `last30Days` delegation in Task 2.2).

### Task 2.1: `StatsWindow` type + `filterByWindow`

**Files:**
- Modify: `lib/stats/aggregations.ts` (append)
- Test: `tests/stats/aggregations.test.ts` (append)

- [ ] **Step 1: Write the failing tests**

In `tests/stats/aggregations.test.ts`, add `filterByWindow` and the type to the existing import line from `@/lib/stats/aggregations`. Append this `describe` block (the `stat()` helper already exists at the top of the file from Plan 3 — reuse it):

```ts
describe('filterByWindow', () => {
  const stats = [
    stat({ date: '2026-05-14' }), // today
    stat({ date: '2026-05-10' }), // 4 days back
    stat({ date: '2026-04-20' }), // 24 days back
    stat({ date: '2026-01-01' }), // 133 days back
  ];

  it('returns everything for the "all" window', () => {
    expect(filterByWindow(stats, '2026-05-14', 'all')).toHaveLength(4);
  });

  it('returns only today for the "today" window', () => {
    const out = filterByWindow(stats, '2026-05-14', 'today');
    expect(out).toHaveLength(1);
    expect(out[0]!.date).toBe('2026-05-14');
  });

  it('returns the trailing 7 days for the "week" window', () => {
    expect(filterByWindow(stats, '2026-05-14', 'week')).toHaveLength(2); // 05-14, 05-10
  });

  it('returns the trailing 30 days for the "month" window', () => {
    expect(filterByWindow(stats, '2026-05-14', 'month')).toHaveLength(3); // 05-14, 05-10, 04-20
  });

  it('returns the trailing 365 days for the "year" window', () => {
    expect(filterByWindow(stats, '2026-05-14', 'year')).toHaveLength(4);
  });

  it('is generic over any row with a date field', () => {
    const rows = [{ date: '2026-05-14', machine: 'iMac' }, { date: '2026-01-01', machine: 'Air' }];
    const out = filterByWindow(rows, '2026-05-14', 'week');
    expect(out).toEqual([{ date: '2026-05-14', machine: 'iMac' }]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test tests/stats/aggregations.test.ts`
Expected: FAIL — `filterByWindow` is not exported.

- [ ] **Step 3: Write `StatsWindow` + `filterByWindow`**

In `lib/stats/aggregations.ts`, append:

```ts
// ---------------------------------------------------------------------------
// Time windows (Plan 4a)
// ---------------------------------------------------------------------------

export type StatsWindow = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'all';

const WINDOW_DAYS: Record<Exclude<StatsWindow, 'all'>, number> = {
  today: 1,
  week: 7,
  month: 30,
  quarter: 90,
  year: 365,
};

// Filters any date-stamped rows to a trailing window ending at `today` (UTC).
export function filterByWindow<T extends { date: string }>(
  rows: T[],
  today: string,
  window: StatsWindow,
): T[] {
  if (window === 'all') return rows;
  const todayMs = Date.parse(today + 'T00:00:00Z');
  const cutoffMs = todayMs - (WINDOW_DAYS[window] - 1) * MS_PER_DAY;
  return rows.filter((r) => {
    const ms = Date.parse(r.date + 'T00:00:00Z');
    return ms >= cutoffMs && ms <= todayMs;
  });
}
```

(`MS_PER_DAY` is the existing module-level const from Plan 3 — it is declared earlier in the file, so it is in scope here.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test tests/stats/aggregations.test.ts && pnpm typecheck`
Expected: test PASS (15 prior + 6 new = 21), typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add lib/stats/aggregations.ts tests/stats/aggregations.test.ts
git commit -m "feat: add StatsWindow and filterByWindow aggregation"
```

---

### Task 2.2: `trendForWindow` (and `last30Days` delegates to it)

**Files:**
- Modify: `lib/stats/aggregations.ts`
- Test: `tests/stats/aggregations.test.ts` (append)

- [ ] **Step 1: Write the failing tests**

In `tests/stats/aggregations.test.ts`, add `trendForWindow` to the import line. Append this `describe` block:

```ts
describe('trendForWindow', () => {
  it('returns 1 day for the "today" window', () => {
    const days = trendForWindow([], '2026-05-14', 'today');
    expect(days).toHaveLength(1);
    expect(days[0]!.date).toBe('2026-05-14');
  });

  it('returns 7 days for the "week" window, oldest first', () => {
    const days = trendForWindow([], '2026-05-14', 'week');
    expect(days).toHaveLength(7);
    expect(days[0]!.date).toBe('2026-05-08');
    expect(days[6]!.date).toBe('2026-05-14');
  });

  it('returns 30 days for the "month" window', () => {
    expect(trendForWindow([], '2026-05-14', 'month')).toHaveLength(30);
  });

  it('maps present days onto their slots with model breakdown', () => {
    const stats = [
      stat({ date: '2026-05-14', tokens_total: 300, tokens_by_model: { 'claude-opus-4-7': 300 } }),
    ];
    const days = trendForWindow(stats, '2026-05-14', 'week');
    expect(days[6]!.tokens).toBe(300);
    expect(days[6]!.opus).toBe(300);
  });

  it('for the "all" window spans from the earliest stat to today', () => {
    const stats = [
      stat({ date: '2026-05-14', tokens_total: 1 }),
      stat({ date: '2026-05-10', tokens_total: 1 }),
    ];
    const days = trendForWindow(stats, '2026-05-14', 'all');
    expect(days).toHaveLength(5); // 05-10 .. 05-14 inclusive
    expect(days[0]!.date).toBe('2026-05-10');
    expect(days[4]!.date).toBe('2026-05-14');
  });

  it('for the "all" window with no stats returns a single day (today)', () => {
    const days = trendForWindow([], '2026-05-14', 'all');
    expect(days).toHaveLength(1);
    expect(days[0]!.date).toBe('2026-05-14');
  });
});
```

The existing `last30Days` `describe` block (4 tests, from Plan 3) must continue to pass unchanged after the refactor in Step 3.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test tests/stats/aggregations.test.ts`
Expected: FAIL — `trendForWindow` is not exported.

- [ ] **Step 3: Write `trendForWindow`, refactor `last30Days` to delegate**

In `lib/stats/aggregations.ts`, append the new function:

```ts
// Window-aware per-day trend. Like last30Days but the length follows the window:
// 'today' = 1 day, 'week' = 7, 'month' = 30, 'quarter' = 90, 'year' = 365,
// 'all' = every day from the earliest stat through today (min 1 day).
export function trendForWindow(stats: DailyStat[], today: string, window: StatsWindow): TrendDay[] {
  const todayMs = Date.parse(today + 'T00:00:00Z');
  let dayCount: number;
  if (window === 'all') {
    if (stats.length === 0) {
      dayCount = 1;
    } else {
      const earliestMs = Math.min(...stats.map((s) => Date.parse(s.date + 'T00:00:00Z')));
      dayCount = Math.max(1, Math.round((todayMs - earliestMs) / MS_PER_DAY) + 1);
    }
  } else {
    dayCount = WINDOW_DAYS[window];
  }
  const byDate = new Map(stats.map((s) => [s.date, s]));
  const out: TrendDay[] = [];
  for (let i = dayCount - 1; i >= 0; i--) {
    const iso = new Date(todayMs - i * MS_PER_DAY).toISOString().slice(0, 10);
    const day: TrendDay = { date: iso, tokens: 0, opus: 0, sonnet: 0, haiku: 0, other: 0 };
    const found = byDate.get(iso);
    if (found) {
      day.tokens = found.tokens_total;
      const byModel = (found.tokens_by_model ?? {}) as Record<string, number>;
      for (const [model, n] of Object.entries(byModel)) {
        day[classifyModel(model)] += n;
      }
    }
    out.push(day);
  }
  return out;
}
```

Then refactor the existing `last30Days` function body so it delegates (the 'month' window is exactly 30 days, identical behavior — this removes the duplicated per-day loop):

```ts
export function last30Days(stats: DailyStat[], today: string): TrendDay[] {
  return trendForWindow(stats, today, 'month');
}
```

Place `last30Days` AFTER `trendForWindow` in the file (a function can reference another declared later in the same module, but keeping declaration order readable is preferred — move the `last30Days` definition down so it sits just below `trendForWindow`). The original `MS_PER_DAY` const declaration stays where it is.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test tests/stats/aggregations.test.ts && pnpm test tests/components/TrendsSection.test.tsx && pnpm typecheck`
Expected: all PASS — the 6 new `trendForWindow` tests, the 4 existing `last30Days` tests (unchanged behavior), and `TrendsSection` (which calls `last30Days`). Typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add lib/stats/aggregations.ts tests/stats/aggregations.test.ts
git commit -m "feat: add trendForWindow; last30Days delegates to it"
```

---

### Task 2.3: `RankedItem` type + `projectTotals`

**Files:**
- Modify: `lib/stats/aggregations.ts` (append)
- Test: `tests/stats/aggregations.test.ts` (append)

- [ ] **Step 1: Write the failing tests**

In `tests/stats/aggregations.test.ts`, add `projectTotals` to the import line. Append:

```ts
describe('projectTotals', () => {
  it('sums projects_touched across stats, sorted by tokens descending', () => {
    const stats = [
      stat({ projects_touched: { 'holden-alt/cc-dashboard': 100, 'realsavvy/agnt-portal': 50 } }),
      stat({ projects_touched: { 'holden-alt/cc-dashboard': 200 } }),
    ];
    expect(projectTotals(stats)).toEqual([
      { label: 'holden-alt/cc-dashboard', value: 300 },
      { label: 'realsavvy/agnt-portal', value: 50 },
    ]);
  });

  it('returns an empty array for stats with no projects', () => {
    expect(projectTotals([stat({ projects_touched: {} })])).toEqual([]);
  });

  it('returns an empty array for empty input', () => {
    expect(projectTotals([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test tests/stats/aggregations.test.ts`
Expected: FAIL — `projectTotals` is not exported.

- [ ] **Step 3: Write `RankedItem` + `projectTotals`**

In `lib/stats/aggregations.ts`, append:

```ts
// ---------------------------------------------------------------------------
// Ranked breakdowns (Plan 4a)
// ---------------------------------------------------------------------------

export type RankedItem = { label: string; value: number };

// Sums projects_touched across the given stats, sorted by tokens descending.
export function projectTotals(stats: DailyStat[]): RankedItem[] {
  const totals: Record<string, number> = {};
  for (const s of stats) {
    const projects = (s.projects_touched ?? {}) as Record<string, number>;
    for (const [label, n] of Object.entries(projects)) {
      totals[label] = (totals[label] ?? 0) + n;
    }
  }
  return Object.entries(totals)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test tests/stats/aggregations.test.ts && pnpm typecheck`
Expected: test PASS, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add lib/stats/aggregations.ts tests/stats/aggregations.test.ts
git commit -m "feat: add RankedItem type and projectTotals aggregation"
```

---

### Task 2.4: `machineTotals`

**Files:**
- Modify: `lib/stats/aggregations.ts`
- Test: `tests/stats/aggregations.test.ts` (append)

- [ ] **Step 1: Write the failing tests**

In `tests/stats/aggregations.test.ts`, add `machineTotals` to the import line. Append:

```ts
describe('machineTotals', () => {
  function machineStat(partial: Partial<import('@/lib/stats/profile-data').MachineDailyStat>) {
    return {
      user_id: 'u1',
      date: '2026-05-14',
      machine: 'iMac',
      tokens_total: 0,
      tokens_by_model: {},
      sessions: 0,
      deep_work_minutes: 0,
      projects_touched: {},
      ships: {},
      hourly_tokens: {},
      updated_at: '2026-05-14T12:00:00Z',
      ...partial,
    };
  }

  it('sums tokens per machine, sorted descending', () => {
    const rows = [
      machineStat({ machine: 'iMac', tokens_total: 100 }),
      machineStat({ machine: 'MacBook-Air', tokens_total: 300 }),
      machineStat({ machine: 'iMac', tokens_total: 50 }),
    ];
    expect(machineTotals(rows)).toEqual([
      { label: 'MacBook-Air', value: 300 },
      { label: 'iMac', value: 150 },
    ]);
  });

  it('returns an empty array for empty input', () => {
    expect(machineTotals([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test tests/stats/aggregations.test.ts`
Expected: FAIL — `machineTotals` is not exported.

- [ ] **Step 3: Write `machineTotals`**

In `lib/stats/aggregations.ts`:

Add `MachineDailyStat` to the existing import at the top of the file:

```ts
import type { DailyStat, MachineDailyStat } from '@/lib/stats/profile-data';
```

Append the function (below `projectTotals`):

```ts
// Sums per-machine tokens across the given machine_daily_stats rows, sorted descending.
export function machineTotals(machineStats: MachineDailyStat[]): RankedItem[] {
  const totals: Record<string, number> = {};
  for (const m of machineStats) {
    totals[m.machine] = (totals[m.machine] ?? 0) + m.tokens_total;
  }
  return Object.entries(totals)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test tests/stats/aggregations.test.ts && pnpm typecheck`
Expected: test PASS (all aggregation tests — 15 from Plan 3 + 6 + 6 + 3 + 2 = 32), typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add lib/stats/aggregations.ts tests/stats/aggregations.test.ts
git commit -m "feat: add machineTotals aggregation"
```

---

## Phase 3 — Components: `SegmentedControl` + `RankedBarList`

### Task 3.1: `SegmentedControl`

**Files:**
- Create: `components/SegmentedControl.tsx`
- Test: `tests/components/SegmentedControl.test.tsx`

- [ ] **Step 1: Write the failing test**

`tests/components/SegmentedControl.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { SegmentedControl } from '@/components/SegmentedControl';

const OPTIONS = [
  { id: 'a', label: 'Alpha' },
  { id: 'b', label: 'Beta' },
  { id: 'c', label: 'Gamma' },
];

describe('SegmentedControl', () => {
  it('renders one button per option', () => {
    const { container } = render(
      <SegmentedControl options={OPTIONS} value="a" onChange={() => {}} />,
    );
    expect(container.querySelectorAll('[data-segment]').length).toBe(3);
  });

  it('marks the active option', () => {
    const { container } = render(
      <SegmentedControl options={OPTIONS} value="b" onChange={() => {}} />,
    );
    expect(container.querySelector('[data-segment="b"]')?.getAttribute('data-active')).toBe('true');
    expect(container.querySelector('[data-segment="a"]')?.getAttribute('data-active')).toBe('false');
  });

  it('calls onChange with the option id when a segment is clicked', () => {
    const onChange = vi.fn();
    const { container } = render(
      <SegmentedControl options={OPTIONS} value="a" onChange={onChange} />,
    );
    fireEvent.click(container.querySelector('[data-segment="c"]')!);
    expect(onChange).toHaveBeenCalledWith('c');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/components/SegmentedControl.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write `SegmentedControl`**

`components/SegmentedControl.tsx`:

```tsx
type SegmentedControlProps = {
  options: readonly { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
};

export function SegmentedControl({ options, value, onChange }: SegmentedControlProps) {
  return (
    <div
      className="flex flex-wrap gap-px rounded overflow-hidden border"
      style={{ borderColor: 'var(--color-border)' }}
      role="tablist"
    >
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={active}
            data-segment={opt.id}
            data-active={active}
            onClick={() => onChange(opt.id)}
            className="px-2 py-1 text-[0.58rem] uppercase tracking-[0.08em] cursor-pointer"
            style={{
              background: active ? 'var(--color-magenta)' : 'var(--color-bg-2)',
              color: active ? 'var(--color-bg)' : 'var(--color-dim)',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/components/SegmentedControl.test.tsx && pnpm typecheck`
Expected: test PASS (3 tests), typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add components/SegmentedControl.tsx tests/components/SegmentedControl.test.tsx
git commit -m "feat: add SegmentedControl component"
```

---

### Task 3.2: `RankedBarList`

**Files:**
- Create: `components/RankedBarList.tsx`
- Test: `tests/components/RankedBarList.test.tsx`

- [ ] **Step 1: Write the failing test**

`tests/components/RankedBarList.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { RankedBarList } from '@/components/RankedBarList';

describe('RankedBarList', () => {
  it('renders one row per item', () => {
    const { container } = render(
      <RankedBarList items={[
        { label: 'project-a', value: 1000 },
        { label: 'project-b', value: 500 },
      ]} />,
    );
    expect(container.querySelectorAll('[data-row]').length).toBe(2);
  });

  it('scales the largest item bar to 100% and others proportionally', () => {
    const { container } = render(
      <RankedBarList items={[
        { label: 'big', value: 200 },
        { label: 'small', value: 50 },
      ]} />,
    );
    expect(container.querySelector('[data-label="big"] [data-bar]')?.getAttribute('data-pct')).toBe('100');
    expect(container.querySelector('[data-label="small"] [data-bar]')?.getAttribute('data-pct')).toBe('25');
  });

  it('renders an empty state when there are no items', () => {
    const { container } = render(<RankedBarList items={[]} />);
    expect(container.querySelector('[data-empty]')).toBeTruthy();
    expect(container.querySelectorAll('[data-row]').length).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/components/RankedBarList.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write `RankedBarList`**

`components/RankedBarList.tsx`:

```tsx
import type { RankedItem } from '@/lib/stats/aggregations';

type RankedBarListProps = {
  items: RankedItem[];
};

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return Math.round(n / 1_000) + 'K';
  return String(n);
}

export function RankedBarList({ items }: RankedBarListProps) {
  if (items.length === 0) {
    return (
      <div
        data-empty
        className="text-[0.6rem] py-6 text-center"
        style={{ color: 'var(--color-dim)' }}
      >
        no data in this window
      </div>
    );
  }
  const max = Math.max(1, ...items.map((it) => it.value));
  return (
    <div className="flex flex-col gap-1.5" role="list" aria-label="ranked breakdown">
      {items.map((it) => {
        const pct = Math.round((it.value / max) * 100);
        return (
          <div
            key={it.label}
            data-row
            data-label={it.label}
            role="listitem"
            className="flex items-center gap-2 text-[0.6rem]"
          >
            <span
              className="w-[140px] shrink-0 truncate"
              style={{ color: 'var(--color-text)' }}
              title={it.label}
            >
              {it.label}
            </span>
            <div
              className="flex-1 h-[10px] rounded-[1px] overflow-hidden"
              style={{ background: 'var(--color-bg-2)' }}
            >
              <div
                data-bar
                data-pct={pct}
                style={{ width: `${pct}%`, height: '100%', background: 'var(--color-cyan)' }}
              />
            </div>
            <span
              className="w-[52px] shrink-0 text-right"
              style={{ color: 'var(--color-dim)' }}
            >
              {formatTokens(it.value)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/components/RankedBarList.test.tsx && pnpm typecheck`
Expected: test PASS (3 tests), typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add components/RankedBarList.tsx tests/components/RankedBarList.test.tsx
git commit -m "feat: add RankedBarList component"
```

---

## Phase 4 — `StatsExplorer` + wiring

### Task 4.1: `StatsExplorer`

**Files:**
- Create: `components/StatsExplorer.tsx`
- Test: `tests/components/StatsExplorer.test.tsx`

- [ ] **Step 1: Write the failing test**

`tests/components/StatsExplorer.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { StatsExplorer } from '@/components/StatsExplorer';
import type { DailyStat, MachineDailyStat } from '@/lib/stats/profile-data';

function stat(partial: Partial<DailyStat>): DailyStat {
  return {
    user_id: 'u1',
    date: '2026-05-14',
    tokens_total: 0,
    tokens_by_model: {},
    sessions: 0,
    deep_work_minutes: 0,
    machines: [],
    projects_touched: {},
    ships: {},
    hourly_tokens: {},
    source_synced_at: null,
    ...partial,
  };
}

function machineStat(partial: Partial<MachineDailyStat>): MachineDailyStat {
  return {
    user_id: 'u1',
    date: '2026-05-14',
    machine: 'iMac',
    tokens_total: 0,
    tokens_by_model: {},
    sessions: 0,
    deep_work_minutes: 0,
    projects_touched: {},
    ships: {},
    hourly_tokens: {},
    updated_at: '2026-05-14T12:00:00Z',
    ...partial,
  };
}

const dailyStats: DailyStat[] = [
  stat({
    date: '2026-05-14',
    tokens_total: 300,
    tokens_by_model: { 'claude-opus-4-7': 300 },
    hourly_tokens: { '14': 300 },
    projects_touched: { 'holden-alt/cc-dashboard': 300 },
  }),
  stat({
    date: '2026-05-01',
    tokens_total: 100,
    tokens_by_model: { 'claude-sonnet-4-6': 100 },
    hourly_tokens: { '9': 100 },
    projects_touched: { 'realsavvy/agnt-portal': 100 },
  }),
];

const machineStats: MachineDailyStat[] = [
  machineStat({ date: '2026-05-14', machine: 'iMac', tokens_total: 300 }),
  machineStat({ date: '2026-05-01', machine: 'MacBook-Air', tokens_total: 100 }),
];

describe('StatsExplorer', () => {
  it('renders with the trends tab active by default', () => {
    const { container } = render(
      <StatsExplorer dailyStats={dailyStats} machineStats={machineStats} today="2026-05-14" />,
    );
    expect(container.querySelector('[data-stats-explorer]')).toBeTruthy();
    // trends tab => TokenTrendChart bars
    expect(container.querySelectorAll('[data-explorer-body] [data-bar]').length).toBeGreaterThan(0);
    // tab + window controls each render their segments
    expect(container.querySelectorAll('[data-segment]').length).toBe(12); // 6 tabs + 6 windows
  });

  it('switches to the projects tab and renders a RankedBarList', () => {
    const { container } = render(
      <StatsExplorer dailyStats={dailyStats} machineStats={machineStats} today="2026-05-14" />,
    );
    fireEvent.click(container.querySelector('[data-segment="projects"]')!);
    const rows = container.querySelectorAll('[data-explorer-body] [data-row]');
    expect(rows.length).toBe(2); // both projects, all-window default
  });

  it('switches to the machines tab and ranks machines by tokens', () => {
    const { container } = render(
      <StatsExplorer dailyStats={dailyStats} machineStats={machineStats} today="2026-05-14" />,
    );
    fireEvent.click(container.querySelector('[data-segment="machines"]')!);
    const labels = Array.from(
      container.querySelectorAll('[data-explorer-body] [data-row]'),
    ).map((r) => r.getAttribute('data-label'));
    expect(labels).toEqual(['iMac', 'MacBook-Air']); // 300 > 100
  });

  it('narrows the data when the window changes to today', () => {
    const { container } = render(
      <StatsExplorer dailyStats={dailyStats} machineStats={machineStats} today="2026-05-14" />,
    );
    fireEvent.click(container.querySelector('[data-segment="projects"]')!);
    expect(container.querySelectorAll('[data-explorer-body] [data-row]').length).toBe(2);
    fireEvent.click(container.querySelector('[data-segment="today"]')!);
    // only 2026-05-14 remains => one project
    const rows = container.querySelectorAll('[data-explorer-body] [data-row]');
    expect(rows.length).toBe(1);
    expect(rows[0]?.getAttribute('data-label')).toBe('holden-alt/cc-dashboard');
  });

  it('renders the time-of-day tab as a 24-bar histogram', () => {
    const { container } = render(
      <StatsExplorer dailyStats={dailyStats} machineStats={machineStats} today="2026-05-14" />,
    );
    fireEvent.click(container.querySelector('[data-segment="timeofday"]')!);
    expect(container.querySelectorAll('[data-explorer-body] [data-hour]').length).toBe(24);
  });
});
```

> Note on `data-segment` collisions: both the tab control and the window control render `[data-segment]` buttons. The tab ids (`trends`, `models`, `timeofday`, `dayofweek`, `projects`, `machines`) and window ids (`today`, `week`, `month`, `quarter`, `year`, `all`) are all distinct, so `querySelector('[data-segment="projects"]')` is unambiguous.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/components/StatsExplorer.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write `StatsExplorer`**

`components/StatsExplorer.tsx`:

```tsx
'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import type { DailyStat, MachineDailyStat } from '@/lib/stats/profile-data';
import {
  type StatsWindow,
  filterByWindow,
  trendForWindow,
  modelTotals,
  dayOfWeekAverages,
  hourlyTotals,
  projectTotals,
  machineTotals,
} from '@/lib/stats/aggregations';
import { SegmentedControl } from '@/components/SegmentedControl';
import { TokenTrendChart } from '@/components/charts/TokenTrendChart';
import { ModelAreaChart } from '@/components/charts/ModelAreaChart';
import { ModelDonut } from '@/components/charts/ModelDonut';
import { DayOfWeekChart } from '@/components/charts/DayOfWeekChart';
import { TimeOfDayHistogram } from '@/components/charts/TimeOfDayHistogram';
import { RankedBarList } from '@/components/RankedBarList';

type StatsExplorerProps = {
  dailyStats: DailyStat[];
  machineStats: MachineDailyStat[];
  today: string;
};

const TABS = [
  { id: 'trends', label: 'trends' },
  { id: 'models', label: 'model mix' },
  { id: 'timeofday', label: 'time of day' },
  { id: 'dayofweek', label: 'day of week' },
  { id: 'projects', label: 'projects' },
  { id: 'machines', label: 'machines' },
] as const;

const WINDOWS = [
  { id: 'today', label: 'today' },
  { id: 'week', label: 'week' },
  { id: 'month', label: 'month' },
  { id: 'quarter', label: 'quarter' },
  { id: 'year', label: 'year' },
  { id: 'all', label: 'all' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function StatsExplorer({ dailyStats, machineStats, today }: StatsExplorerProps) {
  const [tab, setTab] = useState<TabId>('trends');
  const [statsWindow, setStatsWindow] = useState<StatsWindow>('all');

  const filteredDaily = filterByWindow(dailyStats, today, statsWindow);
  const filteredMachines = filterByWindow(machineStats, today, statsWindow);

  let body: ReactNode;
  switch (tab) {
    case 'trends': {
      const days = trendForWindow(dailyStats, today, statsWindow);
      body = <TokenTrendChart days={days.map((d) => ({ date: d.date, tokens: d.tokens }))} />;
      break;
    }
    case 'models': {
      const days = trendForWindow(dailyStats, today, statsWindow);
      body = (
        <div className="flex flex-col gap-3">
          <ModelDonut totals={modelTotals(filteredDaily)} />
          <ModelAreaChart days={days} />
        </div>
      );
      break;
    }
    case 'timeofday':
      body = <TimeOfDayHistogram hourly={hourlyTotals(filteredDaily)} />;
      break;
    case 'dayofweek':
      body = <DayOfWeekChart averages={dayOfWeekAverages(filteredDaily)} />;
      break;
    case 'projects':
      body = <RankedBarList items={projectTotals(filteredDaily)} />;
      break;
    case 'machines':
      body = <RankedBarList items={machineTotals(filteredMachines)} />;
      break;
  }

  return (
    <section className="mt-3" data-stats-explorer>
      <h3
        className="text-[0.6rem] uppercase tracking-[0.12em] font-semibold mb-2"
        style={{ color: 'var(--color-dim)' }}
      >
        stats · explorer
      </h3>
      <div
        className="rounded border p-2.5"
        style={{ borderColor: 'var(--color-border)', borderTop: '2px solid var(--color-magenta)' }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <SegmentedControl options={TABS} value={tab} onChange={(id) => setTab(id as TabId)} />
          <SegmentedControl
            options={WINDOWS}
            value={statsWindow}
            onChange={(id) => setStatsWindow(id as StatsWindow)}
          />
        </div>
        <div data-explorer-body>{body}</div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/components/StatsExplorer.test.tsx && pnpm typecheck`
Expected: test PASS (5 tests), typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add components/StatsExplorer.tsx tests/components/StatsExplorer.test.tsx
git commit -m "feat: add StatsExplorer tabbed window-aware component"
```

---

### Task 4.2: Wire `StatsExplorer` into `ProfileLive`, remove `ChartsSection`

**Files:**
- Modify: `components/ProfileLive.tsx`
- Delete: `components/ChartsSection.tsx`, `tests/components/ChartsSection.test.tsx`
- Modify: `tests/components/ProfileLive.test.tsx`
- Possibly modify: `e2e/profile.spec.ts` (only if it references the removed "stats · charts" section)

- [ ] **Step 1: Update the `ProfileLive` test**

In `tests/components/ProfileLive.test.tsx`:

First, add `machineStats: []` to the `baseData` fixture so it satisfies the updated `ProfileData` type. The `baseData` object becomes:

```ts
const baseData: ProfileData = {
  user: {
    id: 'u1', github_handle: 'holden-alt', display_name: 'Holden',
    avatar_url: null, primary_persona: null, secondary_personas: [],
  },
  dailyStats: [
    {
      date: '2026-05-14', user_id: 'u1', tokens_total: 100000,
      tokens_by_model: { 'claude-opus-4-7': 100000 }, sessions: 2,
      deep_work_minutes: 60, machines: ['iMac'], projects_touched: {},
      ships: { commits: 1, repos: 1 }, hourly_tokens: {}, source_synced_at: null,
    },
  ],
  machineStats: [],
};
```

Then replace the existing `it('renders the trends and charts sections', ...)` block (the last test in the file) with this updated version — the static `ChartsSection` is gone, so it no longer renders `[data-donut]` / `[data-hour]` on initial load; instead the `StatsExplorer` renders with its default `trends` tab:

```ts
  it('renders the trends section and the stats explorer', () => {
    const initialData: ProfileData = {
      user: {
        id: 'u1', github_handle: 'holden-alt', display_name: 'Holden',
        avatar_url: null, primary_persona: null, secondary_personas: [],
      },
      dailyStats: [
        {
          user_id: 'u1', date: '2026-05-14', tokens_total: 300,
          tokens_by_model: { 'claude-opus-4-7': 300 }, sessions: 2,
          deep_work_minutes: 60, machines: ['iMac'], projects_touched: {},
          ships: {}, hourly_tokens: { '14': 300 }, source_synced_at: null,
        },
      ],
      machineStats: [
        {
          user_id: 'u1', date: '2026-05-14', machine: 'iMac', tokens_total: 300,
          tokens_by_model: {}, sessions: 2, deep_work_minutes: 60,
          projects_touched: {}, ships: {}, hourly_tokens: {}, updated_at: '2026-05-14T12:00:00Z',
        },
      ],
    };
    const { container } = render(<ProfileLive initialData={initialData} today="2026-05-14" />);
    // TrendsSection: 30 token bars + 30 model-mix columns
    expect(container.querySelectorAll('[data-col]').length).toBe(30);
    // StatsExplorer present, with its tab + window controls (6 + 6 segments)
    expect(container.querySelector('[data-stats-explorer]')).toBeTruthy();
    expect(container.querySelectorAll('[data-segment]').length).toBe(12);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test tests/components/ProfileLive.test.tsx`
Expected: FAIL — `[data-stats-explorer]` is not in the DOM yet (ProfileLive still renders `ChartsSection`).

- [ ] **Step 3: Wire `StatsExplorer` into `ProfileLive`**

In `components/ProfileLive.tsx`:

Replace the `ChartsSection` import line:

```tsx
import { ChartsSection } from '@/components/ChartsSection';
```

with:

```tsx
import { StatsExplorer } from '@/components/StatsExplorer';
```

The component destructures `initialData` — it currently pulls `const { user } = initialData;`. Change that line to also pull `machineStats`:

```tsx
  const { user, machineStats } = initialData;
```

In the returned JSX, replace:

```tsx
      <ChartsSection dailyStats={dailyStats} />
```

with:

```tsx
      <StatsExplorer dailyStats={dailyStats} machineStats={machineStats} today={today} />
```

(`dailyStats` is the realtime `useState` value — the explorer's `daily_stats`-derived tabs stay live. `machineStats` comes straight from `initialData` — static, per Key Decision 4. `today` is already a prop.)

- [ ] **Step 4: Delete the superseded `ChartsSection`**

```bash
git rm components/ChartsSection.tsx tests/components/ChartsSection.test.tsx
```

- [ ] **Step 5: Check the e2e test**

Read `e2e/profile.spec.ts`. If it asserts on the text "stats · charts" or otherwise depends on the removed `ChartsSection`, update that assertion to "stats · explorer" (the new `StatsExplorer` heading). If it does not reference that section, leave it unchanged.

- [ ] **Step 6: Run the full suite + typecheck**

Run: `pnpm test && pnpm typecheck`
Expected: PASS — all Vitest tests green (Plan 1/2/3 tests + all Plan 4a tests; the `ChartsSection` test is gone), typecheck clean. Then run `python3 -m pytest tests/python/ -q` — expected: 20 passed (Plan 4a touches no Python).

- [ ] **Step 7: Commit**

```bash
git add components/ProfileLive.tsx tests/components/ProfileLive.test.tsx
git commit -m "feat: replace static ChartsSection with interactive StatsExplorer"
```

(If `e2e/profile.spec.ts` was modified in Step 5, `git add` it into this commit too.)

---

### Task 4.3: Manual dev-server check

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

Run: `pnpm dev` and open the profile page (`/holden-alt`). A `.env.local` with `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` is required for the page to render — it should already exist from the Plan 3 dev check.

- [ ] **Step 2: Verify the Stats Explorer**

Confirm:
- A "stats · explorer" section appears below the "trends · 30d" section, in place of the old "stats · charts" grid.
- Two segmented controls render: the tab control (trends / model mix / time of day / day of week / projects / machines) and the window control (today / week / month / quarter / year / all).
- Clicking each tab swaps the chart body: trends → token bar chart; model mix → donut + stacked area; time of day → 24-bar histogram; day of week → 7 bars; projects → ranked bar list of project names; machines → ranked bar list (iMac / MacBook-Air).
- Changing the window visibly changes the data (e.g. "today" vs "all" on the trends tab changes the number of bars).
- No console errors, no hydration warnings.

- [ ] **Step 3: Stop the dev server**

Stop `pnpm dev`. No commit — this is a verification gate.

---

## Self-Review

**1. Spec coverage:**
- Spec §3 item 8 "Stats explorer — tabbed multi-chart view: trends, model mix donut, time-of-day histogram, day-of-week bars, projects, skills, machines" → `StatsExplorer` (Task 4.1) ships six of the seven tabs: trends, model mix (donut + area), time of day, day of week, projects, machines. "skills" is explicitly deferred to Plan 6 per Key Decision 2 (no skills data exists in the schema). ✓ (with documented deferral)
- Spec §4 "time windows: today, this week, this month, this quarter, this year, all-time" → `StatsWindow` + `WINDOWS` + `filterByWindow` + `trendForWindow` (Tasks 2.1, 2.2) — all six windows. ✓
- Spec §4 visualizations → the explorer surfaces `TokenTrendChart`, `ModelAreaChart`, `ModelDonut`, `DayOfWeekChart`, `TimeOfDayHistogram` (Plan 3) + `RankedBarList` (Task 3.2) = 6 visualization types. ✓
- Spec §11 "stats explorer with 5+ chart types" → 6 chart types. ✓
- Spec §4 metric × window × scope × visualization full matrix → intentionally NOT built as a combinatorial UI per Key Decision 5; "scope" belongs to Plan 4b. Documented.

**2. Placeholder scan:** No "TBD", no "add error handling", no "similar to Task N", no undefined references. Every code step has complete code. The one "read the file and decide" step (Task 4.2 Step 5, e2e check) is a genuine conditional, not a placeholder — the condition and both branches are spelled out.

**3. Type consistency:**
- `MachineDailyStat` defined in `profile-data.ts` (Task 1.1), imported by `aggregations.ts` (Task 2.4) and `StatsExplorer.tsx` (Task 4.1) — same type. ✓
- `StatsWindow` defined in Task 2.1, consumed by `filterByWindow` (2.1), `trendForWindow` (2.2), `StatsExplorer` (4.1) — same union. ✓
- `RankedItem` defined in Task 2.3, returned by `projectTotals` (2.3) + `machineTotals` (2.4), consumed by `RankedBarList` (3.2) — same shape `{ label: string; value: number }`. ✓
- `trendForWindow` returns `TrendDay[]` (the Plan 3 type), consumed by `ModelAreaChart` (`{ days: TrendDay[] }`) and mapped to `{date, tokens}[]` for `TokenTrendChart` — matches. ✓
- `SegmentedControl` `options` prop is `readonly { id: string; label: string }[]`; `TABS`/`WINDOWS` are `as const` tuples of `{ id, label }` — assignable (readonly literal arrays widen to the prop type). ✓
- `ProfileData` gains required `machineStats` (Task 1.1); every fixture constructing a `ProfileData` is updated in Task 4.2 (`baseData` + the inline `initialData`). ✓

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-14-cc-dashboard-plan-4a-stats-explorer.md`. Two execution options:

**1. Subagent-Driven (recommended)** — fresh subagent per task, two-stage review (spec + quality) between tasks. 9 tasks; Phases are mostly sequential (Phase 2 depends on Phase 1's `MachineDailyStat`; Phase 4 depends on Phases 2–3), but the two Phase 3 components are independent of each other. Same method used for Plan 3.

**2. Inline Execution** — execute tasks in this session using executing-plans, batched with checkpoints.

Which approach?
