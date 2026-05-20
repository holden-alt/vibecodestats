# Dashboard Redesign Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Pivot the profile dashboard from a generic bento to a live-cockpit anchored by a **global live-rank tile** + visible **global leaderboard** above the fold, with personal bests / week-month rollups / all-time totals / deltas-vs-averages around them. Drop squads, friends, deep_work, projects tile, and the time-window-vague hour-of-day & day-of-week tiles from above the fold. Move the existing StatsExplorer (which has those breakdowns with proper window controls) below the fold but visible (not collapsed).

**Architecture:** Build on Phase 1 (`docs/superpowers/plans/2026-05-19-dashboard-redesign.md`). Add new aggregation helpers in `lib/stats/`, new dashboard components in `components/dashboard/`, and recompose `ProfileLive`. Realtime is hybrid: viewer's own pushes via existing Supabase realtime sub (instant); other users' movement picked up by a 30-second client-side poll of `/api/leaderboard/live` (new lightweight edge route).

**Tech Stack:** Same as Phase 1 — Next.js 15 edge, Tailwind 4, Recharts via shadcn Chart, Supabase realtime + REST.

**Spec source:** This file supersedes Phase 1 above the fold and adds new content. Below the fold (StatsExplorer + heatmap) is unchanged.

---

## Above-the-fold composition (target)

```
┌───────────────────────────────────────────────────────────────────┐
│ IdentityStrip — handle, persona, streak, now-coding                │
├───────────────────────────────────────────────────────────────────┤
│ HeroBlock — tokens today + delta vs yesterday + 7d avg + 30d avg  │
├───────────────────────────────────────────────────────────────────┤
│ ★ LiveRankTile (full width, prominent)                             │
│   "you're #N of M globally today"  •  "top X%"                    │
│   ━━━━━━━━━━━▲━━━━━━━━━━━━  (percentile bar, marker = you)        │
│   closest above: @user (+N tokens)                                 │
│   closest below: @user (-N tokens)                                 │
├───────────────────────────────────────────────────────────────────┤
│ Global Leaderboard (top 10 + you) with metric/window pills        │
├───────────────────────────────────────────────────────────────────┤
│ Bento (4-col, varied):                                            │
│   [ streak (1) ] [ model mix (1) ] [ week rollup (1) ] [ month (1)]│
│   [ personal bests (2) ] [ all-time + next milestone (2) ]        │
│   [ ships (1) ] [ machines (1) ] [ 30d trend chart (2 wide, 1) ]  │
└───────────────────────────────────────────────────────────────────┘
                  — scroll for deep dive —
StatsExplorer (now visible, not collapsed): trends · models · hour-of-day ·
  day-of-week · projects · machines  (each tab has its own time-window pills)
ContributionHeatmap (52-week activity)
```

Below the fold is no longer wrapped in `<details>` — the deep dive is one scroll away, not behind a click.

---

## File structure

**New files:**
- `lib/stats/aggregations.ts` — add new helpers: `computeRollingAverage`, `computeWeekTotal`, `computeMonthTotal`, `computeAllTimeTotals`, `computePersonalBests`, `computeNextMilestone`
- `lib/stats/leaderboard-live.ts` — `computeLiveDailyRanking(stats)` returns `{ rank, total, percentile, closestAbove, closestBelow }`
- `app/api/leaderboard/live/route.ts` — GET endpoint returning today's global ranking JSON for client poll
- `components/dashboard/profile/LiveRankTile.tsx`
- `components/dashboard/profile/PercentileBar.tsx`
- `components/dashboard/profile/PersonalBests.tsx`
- `components/dashboard/profile/RollupPills.tsx` (week + month)
- `components/dashboard/profile/AllTimeTile.tsx` (lifetime + next milestone progress)
- `components/dashboard/profile/StreakAtRisk.tsx`
- `components/dashboard/profile/GlobalLeaderboard.tsx` (compact prominent version)
- `hooks/useLiveRank.ts` — wires the 30s poll + initial-data hand-off

**Modified files:**
- `lib/stats/profile-data.ts` — extend `getProfileData` to fetch all users' today rows for ranking
- `components/dashboard/profile/IdentityStrip.tsx` — drop the "rank in squad" pill
- `components/dashboard/profile/HeroBlock.tsx` — add 7d/30d avg delta badges
- `components/charts/v2/TokenTrendChart.tsx` — add rolling 7d average line + best-day marker
- `components/ProfileLive.tsx` — recompose above the fold; un-`<details>` the deep dive; drop squad/friend imports
- `app/[handle]/page.tsx` — fetch live rank server-side for initial render

**Files to delete (or leave untouched and hidden):**
- Leave on disk, just no longer rendered: `components/GroupLeaderboardSection.tsx`, `app/groups/[slug]/page.tsx`, anything friends-related (HeadToHead). Per Holden's direction: just hide, don't drop the DB tables.

---

## Tasks

### Task 1: Aggregation helpers + tests

**Files:**
- Modify: `lib/stats/aggregations.ts`
- Create: `tests/lib/aggregations-phase2.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/lib/aggregations-phase2.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  computeRollingAverage,
  computeWeekTotal,
  computeMonthTotal,
  computeAllTimeTotals,
  computePersonalBests,
  computeNextMilestone,
} from '@/lib/stats/aggregations';
import type { DailyStat } from '@/lib/stats/profile-data';

const stat = (date: string, tokens: number, sessions = 1, ships = 0): DailyStat => ({
  user_id: 'u1', date, tokens_total: tokens,
  tokens_by_model: {}, sessions, deep_work_minutes: 0, machines: [],
  projects_touched: {}, ships: { commits: ships, repos: 1 },
  hourly_tokens: {}, source_synced_at: null,
} as DailyStat);

describe('computeRollingAverage', () => {
  it('returns the mean of the last N days', () => {
    const stats = [stat('2026-05-19', 100), stat('2026-05-18', 200), stat('2026-05-17', 300)];
    expect(computeRollingAverage(stats, '2026-05-19', 3)).toBe(200);
    expect(computeRollingAverage(stats, '2026-05-19', 1)).toBe(100);
  });
  it('returns 0 when no stats', () => {
    expect(computeRollingAverage([], '2026-05-19', 7)).toBe(0);
  });
});

describe('computeWeekTotal', () => {
  it('sums last 7 days inclusive of anchor', () => {
    const stats = Array.from({ length: 10 }, (_, i) => {
      const d = new Date('2026-05-19T00:00:00Z');
      d.setUTCDate(d.getUTCDate() - i);
      return stat(d.toISOString().slice(0, 10), 1000);
    });
    expect(computeWeekTotal(stats, '2026-05-19')).toBe(7000);
  });
});

describe('computeMonthTotal', () => {
  it('sums rows within the calendar month of the anchor', () => {
    const stats = [
      stat('2026-05-01', 1000), stat('2026-05-15', 2000), stat('2026-05-31', 3000),
      stat('2026-04-30', 500), stat('2026-06-01', 700),
    ];
    expect(computeMonthTotal(stats, '2026-05-19')).toBe(6000);
  });
});

describe('computeAllTimeTotals', () => {
  it('returns lifetime tokens + days active + lifetime ships', () => {
    const stats = [stat('2026-05-19', 500, 1, 3), stat('2026-05-18', 1000, 1, 5)];
    const t = computeAllTimeTotals(stats);
    expect(t.tokens).toBe(1500);
    expect(t.daysActive).toBe(2);
    expect(t.ships).toBe(8);
  });
});

describe('computePersonalBests', () => {
  it('finds the highest tokens day and its date', () => {
    const stats = [stat('2026-05-19', 500), stat('2026-05-18', 9000), stat('2026-05-17', 200)];
    const pb = computePersonalBests(stats);
    expect(pb.bestDayTokens).toBe(9000);
    expect(pb.bestDayDate).toBe('2026-05-18');
  });
  it('finds the most ships in a day', () => {
    const stats = [stat('2026-05-19', 500, 1, 3), stat('2026-05-18', 100, 1, 12)];
    expect(computePersonalBests(stats).bestShipsCount).toBe(12);
  });
});

describe('computeNextMilestone', () => {
  it('returns the next lifetime-token milestone above current', () => {
    expect(computeNextMilestone(820_000).target).toBe(1_000_000);
    expect(computeNextMilestone(2_500_000).target).toBe(5_000_000);
    expect(computeNextMilestone(120_000_000).target).toBeGreaterThan(120_000_000);
  });
  it('returns progress fraction 0..1', () => {
    const m = computeNextMilestone(800_000);
    expect(m.progress).toBeCloseTo(0.8, 1);
  });
});
```

- [ ] **Step 2: Run tests, confirm FAIL**

`pnpm vitest run tests/lib/aggregations-phase2.test.ts` — fails because functions don't exist.

- [ ] **Step 3: Append helpers to `lib/stats/aggregations.ts`**

Open the file. Add these exports at the end (don't touch existing exports):

```typescript
export function computeRollingAverage(stats: DailyStat[], anchor: string, days: number): number {
  if (!stats.length) return 0;
  const end = new Date(anchor + 'T00:00:00Z');
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days + 1);
  const startKey = start.toISOString().slice(0, 10);
  const window = stats.filter((s) => s.date >= startKey && s.date <= anchor);
  if (!window.length) return 0;
  const sum = window.reduce((acc, s) => acc + s.tokens_total, 0);
  return Math.round(sum / days);
}

export function computeWeekTotal(stats: DailyStat[], anchor: string): number {
  const end = new Date(anchor + 'T00:00:00Z');
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 6);
  const startKey = start.toISOString().slice(0, 10);
  return stats
    .filter((s) => s.date >= startKey && s.date <= anchor)
    .reduce((acc, s) => acc + s.tokens_total, 0);
}

export function computeMonthTotal(stats: DailyStat[], anchor: string): number {
  const ym = anchor.slice(0, 7); // YYYY-MM
  return stats
    .filter((s) => s.date.startsWith(ym))
    .reduce((acc, s) => acc + s.tokens_total, 0);
}

export function computeAllTimeTotals(stats: DailyStat[]): {
  tokens: number; daysActive: number; ships: number; sessions: number;
} {
  let tokens = 0, ships = 0, sessions = 0;
  for (const s of stats) {
    tokens += s.tokens_total;
    sessions += s.sessions;
    const sh = (s.ships as { commits?: number } | null)?.commits ?? 0;
    ships += sh;
  }
  return { tokens, daysActive: stats.length, ships, sessions };
}

export function computePersonalBests(stats: DailyStat[]): {
  bestDayTokens: number; bestDayDate: string | null;
  bestShipsCount: number; bestShipsDate: string | null;
  bestSessionsCount: number; bestSessionsDate: string | null;
} {
  let bestDayTokens = 0, bestDayDate: string | null = null;
  let bestShipsCount = 0, bestShipsDate: string | null = null;
  let bestSessionsCount = 0, bestSessionsDate: string | null = null;
  for (const s of stats) {
    if (s.tokens_total > bestDayTokens) { bestDayTokens = s.tokens_total; bestDayDate = s.date; }
    const sh = (s.ships as { commits?: number } | null)?.commits ?? 0;
    if (sh > bestShipsCount) { bestShipsCount = sh; bestShipsDate = s.date; }
    if (s.sessions > bestSessionsCount) { bestSessionsCount = s.sessions; bestSessionsDate = s.date; }
  }
  return { bestDayTokens, bestDayDate, bestShipsCount, bestShipsDate, bestSessionsCount, bestSessionsDate };
}

const MILESTONES = [
  1_000_000, 5_000_000, 10_000_000, 25_000_000, 50_000_000,
  100_000_000, 250_000_000, 500_000_000, 1_000_000_000,
];

export function computeNextMilestone(lifetimeTokens: number): {
  target: number; progress: number; remaining: number;
} {
  const target = MILESTONES.find((m) => m > lifetimeTokens) ?? lifetimeTokens * 2;
  return {
    target,
    progress: Math.min(1, lifetimeTokens / target),
    remaining: Math.max(0, target - lifetimeTokens),
  };
}
```

- [ ] **Step 4: Run tests, confirm PASS**

`pnpm vitest run tests/lib/aggregations-phase2.test.ts`

- [ ] **Step 5: Commit**

```
git add lib/stats/aggregations.ts tests/lib/aggregations-phase2.test.ts
git commit -m "feat(stats): phase-2 aggregations (rolling avg, week/month/all-time, PBs, milestones)"
```

---

### Task 2: Live ranking helper + tests

**Files:**
- Create: `lib/stats/leaderboard-live.ts`
- Create: `tests/lib/leaderboard-live.test.ts`

The live ranking takes a snapshot of every user's `tokens_total` for the current day and returns the viewer's rank, total user count, percentile, and the immediately adjacent competitors.

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, it, expect } from 'vitest';
import { computeLiveDailyRanking } from '@/lib/stats/leaderboard-live';

const row = (user_id: string, github_handle: string, tokens: number) =>
  ({ user_id, github_handle, tokens_total: tokens });

describe('computeLiveDailyRanking', () => {
  it('ranks users by tokens descending and returns viewer position', () => {
    const rows = [
      row('a', 'alpha', 5000),
      row('b', 'beta', 3000),
      row('c', 'gamma', 1000),
    ];
    const r = computeLiveDailyRanking(rows, 'b');
    expect(r.rank).toBe(2);
    expect(r.total).toBe(3);
    expect(r.percentile).toBeCloseTo(0.66, 1); // 2/3 of users at or above
    expect(r.closestAbove?.handle).toBe('alpha');
    expect(r.closestAbove?.tokensAhead).toBe(2000);
    expect(r.closestBelow?.handle).toBe('gamma');
    expect(r.closestBelow?.tokensBehind).toBe(2000);
  });
  it('handles viewer not in data', () => {
    const rows = [row('a', 'alpha', 5000)];
    const r = computeLiveDailyRanking(rows, 'missing');
    expect(r.rank).toBe(null);
    expect(r.total).toBe(1);
  });
  it('handles empty data', () => {
    const r = computeLiveDailyRanking([], 'a');
    expect(r.rank).toBe(null);
    expect(r.total).toBe(0);
    expect(r.percentile).toBe(0);
  });
  it('marks rank #1 with no closestAbove', () => {
    const rows = [row('a', 'alpha', 5000), row('b', 'beta', 3000)];
    const r = computeLiveDailyRanking(rows, 'a');
    expect(r.rank).toBe(1);
    expect(r.closestAbove).toBe(null);
    expect(r.percentile).toBeCloseTo(1.0, 2);
  });
});
```

- [ ] **Step 2: Implement `lib/stats/leaderboard-live.ts`**

```typescript
export type LiveRankRow = {
  user_id: string;
  github_handle: string;
  tokens_total: number;
};

export type LiveRanking = {
  rank: number | null;
  total: number;
  percentile: number; // 0..1, fraction of users at or below the viewer
  viewerTokens: number;
  closestAbove: { handle: string; tokens: number; tokensAhead: number } | null;
  closestBelow: { handle: string; tokens: number; tokensBehind: number } | null;
  top: { rank: number; handle: string; tokens: number; isViewer: boolean }[];
};

export function computeLiveDailyRanking(
  rows: LiveRankRow[],
  viewerId: string,
  topN = 10,
): LiveRanking {
  const sorted = [...rows].sort((a, b) => b.tokens_total - a.tokens_total);
  const idx = sorted.findIndex((r) => r.user_id === viewerId);
  const total = sorted.length;

  if (idx === -1) {
    return {
      rank: null, total,
      percentile: 0, viewerTokens: 0,
      closestAbove: null, closestBelow: null,
      top: sorted.slice(0, topN).map((r, i) => ({ rank: i + 1, handle: r.github_handle, tokens: r.tokens_total, isViewer: false })),
    };
  }

  const rank = idx + 1;
  const viewerTokens = sorted[idx]!.tokens_total;
  const percentile = total > 0 ? (total - rank + 1) / total : 0;

  const above = sorted[idx - 1];
  const below = sorted[idx + 1];

  return {
    rank, total, percentile, viewerTokens,
    closestAbove: above ? { handle: above.github_handle, tokens: above.tokens_total, tokensAhead: above.tokens_total - viewerTokens } : null,
    closestBelow: below ? { handle: below.github_handle, tokens: below.tokens_total, tokensBehind: viewerTokens - below.tokens_total } : null,
    top: sorted.slice(0, topN).map((r, i) => ({
      rank: i + 1, handle: r.github_handle, tokens: r.tokens_total, isViewer: r.user_id === viewerId,
    })),
  };
}
```

- [ ] **Step 3: Tests PASS**

- [ ] **Step 4: Commit**

```
git add lib/stats/leaderboard-live.ts tests/lib/leaderboard-live.test.ts
git commit -m "feat(stats): computeLiveDailyRanking with percentile + closest competitors"
```

---

### Task 3: Live-ranking API route

**Files:**
- Create: `app/api/leaderboard/live/route.ts`

- [ ] **Step 1: Implement**

```typescript
import { createClient } from '@/lib/supabase/server';
import { computeLiveDailyRanking } from '@/lib/stats/leaderboard-live';

export const runtime = 'edge';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const viewerId = url.searchParams.get('viewer') ?? '';
  const date = url.searchParams.get('date') ?? new Date().toISOString().slice(0, 10);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('daily_stats')
    .select('user_id, tokens_total, users:user_id (github_handle)')
    .eq('date', date);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []).map((r: any) => ({
    user_id: r.user_id,
    github_handle: r.users?.github_handle ?? '',
    tokens_total: r.tokens_total,
  })).filter((r: any) => r.github_handle);

  const ranking = computeLiveDailyRanking(rows, viewerId);
  return Response.json(ranking, {
    headers: {
      'cache-control': 'public, max-age=10, s-maxage=10',
    },
  });
}
```

- [ ] **Step 2: Smoke test**

```
pnpm exec tsc --noEmit
pnpm run build
```

Local smoke (optional): start dev, curl `http://localhost:3000/api/leaderboard/live?viewer=00000000-0000-4000-8000-000000000a00` — should return `{rank, total, percentile, ...}` JSON.

- [ ] **Step 3: Commit**

```
git add app/api/leaderboard/live/route.ts
git commit -m "feat(api): GET /api/leaderboard/live returns today's global ranking"
```

---

### Task 4: useLiveRank hook

**Files:**
- Create: `hooks/useLiveRank.ts`

- [ ] **Step 1: Implement**

```typescript
'use client';

import { useEffect, useState, useRef } from 'react';
import type { LiveRanking } from '@/lib/stats/leaderboard-live';

const POLL_MS = 30_000;

export function useLiveRank(
  viewerId: string,
  date: string,
  initial: LiveRanking,
): LiveRanking {
  const [data, setData] = useState<LiveRanking>(initial);
  const lastPushRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const fetchNow = async () => {
      try {
        const res = await fetch(`/api/leaderboard/live?viewer=${encodeURIComponent(viewerId)}&date=${encodeURIComponent(date)}`);
        if (!res.ok) return;
        const json = (await res.json()) as LiveRanking;
        if (!cancelled) setData(json);
      } catch {}
    };
    const interval = setInterval(fetchNow, POLL_MS);

    // Also fetch immediately when viewerId/date changes
    fetchNow();

    return () => { cancelled = true; clearInterval(interval); };
  }, [viewerId, date]);

  return data;
}
```

- [ ] **Step 2: Commit**

```
git add hooks/useLiveRank.ts
git commit -m "feat(hooks): useLiveRank polls /api/leaderboard/live every 30s"
```

---

### Task 5: PercentileBar component

**Files:**
- Create: `components/dashboard/profile/PercentileBar.tsx`

- [ ] **Step 1: Implement**

```tsx
type Props = {
  percentile: number; // 0..1
  height?: number;
};

export function PercentileBar({ percentile, height = 14 }: Props) {
  const pct = Math.max(0, Math.min(1, percentile));
  // Position the marker: higher percentile = further right
  const markerLeft = `${pct * 100}%`;
  return (
    <div style={{ position: 'relative', height: height + 16, width: '100%' }}>
      <div
        style={{
          position: 'absolute', top: 8, left: 0, right: 0, height,
          background: 'linear-gradient(90deg, #2a1818 0%, #553030 25%, #3a3a1f 50%, #2f5a2f 75%, #d97757 100%)',
          borderRadius: 2,
          border: '1px solid var(--color-border)',
        }}
      />
      <div
        style={{
          position: 'absolute', top: 4, left: markerLeft, transform: 'translateX(-50%)',
          width: 2, height: height + 8,
          background: 'var(--color-text)',
          boxShadow: '0 0 0 1px var(--color-bg)',
        }}
      />
      <div
        style={{
          position: 'absolute', top: 0, left: markerLeft, transform: 'translateX(-50%)',
          fontSize: '0.55rem', color: 'var(--chart-1)', whiteSpace: 'nowrap',
        }}
      >
        ▼
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```
git add components/dashboard/profile/PercentileBar.tsx
git commit -m "feat(dashboard): PercentileBar — gradient bar with you-are-here marker"
```

---

### Task 6: LiveRankTile component

**Files:**
- Create: `components/dashboard/profile/LiveRankTile.tsx`

This is THE featured element above the fold.

- [ ] **Step 1: Implement**

```tsx
'use client';

import { useLiveRank } from '@/hooks/useLiveRank';
import { RollingNumber } from '@/components/dashboard/RollingNumber';
import { PercentileBar } from './PercentileBar';
import { formatCompact, formatNumber } from '@/lib/format';
import type { LiveRanking } from '@/lib/stats/leaderboard-live';

type Props = {
  viewerId: string;
  date: string;
  initial: LiveRanking;
};

export function LiveRankTile({ viewerId, date, initial }: Props) {
  const r = useLiveRank(viewerId, date, initial);
  const pctText = r.rank != null ? `top ${Math.max(1, Math.round((1 - r.percentile) * 100))}%` : '—';
  return (
    <div
      style={{
        position: 'relative',
        padding: '14px 16px 12px',
        border: '1px solid var(--color-border)',
        borderLeft: '3px solid var(--chart-5)',
        background: 'linear-gradient(180deg, var(--color-bg-2), var(--color-bg))',
        borderRadius: 3,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ fontSize: '0.55rem', opacity: 0.55, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            global rank · today (live)
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 4 }}>
            <span style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--chart-5)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              {r.rank != null ? <>#<RollingNumber value={r.rank} /></> : '—'}
            </span>
            <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>
              of {r.total}
            </span>
            <span style={{
              fontSize: '0.65rem', padding: '2px 6px', borderRadius: 2,
              background: 'var(--chart-3)', color: 'var(--color-bg)', fontWeight: 600,
            }}>
              {pctText}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: '0.6rem', minWidth: 200 }}>
          {r.closestAbove ? (
            <div>↑ <strong>@{r.closestAbove.handle}</strong> is {formatCompact(r.closestAbove.tokensAhead)} ahead</div>
          ) : (
            <div style={{ opacity: 0.6 }}>you&apos;re at the top — no one above</div>
          )}
          {r.closestBelow ? (
            <div>↓ <strong>@{r.closestBelow.handle}</strong> is {formatCompact(r.closestBelow.tokensBehind)} behind</div>
          ) : (
            <div style={{ opacity: 0.5 }}>no one ranked below yet</div>
          )}
        </div>
      </div>
      <div style={{ marginTop: 10 }}>
        <PercentileBar percentile={r.percentile} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.5rem', opacity: 0.55, marginTop: 2 }}>
          <span>bottom</span>
          <span>top</span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```
git add components/dashboard/profile/LiveRankTile.tsx
git commit -m "feat(dashboard): LiveRankTile with percentile bar + closest competitors"
```

---

### Task 7: GlobalLeaderboard (compact, above-the-fold)

**Files:**
- Create: `components/dashboard/profile/GlobalLeaderboard.tsx`

A prominent leaderboard that mirrors the existing LeaderboardSection's metric/window controls, but limited to global scope, top 10 + you, and visible by default (not in `<details>`).

- [ ] **Step 1: Implement**

```tsx
'use client';

import { useState, useMemo } from 'react';
import { rankUsers } from '@/lib/stats/leaderboard';
import type { LeaderboardData } from '@/lib/stats/leaderboard';
import { formatCompact } from '@/lib/format';

type Metric = 'tokens' | 'sessions' | 'deep_work' | 'ships';
type Window = 'today' | 'week' | 'month' | 'all';

const METRICS: Metric[] = ['tokens', 'sessions', 'ships'];
const WINDOWS: Window[] = ['today', 'week', 'month', 'all'];

type Props = {
  data: LeaderboardData;
  viewerId: string;
  today: string;
};

export function GlobalLeaderboard({ data, viewerId, today }: Props) {
  const [metric, setMetric] = useState<Metric>('tokens');
  const [window, setWindow] = useState<Window>('today');

  const ranked = useMemo(
    () => rankUsers(data, { metric, window, scope: 'global', viewerId, today }),
    [data, metric, window, viewerId, today],
  );

  const viewerEntry = ranked.find((e) => e.isViewer);
  const top10 = ranked.slice(0, 10);
  const showViewerRow = viewerEntry && !top10.includes(viewerEntry);
  const max = ranked[0]?.value ?? 1;

  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: 3, padding: '10px 12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
        <div style={{ fontSize: '0.55rem', opacity: 0.55, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          global leaderboard
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ display: 'flex', gap: 3 }}>
            {METRICS.map((m) => (
              <button key={m} onClick={() => setMetric(m)} style={pill(m === metric)}>{m}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 3 }}>
            {WINDOWS.map((w) => (
              <button key={w} onClick={() => setWindow(w)} style={pill(w === window)}>{w}</button>
            ))}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {top10.map((e) => (
          <Row key={e.user_id} rank={e.rank} handle={e.github_handle} value={e.value} max={max} viewer={e.isViewer} />
        ))}
        {showViewerRow && (
          <>
            <div style={{ fontSize: '0.6rem', opacity: 0.4, textAlign: 'center', margin: '2px 0' }}>···</div>
            <Row rank={viewerEntry!.rank} handle={viewerEntry!.github_handle} value={viewerEntry!.value} max={max} viewer={true} />
          </>
        )}
        {ranked.length === 0 && (
          <div style={{ fontSize: '0.6rem', opacity: 0.6 }}>no data yet for {metric} · {window}</div>
        )}
      </div>
    </div>
  );
}

function Row({ rank, handle, value, max, viewer }: { rank: number; handle: string; value: number; max: number; viewer: boolean }) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: '0.7rem', fontVariantNumeric: 'tabular-nums',
        background: viewer ? 'rgba(217,119,87,0.08)' : 'transparent',
        padding: '3px 4px', borderRadius: 2,
      }}
    >
      <span style={{ width: 22, textAlign: 'right', opacity: 0.6 }}>#{rank}</span>
      <span style={{ width: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>@{handle}</span>
      <div style={{ flex: 1, background: 'var(--color-bg-2)', height: 7, borderRadius: 1, overflow: 'hidden' }}>
        <div style={{ width: `${(value / max) * 100}%`, background: viewer ? 'var(--chart-1)' : 'var(--chart-2)', height: '100%', transition: 'width 800ms ease-out' }} />
      </div>
      <span style={{ opacity: 0.85, minWidth: 52, textAlign: 'right' }}>{formatCompact(value)}</span>
    </div>
  );
}

function pill(active: boolean): React.CSSProperties {
  return {
    background: 'transparent',
    border: `1px solid ${active ? 'var(--chart-1)' : 'var(--color-border)'}`,
    color: active ? 'var(--chart-1)' : 'inherit',
    padding: '1px 6px',
    borderRadius: 2,
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '0.55rem',
  };
}
```

- [ ] **Step 2: Commit**

```
git add components/dashboard/profile/GlobalLeaderboard.tsx
git commit -m "feat(dashboard): GlobalLeaderboard (prominent, top10+you, metric/window pills)"
```

---

### Task 8: PersonalBests + RollupPills + AllTimeTile + StreakAtRisk components

Batch — four small components.

- [ ] **Step 1: Create `components/dashboard/profile/PersonalBests.tsx`**

```tsx
import { formatCompact, formatNumber } from '@/lib/format';

type Props = {
  bestDayTokens: number;
  bestDayDate: string | null;
  bestShipsCount: number;
  bestShipsDate: string | null;
  bestSessionsCount: number;
  bestSessionsDate: string | null;
};

export function PersonalBests({ bestDayTokens, bestDayDate, bestShipsCount, bestShipsDate, bestSessionsCount, bestSessionsDate }: Props) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      <Trophy label="best day" value={formatCompact(bestDayTokens)} sub={bestDayDate ?? '—'} />
      <Trophy label="most ships" value={formatNumber(bestShipsCount)} sub={bestShipsDate ?? '—'} />
      <Trophy label="most sessions" value={formatNumber(bestSessionsCount)} sub={bestSessionsDate ?? '—'} />
    </div>
  );
}

function Trophy({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div
      style={{
        flex: '1 1 0',
        minWidth: 120,
        padding: '8px 10px',
        border: '1px solid var(--color-border)',
        borderLeft: '2px solid var(--chart-5)',
        borderRadius: 3,
        background: 'rgba(227, 196, 102, 0.04)',
      }}
    >
      <div style={{ fontSize: '0.5rem', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--chart-5)', marginTop: 2 }}>{value}</div>
      <div style={{ fontSize: '0.5rem', opacity: 0.5, marginTop: 2 }}>{sub}</div>
    </div>
  );
}
```

- [ ] **Step 2: Create `components/dashboard/profile/RollupPills.tsx`**

```tsx
import { formatCompact, formatNumber } from '@/lib/format';

type Props = {
  weekTokens: number;
  weekDelta: number; // ratio
  monthTokens: number;
  daysActiveThisMonth: number;
  daysInMonth: number;
  shipsThisMonth: number;
};

export function RollupPills({ weekTokens, weekDelta, monthTokens, daysActiveThisMonth, daysInMonth, shipsThisMonth }: Props) {
  const deltaSign = weekDelta >= 0 ? '+' : '';
  const deltaColor = weekDelta >= 0 ? 'var(--chart-3)' : 'var(--color-red, #d97373)';
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: '0.6rem' }}>
      <Pill label="this week" value={formatCompact(weekTokens)} delta={`${deltaSign}${Math.round(weekDelta * 100)}% vs last`} deltaColor={deltaColor} />
      <Pill label="this month" value={formatCompact(monthTokens)} />
      <Pill label="days active" value={`${daysActiveThisMonth}/${daysInMonth}`} />
      <Pill label="ships this month" value={formatNumber(shipsThisMonth)} />
    </div>
  );
}

function Pill({ label, value, delta, deltaColor }: { label: string; value: string; delta?: string; deltaColor?: string }) {
  return (
    <div style={{
      padding: '6px 10px',
      border: '1px solid var(--color-border)',
      borderRadius: 2,
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
      minWidth: 110,
    }}>
      <span style={{ opacity: 0.55, fontSize: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
      <span style={{ fontWeight: 600, fontSize: '0.8rem' }}>{value}</span>
      {delta && <span style={{ color: deltaColor, fontSize: '0.5rem' }}>{delta}</span>}
    </div>
  );
}
```

- [ ] **Step 3: Create `components/dashboard/profile/AllTimeTile.tsx`**

```tsx
import { formatCompact, formatNumber } from '@/lib/format';

type Props = {
  lifetimeTokens: number;
  daysActive: number;
  lifetimeShips: number;
  nextMilestone: { target: number; progress: number; remaining: number };
};

export function AllTimeTile({ lifetimeTokens, daysActive, lifetimeShips, nextMilestone }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: '0.65rem' }}>
        <Stat label="lifetime tokens" value={formatCompact(lifetimeTokens)} />
        <Stat label="days active" value={formatNumber(daysActive)} />
        <Stat label="lifetime ships" value={formatNumber(lifetimeShips)} />
      </div>
      <div>
        <div style={{ fontSize: '0.5rem', opacity: 0.55, marginBottom: 3 }}>
          next milestone: {formatCompact(nextMilestone.target)} tokens
          <span style={{ opacity: 0.5, marginLeft: 6 }}>
            ({formatCompact(nextMilestone.remaining)} to go)
          </span>
        </div>
        <div style={{ height: 6, background: 'var(--color-bg-2)', borderRadius: 1, overflow: 'hidden' }}>
          <div
            style={{
              width: `${nextMilestone.progress * 100}%`,
              height: '100%',
              background: 'var(--chart-1)',
              transition: 'width 800ms ease-out',
            }}
          />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ opacity: 0.6, fontSize: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--chart-2)' }}>{value}</div>
    </div>
  );
}
```

- [ ] **Step 4: Create `components/dashboard/profile/StreakAtRisk.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';

type Props = {
  streakDays: number;
  todayTokens: number;
};

export function StreakAtRisk({ streakDays, todayTokens }: Props) {
  const [isAfternoon, setIsAfternoon] = useState(false);
  useEffect(() => {
    const update = () => setIsAfternoon(new Date().getHours() >= 12);
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, []);
  if (streakDays < 2 || todayTokens > 0 || !isAfternoon) return null;
  return (
    <div
      style={{
        padding: '6px 10px',
        border: '1px dashed var(--color-red, #d97373)',
        borderRadius: 2,
        background: 'rgba(217,115,115,0.05)',
        color: 'var(--color-red, #d97373)',
        fontSize: '0.65rem',
      }}
    >
      ⚠ your {streakDays}-day streak ends at midnight — push something today
    </div>
  );
}
```

- [ ] **Step 5: tsc + commit**

```
pnpm exec tsc --noEmit
git add components/dashboard/profile/PersonalBests.tsx components/dashboard/profile/RollupPills.tsx components/dashboard/profile/AllTimeTile.tsx components/dashboard/profile/StreakAtRisk.tsx
git commit -m "feat(dashboard): PersonalBests, RollupPills, AllTimeTile, StreakAtRisk"
```

---

### Task 9: HeroBlock — add 7d/30d avg delta badges

**Files:**
- Modify: `components/dashboard/profile/HeroBlock.tsx`

- [ ] **Step 1: Add two new props**

Open the file. Update `type Props` to include:

```ts
deltaVs7dAvg: number; // ratio (today / 7d avg - 1), 0 if no 7d avg
deltaVs30dAvg: number; // ratio, 0 if no 30d avg
```

- [ ] **Step 2: Update the JSX**

Find the sub-line `<div style={{ fontSize: '0.65rem', opacity: 0.65, marginTop: 6 }}>{sessionsToday} sessions · {formatDuration(deepWorkMinutes)} deep work · …</div>` and replace it with:

```tsx
<div style={{ display: 'flex', gap: 8, marginTop: 6, fontSize: '0.6rem', flexWrap: 'wrap' }}>
  {deltaVs7dAvg !== 0 && (
    <span style={{ color: deltaVs7dAvg >= 0 ? 'var(--chart-3)' : 'var(--color-red, #d97373)' }}>
      {deltaVs7dAvg >= 0 ? '▲' : '▼'} {formatDelta(deltaVs7dAvg)} vs 7d avg
    </span>
  )}
  {deltaVs30dAvg !== 0 && (
    <span style={{ color: deltaVs30dAvg >= 0 ? 'var(--chart-3)' : 'var(--color-red, #d97373)' }}>
      {deltaVs30dAvg >= 0 ? '▲' : '▼'} {formatDelta(deltaVs30dAvg)} vs 30d avg
    </span>
  )}
  <span style={{ opacity: 0.65 }}>
    {sessionsToday} sessions · {shipsToday.commits} ships · {projectsTouchedCount} projects
  </span>
</div>
```

Drop the `deepWork` reference. Update the import: remove `formatDuration` if it's no longer used.

- [ ] **Step 3: tsc + commit**

```
pnpm exec tsc --noEmit
git add components/dashboard/profile/HeroBlock.tsx
git commit -m "feat(hero): replace deep-work with 7d/30d avg delta badges"
```

---

### Task 10: TokenTrendChart — 7d rolling avg line + best-day marker

**Files:**
- Modify: `components/charts/v2/TokenTrendChart.tsx`

- [ ] **Step 1: Update the data + chart**

Inside the `TokenTrendChart` function, after the existing `data` useMemo, add:

```ts
const enriched = useMemo(() => {
  // window-aware rolling 7d avg, marked best day in range
  let bestIdx = -1;
  let bestVal = 0;
  data.forEach((d, i) => { if (d.tokens > bestVal) { bestVal = d.tokens; bestIdx = i; } });
  return data.map((d, i) => {
    // compute rolling avg of preceding 7 days inclusive
    const start = Math.max(0, i - 6);
    const window = data.slice(start, i + 1);
    const avg = window.reduce((s, x) => s + x.tokens, 0) / Math.max(1, window.length);
    return { ...d, avg7d: Math.round(avg), isBest: i === bestIdx };
  });
}, [data]);
```

Replace the `<AreaChart data={data} ...>` props with `data={enriched}`. Replace the existing `<Area ...>` with TWO elements:

```tsx
<Area type="monotone" dataKey="tokens" stroke="var(--chart-1)" fill="url(#ttc-fill)" strokeWidth={1.5} isAnimationActive animationDuration={1200} />
<Line type="monotone" dataKey="avg7d" stroke="var(--chart-3)" strokeWidth={1.2} strokeDasharray="3 3" dot={false} isAnimationActive animationDuration={1500} />
```

Add an import: `import { Line } from 'recharts';` to the top imports.

For the best-day marker, add a `<ReferenceDot>`:

```tsx
{enriched.find((d) => d.isBest) && (
  <ReferenceDot
    x={enriched.find((d) => d.isBest)!.date}
    y={enriched.find((d) => d.isBest)!.tokens}
    r={4}
    fill="var(--chart-5)"
    stroke="var(--color-bg)"
    strokeWidth={1}
  />
)}
```

Import `ReferenceDot` from recharts.

Update the `config` to include the avg7d series:

```ts
const config: ChartConfig = {
  tokens: { label: 'tokens', color: 'var(--chart-1)' },
  avg7d: { label: '7d avg', color: 'var(--chart-3)' },
};
```

- [ ] **Step 2: tsc + commit**

```
pnpm exec tsc --noEmit
git add components/charts/v2/TokenTrendChart.tsx
git commit -m "feat(trend): add 7d rolling avg line + best-day marker"
```

---

### Task 11: profile-data.ts — fetch live ranking data server-side

**Files:**
- Modify: `lib/stats/profile-data.ts`
- Modify: `app/[handle]/page.tsx`

- [ ] **Step 1: Add a new fetcher in `lib/stats/profile-data.ts`**

Append:

```ts
import { computeLiveDailyRanking, type LiveRanking } from './leaderboard-live';

export async function getLiveRanking(
  supabase: SupabaseClient<Database>,
  viewerId: string,
  date: string,
): Promise<LiveRanking> {
  const { data } = await supabase
    .from('daily_stats')
    .select('user_id, tokens_total, users:user_id (github_handle)')
    .eq('date', date);
  const rows = (data ?? []).map((r: any) => ({
    user_id: r.user_id,
    github_handle: r.users?.github_handle ?? '',
    tokens_total: r.tokens_total,
  })).filter((r: any) => r.github_handle);
  return computeLiveDailyRanking(rows, viewerId);
}
```

- [ ] **Step 2: Update `app/[handle]/page.tsx`**

Open `app/[handle]/page.tsx`. After the existing `getProfileData` call, add a call to `getLiveRanking` (server-side, before render):

Look at the existing call signature; add something like:

```ts
import { getLiveRanking } from '@/lib/stats/profile-data';
...
const liveRanking = await getLiveRanking(supabase, data.user.id, today);
```

Pass `liveRanking` as a new prop to `<ProfileLive ... initialLiveRanking={liveRanking} />`.

- [ ] **Step 3: tsc + commit**

```
pnpm exec tsc --noEmit
pnpm run build
git add lib/stats/profile-data.ts app/[handle]/page.tsx
git commit -m "feat(data): server-side live-ranking fetch for SSR hydration"
```

---

### Task 12: Recompose ProfileLive (above-the-fold)

**Files:**
- Modify: `components/ProfileLive.tsx`

This is the big integration that wires Phase 2 in. Preserve the realtime subscription block (unchanged). Drop the rank-in-squad tile, model donut tile, hour-of-day tile, day-of-week tile, top-projects tile, machines tile, and ships tile from the bento. Keep streak. Add the new components.

Un-`<details>` the deep dive — StatsExplorer + heatmap render normally below the bento.

- [ ] **Step 1: Rewrite the file**

Replace the entire `components/ProfileLive.tsx` with:

```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/browser';
import { StatsExplorer } from '@/components/StatsExplorer';
import { IdentityStrip } from '@/components/dashboard/profile/IdentityStrip';
import { HeroBlock } from '@/components/dashboard/profile/HeroBlock';
import { BentoGrid } from '@/components/dashboard/profile/BentoGrid';
import { BentoTile } from '@/components/dashboard/BentoTile';
import { LiveRankTile } from '@/components/dashboard/profile/LiveRankTile';
import { GlobalLeaderboard } from '@/components/dashboard/profile/GlobalLeaderboard';
import { PersonalBests } from '@/components/dashboard/profile/PersonalBests';
import { RollupPills } from '@/components/dashboard/profile/RollupPills';
import { AllTimeTile } from '@/components/dashboard/profile/AllTimeTile';
import { StreakAtRisk } from '@/components/dashboard/profile/StreakAtRisk';
import { TokenTrendChart } from '@/components/charts/v2/TokenTrendChart';
import { ContributionHeatmap } from '@/components/charts/v2/ContributionHeatmap';
import { RollingNumber } from '@/components/dashboard/RollingNumber';
import {
  computeStreak,
  computeRollingAverage,
  computeWeekTotal,
  computeMonthTotal,
  computeAllTimeTotals,
  computePersonalBests,
  computeNextMilestone,
} from '@/lib/stats/aggregations';
import type { ProfileData, DailyStat } from '@/lib/stats/profile-data';
import type { LeaderboardData } from '@/lib/stats/leaderboard';
import type { LiveRanking } from '@/lib/stats/leaderboard-live';

type ProfileLiveProps = {
  initialData: ProfileData;
  leaderboardData: LeaderboardData;
  initialLiveRanking: LiveRanking;
  today: string;
};

export function ProfileLive({ initialData, leaderboardData, initialLiveRanking, today }: ProfileLiveProps) {
  const [dailyStats, setDailyStats] = useState<DailyStat[]>(initialData.dailyStats);
  const { user } = initialData;

  useEffect(() => {
    const supabase = createClient();
    const baseChannel: RealtimeChannel = supabase.channel(`daily_stats:${user.id}`);
    const channel = (
      baseChannel.on as unknown as (
        event: 'postgres_changes',
        filter: { event: string; schema: string; table: string; filter: string },
        callback: (payload: { new?: DailyStat }) => void,
      ) => RealtimeChannel
    )(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'daily_stats', filter: `user_id=eq.${user.id}` },
      (payload: { new?: DailyStat }) => {
        const row = payload.new;
        if (!row) return;
        setDailyStats((prev) => {
          const without = prev.filter((r) => r.date !== row.date);
          return [row, ...without].sort((a, b) => (a.date < b.date ? 1 : -1));
        });
      },
    ).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user.id]);

  const effectiveToday = useMemo(() => {
    if (dailyStats.find((s) => s.date === today)) return today;
    return dailyStats[0]?.date ?? today;
  }, [dailyStats, today]);

  const todayRow = useMemo(() => dailyStats.find((s) => s.date === effectiveToday), [dailyStats, effectiveToday]);
  const yesterdayRow = useMemo(() => {
    const d = new Date(effectiveToday + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() - 1);
    const key = d.toISOString().slice(0, 10);
    return dailyStats.find((s) => s.date === key);
  }, [dailyStats, effectiveToday]);

  const tokensToday = todayRow?.tokens_total ?? 0;
  const tokensYesterday = yesterdayRow?.tokens_total ?? 0;
  const deltaVsYesterday = tokensYesterday > 0 ? (tokensToday - tokensYesterday) / tokensYesterday : 0;
  const avg7d = computeRollingAverage(dailyStats, effectiveToday, 7);
  const avg30d = computeRollingAverage(dailyStats, effectiveToday, 30);
  const deltaVs7d = avg7d > 0 ? (tokensToday - avg7d) / avg7d : 0;
  const deltaVs30d = avg30d > 0 ? (tokensToday - avg30d) / avg30d : 0;

  const sessionsToday = todayRow?.sessions ?? 0;
  const shipsToday = (todayRow?.ships as { commits?: number; repos?: number } | undefined) ?? {};
  const projectsTouched = (todayRow?.projects_touched as Record<string, number>) ?? {};

  const projectsTouchedCount = Object.keys(projectsTouched).length;
  const streakDays = computeStreak(dailyStats, effectiveToday);
  const nowProject = pickNowProject(projectsTouched);

  const weekTokens = computeWeekTotal(dailyStats, effectiveToday);
  const lastWeekAnchor = useMemo(() => {
    const d = new Date(effectiveToday + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() - 7);
    return d.toISOString().slice(0, 10);
  }, [effectiveToday]);
  const lastWeekTokens = computeWeekTotal(dailyStats, lastWeekAnchor);
  const weekDelta = lastWeekTokens > 0 ? (weekTokens - lastWeekTokens) / lastWeekTokens : 0;

  const monthTokens = computeMonthTotal(dailyStats, effectiveToday);
  const monthDate = new Date(effectiveToday + 'T00:00:00Z');
  const daysInMonth = new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + 1, 0)).getUTCDate();
  const daysActiveThisMonth = dailyStats.filter((s) => s.date.startsWith(effectiveToday.slice(0, 7)) && s.tokens_total > 0).length;
  const monthShips = dailyStats
    .filter((s) => s.date.startsWith(effectiveToday.slice(0, 7)))
    .reduce((acc, s) => acc + ((s.ships as { commits?: number } | null)?.commits ?? 0), 0);

  const allTime = useMemo(() => computeAllTimeTotals(dailyStats), [dailyStats]);
  const pbs = useMemo(() => computePersonalBests(dailyStats), [dailyStats]);
  const milestone = useMemo(() => computeNextMilestone(allTime.tokens), [allTime.tokens]);

  return (
    <main style={{ maxWidth: 1400, margin: '0 auto', padding: '16px 16px 48px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <IdentityStrip
        user={user}
        rank={null}
        squadSize={null}
        streakDays={streakDays}
        nowProject={nowProject}
      />

      <StreakAtRisk streakDays={streakDays} todayTokens={tokensToday} />

      <HeroBlock
        tokensToday={tokensToday}
        sessionsToday={sessionsToday}
        deepWorkMinutes={0}
        shipsToday={{ commits: shipsToday.commits ?? 0, repos: shipsToday.repos ?? 0 }}
        projectsTouchedCount={projectsTouchedCount}
        trendStats={dailyStats}
        deltaVsYesterday={deltaVsYesterday}
        deltaVs7dAvg={deltaVs7d}
        deltaVs30dAvg={deltaVs30d}
      />

      <LiveRankTile viewerId={user.id} date={today} initial={initialLiveRanking} />

      <GlobalLeaderboard data={leaderboardData} viewerId={user.id} today={today} />

      <RollupPills
        weekTokens={weekTokens}
        weekDelta={weekDelta}
        monthTokens={monthTokens}
        daysActiveThisMonth={daysActiveThisMonth}
        daysInMonth={daysInMonth}
        shipsThisMonth={monthShips}
      />

      <PersonalBests
        bestDayTokens={pbs.bestDayTokens}
        bestDayDate={pbs.bestDayDate}
        bestShipsCount={pbs.bestShipsCount}
        bestShipsDate={pbs.bestShipsDate}
        bestSessionsCount={pbs.bestSessionsCount}
        bestSessionsDate={pbs.bestSessionsDate}
      />

      <BentoGrid>
        <BentoTile label="streak" sub="days in a row" colSpan={2}>
          <span style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--chart-3)' }}>
            <RollingNumber value={streakDays} />d
          </span>
        </BentoTile>
        <BentoTile label="all-time" colSpan={4}>
          <AllTimeTile
            lifetimeTokens={allTime.tokens}
            daysActive={allTime.daysActive}
            lifetimeShips={allTime.ships}
            nextMilestone={milestone}
          />
        </BentoTile>
        <BentoTile label="30-day trend" colSpan={6}>
          <TokenTrendChart stats={dailyStats} />
        </BentoTile>
      </BentoGrid>

      <BentoTile label="52-week activity">
        <ContributionHeatmap stats={dailyStats} />
      </BentoTile>

      <section style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 style={{ fontSize: '0.7rem', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>deep dive</h2>
        <StatsExplorer dailyStats={dailyStats} machineStats={initialData.machineStats} today={today} />
      </section>
    </main>
  );
}

function pickNowProject(projects: Record<string, number>): string | null {
  const entries = Object.entries(projects).filter(([k]) => k && k !== '~' && k !== 'unknown').sort((a, b) => b[1] - a[1]);
  return entries[0]?.[0] ?? null;
}
```

- [ ] **Step 2: Update IdentityStrip to drop rank pill**

The plan is to "drop the rank-in-squad pill". Since we still pass rank=null/squadSize=null, the existing component will hide them (if it checks for null). Verify by reading the current IdentityStrip — if it doesn't gracefully handle null rank+squadSize, edit it to do so.

If the existing IdentityStrip already checks `rank != null && squadSize != null`, no change needed.

- [ ] **Step 3: tsc + tests + build**

```
pnpm exec tsc --noEmit
pnpm vitest run
pnpm run build
```

Update `tests/components/ProfileLive.test.tsx` if it breaks. The minimum it should assert: `@holden-alt` renders (identity strip) and the live-rank tile renders ("global rank" label is visible).

- [ ] **Step 4: Commit**

```
git add components/ProfileLive.tsx components/dashboard/profile/IdentityStrip.tsx tests/components/ProfileLive.test.tsx
git commit -m "feat(profile): phase-2 recompose — live rank, leaderboard, rollups, PBs above the fold"
```

---

### Task 13: Verify + deploy

- [ ] **Step 1: From the worktree, run full check**

```bash
cd /Users/holdenrichardson/Claude/holden-alt/cc-dashboard/.worktrees/dashboard-redesign
pnpm exec tsc --noEmit
pnpm vitest run
pnpm run build
pnpm exec next-on-pages
```

All four must pass.

- [ ] **Step 2: Push for preview deploy**

```bash
git push
```

CF Pages auto-deploys preview.

- [ ] **Step 3: Smoke-test the preview URL**

`curl -s -o /dev/null -w "%{http_code}\n" https://dashboard-redesign.cc-dashboard-qab.pages.dev/holden-alt` — expect 200.

`curl -s 'https://dashboard-redesign.cc-dashboard-qab.pages.dev/api/leaderboard/live?viewer=00000000-0000-4000-8000-000000000a00&date=2026-05-19' | python3 -m json.tool` — expect a `{rank, total, percentile, top, ...}` JSON shape.

- [ ] **Step 4: Report ready**

Report the preview URL + the live-rank API URL for Holden to verify visually.

---

## Out of scope

- Improving `dashboard_push.py` to capture real project names (current ingest mostly records `~`). Separate effort.
- Replacing the deep-work metric with something meaningful (just dropping it from display for now).
- Removing the `groups`/`friendships`/`group_members` tables. They stay in the DB; the UI just doesn't render them.
- Notification system for streak-at-risk (it's an in-page badge only; no email/push).
- A "weekly digest" surface (Wrapped-style). Could be Phase 3.
