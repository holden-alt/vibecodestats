# cc-dashboard Plan 3 — Charts: 30d Trends + Stats Explorer Charts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render Holden's Claude Code history as five terminal-styled charts on the profile — a 30-day daily-token bar chart, a 30-day model-mix stacked area chart, a model-split donut, a day-of-week bar chart, and a time-of-day histogram — all live-updating via the existing Realtime channel.

**Architecture:** Four of the five charts derive from data already in `daily_stats` (date, `tokens_total`, `tokens_by_model`). The fifth — time-of-day — needs hour-granularity data that does not exist yet, so Phase 0 extends the ingestion pipeline: a new `hourly_tokens` jsonb column on `daily_stats` + `machine_daily_stats`, a new (optional) `hourly_tokens` field on `IngestPayload`, hour-bucketing in `dashboard_push.py`, and a cross-machine merge in `/api/ingest`. Phases 1–3 add pure aggregation helpers, pure presentational chart components (divs + grid + gradients — no chart library, per spec §7), and two new sections wired into the existing `ProfileLive` client component. Phase 4 is the backfill + manual verification.

**Tech Stack:** Next.js 15 edge route, Supabase Postgres + Realtime, TypeScript strict, Tailwind v4, Vitest + Testing Library, Python 3 stdlib.

**Spec reference:** `docs/superpowers/specs/2026-05-13-cc-dashboard-design.md` §3 (item 3 "Trends · 30d"), §4 (visualization catalog), §7 (custom chart components, no library).

**Prereqs from Plan 2:** Deployed at `https://cc-dashboard-qab.pages.dev`. Supabase project `zhumaztwplxrzsdsabtp` live with `users`, `daily_stats`, `machine_daily_stats`. `/api/ingest` edge route, `lib/ingest/payload.ts`, `scripts/dashboard_push.py`, `components/ProfileLive.tsx` all exist and pass tests. Both Macs run the `Stop` hook.

---

## Key engineering decisions (made during planning — Holden can veto)

1. **`hourly_tokens` is local-hour buckets, computed on the Mac.** `dashboard_push.py` converts each session message's UTC timestamp to the machine's local time and buckets fresh tokens by local hour (`"0"`..`"23"` → token count). "Time of day" is only meaningful in the user's own timezone, and the push script is the only place that knows it. Holden's two Macs are both US Eastern, so the cross-machine merge is a plain sum. A future multi-timezone user is a v2 concern.

2. **`hourly_tokens` is optional on the wire, required in storage.** The migration adds the column `not null default '{}'::jsonb` so existing rows backfill to `{}`. The `IngestPayload` validator treats `hourly_tokens` as optional and defaults a missing value to `{}`. This means the deploy order is safe: ship the migration + route + payload change first, and the *old* `dashboard_push.py` keeps working (it just sends no hour data) until the script is updated and re-backfilled. No breakage window.

3. **No chart library.** Per spec §7, charts are built from `div`s, CSS grid, flexbox, and `conic-gradient`. Bar heights are plain max-normalized percentages (`value / max * 100`) — no `d3-scale`, no axis library. The existing `Heatmap.tsx` already establishes this pattern.

4. **Charts are pure presentational components in `components/charts/`.** Each takes already-computed numbers as props and renders. All data derivation lives in pure functions in `lib/stats/aggregations.ts` so it is unit-testable without rendering. Charts expose `data-*` attributes (mirroring `Heatmap.tsx`'s `data-cell` / `data-level`) so tests assert on computed geometry.

5. **Two new sections, both inside `ProfileLive`.** `TrendsSection` (the spec §3 "Trends · 30d" — daily-token bar + model-mix area, side by side) and `ChartsSection` (donut + day-of-week + time-of-day in a static 3-up grid). Both live inside the `ProfileLive` client component so they re-render on Realtime updates. The full *tabbed, interactive* Stats Explorer (spec §8) is Plan 4's "clickable layer" — `ChartsSection`'s static grid is the interim home for those three charts and Plan 4 supersedes it.

6. **`ModelAreaChart` is 100%-stacked thin columns, not a true SVG area.** With divs, a per-day full-height column whose segments are proportional to that day's model split reads as a flowing model-*mix* area chart while staying trivially testable. Days with zero tokens render an empty `bg-2` column.

---

## File Structure (after Plan 3)

```
cc-dashboard/
  supabase/
    migrations/
      20260514000004_hourly_tokens.sql        NEW — hourly_tokens column on both stats tables
  lib/
    types/
      database.ts                             MODIFIED — hourly_tokens on daily_stats + machine_daily_stats
    ingest/
      payload.ts                              MODIFIED — optional hourly_tokens field + validation
    stats/
      aggregations.ts                         NEW — pure chart-data derivation functions
  app/
    api/
      ingest/
        route.ts                              MODIFIED — merge hourly_tokens across machines
  scripts/
    dashboard_push.py                         MODIFIED — bucket fresh tokens by local hour
  components/
    charts/
      TokenTrendChart.tsx                     NEW — 30-day daily-token bar chart
      ModelAreaChart.tsx                      NEW — 30-day 100%-stacked model-mix columns
      ModelDonut.tsx                          NEW — model-split conic-gradient donut
      DayOfWeekChart.tsx                      NEW — 7-bar average-tokens-by-weekday chart
      TimeOfDayHistogram.tsx                  NEW — 24-bar tokens-by-hour histogram
    TrendsSection.tsx                         NEW — "Trends · 30d" section (2 charts)
    ChartsSection.tsx                         NEW — "Stats · charts" section (3 charts)
    ProfileLive.tsx                           MODIFIED — render TrendsSection + ChartsSection
  tests/
    db/
      hourly-tokens-schema.test.ts            NEW
      types.test.ts                           MODIFIED — assert hourly_tokens in Database type
    ingest/
      payload.test.ts                         MODIFIED — hourly_tokens validation cases
      route.test.ts                            MODIFIED — hourly_tokens rollup case
    stats/
      aggregations.test.ts                    NEW
    components/
      TokenTrendChart.test.tsx                NEW
      ModelAreaChart.test.tsx                 NEW
      ModelDonut.test.tsx                     NEW
      DayOfWeekChart.test.tsx                 NEW
      TimeOfDayHistogram.test.tsx             NEW
      TrendsSection.test.tsx                  NEW
      ChartsSection.test.tsx                  NEW
    python/
      test_dashboard_push.py                  MODIFIED — local-hour bucketing tests
```

---

## Phase 0 — Hourly data pipeline

### Task 0.1: Migration — add `hourly_tokens` to both stats tables

**Files:**
- Create: `supabase/migrations/20260514000004_hourly_tokens.sql`
- Test: `tests/db/hourly-tokens-schema.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/db/hourly-tokens-schema.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('hourly_tokens migration', () => {
  const sql = readFileSync(
    resolve(__dirname, '../../supabase/migrations/20260514000004_hourly_tokens.sql'),
    'utf8',
  );

  it('adds hourly_tokens to daily_stats', () => {
    expect(sql).toMatch(/alter table public\.daily_stats\s+add column hourly_tokens jsonb/i);
  });

  it('adds hourly_tokens to machine_daily_stats', () => {
    expect(sql).toMatch(/alter table public\.machine_daily_stats\s+add column hourly_tokens jsonb/i);
  });

  it('defaults hourly_tokens to an empty object and is not null', () => {
    const matches = sql.match(/hourly_tokens jsonb not null default '\{\}'::jsonb/gi);
    expect(matches?.length).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/db/hourly-tokens-schema.test.ts`
Expected: FAIL — `ENOENT` (migration file does not exist).

- [ ] **Step 3: Write the migration**

`supabase/migrations/20260514000004_hourly_tokens.sql`:

```sql
-- 20260514000004_hourly_tokens.sql
-- Add per-hour token buckets so the time-of-day histogram has real data.
-- hourly_tokens is a jsonb record of local-hour string -> token count, e.g.
-- {"9": 12000, "10": 48000, "22": 9000}. The hour is the user's LOCAL hour at
-- push time (dashboard_push.py converts each session's UTC timestamps to local).
-- Existing rows backfill to '{}' via the default; re-running --backfill fills real data.

alter table public.daily_stats
  add column hourly_tokens jsonb not null default '{}'::jsonb;

alter table public.machine_daily_stats
  add column hourly_tokens jsonb not null default '{}'::jsonb;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/db/hourly-tokens-schema.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Apply the migration to the live Supabase project**

The dashboard reads from the live project; the migration must actually run there. Apply it via the Supabase MCP `apply_migration` tool (project ref `zhumaztwplxrzsdsabtp`, name `hourly_tokens`, the SQL body above), OR via the Supabase SQL editor. Confirm with a follow-up query:

```sql
select column_name from information_schema.columns
where table_schema = 'public'
  and table_name in ('daily_stats', 'machine_daily_stats')
  and column_name = 'hourly_tokens';
```

Expected: 2 rows.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260514000004_hourly_tokens.sql tests/db/hourly-tokens-schema.test.ts
git commit -m "feat: add hourly_tokens column to stats tables"
```

---

### Task 0.2: Add `hourly_tokens` to the hand-maintained `Database` type

**Files:**
- Modify: `lib/types/database.ts` (daily_stats + machine_daily_stats — Row, Insert, Update)
- Test: `tests/db/types.test.ts` (add one assertion)

- [ ] **Step 1: Add the failing assertion to the existing test**

In `tests/db/types.test.ts`, add this `it` block inside the existing `describe('generated database types', ...)`:

```ts
  it('includes hourly_tokens on daily_stats and machine_daily_stats', () => {
    const src = readFileSync(path, 'utf8');
    const matches = src.match(/hourly_tokens/g);
    // 2 tables x 3 variants (Row/Insert/Update) = 6 occurrences
    expect(matches?.length).toBe(6);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/db/types.test.ts`
Expected: FAIL — `expected undefined to be 6` (no `hourly_tokens` in the file yet).

- [ ] **Step 3: Add `hourly_tokens` to the type**

In `lib/types/database.ts`, edit the `daily_stats` table object:

- In `Row`, after `ships: Json;` add: `hourly_tokens: Json;`
- In `Insert`, after `ships?: Json;` add: `hourly_tokens?: Json;`
- In `Update`, after `ships?: Json;` add: `hourly_tokens?: Json;`

Then edit the `machine_daily_stats` table object the same way:

- In `Row`, after `ships: Json;` add: `hourly_tokens: Json;`
- In `Insert`, after `ships?: Json;` add: `hourly_tokens?: Json;`
- In `Update`, after `ships?: Json;` add: `hourly_tokens?: Json;`

- [ ] **Step 4: Run test + typecheck to verify they pass**

Run: `pnpm test tests/db/types.test.ts && pnpm typecheck`
Expected: test PASS (3 tests), typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add lib/types/database.ts tests/db/types.test.ts
git commit -m "feat: type hourly_tokens on daily_stats and machine_daily_stats"
```

---

### Task 0.3: Add optional `hourly_tokens` to `IngestPayload` + validator

**Files:**
- Modify: `lib/ingest/payload.ts`
- Test: `tests/ingest/payload.test.ts`

- [ ] **Step 1: Write the failing tests**

In `tests/ingest/payload.test.ts`, add these `it` blocks inside the existing `describe('validateIngestPayload', ...)`:

```ts
  it('accepts a payload with hourly_tokens', () => {
    const result = validateIngestPayload({ ...valid, hourly_tokens: { '9': 12000, '22': 8000 } });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.hourly_tokens).toEqual({ '9': 12000, '22': 8000 });
  });

  it('defaults hourly_tokens to {} when omitted', () => {
    const result = validateIngestPayload(valid);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.hourly_tokens).toEqual({});
  });

  it('rejects a non-object hourly_tokens', () => {
    const result = validateIngestPayload({ ...valid, hourly_tokens: 5 });
    expect(result.ok).toBe(false);
  });

  it('rejects negative values in hourly_tokens', () => {
    const result = validateIngestPayload({ ...valid, hourly_tokens: { '9': -1 } });
    expect(result.ok).toBe(false);
  });
```

(The existing `valid` fixture at the top of the file is left unchanged — `hourly_tokens` is optional, so the existing "accepts a well-formed payload" test still passes.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test tests/ingest/payload.test.ts`
Expected: FAIL — `value.hourly_tokens` is `undefined`, and the non-object/negative cases return `ok: true` (no validation yet).

- [ ] **Step 3: Add the field + validation**

In `lib/ingest/payload.ts`:

Add `hourly_tokens` to the `IngestPayload` type, after `ships`:

```ts
export type IngestPayload = {
  github_handle: string;
  machine: string;
  date: string; // YYYY-MM-DD
  tokens_total: number;
  tokens_by_model: Record<string, number>;
  sessions: number;
  deep_work_minutes: number;
  projects_touched: Record<string, number>;
  ships: { commits: number; repos: number };
  hourly_tokens: Record<string, number>;
};
```

In `validateIngestPayload`, after the `ships` check (the `if (!isPlainObject(body.ships) || ...)` block) and before the final `return`, add:

```ts
  let hourly_tokens: Record<string, number> = {};
  if (body.hourly_tokens !== undefined) {
    if (!isNumberRecord(body.hourly_tokens)) {
      return { ok: false, error: 'hourly_tokens must be a record of non-negative numbers' };
    }
    hourly_tokens = body.hourly_tokens;
  }
```

Then add `hourly_tokens` to the returned `value` object, after `ships`:

```ts
  return {
    ok: true,
    value: {
      github_handle: body.github_handle,
      machine: body.machine,
      date: body.date,
      tokens_total: body.tokens_total,
      tokens_by_model: body.tokens_by_model,
      sessions: body.sessions,
      deep_work_minutes: body.deep_work_minutes,
      projects_touched: body.projects_touched,
      ships: { commits: body.ships.commits, repos: body.ships.repos },
      hourly_tokens,
    },
  };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test tests/ingest/payload.test.ts && pnpm typecheck`
Expected: test PASS (all cases, old + 4 new), typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add lib/ingest/payload.ts tests/ingest/payload.test.ts
git commit -m "feat: validate optional hourly_tokens on ingest payload"
```

---

### Task 0.4: Merge `hourly_tokens` across machines in the ingest route

**Files:**
- Modify: `app/api/ingest/route.ts`
- Test: `tests/ingest/route.test.ts`

- [ ] **Step 1: Write the failing test**

In `tests/ingest/route.test.ts`, add `hourly_tokens` to the `MachineRowT` type (after `ships`):

```ts
type MachineRowT = {
  machine: string;
  tokens_total: number;
  tokens_by_model: Record<string, number>;
  sessions: number;
  deep_work_minutes: number;
  projects_touched: Record<string, number>;
  ships: { commits: number; repos: number };
  hourly_tokens: Record<string, number>;
};
```

Then add this `it` block inside `describe('POST /api/ingest — rollup semantics', ...)`:

```ts
  it('merges hourly_tokens across machines', async () => {
    const { POST } = await import('../../app/api/ingest/route');
    await POST(await makeRequest({
      ...validBody, machine: 'iMac', tokens_total: 500,
      hourly_tokens: { '9': 300, '10': 200 },
    }));
    await POST(await makeRequest({
      ...validBody, machine: 'MacBook-Air', tokens_total: 300,
      hourly_tokens: { '10': 100, '22': 200 },
    }));
    const rollup = dailyUpsertMock.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(rollup.hourly_tokens).toEqual({ '9': 300, '10': 300, '22': 200 });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/ingest/route.test.ts`
Expected: FAIL — `rollup.hourly_tokens` is `undefined`.

- [ ] **Step 3: Wire `hourly_tokens` through the route**

In `app/api/ingest/route.ts`:

Add `hourly_tokens` to the `MachineRow` type, after `ships`:

```ts
type MachineRow = {
  machine: string;
  tokens_total: number;
  tokens_by_model: Record<string, number>;
  sessions: number;
  deep_work_minutes: number;
  projects_touched: Record<string, number>;
  ships: { commits: number; repos: number };
  hourly_tokens: Record<string, number>;
};
```

In step 1 (the `machine_daily_stats` upsert), add `hourly_tokens` to the upserted row, after `ships: payload.ships,`:

```ts
      ships: payload.ships,
      hourly_tokens: payload.hourly_tokens,
      updated_at: new Date().toISOString(),
```

In step 2 (the `machine_daily_stats` select), add `hourly_tokens` to the selected columns:

```ts
    .select('machine, tokens_total, tokens_by_model, sessions, deep_work_minutes, projects_touched, ships, hourly_tokens')
```

In step 3 (the `rollup` object), add `hourly_tokens` after the `ships` field:

```ts
    ships: {
      commits: rows.reduce((s, r) => s + r.ships.commits, 0),
      repos: rows.reduce((m, r) => Math.max(m, r.ships.repos), 0),
    },
    hourly_tokens: rows.reduce<Record<string, number>>(
      (acc, r) => mergeNumberRecords(acc, r.hourly_tokens),
      {},
    ),
    source_synced_at: new Date().toISOString(),
```

(`mergeNumberRecords` already exists in this file and handles the missing-key sum.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/ingest/route.test.ts && pnpm typecheck`
Expected: test PASS (all cases), typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add app/api/ingest/route.ts tests/ingest/route.test.ts
git commit -m "feat: roll up hourly_tokens across machines in ingest route"
```

---

### Task 0.5: Bucket fresh tokens by local hour in `dashboard_push.py`

**Files:**
- Modify: `scripts/dashboard_push.py` (`parse_day`, `build_payload`)
- Test: `tests/python/test_dashboard_push.py`

- [ ] **Step 1: Write the failing tests**

In `tests/python/test_dashboard_push.py`, add this test class (place it after `TestParseSessions`):

```python
class TestHourlyBucketing(unittest.TestCase):
    def setUp(self):
        self._orig_tz = os.environ.get('TZ')
        os.environ['TZ'] = 'America/New_York'
        time.tzset()

    def tearDown(self):
        if self._orig_tz is None:
            os.environ.pop('TZ', None)
        else:
            os.environ['TZ'] = self._orig_tz
        time.tzset()

    def test_parse_day_buckets_tokens_by_local_hour(self):
        with tempfile.TemporaryDirectory() as d:
            p = os.path.join(d, 'sess.jsonl')
            write_jsonl(p, [
                # 2026-05-14T18:00Z is 14:00 EDT (UTC-4)
                {'type': 'assistant', 'timestamp': '2026-05-14T18:00:00.000Z',
                 'cwd': '/Users/holden/Claude/x', 'sessionId': 's',
                 'message': {'model': 'claude-opus-4-7',
                             'usage': {'input_tokens': 100, 'output_tokens': 200}}},
                # 2026-05-14T18:30Z is also 14:00 EDT -> same bucket
                {'type': 'assistant', 'timestamp': '2026-05-14T18:30:00.000Z',
                 'cwd': '/Users/holden/Claude/x', 'sessionId': 's',
                 'message': {'model': 'claude-opus-4-7',
                             'usage': {'input_tokens': 50, 'output_tokens': 50}}},
                # 2026-05-15T02:00Z is 22:00 EDT on 2026-05-14 -> hour 22, wrong day, ignored
                {'type': 'assistant', 'timestamp': '2026-05-15T02:00:00.000Z',
                 'cwd': '/Users/holden/Claude/x', 'sessionId': 's',
                 'message': {'model': 'claude-opus-4-7',
                             'usage': {'input_tokens': 999, 'output_tokens': 999}}},
            ])
            result = dashboard_push.parse_day([p], target_date='2026-05-14', home='/Users/holden')
            # both same-day messages land in local hour 14: 300 + 100 = 400
            self.assertEqual(result['tokens_by_hour'], {'14': 400})

    def test_build_payload_includes_hourly_tokens(self):
        day = {
            'tokens_total': 400,
            'tokens_by_model': {'claude-opus-4-7': 400},
            'sessions': 1,
            'projects_touched': {'holden-alt/cc-dashboard': 400},
            'timestamps': ['2026-05-14T18:00:00.000Z'],
            'tokens_by_hour': {'14': 400},
        }
        payload = dashboard_push.build_payload(
            day, {'commits': 0, 'repos': 0},
            github_handle='holden-alt', machine='iMac', target_date='2026-05-14',
        )
        self.assertEqual(payload['hourly_tokens'], {'14': 400})
```

Also update the existing `TestSignAndPayload.test_build_payload_shape` test — its hand-built `day` dict needs the new key. Add `'tokens_by_hour': {'10': 415}` to that `day` dict, and add this assertion at the end of the test:

```python
        self.assertEqual(payload['hourly_tokens'], {'10': 415})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python3 -m pytest tests/python/test_dashboard_push.py -q` (or `python3 tests/python/test_dashboard_push.py`)
Expected: FAIL — `KeyError: 'tokens_by_hour'` in `parse_day` results, and `build_payload` has no `hourly_tokens` key.

- [ ] **Step 3: Add hour bucketing to `parse_day`**

In `scripts/dashboard_push.py`, in `parse_day`:

Add a new accumulator next to the others, after `tokens_by_project = defaultdict(int)`:

```python
    tokens_by_hour = defaultdict(int)
```

Inside the per-message loop, where `fresh` is added to `tokens_by_model` and `tokens_by_project`, add the hour bucket. Change this block:

```python
                    fresh = (usage.get('input_tokens') or 0) + (usage.get('output_tokens') or 0)
                    tokens_by_model[model] += fresh
                    label = short_project(session_cwd, home)
                    tokens_by_project[label] += fresh
```

to:

```python
                    fresh = (usage.get('input_tokens') or 0) + (usage.get('output_tokens') or 0)
                    tokens_by_model[model] += fresh
                    label = short_project(session_cwd, home)
                    tokens_by_project[label] += fresh
                    # Bucket by the user's LOCAL hour. ts is UTC ISO with a 'Z' suffix;
                    # .astimezone() (no arg) converts to the machine's local timezone.
                    local_hour = datetime.fromisoformat(
                        ts.replace('Z', '+00:00')
                    ).astimezone().hour
                    tokens_by_hour[str(local_hour)] += fresh
```

Add `tokens_by_hour` to the returned dict:

```python
    return {
        'tokens_total': sum(tokens_by_model.values()),
        'tokens_by_model': dict(tokens_by_model),
        'sessions': len(sessions),
        'projects_touched': dict(tokens_by_project),
        'tokens_by_hour': dict(tokens_by_hour),
        'timestamps': timestamps,
    }
```

- [ ] **Step 4: Add `hourly_tokens` to `build_payload`**

In `scripts/dashboard_push.py`, in `build_payload`, add the field after `'ships': ships,`:

```python
    return {
        'github_handle': github_handle,
        'machine': machine,
        'date': target_date,
        'tokens_total': day['tokens_total'],
        'tokens_by_model': day['tokens_by_model'],
        'sessions': day['sessions'],
        'deep_work_minutes': deep_work_minutes(day.get('timestamps', [])),
        'projects_touched': day['projects_touched'],
        'ships': ships,
        'hourly_tokens': day.get('tokens_by_hour', {}),
    }
```

(`.get` with a `{}` default keeps `build_payload` robust if ever called with a hand-built `day` dict.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `python3 -m pytest tests/python/test_dashboard_push.py -q`
Expected: PASS (all classes — existing + `TestHourlyBucketing`).

- [ ] **Step 6: Commit**

```bash
git add scripts/dashboard_push.py tests/python/test_dashboard_push.py
git commit -m "feat: bucket Claude Code tokens by local hour in dashboard push"
```

---

## Phase 1 — Aggregation helpers

All of Phase 1 lives in one new file, `lib/stats/aggregations.ts`, with one test file `tests/stats/aggregations.test.ts`. Each task adds one function + its tests.

### Task 1.1: `classifyModel` + `modelTotals`

**Files:**
- Create: `lib/stats/aggregations.ts`
- Test: `tests/stats/aggregations.test.ts`

- [ ] **Step 1: Write the failing tests**

`tests/stats/aggregations.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { classifyModel, modelTotals } from '@/lib/stats/aggregations';
import type { DailyStat } from '@/lib/stats/profile-data';

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

describe('classifyModel', () => {
  it('classifies opus, sonnet, haiku by substring', () => {
    expect(classifyModel('claude-opus-4-7')).toBe('opus');
    expect(classifyModel('claude-sonnet-4-6')).toBe('sonnet');
    expect(classifyModel('claude-haiku-4-5-20251001')).toBe('haiku');
  });
  it('classifies anything else as other', () => {
    expect(classifyModel('gpt-4o')).toBe('other');
    expect(classifyModel('unknown')).toBe('other');
  });
});

describe('modelTotals', () => {
  it('sums tokens by model class across all stats', () => {
    const stats = [
      stat({ tokens_by_model: { 'claude-opus-4-7': 100, 'claude-sonnet-4-6': 50 } }),
      stat({ tokens_by_model: { 'claude-opus-4-7': 200, 'gpt-4o': 10 } }),
    ];
    expect(modelTotals(stats)).toEqual({ opus: 300, sonnet: 50, haiku: 0, other: 10 });
  });
  it('returns all-zero for empty input', () => {
    expect(modelTotals([])).toEqual({ opus: 0, sonnet: 0, haiku: 0, other: 0 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test tests/stats/aggregations.test.ts`
Expected: FAIL — module `@/lib/stats/aggregations` does not exist.

- [ ] **Step 3: Write `classifyModel` + `modelTotals`**

`lib/stats/aggregations.ts`:

```ts
import type { DailyStat } from '@/lib/stats/profile-data';

export type ModelClass = 'opus' | 'sonnet' | 'haiku' | 'other';

export function classifyModel(model: string): ModelClass {
  if (model.includes('opus')) return 'opus';
  if (model.includes('sonnet')) return 'sonnet';
  if (model.includes('haiku')) return 'haiku';
  return 'other';
}

export type ModelTotals = { opus: number; sonnet: number; haiku: number; other: number };

export function modelTotals(stats: DailyStat[]): ModelTotals {
  const out: ModelTotals = { opus: 0, sonnet: 0, haiku: 0, other: 0 };
  for (const s of stats) {
    const byModel = (s.tokens_by_model ?? {}) as Record<string, number>;
    for (const [model, n] of Object.entries(byModel)) {
      out[classifyModel(model)] += n;
    }
  }
  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test tests/stats/aggregations.test.ts && pnpm typecheck`
Expected: test PASS (4 tests), typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add lib/stats/aggregations.ts tests/stats/aggregations.test.ts
git commit -m "feat: add classifyModel and modelTotals aggregations"
```

---

### Task 1.2: `last30Days`

**Files:**
- Modify: `lib/stats/aggregations.ts`
- Test: `tests/stats/aggregations.test.ts`

- [ ] **Step 1: Write the failing tests**

In `tests/stats/aggregations.test.ts`, add `last30Days` to the import line:

```ts
import { classifyModel, modelTotals, last30Days } from '@/lib/stats/aggregations';
```

Add this `describe` block:

```ts
describe('last30Days', () => {
  it('returns exactly 30 days ending at today, oldest first', () => {
    const days = last30Days([], '2026-05-14');
    expect(days.length).toBe(30);
    expect(days[0].date).toBe('2026-04-15');
    expect(days[29].date).toBe('2026-05-14');
  });

  it('fills missing days with zeros', () => {
    const days = last30Days([], '2026-05-14');
    expect(days.every((d) => d.tokens === 0 && d.opus === 0)).toBe(true);
  });

  it('maps a present day onto its slot with model breakdown', () => {
    const stats = [
      stat({
        date: '2026-05-14',
        tokens_total: 300,
        tokens_by_model: { 'claude-opus-4-7': 250, 'claude-sonnet-4-6': 50 },
      }),
    ];
    const days = last30Days(stats, '2026-05-14');
    const today = days[29];
    expect(today.tokens).toBe(300);
    expect(today.opus).toBe(250);
    expect(today.sonnet).toBe(50);
    expect(today.haiku).toBe(0);
  });

  it('ignores stats outside the 30-day window', () => {
    const stats = [stat({ date: '2026-01-01', tokens_total: 999 })];
    const days = last30Days(stats, '2026-05-14');
    expect(days.some((d) => d.tokens === 999)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test tests/stats/aggregations.test.ts`
Expected: FAIL — `last30Days` is not exported.

- [ ] **Step 3: Write `last30Days`**

In `lib/stats/aggregations.ts`, append:

```ts
export type TrendDay = {
  date: string;
  tokens: number;
  opus: number;
  sonnet: number;
  haiku: number;
  other: number;
};

const MS_PER_DAY = 86_400_000;

export function last30Days(stats: DailyStat[], today: string): TrendDay[] {
  const byDate = new Map(stats.map((s) => [s.date, s]));
  const todayMs = Date.parse(today + 'T00:00:00Z');
  const out: TrendDay[] = [];
  for (let i = 29; i >= 0; i--) {
    const iso = new Date(todayMs - i * MS_PER_DAY).toISOString().slice(0, 10);
    const day: TrendDay = { date: iso, tokens: 0, opus: 0, sonnet: 0, haiku: 0, other: 0 };
    const stat = byDate.get(iso);
    if (stat) {
      day.tokens = stat.tokens_total;
      const byModel = (stat.tokens_by_model ?? {}) as Record<string, number>;
      for (const [model, n] of Object.entries(byModel)) {
        day[classifyModel(model)] += n;
      }
    }
    out.push(day);
  }
  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test tests/stats/aggregations.test.ts && pnpm typecheck`
Expected: test PASS (8 tests total), typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add lib/stats/aggregations.ts tests/stats/aggregations.test.ts
git commit -m "feat: add last30Days trend aggregation"
```

---

### Task 1.3: `dayOfWeekAverages`

**Files:**
- Modify: `lib/stats/aggregations.ts`
- Test: `tests/stats/aggregations.test.ts`

- [ ] **Step 1: Write the failing tests**

In `tests/stats/aggregations.test.ts`, add `dayOfWeekAverages` to the import line. Add this `describe`:

```ts
describe('dayOfWeekAverages', () => {
  it('returns a length-7 array, index 0 = Sunday', () => {
    expect(dayOfWeekAverages([]).length).toBe(7);
  });

  it('averages tokens per weekday over the days observed', () => {
    // 2026-05-14 is a Thursday (getUTCDay() === 4). 2026-05-07 also Thursday.
    const stats = [
      stat({ date: '2026-05-14', tokens_total: 100 }),
      stat({ date: '2026-05-07', tokens_total: 300 }),
    ];
    const avgs = dayOfWeekAverages(stats);
    expect(avgs[4]).toBe(200); // (100 + 300) / 2 Thursdays
  });

  it('returns 0 for weekdays with no data', () => {
    const stats = [stat({ date: '2026-05-14', tokens_total: 100 })]; // Thursday only
    const avgs = dayOfWeekAverages(stats);
    expect(avgs[0]).toBe(0); // Sunday
    expect(avgs[1]).toBe(0); // Monday
  });

  it('rounds the average to an integer', () => {
    const stats = [
      stat({ date: '2026-05-14', tokens_total: 100 }), // Thursday
      stat({ date: '2026-05-07', tokens_total: 101 }), // Thursday
    ];
    expect(dayOfWeekAverages(stats)[4]).toBe(101); // round(100.5)
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test tests/stats/aggregations.test.ts`
Expected: FAIL — `dayOfWeekAverages` is not exported.

- [ ] **Step 3: Write `dayOfWeekAverages`**

In `lib/stats/aggregations.ts`, append:

```ts
// Index 0 = Sunday, matching Date.prototype.getUTCDay().
export function dayOfWeekAverages(stats: DailyStat[]): number[] {
  const sums = new Array<number>(7).fill(0);
  const counts = new Array<number>(7).fill(0);
  for (const s of stats) {
    const dow = new Date(s.date + 'T00:00:00Z').getUTCDay();
    sums[dow] += s.tokens_total;
    counts[dow] += 1;
  }
  return sums.map((sum, i) => (counts[i] > 0 ? Math.round(sum / counts[i]) : 0));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test tests/stats/aggregations.test.ts && pnpm typecheck`
Expected: test PASS (12 tests total), typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add lib/stats/aggregations.ts tests/stats/aggregations.test.ts
git commit -m "feat: add dayOfWeekAverages aggregation"
```

---

### Task 1.4: `hourlyTotals`

**Files:**
- Modify: `lib/stats/aggregations.ts`
- Test: `tests/stats/aggregations.test.ts`

- [ ] **Step 1: Write the failing tests**

In `tests/stats/aggregations.test.ts`, add `hourlyTotals` to the import line. Add this `describe`:

```ts
describe('hourlyTotals', () => {
  it('returns a length-24 array', () => {
    expect(hourlyTotals([]).length).toBe(24);
  });

  it('sums hourly_tokens across all stats by hour index', () => {
    const stats = [
      stat({ hourly_tokens: { '9': 100, '22': 50 } }),
      stat({ hourly_tokens: { '9': 200, '10': 30 } }),
    ];
    const hours = hourlyTotals(stats);
    expect(hours[9]).toBe(300);
    expect(hours[10]).toBe(30);
    expect(hours[22]).toBe(50);
    expect(hours[0]).toBe(0);
  });

  it('ignores out-of-range or non-integer hour keys', () => {
    const stats = [stat({ hourly_tokens: { '25': 999, 'x': 999, '-1': 999 } })];
    const hours = hourlyTotals(stats);
    expect(hours.every((n) => n === 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test tests/stats/aggregations.test.ts`
Expected: FAIL — `hourlyTotals` is not exported.

- [ ] **Step 3: Write `hourlyTotals`**

In `lib/stats/aggregations.ts`, append:

```ts
// Index = hour 0..23. Sums hourly_tokens across every stat row.
export function hourlyTotals(stats: DailyStat[]): number[] {
  const out = new Array<number>(24).fill(0);
  for (const s of stats) {
    const hourly = (s.hourly_tokens ?? {}) as Record<string, number>;
    for (const [hour, n] of Object.entries(hourly)) {
      const h = Number(hour);
      if (Number.isInteger(h) && h >= 0 && h < 24) out[h] += n;
    }
  }
  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test tests/stats/aggregations.test.ts && pnpm typecheck`
Expected: test PASS (15 tests total), typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add lib/stats/aggregations.ts tests/stats/aggregations.test.ts
git commit -m "feat: add hourlyTotals aggregation"
```

---

## Phase 2 — Chart components

All chart components are pure presentational functions in `components/charts/`. They expose `data-*` attributes for testing, mirror the terminal aesthetic from `globals.css`, and use only divs + CSS.

### Task 2.1: `TokenTrendChart`

**Files:**
- Create: `components/charts/TokenTrendChart.tsx`
- Test: `tests/components/TokenTrendChart.test.tsx`

- [ ] **Step 1: Write the failing test**

`tests/components/TokenTrendChart.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { TokenTrendChart } from '@/components/charts/TokenTrendChart';

describe('TokenTrendChart', () => {
  it('renders one bar per day', () => {
    const days = Array.from({ length: 30 }, (_, i) => ({
      date: `2026-04-${String(i + 1).padStart(2, '0')}`,
      tokens: i * 1000,
    }));
    const { container } = render(<TokenTrendChart days={days} />);
    expect(container.querySelectorAll('[data-bar]').length).toBe(30);
  });

  it('scales the tallest bar to 100% and others proportionally', () => {
    const days = [
      { date: '2026-05-13', tokens: 100 },
      { date: '2026-05-14', tokens: 200 },
    ];
    const { container } = render(<TokenTrendChart days={days} />);
    const bars = container.querySelectorAll('[data-bar]');
    expect(bars[0].getAttribute('data-pct')).toBe('50');
    expect(bars[1].getAttribute('data-pct')).toBe('100');
  });

  it('renders all-zero bars without crashing on empty/zero data', () => {
    const days = [{ date: '2026-05-14', tokens: 0 }];
    const { container } = render(<TokenTrendChart days={days} />);
    expect(container.querySelector('[data-bar]')?.getAttribute('data-pct')).toBe('0');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/components/TokenTrendChart.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write `TokenTrendChart`**

`components/charts/TokenTrendChart.tsx`:

```tsx
type TokenTrendChartProps = {
  days: { date: string; tokens: number }[];
};

export function TokenTrendChart({ days }: TokenTrendChartProps) {
  const max = Math.max(1, ...days.map((d) => d.tokens));
  return (
    <div
      className="flex items-end gap-[2px] h-[80px]"
      role="img"
      aria-label="30-day daily token trend"
    >
      {days.map((d) => {
        const pct = Math.round((d.tokens / max) * 100);
        return (
          <div
            key={d.date}
            data-bar
            data-date={d.date}
            data-pct={pct}
            title={`${d.date} · ${d.tokens.toLocaleString()} tokens`}
            className="flex-1 rounded-t-[1px]"
            style={{ height: `${pct}%`, minHeight: '1px', background: 'var(--color-orange)' }}
          />
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/components/TokenTrendChart.test.tsx && pnpm typecheck`
Expected: test PASS (3 tests), typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add components/charts/TokenTrendChart.tsx tests/components/TokenTrendChart.test.tsx
git commit -m "feat: add TokenTrendChart component"
```

---

### Task 2.2: `ModelAreaChart`

**Files:**
- Create: `components/charts/ModelAreaChart.tsx`
- Test: `tests/components/ModelAreaChart.test.tsx`

- [ ] **Step 1: Write the failing test**

`tests/components/ModelAreaChart.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ModelAreaChart } from '@/components/charts/ModelAreaChart';
import type { TrendDay } from '@/lib/stats/aggregations';

function day(partial: Partial<TrendDay>): TrendDay {
  return { date: '2026-05-14', tokens: 0, opus: 0, sonnet: 0, haiku: 0, other: 0, ...partial };
}

describe('ModelAreaChart', () => {
  it('renders one column per day', () => {
    const days = Array.from({ length: 30 }, (_, i) =>
      day({ date: `2026-04-${String(i + 1).padStart(2, '0')}` }),
    );
    const { container } = render(<ModelAreaChart days={days} />);
    expect(container.querySelectorAll('[data-col]').length).toBe(30);
  });

  it('stacks model layers proportionally within a day', () => {
    const days = [day({ date: '2026-05-14', tokens: 100, opus: 75, sonnet: 25 })];
    const { container } = render(<ModelAreaChart days={days} />);
    const opus = container.querySelector('[data-layer="opus"]');
    const sonnet = container.querySelector('[data-layer="sonnet"]');
    expect(opus?.getAttribute('data-pct')).toBe('75');
    expect(sonnet?.getAttribute('data-pct')).toBe('25');
  });

  it('renders an empty column for a zero-token day', () => {
    const days = [day({ date: '2026-05-14' })];
    const { container } = render(<ModelAreaChart days={days} />);
    expect(container.querySelector('[data-col]')).toBeTruthy();
    expect(container.querySelectorAll('[data-layer]').length).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/components/ModelAreaChart.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write `ModelAreaChart`**

`components/charts/ModelAreaChart.tsx`:

```tsx
import type { TrendDay } from '@/lib/stats/aggregations';

type ModelAreaChartProps = {
  days: TrendDay[];
};

const LAYERS = [
  { key: 'opus', color: 'var(--color-orange)' },
  { key: 'sonnet', color: 'var(--color-cyan)' },
  { key: 'haiku', color: 'var(--color-green)' },
  { key: 'other', color: 'var(--color-dim)' },
] as const;

export function ModelAreaChart({ days }: ModelAreaChartProps) {
  return (
    <div
      className="flex items-stretch gap-[2px] h-[80px]"
      role="img"
      aria-label="30-day model mix"
    >
      {days.map((d) => {
        const total = d.opus + d.sonnet + d.haiku + d.other;
        return (
          <div
            key={d.date}
            data-col
            data-date={d.date}
            className="flex-1 flex flex-col-reverse rounded-[1px] overflow-hidden"
            style={{ background: 'var(--color-bg-2)' }}
            title={`${d.date} · ${total.toLocaleString()} tokens`}
          >
            {total > 0 &&
              LAYERS.map((layer) => {
                const pct = Math.round((d[layer.key] / total) * 100);
                if (pct === 0) return null;
                return (
                  <div
                    key={layer.key}
                    data-layer={layer.key}
                    data-pct={pct}
                    style={{ height: `${pct}%`, background: layer.color }}
                  />
                );
              })}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/components/ModelAreaChart.test.tsx && pnpm typecheck`
Expected: test PASS (3 tests), typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add components/charts/ModelAreaChart.tsx tests/components/ModelAreaChart.test.tsx
git commit -m "feat: add ModelAreaChart component"
```

---

### Task 2.3: `ModelDonut`

**Files:**
- Create: `components/charts/ModelDonut.tsx`
- Test: `tests/components/ModelDonut.test.tsx`

- [ ] **Step 1: Write the failing test**

`tests/components/ModelDonut.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ModelDonut } from '@/components/charts/ModelDonut';

describe('ModelDonut', () => {
  it('renders a legend entry per model class with rounded percentages', () => {
    const { container } = render(
      <ModelDonut totals={{ opus: 750, sonnet: 250, haiku: 0, other: 0 }} />,
    );
    expect(container.querySelector('[data-legend="opus"]')?.getAttribute('data-pct')).toBe('75');
    expect(container.querySelector('[data-legend="sonnet"]')?.getAttribute('data-pct')).toBe('25');
    expect(container.querySelector('[data-legend="haiku"]')?.getAttribute('data-pct')).toBe('0');
  });

  it('renders the donut element', () => {
    const { container } = render(
      <ModelDonut totals={{ opus: 1, sonnet: 0, haiku: 0, other: 0 }} />,
    );
    expect(container.querySelector('[data-donut]')).toBeTruthy();
  });

  it('does not divide by zero on all-zero totals', () => {
    const { container } = render(
      <ModelDonut totals={{ opus: 0, sonnet: 0, haiku: 0, other: 0 }} />,
    );
    expect(container.querySelector('[data-legend="opus"]')?.getAttribute('data-pct')).toBe('0');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/components/ModelDonut.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write `ModelDonut`**

`components/charts/ModelDonut.tsx`:

```tsx
import type { ModelTotals } from '@/lib/stats/aggregations';

type ModelDonutProps = {
  totals: ModelTotals;
};

const SEGMENTS = [
  { key: 'opus', label: 'opus', color: 'var(--color-orange)' },
  { key: 'sonnet', label: 'sonnet', color: 'var(--color-cyan)' },
  { key: 'haiku', label: 'haiku', color: 'var(--color-green)' },
  { key: 'other', label: 'other', color: 'var(--color-dim)' },
] as const;

export function ModelDonut({ totals }: ModelDonutProps) {
  const total = SEGMENTS.reduce((s, seg) => s + totals[seg.key], 0) || 1;
  let cursor = 0;
  const stops: string[] = [];
  const legend: { key: string; label: string; pct: number; color: string }[] = [];
  for (const seg of SEGMENTS) {
    const pct = (totals[seg.key] / total) * 100;
    stops.push(`${seg.color} ${cursor}% ${cursor + pct}%`);
    legend.push({ key: seg.key, label: seg.label, pct: Math.round(pct), color: seg.color });
    cursor += pct;
  }
  return (
    <div className="flex items-center gap-3">
      <div
        data-donut
        role="img"
        aria-label="model token split"
        className="w-[72px] h-[72px] rounded-full shrink-0"
        style={{
          background: `conic-gradient(${stops.join(', ')})`,
          mask: 'radial-gradient(circle, transparent 38%, black 39%)',
          WebkitMask: 'radial-gradient(circle, transparent 38%, black 39%)',
        }}
      />
      <div className="flex flex-col gap-0.5 text-[0.6rem]">
        {legend.map((l) => (
          <span
            key={l.key}
            data-legend={l.key}
            data-pct={l.pct}
            style={{ color: 'var(--color-dim)' }}
          >
            <i
              className="inline-block w-2 h-2 rounded-[2px] mr-1 align-middle"
              style={{ background: l.color }}
            />
            {l.label} {l.pct}%
          </span>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/components/ModelDonut.test.tsx && pnpm typecheck`
Expected: test PASS (3 tests), typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add components/charts/ModelDonut.tsx tests/components/ModelDonut.test.tsx
git commit -m "feat: add ModelDonut component"
```

---

### Task 2.4: `DayOfWeekChart`

**Files:**
- Create: `components/charts/DayOfWeekChart.tsx`
- Test: `tests/components/DayOfWeekChart.test.tsx`

- [ ] **Step 1: Write the failing test**

`tests/components/DayOfWeekChart.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { DayOfWeekChart } from '@/components/charts/DayOfWeekChart';

describe('DayOfWeekChart', () => {
  it('renders 7 bars', () => {
    const { container } = render(<DayOfWeekChart averages={[0, 0, 0, 0, 0, 0, 0]} />);
    expect(container.querySelectorAll('[data-bar]').length).toBe(7);
  });

  it('scales the tallest weekday to 100%', () => {
    const { container } = render(<DayOfWeekChart averages={[100, 0, 0, 0, 200, 0, 0]} />);
    const bars = container.querySelectorAll('[data-bar]');
    expect(bars[0].getAttribute('data-pct')).toBe('50');
    expect(bars[4].getAttribute('data-pct')).toBe('100');
  });

  it('does not crash on all-zero averages', () => {
    const { container } = render(<DayOfWeekChart averages={[0, 0, 0, 0, 0, 0, 0]} />);
    expect(container.querySelector('[data-bar]')?.getAttribute('data-pct')).toBe('0');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/components/DayOfWeekChart.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write `DayOfWeekChart`**

`components/charts/DayOfWeekChart.tsx`:

```tsx
type DayOfWeekChartProps = {
  averages: number[]; // length 7, index 0 = Sunday
};

const LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function DayOfWeekChart({ averages }: DayOfWeekChartProps) {
  const max = Math.max(1, ...averages);
  return (
    <div
      className="flex items-end gap-1 h-[80px]"
      role="img"
      aria-label="average tokens by day of week"
    >
      {averages.map((avg, i) => {
        const pct = Math.round((avg / max) * 100);
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
            <div
              data-bar
              data-day={i}
              data-pct={pct}
              title={`${LABELS[i]} · ${avg.toLocaleString()} avg tokens`}
              className="w-full rounded-t-[1px]"
              style={{ height: `${pct}%`, minHeight: '1px', background: 'var(--color-yellow)' }}
            />
            <span className="text-[0.55rem]" style={{ color: 'var(--color-dim)' }}>
              {LABELS[i]}
            </span>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/components/DayOfWeekChart.test.tsx && pnpm typecheck`
Expected: test PASS (3 tests), typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add components/charts/DayOfWeekChart.tsx tests/components/DayOfWeekChart.test.tsx
git commit -m "feat: add DayOfWeekChart component"
```

---

### Task 2.5: `TimeOfDayHistogram`

**Files:**
- Create: `components/charts/TimeOfDayHistogram.tsx`
- Test: `tests/components/TimeOfDayHistogram.test.tsx`

- [ ] **Step 1: Write the failing test**

`tests/components/TimeOfDayHistogram.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { TimeOfDayHistogram } from '@/components/charts/TimeOfDayHistogram';

describe('TimeOfDayHistogram', () => {
  it('renders 24 bars', () => {
    const { container } = render(<TimeOfDayHistogram hourly={new Array(24).fill(0)} />);
    expect(container.querySelectorAll('[data-hour]').length).toBe(24);
  });

  it('scales the busiest hour to 100%', () => {
    const hourly = new Array(24).fill(0);
    hourly[9] = 100;
    hourly[14] = 200;
    const { container } = render(<TimeOfDayHistogram hourly={hourly} />);
    expect(container.querySelector('[data-hour="9"]')?.getAttribute('data-pct')).toBe('50');
    expect(container.querySelector('[data-hour="14"]')?.getAttribute('data-pct')).toBe('100');
  });

  it('does not crash on all-zero hours', () => {
    const { container } = render(<TimeOfDayHistogram hourly={new Array(24).fill(0)} />);
    expect(container.querySelector('[data-hour="0"]')?.getAttribute('data-pct')).toBe('0');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/components/TimeOfDayHistogram.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write `TimeOfDayHistogram`**

`components/charts/TimeOfDayHistogram.tsx`:

```tsx
type TimeOfDayHistogramProps = {
  hourly: number[]; // length 24, index = hour 0..23
};

export function TimeOfDayHistogram({ hourly }: TimeOfDayHistogramProps) {
  const max = Math.max(1, ...hourly);
  return (
    <div
      className="flex items-end gap-[1px] h-[80px]"
      role="img"
      aria-label="tokens by hour of day"
    >
      {hourly.map((n, h) => {
        const pct = Math.round((n / max) * 100);
        return (
          <div
            key={h}
            data-hour={h}
            data-pct={pct}
            title={`${String(h).padStart(2, '0')}:00 · ${n.toLocaleString()} tokens`}
            className="flex-1 rounded-t-[1px]"
            style={{ height: `${pct}%`, minHeight: '1px', background: 'var(--color-magenta)' }}
          />
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/components/TimeOfDayHistogram.test.tsx && pnpm typecheck`
Expected: test PASS (3 tests), typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add components/charts/TimeOfDayHistogram.tsx tests/components/TimeOfDayHistogram.test.tsx
git commit -m "feat: add TimeOfDayHistogram component"
```

---

## Phase 3 — Sections + wiring

### Task 3.1: `TrendsSection`

**Files:**
- Create: `components/TrendsSection.tsx`
- Test: `tests/components/TrendsSection.test.tsx`

- [ ] **Step 1: Write the failing test**

`tests/components/TrendsSection.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { TrendsSection } from '@/components/TrendsSection';
import type { DailyStat } from '@/lib/stats/profile-data';

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

describe('TrendsSection', () => {
  it('renders a 30-bar token trend and a 30-column model area chart', () => {
    const stats = [
      stat({ date: '2026-05-14', tokens_total: 300, tokens_by_model: { 'claude-opus-4-7': 300 } }),
    ];
    const { container } = render(<TrendsSection dailyStats={stats} today="2026-05-14" />);
    expect(container.querySelectorAll('[data-bar]').length).toBe(30);
    expect(container.querySelectorAll('[data-col]').length).toBe(30);
  });

  it('renders without crashing on empty stats', () => {
    const { container } = render(<TrendsSection dailyStats={[]} today="2026-05-14" />);
    expect(container.querySelectorAll('[data-bar]').length).toBe(30);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/components/TrendsSection.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write `TrendsSection`**

`components/TrendsSection.tsx`:

```tsx
import type { DailyStat } from '@/lib/stats/profile-data';
import { last30Days } from '@/lib/stats/aggregations';
import { TokenTrendChart } from '@/components/charts/TokenTrendChart';
import { ModelAreaChart } from '@/components/charts/ModelAreaChart';

type TrendsSectionProps = {
  dailyStats: DailyStat[];
  today: string;
};

export function TrendsSection({ dailyStats, today }: TrendsSectionProps) {
  const days = last30Days(dailyStats, today);
  return (
    <section className="mt-4">
      <h3
        className="text-[0.6rem] uppercase tracking-[0.12em] font-semibold mb-2"
        style={{ color: 'var(--color-dim)' }}
      >
        trends · 30d
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div
          className="rounded border p-2.5"
          style={{ borderColor: 'var(--color-border)', borderTop: '2px solid var(--color-orange)' }}
        >
          <h4
            className="text-[0.58rem] uppercase tracking-[0.1em] mb-2"
            style={{ color: 'var(--color-orange)' }}
          >
            · daily tokens
          </h4>
          <TokenTrendChart days={days.map((d) => ({ date: d.date, tokens: d.tokens }))} />
        </div>
        <div
          className="rounded border p-2.5"
          style={{ borderColor: 'var(--color-border)', borderTop: '2px solid var(--color-cyan)' }}
        >
          <h4
            className="text-[0.58rem] uppercase tracking-[0.1em] mb-2"
            style={{ color: 'var(--color-cyan)' }}
          >
            · model mix
          </h4>
          <ModelAreaChart days={days} />
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/components/TrendsSection.test.tsx && pnpm typecheck`
Expected: test PASS (2 tests), typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add components/TrendsSection.tsx tests/components/TrendsSection.test.tsx
git commit -m "feat: add TrendsSection (30d daily tokens + model mix)"
```

---

### Task 3.2: `ChartsSection`

**Files:**
- Create: `components/ChartsSection.tsx`
- Test: `tests/components/ChartsSection.test.tsx`

- [ ] **Step 1: Write the failing test**

`tests/components/ChartsSection.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ChartsSection } from '@/components/ChartsSection';
import type { DailyStat } from '@/lib/stats/profile-data';

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

describe('ChartsSection', () => {
  it('renders the donut, day-of-week chart, and time-of-day histogram', () => {
    const stats = [
      stat({
        date: '2026-05-14',
        tokens_total: 300,
        tokens_by_model: { 'claude-opus-4-7': 300 },
        hourly_tokens: { '14': 300 },
      }),
    ];
    const { container } = render(<ChartsSection dailyStats={stats} />);
    expect(container.querySelector('[data-donut]')).toBeTruthy();
    expect(container.querySelectorAll('[data-day]').length).toBe(7);
    expect(container.querySelectorAll('[data-hour]').length).toBe(24);
  });

  it('renders without crashing on empty stats', () => {
    const { container } = render(<ChartsSection dailyStats={[]} />);
    expect(container.querySelector('[data-donut]')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/components/ChartsSection.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write `ChartsSection`**

`components/ChartsSection.tsx`:

```tsx
import type { DailyStat } from '@/lib/stats/profile-data';
import { modelTotals, dayOfWeekAverages, hourlyTotals } from '@/lib/stats/aggregations';
import { ModelDonut } from '@/components/charts/ModelDonut';
import { DayOfWeekChart } from '@/components/charts/DayOfWeekChart';
import { TimeOfDayHistogram } from '@/components/charts/TimeOfDayHistogram';

type ChartsSectionProps = {
  dailyStats: DailyStat[];
};

const PANELS = [
  { title: '· model split', color: 'var(--color-magenta)' },
  { title: '· day of week', color: 'var(--color-yellow)' },
  { title: '· time of day', color: 'var(--color-magenta)' },
];

export function ChartsSection({ dailyStats }: ChartsSectionProps) {
  const totals = modelTotals(dailyStats);
  const dow = dayOfWeekAverages(dailyStats);
  const hourly = hourlyTotals(dailyStats);
  const charts = [
    <ModelDonut key="donut" totals={totals} />,
    <DayOfWeekChart key="dow" averages={dow} />,
    <TimeOfDayHistogram key="tod" hourly={hourly} />,
  ];
  return (
    <section className="mt-3">
      <h3
        className="text-[0.6rem] uppercase tracking-[0.12em] font-semibold mb-2"
        style={{ color: 'var(--color-dim)' }}
      >
        stats · charts
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {PANELS.map((panel, i) => (
          <div
            key={panel.title}
            className="rounded border p-2.5"
            style={{ borderColor: 'var(--color-border)', borderTop: `2px solid ${panel.color}` }}
          >
            <h4
              className="text-[0.58rem] uppercase tracking-[0.1em] mb-2"
              style={{ color: panel.color }}
            >
              {panel.title}
            </h4>
            {charts[i]}
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/components/ChartsSection.test.tsx && pnpm typecheck`
Expected: test PASS (2 tests), typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add components/ChartsSection.tsx tests/components/ChartsSection.test.tsx
git commit -m "feat: add ChartsSection (donut + day-of-week + time-of-day)"
```

---

### Task 3.3: Wire `TrendsSection` + `ChartsSection` into `ProfileLive`

**Files:**
- Modify: `components/ProfileLive.tsx`
- Test: `tests/components/ProfileLive.test.tsx`

- [ ] **Step 1: Write the failing test**

In `tests/components/ProfileLive.test.tsx`, add this `it` block inside the existing top-level `describe`. (The existing tests build an `initialData`/`ProfileData` fixture — reuse whatever helper or inline object the file already uses; the assertion below only depends on the rendered output.)

```tsx
  it('renders the trends and charts sections', () => {
    const initialData = {
      user: {
        id: 'u1',
        github_handle: 'holden-alt',
        display_name: 'Holden',
        avatar_url: null,
        primary_persona: null,
        secondary_personas: [],
      },
      dailyStats: [
        {
          user_id: 'u1',
          date: '2026-05-14',
          tokens_total: 300,
          tokens_by_model: { 'claude-opus-4-7': 300 },
          sessions: 2,
          deep_work_minutes: 60,
          machines: ['iMac'],
          projects_touched: {},
          ships: {},
          hourly_tokens: { '14': 300 },
          source_synced_at: null,
        },
      ],
    };
    const { container } = render(<ProfileLive initialData={initialData} today="2026-05-14" />);
    // TrendsSection: 30 token bars + 30 model-mix columns
    expect(container.querySelectorAll('[data-bar]').length).toBeGreaterThanOrEqual(30);
    expect(container.querySelectorAll('[data-col]').length).toBe(30);
    // ChartsSection: donut + 24 hour bars
    expect(container.querySelector('[data-donut]')).toBeTruthy();
    expect(container.querySelectorAll('[data-hour]').length).toBe(24);
  });
```

> Note: if the existing `ProfileLive.test.tsx` already declares an `initialData` fixture missing the `hourly_tokens` field on its `dailyStats` rows, add `hourly_tokens: {}` to those rows so the file typechecks against the updated `DailyStat` type.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/components/ProfileLive.test.tsx`
Expected: FAIL — no `[data-donut]` / `[data-col]` elements (sections not rendered yet).

- [ ] **Step 3: Render the two sections in `ProfileLive`**

In `components/ProfileLive.tsx`:

Add the imports after the existing `PersonaPane` import:

```tsx
import { TrendsSection } from '@/components/TrendsSection';
import { ChartsSection } from '@/components/ChartsSection';
```

In the returned JSX, after the closing `</section>` of the 3-pane hero grid and before the closing `</main>`, add:

```tsx
      <TrendsSection dailyStats={dailyStats} today={today} />
      <ChartsSection dailyStats={dailyStats} />
```

The full return block becomes:

```tsx
  return (
    <main className="min-h-screen px-6 py-4 max-w-[1400px] mx-auto">
      <StatusBar
        handle={user.github_handle}
        primaryPersona={user.primary_persona ?? null}
        streakDays={streakDays}
        tokensToday={tokensToday}
      />
      <section className="grid grid-cols-1 lg:grid-cols-[1.2fr_2fr_1.2fr] gap-3 mt-4">
        <BuildsPane projects={projectsToday} />
        <ActivityPane
          tokensToday={tokensToday}
          sessionsToday={sessionsToday}
          machinesCount={machinesToday.length}
          deepWorkMinutes={deepWorkToday}
          tokensByModel={tokensByModel}
          dailyStats={dailyStats}
          today={today}
        />
        <PersonaPane
          primary={user.primary_persona ?? null}
          secondary={user.secondary_personas ?? []}
        />
      </section>
      <TrendsSection dailyStats={dailyStats} today={today} />
      <ChartsSection dailyStats={dailyStats} />
    </main>
  );
```

- [ ] **Step 4: Run the full test suite + typecheck to verify nothing regressed**

Run: `pnpm test && pnpm typecheck`
Expected: PASS — all TS/Vitest tests green (the original 71 + everything added in Plan 3), typecheck clean.

- [ ] **Step 5: Run the Python test suite**

Run: `python3 -m pytest tests/python/ -q`
Expected: PASS — all Python tests green (the original 16 + `TestHourlyBucketing`).

- [ ] **Step 6: Commit**

```bash
git add components/ProfileLive.tsx tests/components/ProfileLive.test.tsx
git commit -m "feat: render trends and charts sections on the profile"
```

---

### Task 3.4: Manual dev-server check of the charts

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

Run: `pnpm dev`
Open `http://localhost:3000/holden-alt`.

- [ ] **Step 2: Verify the charts render**

Confirm visually:
- A "trends · 30d" section appears below the 3-pane hero with two panels: a daily-token bar chart (orange) and a model-mix stacked-column chart (orange/cyan/green).
- A "stats · charts" section appears below it with three panels: a donut with an opus/sonnet/haiku/other legend, a 7-bar day-of-week chart (yellow), and a 24-bar time-of-day histogram (magenta).
- The time-of-day histogram is **all-zero / flat** at this point — that is expected. The migration backfilled existing rows to `hourly_tokens = {}`; real hour data only appears after Task 4.1's re-backfill.
- No console errors, no hydration warnings.

- [ ] **Step 3: Stop the dev server**

Stop `pnpm dev` (Ctrl-C).

There is no commit for this task — it is a verification gate before deploying.

---

## Phase 4 — Deploy + backfill + verify

### Task 4.1: Deploy, re-backfill both Macs, verify time-of-day data

**Files:** none (operational — Holden runs these)

This task is operational, mirroring the Plan 2 setup. The migration (Task 0.1 Step 5) is already applied to the live Supabase project. This task deploys the updated code and re-runs the local backfill so `hourly_tokens` gets populated for history.

- [ ] **Step 1: Deploy the updated app to Cloudflare Pages**

The CF Pages project `cc-dashboard` is git-integrated to `holden-alt/cc-dashboard`, so pushing the Plan 3 commits to the default branch triggers a deploy:

```bash
git push
```

Wait for the Cloudflare Pages build to finish (check the Pages dashboard or `wrangler pages deployment list`). Once live, `/api/ingest` accepts and merges `hourly_tokens`.

- [ ] **Step 2: Re-run the backfill on the iMac**

On the iMac, with the `CC_DASHBOARD_*` env vars already set in `~/.zshrc` (from Plan 2):

```bash
python3 ~/Claude/holden-alt/cc-dashboard/scripts/dashboard_push.py --backfill
```

Expected: one `YYYY-MM-DD: 200 ...` line per active date. This re-pushes every historical day, now including `hourly_tokens`.

- [ ] **Step 3: Re-run the backfill on the MacBook-Air**

Same command on the MacBook-Air:

```bash
python3 ~/Claude/holden-alt/cc-dashboard/scripts/dashboard_push.py --backfill
```

- [ ] **Step 4: Verify `hourly_tokens` landed in Supabase**

Query the live project (Supabase SQL editor or MCP `execute_sql`):

```sql
select date, hourly_tokens
from public.daily_stats
where hourly_tokens <> '{}'::jsonb
order by date desc
limit 5;
```

Expected: recent rows have non-empty `hourly_tokens` objects keyed by hour strings.

- [ ] **Step 5: Verify the live profile**

Open `https://cc-dashboard-qab.pages.dev/holden-alt`. Confirm:
- The "trends · 30d" daily-token bars show real history.
- The model-mix chart shows the orange/cyan/green split per day.
- The donut shows Holden's all-time opus/sonnet/haiku split.
- The day-of-week chart shows 7 bars with real averages.
- The **time-of-day histogram now shows a real shape** (peaks at Holden's actual working hours, in US Eastern local time).

- [ ] **Step 6: Verify live updates still work**

Run a Claude Code turn on either Mac (the `Stop` hook fires `dashboard_push.py` for *today*, which now includes `hourly_tokens`). With the profile open, confirm today's data updates and no `/api/ingest` errors appear in the CF Pages logs.

---

## Self-Review

**1. Spec coverage:**
- Spec §3 item 3 "Trends · 30d — 2 charts side by side: daily tokens bar chart, model-mix area chart" → Task 3.1 `TrendsSection` (`TokenTrendChart` + `ModelAreaChart`). ✓
- Spec §4 visualization catalog: bar chart → `TokenTrendChart` / `DayOfWeekChart` (Tasks 2.1, 2.4); area chart (stacked, model mix) → `ModelAreaChart` (Task 2.2); donut chart (model split) → `ModelDonut` (Task 2.3); histogram (time-of-day, day-of-week) → `TimeOfDayHistogram` / `DayOfWeekChart` (Tasks 2.5, 2.4). ✓ (Calendar heatmap already exists from Plan 1/2; sparkline, race chart, rank list, bar comparison are Plan 4+ — out of scope per checkpoint.)
- Spec §7 "custom components (no chart lib for v1) … divs + grid + gradients" → every chart in Phase 2 is divs + CSS, no library, no `d3-scale`. ✓
- Checkpoint scope "charts (30d trend, model donut, time-of-day histogram, day-of-week, stacked area)" → all five built (Tasks 2.1–2.5) plus the pipeline extension Holden chose (Phase 0). ✓

**2. Placeholder scan:** No "TBD", no "add error handling", no "similar to Task N", no undefined references. Every code step has complete code. ✓

**3. Type consistency:**
- `ModelTotals` defined in Task 1.1, consumed by `ModelDonut` (Task 2.3) and `ChartsSection` (Task 3.2) — same shape. ✓
- `TrendDay` defined in Task 1.2, consumed by `ModelAreaChart` (Task 2.2) and `TrendsSection` (Task 3.1) — same shape. ✓
- `classifyModel` returns `ModelClass` (`'opus'|'sonnet'|'haiku'|'other'`), used as an index into `ModelTotals` and `TrendDay` — both have exactly those four numeric keys. ✓
- `hourly_tokens` is `Record<string, number>` on `IngestPayload` (Task 0.3), `Json` on the `Database` type (Task 0.2), and read with an `as Record<string, number>` cast in `hourlyTotals` (Task 1.4) — consistent with how `tokens_by_model` is already handled in the codebase. ✓
- `dashboard_push.py` emits `hourly_tokens` as a `str → int` dict (Task 0.5); the route merges it with the existing `mergeNumberRecords` (Task 0.4). ✓

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-14-cc-dashboard-plan-3-charts.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. This plan's tasks are mostly independent within a phase (the four Phase 1 helpers, the five Phase 2 charts) so several can run in parallel waves, matching how Plans 1 & 2 were executed.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints for review.

Which approach?
