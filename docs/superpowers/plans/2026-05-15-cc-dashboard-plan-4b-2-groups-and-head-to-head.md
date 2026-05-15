# cc-dashboard Plan 4b-2 — Groups + Head-to-Head Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the second half of Plan 4b — a `/groups/:slug` route with a full leaderboard scoped to that group's members, one full-leaderboard section on each profile per group the user belongs to, and a `/:handle/vs/:opponent` head-to-head route with side-by-side stat cards (5 metric rows, winner-per-row highlighting, 30-day overlay sparkline per row, one shared window picker).

**Architecture:** This plan builds on Plan 4b-1's foundation: the `groups` / `group_members` / `friendships` tables (migration `20260514000006`), the seeded squad (migration `20260514000007`), `getLeaderboardData`, `rankUsers`, and the `<Leaderboard>` client component. Phase 0 extends the data layer once: `getLeaderboardData` now also returns a `viewerGroups` array (each group's id/slug/name/color/description/memberUserIds), and `rankUsers` accepts an optional `groupId` so `scope: 'groups'` can pin to one specific group instead of the union of all the viewer's groups. Phase 1 makes `<Leaderboard>` scope-pinnable (a `lockedScope` prop that hides the scope SegmentedControl and forces the value) and builds the `/groups/:slug` route on top of that. Phase 2 wires N group-leaderboard sections onto the profile page, one per group the user belongs to. Phases 3-5 build the head-to-head feature from scratch: a fresh data fetch (`getHeadToHeadData`), a pure compare function (`computeHeadToHead`) that emits per-metric rows with winner + overlay sparkline series, a `<Sparkline>` SVG component, a `<StatRow>` component (two stat values + winner highlight + sparkline), a `<HeadToHead>` orchestrator (state for window, renders rows), and the `/:handle/vs/:opponent` route. Phase 6 is full-suite verification + ship.

**Tech Stack:** Supabase Postgres (no new migrations — reuses 4b-1 schema), Next.js 15 App Router (server routes + client components), React 19 + `useState`, TypeScript strict (`noUncheckedIndexedAccess` on), Tailwind v4, Vitest + Testing Library. Sparkline is hand-rolled inline SVG (no chart library), consistent with `components/charts/TokenTrendChart.tsx`'s "no Recharts" pattern.

**Spec reference:** `docs/superpowers/specs/2026-05-13-cc-dashboard-design.md` §3 item 5 (on-profile group sections), §5 (leaderboard surface), §9 routing table (`/groups/:slug`, `/:handle/vs/:handle`), §11 (in scope: "group bar comparison", "head-to-head comparison").

**Prereqs (all shipped to `main` in 4b-1, verified live):** Schema has `groups`, `group_members`, `friendships`. Seed migration `20260514000007` inserts the default group (`slug=default`, owner = `holden-alt`, members = Holden + 5 squad) and friendships Holden ↔ Mira and Holden ↔ Sam. `getLeaderboardData` lives at `lib/stats/leaderboard-data.ts:8-55` and returns `{ users, statsByUser, groupMemberUserIds, friendUserIds }`. `rankUsers` lives at `lib/stats/leaderboard.ts:56-74`. `<Leaderboard>` lives at `components/leaderboard/Leaderboard.tsx:47-72`. `<LeaderboardSection>` lives at `components/LeaderboardSection.tsx:10-22`. `app/[handle]/page.tsx:13-28` already fetches `leaderboardData` and passes it to `<ProfileLive>`. `computeStreak` is exported from `lib/stats/aggregations.ts:185-197`. `filterByWindow<T extends { date: string }>(rows, today, window)` is reused as-is.

---

## Key engineering decisions (made during planning — Holden can veto)

1. **`/groups/:slug` shows the full Leaderboard UI, scope pinned to this group.** Same 5 metrics × 6 windows × 2 views as `/leaderboard`. The scope SegmentedControl is hidden (scope is fixed). Group name + color appear in the page header; description (if present) renders below. Missing slug → `notFound()`.

2. **`/:handle/vs/:opponent` shows side-by-side stat cards, not a leaderboard.** Two columns (one per user), five metric rows (tokens / sessions / deepwork / streak / ships), one shared window picker at top. Winner per row is highlighted in green (new color token `--color-green`); ties highlight neither. Each row has a 30-day overlay sparkline (both users' daily values plotted as two polylines). Streak row sparkline plots cumulative-active-day count (the per-day "is the user active" → running count), so the sparkline visualizes the streak's growth. Missing user → `notFound()`. `handle === opponent` → `notFound()` (prevents `/holden-alt/vs/holden-alt`).

3. **On-profile group sections are full leaderboards.** `<ProfileLive>` renders N `<GroupLeaderboardSection>`s (one per group the profile owner is in) directly below the existing global `<LeaderboardSection>`. Each is identical in shape to the global section: same SegmentedControls, same RankList/BarComparison views, but with `scope` pinned to that specific group. Empty groups (no members other than the owner) still render — the leaderboard just shows one row.

4. **Data layer extends once, used everywhere.** `getLeaderboardData` now also returns `viewerGroups: Group[]` with `{ id, slug, name, color, description, memberUserIds }`. `rankUsers` accepts an optional `groupId`; when `scope === 'groups'` and `groupId` is provided, the scope set becomes just that group's members. When `groupId` is omitted (current behavior), `groups` scope keeps its existing meaning (union of all the viewer's groups' members). No new data-fetch helper for the group route or profile group sections.

5. **Head-to-head has its own data layer, not a reuse of `getLeaderboardData`.** `getHeadToHeadData(supabase, handle1, handle2)` does a focused 2-user fetch: resolves both users by handle (joined `users` query with `in('github_handle', [h1, h2])`), then fetches their full `daily_stats`. `getLeaderboardData`'s 4000-row limit is wrong for head-to-head (we want every day for the sparkline); a dedicated function is clearer. `computeHeadToHead(data, window, today)` is pure: returns `HeadToHeadRow[]` with `{ metric, valueA, valueB, winner, sparkA, sparkB }`. `sparkA`/`sparkB` are `number[]` of length 30 (oldest → newest).

6. **`<Sparkline>` is hand-rolled SVG.** Two polylines on a fixed `viewBox="0 0 100 30"`, one orange (the profile owner / left side / "A"), one cyan (the opponent / right side / "B"). Polyline coordinates are computed pure (no animation, no axes, no library). Falls back to a single horizontal baseline if both series are all-zero (so empty rows don't render as broken SVGs).

7. **Lockable scope, not separate components.** Instead of building a `<GroupLeaderboard>` component that duplicates `<Leaderboard>`, we add two props to `<Leaderboard>`: `lockedScope?: LeaderboardScope` (forces the value; hides the SegmentedControl) and `lockedGroupId?: string` (passed to `rankUsers` when `lockedScope === 'groups'`). One component, two configurations. The standalone `/leaderboard` route and the on-profile global section both pass neither prop and keep current behavior.

8. **Routes are read-only and public.** No auth gates on `/groups/:slug` or `/:handle/vs/:opponent` — consistent with `/leaderboard` and `/:handle`. RLS already keeps writes service-role only.

9. **Next.js dynamic route param names must be unique within a route.** Cannot use `/[handle]/vs/[handle]`. Used `/[handle]/vs/[opponent]` (the second segment's param is `opponent`). The route resolves user A from `params.handle` (left side, profile owner) and user B from `params.opponent` (right side, the challenger).

10. **No new migrations. No auth changes.** Schema is unchanged from 4b-1. Holden's standing rule about destructive ops doesn't apply; this plan is local-execution + push only.

---

## File Structure (after Plan 4b-2)

```
cc-dashboard/
  lib/
    stats/
      leaderboard-data.ts                          MODIFIED — return viewerGroups: Group[]
      leaderboard.ts                               MODIFIED — Group type; rankUsers groupId param
      head-to-head-data.ts                         NEW — getHeadToHeadData + HeadToHeadData type
      head-to-head.ts                              NEW — computeHeadToHead + HeadToHeadRow type
  components/
    leaderboard/
      Leaderboard.tsx                              MODIFIED — lockedScope + lockedGroupId props; hides SegmentedControl when locked
    head-to-head/
      Sparkline.tsx                                NEW — inline SVG, two polylines
      StatRow.tsx                                  NEW — one metric row: two values + winner highlight + sparkline
      HeadToHead.tsx                               NEW — client orchestrator: window state + rows
    groups/
      GroupHeader.tsx                              NEW — slug-page header: color stripe + name + description
    GroupLeaderboardSection.tsx                    NEW — on-profile wrapper, identical shape to LeaderboardSection, with group context
    LeaderboardSection.tsx                         UNCHANGED — keeps current shape (global)
    ProfileLive.tsx                                MODIFIED — render one GroupLeaderboardSection per viewerGroup below LeaderboardSection
  app/
    groups/[slug]/page.tsx                         NEW — /groups/:slug route
    [handle]/vs/[opponent]/page.tsx                NEW — /:handle/vs/:opponent route
    [handle]/page.tsx                              UNCHANGED (leaderboardData already passed; viewerGroups travels inside it)
    globals.css                                    MODIFIED — add --color-green token
  tests/
    stats/
      leaderboard-data.test.ts                     MODIFIED — assert viewerGroups
      leaderboard.test.ts                          MODIFIED — assert rankUsers groupId behavior
      head-to-head-data.test.ts                    NEW
      head-to-head.test.ts                         NEW
    components/
      Leaderboard.test.tsx                         MODIFIED — assert lockedScope hides control + restricts to that scope
      Sparkline.test.tsx                           NEW
      StatRow.test.tsx                             NEW
      HeadToHead.test.tsx                          NEW
      GroupHeader.test.tsx                         NEW
      GroupLeaderboardSection.test.tsx             NEW
      ProfileLive.test.tsx                         MODIFIED — fixture includes viewerGroups; assert N sections rendered
    routes/
      groups-slug-page.test.tsx                    NEW
      head-to-head-page.test.tsx                   NEW
```

---

## Phase 0 — Data layer extensions (Tasks 0.1, 0.2)

### Task 0.1: Extend `LeaderboardData` with `viewerGroups`; update `getLeaderboardData`

**Files:**
- Modify: `lib/stats/leaderboard.ts:8-13` (LeaderboardData type)
- Modify: `lib/stats/leaderboard-data.ts:8-55` (getLeaderboardData implementation)
- Modify: `tests/stats/leaderboard-data.test.ts`

- [ ] **Step 1: Write failing tests for `viewerGroups`**

Replace the existing two tests in `tests/stats/leaderboard-data.test.ts` with this expanded suite:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { getLeaderboardData } from '@/lib/stats/leaderboard-data';

// The mock returns table-specific data. getLeaderboardData issues six reads now:
// users, daily_stats, group_members (viewer's groups), groups (group details),
// group_members (all members of those groups), friendships.
function mockSupabase(tables: {
  users: unknown[];
  daily_stats: unknown[];
  viewer_groups: { group_id: string }[];        // first group_members read (eq user_id)
  groups: unknown[];                            // groups read (in id)
  group_members: { group_id: string; user_id: string }[]; // second group_members read (in group_id)
  friendships: unknown[];
}) {
  let groupMembersCall = 0;
  return {
    from: vi.fn((table: string) => {
      if (table === 'users') {
        return { select: () => Promise.resolve({ data: tables.users, error: null }) };
      }
      if (table === 'daily_stats') {
        return {
          select: () => ({
            order: () => ({ limit: vi.fn(async () => ({ data: tables.daily_stats, error: null })) }),
          }),
        };
      }
      if (table === 'group_members') {
        groupMembersCall++;
        return {
          select: () => ({
            eq: vi.fn(async () => ({ data: tables.viewer_groups, error: null })),
            in: vi.fn(async () => ({ data: tables.group_members, error: null })),
          }),
        };
      }
      if (table === 'groups') {
        return {
          select: () => ({ in: vi.fn(async () => ({ data: tables.groups, error: null })) }),
        };
      }
      // friendships
      return {
        select: () => ({ eq: vi.fn(async () => ({ data: tables.friendships, error: null })) }),
      };
    }),
  };
}

describe('getLeaderboardData', () => {
  it('returns users, stats grouped by user, and the viewer relationships', async () => {
    const supabase = mockSupabase({
      users: [
        { id: 'u1', github_handle: 'holden-alt', display_name: 'Holden' },
        { id: 'u2', github_handle: 'mira-builds', display_name: 'Mira' },
      ],
      daily_stats: [
        { user_id: 'u1', date: '2026-05-14', tokens_total: 100, tokens_by_model: {},
          sessions: 1, deep_work_minutes: 10, machines: [], projects_touched: {},
          ships: {}, hourly_tokens: {}, source_synced_at: null },
        { user_id: 'u2', date: '2026-05-14', tokens_total: 200, tokens_by_model: {},
          sessions: 2, deep_work_minutes: 20, machines: [], projects_touched: {},
          ships: {}, hourly_tokens: {}, source_synced_at: null },
      ],
      viewer_groups: [{ group_id: 'g1' }],
      groups: [{ id: 'g1', slug: 'default', name: 'The Squad', color: 'cyan', description: null }],
      group_members: [
        { group_id: 'g1', user_id: 'u1' },
        { group_id: 'g1', user_id: 'u2' },
      ],
      friendships: [{ user_id: 'u1', friend_id: 'u2' }],
    });
    const result = await getLeaderboardData(supabase as never, 'u1');
    expect(result.users).toHaveLength(2);
    expect(result.statsByUser['u1']).toHaveLength(1);
    expect(result.statsByUser['u2']?.[0]?.tokens_total).toBe(200);
    expect(result.groupMemberUserIds.sort()).toEqual(['u1', 'u2']);
    expect(result.friendUserIds).toEqual(['u2']);
    expect(result.viewerGroups).toHaveLength(1);
    expect(result.viewerGroups[0]).toEqual({
      id: 'g1',
      slug: 'default',
      name: 'The Squad',
      color: 'cyan',
      description: null,
      memberUserIds: ['u1', 'u2'],
    });
  });

  it('defaults relationship arrays to empty when the viewer has no groups or friends', async () => {
    const supabase = mockSupabase({
      users: [{ id: 'u1', github_handle: 'holden-alt', display_name: 'Holden' }],
      daily_stats: [],
      viewer_groups: [],
      groups: [],
      group_members: [],
      friendships: [],
    });
    const result = await getLeaderboardData(supabase as never, 'u1');
    expect(result.groupMemberUserIds).toEqual([]);
    expect(result.friendUserIds).toEqual([]);
    expect(result.viewerGroups).toEqual([]);
    expect(result.statsByUser).toEqual({});
  });

  it('returns multiple viewerGroups when the viewer is in more than one', async () => {
    const supabase = mockSupabase({
      users: [
        { id: 'u1', github_handle: 'holden-alt', display_name: 'Holden' },
        { id: 'u2', github_handle: 'mira-builds', display_name: 'Mira' },
        { id: 'u3', github_handle: 'devon-ships', display_name: 'Devon' },
      ],
      daily_stats: [],
      viewer_groups: [{ group_id: 'g1' }, { group_id: 'g2' }],
      groups: [
        { id: 'g1', slug: 'default', name: 'The Squad', color: 'cyan', description: 'demo group' },
        { id: 'g2', slug: 'opus-club', name: 'Opus Club', color: 'orange', description: null },
      ],
      group_members: [
        { group_id: 'g1', user_id: 'u1' },
        { group_id: 'g1', user_id: 'u2' },
        { group_id: 'g2', user_id: 'u1' },
        { group_id: 'g2', user_id: 'u3' },
      ],
      friendships: [],
    });
    const result = await getLeaderboardData(supabase as never, 'u1');
    expect(result.viewerGroups.map((g) => g.slug).sort()).toEqual(['default', 'opus-club']);
    const squad = result.viewerGroups.find((g) => g.slug === 'default')!;
    expect(squad.memberUserIds.sort()).toEqual(['u1', 'u2']);
    const opus = result.viewerGroups.find((g) => g.slug === 'opus-club')!;
    expect(opus.memberUserIds.sort()).toEqual(['u1', 'u3']);
    expect(opus.description).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run vitest run tests/stats/leaderboard-data.test.ts`
Expected: FAIL — `viewerGroups` is not yet on the returned object.

- [ ] **Step 3: Extend the `Group` + `LeaderboardData` types**

Edit `lib/stats/leaderboard.ts:8-13`, replacing the `LeaderboardData` type and adding a `Group` type just above it:

```typescript
// Group with full details + the user ids of its members. Used both for the
// per-group profile sections and for the /groups/:slug route header.
export type Group = {
  id: string;
  slug: string;
  name: string;
  color: string;
  description: string | null;
  memberUserIds: string[];
};

// What getLeaderboardData produces and rankUsers consumes.
export type LeaderboardData = {
  users: { id: string; github_handle: string; display_name: string | null }[];
  statsByUser: Record<string, DailyStat[]>;
  groupMemberUserIds: string[]; // union of all the viewer's groups' members (includes the viewer)
  friendUserIds: string[]; // the viewer's friends' user ids
  viewerGroups: Group[]; // every group the viewer belongs to, with per-group membership
};
```

- [ ] **Step 4: Rewrite `getLeaderboardData` to fetch group details + per-group memberships**

Replace the full body of `lib/stats/leaderboard-data.ts` with:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database';
import type { DailyStat } from '@/lib/stats/profile-data';
import type { Group, LeaderboardData } from '@/lib/stats/leaderboard';

const STATS_LIMIT = 4000; // ~6 users x ~hundreds of days of headroom for v1

export async function getLeaderboardData(
  supabase: SupabaseClient<Database>,
  viewerId: string,
): Promise<LeaderboardData> {
  const { data: users } = await supabase
    .from('users')
    .select('id, github_handle, display_name');

  const { data: stats } = await supabase
    .from('daily_stats')
    .select('*')
    .order('date', { ascending: false })
    .limit(STATS_LIMIT);

  // Viewer's groups (just the ids, used to drive the next two reads).
  const { data: viewerGroupRows } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', viewerId);
  const groupIds = (viewerGroupRows ?? []).map((g) => g.group_id);

  // Group details for those groups, and every member of those groups.
  let groupDetails: { id: string; slug: string; name: string; color: string; description: string | null }[] = [];
  let allMembers: { group_id: string; user_id: string }[] = [];
  if (groupIds.length > 0) {
    const { data: groupsData } = await supabase
      .from('groups')
      .select('id, slug, name, color, description')
      .in('id', groupIds);
    groupDetails = groupsData ?? [];
    const { data: members } = await supabase
      .from('group_members')
      .select('group_id, user_id')
      .in('group_id', groupIds);
    allMembers = members ?? [];
  }

  // Per-group membership map for viewerGroups.
  const membersByGroupId = new Map<string, string[]>();
  for (const m of allMembers) {
    const list = membersByGroupId.get(m.group_id) ?? [];
    list.push(m.user_id);
    membersByGroupId.set(m.group_id, list);
  }
  const viewerGroups: Group[] = groupDetails.map((g) => ({
    id: g.id,
    slug: g.slug,
    name: g.name,
    color: g.color,
    description: g.description,
    memberUserIds: membersByGroupId.get(g.id) ?? [],
  }));

  // Union of all members across the viewer's groups (existing groupMemberUserIds shape).
  const groupMemberUserIds = [...new Set(allMembers.map((m) => m.user_id))];

  const { data: friendships } = await supabase
    .from('friendships')
    .select('friend_id')
    .eq('user_id', viewerId);
  const friendUserIds = (friendships ?? []).map((f) => f.friend_id);

  const statsByUser: Record<string, DailyStat[]> = {};
  for (const row of (stats ?? []) as DailyStat[]) {
    (statsByUser[row.user_id] ??= []).push(row);
  }

  return {
    users: users ?? [],
    statsByUser,
    groupMemberUserIds,
    friendUserIds,
    viewerGroups,
  };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun run vitest run tests/stats/leaderboard-data.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Run the full TS suite to confirm no callsites broke**

Run: `bun run vitest run && bun run typecheck`
Expected: all passing. Existing consumers of `LeaderboardData` (`rankUsers`, `<Leaderboard>`, `<ProfileLive>`, tests) still type-check because every fixture they construct now needs a `viewerGroups: []` entry — fix any fixture compile errors by adding `viewerGroups: []`.

- [ ] **Step 7: Commit**

```bash
git add lib/stats/leaderboard.ts lib/stats/leaderboard-data.ts tests/stats/leaderboard-data.test.ts
# plus any fixture files that gained viewerGroups: []
git add -u tests/
git commit -m "feat(leaderboard): return viewerGroups with per-group memberships"
```

---

### Task 0.2: Add `groupId` to `rankUsers` for pinned-group scoping

**Files:**
- Modify: `lib/stats/leaderboard.ts:24-30` (RankOptions type), `lib/stats/leaderboard.ts:50-54` (scopedUserIds helper), `lib/stats/leaderboard.ts:56-74` (rankUsers function)
- Modify: `tests/stats/leaderboard.test.ts`

- [ ] **Step 1: Write failing tests for `groupId`-scoped ranking**

Append these tests inside the `describe('rankUsers', () => { ... })` block in `tests/stats/leaderboard.test.ts` (and update the existing `data` fixture to include `viewerGroups`):

```typescript
// Update the existing fixture's viewerGroups so the new tests have data to work with:
const dataWithTwoGroups: LeaderboardData = {
  ...data,
  viewerGroups: [
    { id: 'g1', slug: 'squad', name: 'Squad', color: 'cyan', description: null, memberUserIds: ['u1', 'u2'] },
    { id: 'g2', slug: 'opus-club', name: 'Opus Club', color: 'orange', description: null, memberUserIds: ['u1', 'u3'] },
  ],
};

it('with groupId, restricts scope to that specific group\'s members only', () => {
  const ranked = rankUsers(dataWithTwoGroups, {
    metric: 'tokens', window: 'all', scope: 'groups', viewerId: 'u1', today: '2026-05-14',
    groupId: 'g1',
  });
  expect(ranked.map((r) => r.handle).sort()).toEqual(['holden-alt', 'mira-builds']);
});

it('with a different groupId, restricts to that group\'s members instead', () => {
  const ranked = rankUsers(dataWithTwoGroups, {
    metric: 'tokens', window: 'all', scope: 'groups', viewerId: 'u1', today: '2026-05-14',
    groupId: 'g2',
  });
  expect(ranked.map((r) => r.handle).sort()).toEqual(['devon-ships', 'holden-alt']);
});

it('with groupId pointing at an unknown group, returns an empty list', () => {
  const ranked = rankUsers(dataWithTwoGroups, {
    metric: 'tokens', window: 'all', scope: 'groups', viewerId: 'u1', today: '2026-05-14',
    groupId: 'g-nonexistent',
  });
  expect(ranked).toEqual([]);
});

it('without groupId, falls back to existing groups behavior (union of all viewer groups)', () => {
  const ranked = rankUsers(dataWithTwoGroups, {
    metric: 'tokens', window: 'all', scope: 'groups', viewerId: 'u1', today: '2026-05-14',
    // no groupId
  });
  // groupMemberUserIds = ['u1', 'u2'] in the base fixture (still the union shape from getLeaderboardData)
  expect(ranked.map((r) => r.handle).sort()).toEqual(['holden-alt', 'mira-builds']);
});

it('groupId is ignored for non-groups scopes', () => {
  const ranked = rankUsers(dataWithTwoGroups, {
    metric: 'tokens', window: 'all', scope: 'global', viewerId: 'u1', today: '2026-05-14',
    groupId: 'g1', // should have no effect
  });
  expect(ranked.map((r) => r.handle).sort()).toEqual(['devon-ships', 'holden-alt', 'mira-builds']);
});
```

Also update the top-level `data` fixture in the file (lines 13-26) to include `viewerGroups: []` for type-correctness.

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run vitest run tests/stats/leaderboard.test.ts`
Expected: FAIL — `groupId` is not a recognized `RankOptions` field.

- [ ] **Step 3: Add `groupId` to `RankOptions` and update `scopedUserIds`**

Edit `lib/stats/leaderboard.ts:24-30` (the `RankOptions` type) and `lib/stats/leaderboard.ts:50-54` (the `scopedUserIds` helper) so the file's relevant sections read:

```typescript
type RankOptions = {
  metric: LeaderboardMetric;
  window: StatsWindow;
  scope: LeaderboardScope;
  viewerId: string;
  today: string;
  groupId?: string; // when scope === 'groups', restricts to this specific group's members
};

function scopedUserIds(
  data: LeaderboardData,
  scope: LeaderboardScope,
  viewerId: string,
  groupId?: string,
): Set<string> {
  if (scope === 'global') return new Set(data.users.map((u) => u.id));
  if (scope === 'groups') {
    if (groupId) {
      const group = data.viewerGroups.find((g) => g.id === groupId);
      return new Set(group?.memberUserIds ?? []);
    }
    return new Set(data.groupMemberUserIds);
  }
  return new Set([viewerId, ...data.friendUserIds]);
}
```

Then update the `rankUsers` body at `lib/stats/leaderboard.ts:56-74` to thread `groupId` into the helper:

```typescript
export function rankUsers(data: LeaderboardData, opts: RankOptions): RankedEntry[] {
  const { metric, window, scope, viewerId, today, groupId } = opts;
  const inScope = scopedUserIds(data, scope, viewerId, groupId);

  const entries = data.users
    .filter((u) => inScope.has(u.id))
    .map((u) => {
      const allStats = data.statsByUser[u.id] ?? [];
      const value =
        metric === 'streak'
          ? computeStreak(allStats, today)
          : cumulativeValue(filterByWindow(allStats, today, window), metric);
      return { userId: u.id, handle: u.github_handle, displayName: u.display_name, value };
    });

  entries.sort((a, b) => b.value - a.value);
  return entries.map((e, i) => ({ ...e, rank: i + 1, isViewer: e.userId === viewerId }));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run vitest run tests/stats/leaderboard.test.ts`
Expected: PASS (all original tests + 5 new ones).

- [ ] **Step 5: Commit**

```bash
git add lib/stats/leaderboard.ts tests/stats/leaderboard.test.ts
git commit -m "feat(leaderboard): rankUsers accepts groupId for pinned-group scope"
```

---

## Phase 1 — Group leaderboard route (Tasks 1.1, 1.2, 1.3, 1.4)

### Task 1.1: Add `lockedScope` + `lockedGroupId` props to `<Leaderboard>`

**Files:**
- Modify: `components/leaderboard/Leaderboard.tsx:11-72`
- Modify: `tests/components/Leaderboard.test.tsx`

- [ ] **Step 1: Write failing tests for the locked-scope behavior**

Append these tests inside the existing `describe('Leaderboard', () => { ... })` block in `tests/components/Leaderboard.test.tsx`:

```typescript
const dataWithTwoGroups: LeaderboardData = {
  ...data,
  viewerGroups: [
    { id: 'g1', slug: 'squad', name: 'Squad', color: 'cyan', description: null, memberUserIds: ['u1', 'u2'] },
    { id: 'g2', slug: 'opus-club', name: 'Opus Club', color: 'orange', description: null, memberUserIds: ['u1', 'u3'] },
  ],
};

it('hides the scope SegmentedControl when lockedScope is set', () => {
  const { container } = render(
    <Leaderboard
      data={dataWithTwoGroups}
      viewerId="u1"
      today="2026-05-14"
      lockedScope="groups"
      lockedGroupId="g1"
    />,
  );
  // Metric/window/view controls still present
  expect(container.querySelector('[data-segment="tokens"]')).toBeTruthy();
  expect(container.querySelector('[data-segment="all"]')).toBeTruthy();
  expect(container.querySelector('[data-segment="ranklist"]')).toBeTruthy();
  // Scope controls absent
  expect(container.querySelector('[data-segment="global"]')).toBeFalsy();
  expect(container.querySelector('[data-segment="groups"]')).toBeFalsy();
  expect(container.querySelector('[data-segment="friends"]')).toBeFalsy();
});

it('with lockedScope=groups + lockedGroupId, restricts the ranking to that group\'s members', () => {
  const { container } = render(
    <Leaderboard
      data={dataWithTwoGroups}
      viewerId="u1"
      today="2026-05-14"
      lockedScope="groups"
      lockedGroupId="g2"
    />,
  );
  const handles = Array.from(container.querySelectorAll('[data-rank-row]'))
    .map((r) => r.getAttribute('data-handle'))
    .sort();
  expect(handles).toEqual(['devon-ships', 'holden-alt']);
});

it('with lockedScope=global, restricts to global (all users) and hides the picker', () => {
  const { container } = render(
    <Leaderboard data={dataWithTwoGroups} viewerId="u1" today="2026-05-14" lockedScope="global" />,
  );
  expect(container.querySelectorAll('[data-rank-row]').length).toBe(3);
  expect(container.querySelector('[data-segment="groups"]')).toBeFalsy();
});
```

Also update the base `data` fixture in the file to include `viewerGroups: []`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run vitest run tests/components/Leaderboard.test.tsx`
Expected: FAIL — `lockedScope` is not a recognized prop.

- [ ] **Step 3: Add `lockedScope` + `lockedGroupId` props and conditionally hide the SegmentedControl**

Replace the contents of `components/leaderboard/Leaderboard.tsx` with:

```typescript
'use client';

import { useState } from 'react';
import type { LeaderboardData, LeaderboardMetric, LeaderboardScope } from '@/lib/stats/leaderboard';
import { rankUsers } from '@/lib/stats/leaderboard';
import type { StatsWindow } from '@/lib/stats/aggregations';
import { SegmentedControl } from '@/components/SegmentedControl';
import { RankList } from '@/components/leaderboard/RankList';
import { BarComparison } from '@/components/leaderboard/BarComparison';

type LeaderboardProps = {
  data: LeaderboardData;
  viewerId: string;
  today: string;
  // When set, the scope SegmentedControl is hidden and rankUsers uses this value.
  // For lockedScope='groups', lockedGroupId pins the rank to that specific group.
  lockedScope?: LeaderboardScope;
  lockedGroupId?: string;
};

type ViewId = 'ranklist' | 'barcomparison';

const METRICS = [
  { id: 'tokens', label: 'tokens' },
  { id: 'sessions', label: 'sessions' },
  { id: 'deepwork', label: 'deep work' },
  { id: 'streak', label: 'streak' },
  { id: 'ships', label: 'ships' },
] as const;

const WINDOWS = [
  { id: 'today', label: 'today' },
  { id: 'week', label: 'week' },
  { id: 'month', label: 'month' },
  { id: 'quarter', label: 'quarter' },
  { id: 'year', label: 'year' },
  { id: 'all', label: 'all' },
] as const;

const SCOPES = [
  { id: 'global', label: 'global' },
  { id: 'groups', label: 'my groups' },
  { id: 'friends', label: 'friends' },
] as const;

const VIEWS = [
  { id: 'ranklist', label: 'rank list' },
  { id: 'barcomparison', label: 'bars' },
] as const;

export function Leaderboard({
  data,
  viewerId,
  today,
  lockedScope,
  lockedGroupId,
}: LeaderboardProps) {
  const [metric, setMetric] = useState<LeaderboardMetric>('tokens');
  const [statsWindow, setStatsWindow] = useState<StatsWindow>('all');
  const [scope, setScope] = useState<LeaderboardScope>(lockedScope ?? 'global');
  const [view, setView] = useState<ViewId>('ranklist');

  const effectiveScope = lockedScope ?? scope;
  const ranked = rankUsers(data, {
    metric,
    window: statsWindow,
    scope: effectiveScope,
    viewerId,
    today,
    groupId: effectiveScope === 'groups' ? lockedGroupId : undefined,
  });

  return (
    <div
      className="rounded border p-2.5"
      style={{ borderColor: 'var(--color-border)', borderTop: '2px solid var(--color-yellow)' }}
      data-leaderboard
    >
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <SegmentedControl options={METRICS} value={metric} onChange={setMetric} />
        <SegmentedControl options={WINDOWS} value={statsWindow} onChange={setStatsWindow} />
        {!lockedScope && (
          <SegmentedControl options={SCOPES} value={scope} onChange={setScope} />
        )}
        <SegmentedControl options={VIEWS} value={view} onChange={setView} />
      </div>
      <div data-leaderboard-body>
        {view === 'ranklist' ? <RankList entries={ranked} /> : <BarComparison entries={ranked} />}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run vitest run tests/components/Leaderboard.test.tsx`
Expected: PASS (all original tests + 3 new ones).

- [ ] **Step 5: Commit**

```bash
git add components/leaderboard/Leaderboard.tsx tests/components/Leaderboard.test.tsx
git commit -m "feat(leaderboard): lockedScope + lockedGroupId props for pinned views"
```

---

### Task 1.2: Create `<GroupHeader>` component

**Files:**
- Create: `components/groups/GroupHeader.tsx`
- Create: `tests/components/GroupHeader.test.tsx`

- [ ] **Step 1: Write failing test**

Create `tests/components/GroupHeader.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { GroupHeader } from '@/components/groups/GroupHeader';

describe('GroupHeader', () => {
  it('renders the group name and the member count', () => {
    const { container } = render(
      <GroupHeader
        name="The Squad"
        color="cyan"
        description="demo vibecoders"
        memberCount={6}
      />,
    );
    expect(container.textContent).toContain('The Squad');
    expect(container.textContent).toContain('6 members');
    expect(container.textContent).toContain('demo vibecoders');
  });

  it('omits the description block when description is null', () => {
    const { container } = render(
      <GroupHeader name="Opus Club" color="orange" description={null} memberCount={3} />,
    );
    expect(container.querySelector('[data-group-description]')).toBeFalsy();
    expect(container.textContent).toContain('Opus Club');
  });

  it('applies the group color via a CSS variable on the accent stripe', () => {
    const { container } = render(
      <GroupHeader name="Squad" color="cyan" description={null} memberCount={2} />,
    );
    const stripe = container.querySelector('[data-group-stripe]') as HTMLElement;
    expect(stripe).toBeTruthy();
    expect(stripe.style.background).toContain('var(--color-cyan)');
  });

  it('singularizes when memberCount is 1', () => {
    const { container } = render(
      <GroupHeader name="Solo" color="cyan" description={null} memberCount={1} />,
    );
    expect(container.textContent).toContain('1 member');
    expect(container.textContent).not.toContain('1 members');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run vitest run tests/components/GroupHeader.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `<GroupHeader>`**

Create `components/groups/GroupHeader.tsx`:

```typescript
type GroupHeaderProps = {
  name: string;
  color: string; // one of the design tokens: cyan, orange, yellow, green, magenta, etc.
  description: string | null;
  memberCount: number;
};

export function GroupHeader({ name, color, description, memberCount }: GroupHeaderProps) {
  return (
    <header className="mb-3" data-group-header>
      <div
        data-group-stripe
        className="h-[3px] w-12 mb-2 rounded-sm"
        style={{ background: `var(--color-${color})` }}
      />
      <h1
        className="text-[0.95rem] uppercase tracking-[0.14em] font-semibold"
        style={{ color: 'var(--color-fg)' }}
      >
        {name}
      </h1>
      <div className="text-[0.6rem] uppercase tracking-[0.12em] mt-1" style={{ color: 'var(--color-dim)' }}>
        {memberCount === 1 ? '1 member' : `${memberCount} members`}
      </div>
      {description ? (
        <p
          data-group-description
          className="text-[0.75rem] mt-2 max-w-[60ch]"
          style={{ color: 'var(--color-fg)' }}
        >
          {description}
        </p>
      ) : null}
    </header>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run vitest run tests/components/GroupHeader.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add components/groups/GroupHeader.tsx tests/components/GroupHeader.test.tsx
git commit -m "feat(groups): GroupHeader component with name, color stripe, member count"
```

---

### Task 1.3: Create `app/groups/[slug]/page.tsx` route

**Files:**
- Create: `app/groups/[slug]/page.tsx`
- Create: `tests/routes/groups-slug-page.test.tsx`

- [ ] **Step 1: Write failing route test**

Create `tests/routes/groups-slug-page.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

const leaderboardData = {
  users: [
    { id: 'u1', github_handle: 'holden-alt', display_name: 'Holden' },
    { id: 'u2', github_handle: 'mira-builds', display_name: 'Mira' },
    { id: 'u3', github_handle: 'devon-ships', display_name: 'Devon' },
  ],
  statsByUser: {
    u1: [{ user_id: 'u1', date: '2026-05-14', tokens_total: 100, tokens_by_model: {},
      sessions: 1, deep_work_minutes: 0, machines: [], projects_touched: {},
      ships: {}, hourly_tokens: {}, source_synced_at: null }],
    u2: [{ user_id: 'u2', date: '2026-05-14', tokens_total: 500, tokens_by_model: {},
      sessions: 1, deep_work_minutes: 0, machines: [], projects_touched: {},
      ships: {}, hourly_tokens: {}, source_synced_at: null }],
    u3: [{ user_id: 'u3', date: '2026-05-14', tokens_total: 300, tokens_by_model: {},
      sessions: 1, deep_work_minutes: 0, machines: [], projects_touched: {},
      ships: {}, hourly_tokens: {}, source_synced_at: null }],
  },
  groupMemberUserIds: ['u1', 'u2', 'u3'],
  friendUserIds: [],
  viewerGroups: [
    { id: 'g1', slug: 'default', name: 'The Squad', color: 'cyan',
      description: 'demo vibecoders', memberUserIds: ['u1', 'u2'] },
    { id: 'g2', slug: 'opus-club', name: 'Opus Club', color: 'orange',
      description: null, memberUserIds: ['u1', 'u3'] },
  ],
};

const notFoundMock = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
vi.mock('next/navigation', () => ({ notFound: notFoundMock }));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: vi.fn((table: string) => {
      if (table === 'users') {
        return { select: () => ({ eq: () => ({ maybeSingle: vi.fn(async () => ({ data: { id: 'u1' }, error: null })) }) }) };
      }
      if (table === 'groups') {
        return { select: () => ({ eq: () => ({ maybeSingle: vi.fn(async (this_: unknown) => {
          // The route looks up the group by slug. Return the matching group fixture, or null.
          // The mock returns null for unknown slugs to drive the notFound() path.
          return { data: null, error: null };
        }) }) }) };
      }
      return { select: () => Promise.resolve({ data: [], error: null }) };
    }),
  })),
}));

vi.mock('@/lib/stats/leaderboard-data', () => ({
  getLeaderboardData: vi.fn(async () => leaderboardData),
}));

describe('/groups/[slug] route', () => {
  it('renders the group header and the leaderboard scoped to the group', async () => {
    // For this test, swap in a mock that returns the matching group.
    const { createClient } = await import('@/lib/supabase/server');
    (createClient as ReturnType<typeof vi.fn>).mockImplementationOnce(async () => ({
      from: vi.fn((table: string) => {
        if (table === 'users') {
          return { select: () => ({ eq: () => ({ maybeSingle: vi.fn(async () => ({ data: { id: 'u1' }, error: null })) }) }) };
        }
        if (table === 'groups') {
          return { select: () => ({ eq: () => ({ maybeSingle: vi.fn(async () => ({
            data: { id: 'g1', slug: 'default', name: 'The Squad', color: 'cyan', description: 'demo vibecoders' },
            error: null,
          })) }) }) };
        }
        return { select: () => Promise.resolve({ data: [], error: null }) };
      }),
    }));

    const { default: GroupPage } = await import('../../app/groups/[slug]/page');
    const ui = await GroupPage({ params: Promise.resolve({ slug: 'default' }) });
    const { container } = render(ui);
    expect(container.querySelector('[data-group-header]')).toBeTruthy();
    expect(container.textContent).toContain('The Squad');
    expect(container.textContent).toContain('demo vibecoders');
    expect(container.querySelector('[data-leaderboard]')).toBeTruthy();
    // scope locked to "default" group = members u1, u2 only
    const handles = Array.from(container.querySelectorAll('[data-rank-row]'))
      .map((r) => r.getAttribute('data-handle'))
      .sort();
    expect(handles).toEqual(['holden-alt', 'mira-builds']);
    // scope SegmentedControl is hidden
    expect(container.querySelector('[data-segment="global"]')).toBeFalsy();
  });

  it('calls notFound() when the slug does not match any group', async () => {
    const { default: GroupPage } = await import('../../app/groups/[slug]/page');
    await expect(
      GroupPage({ params: Promise.resolve({ slug: 'no-such-group' }) }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run vitest run tests/routes/groups-slug-page.test.tsx`
Expected: FAIL — `app/groups/[slug]/page` does not exist yet.

- [ ] **Step 3: Implement the route**

Create `app/groups/[slug]/page.tsx`:

```typescript
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getLeaderboardData } from '@/lib/stats/leaderboard-data';
import { Leaderboard } from '@/components/leaderboard/Leaderboard';
import { GroupHeader } from '@/components/groups/GroupHeader';

export const runtime = 'edge';

// v1: the viewer for the standalone group page is hardcoded to holden-alt,
// matching /leaderboard. v2 resolves the viewer from the session.
const V1_VIEWER_HANDLE = 'holden-alt';

type GroupPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function GroupPage({ params }: GroupPageProps) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: group } = await supabase
    .from('groups')
    .select('id, slug, name, color, description')
    .eq('slug', slug)
    .maybeSingle();
  if (!group) {
    notFound();
  }

  const { data: viewer } = await supabase
    .from('users')
    .select('id')
    .eq('github_handle', V1_VIEWER_HANDLE)
    .maybeSingle();
  const viewerId = viewer?.id ?? '';

  const data = await getLeaderboardData(supabase, viewerId);

  // memberCount is computed from viewerGroups (already fetched), with a
  // fallback for the case where the viewer isn't a member of this group:
  // in v1 that doesn't happen (holden-alt is in every seeded group), but
  // when it does, the count falls back to 0 rather than throwing.
  const viewerGroupEntry = data.viewerGroups.find((g) => g.id === group.id);
  const memberCount = viewerGroupEntry?.memberUserIds.length ?? 0;

  const today = new Date().toISOString().slice(0, 10);

  return (
    <main className="min-h-screen px-6 py-4 max-w-[1000px] mx-auto">
      <GroupHeader
        name={group.name}
        color={group.color}
        description={group.description}
        memberCount={memberCount}
      />
      <Leaderboard
        data={data}
        viewerId={viewerId}
        today={today}
        lockedScope="groups"
        lockedGroupId={group.id}
      />
    </main>
  );
}
```

**Note for the implementer:** if the viewer is not a member of the group being viewed (a v2 concern), `viewerGroupEntry` will be undefined and the leaderboard will render empty. That is acceptable for v1 — the only place this hits in v1 is if a user navigates to `/groups/some-other-club` that holden-alt is not in. The route still renders the header and an empty leaderboard, which is the right UX (the page says "this group exists, but you don't see its members") and doesn't crash.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run vitest run tests/routes/groups-slug-page.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add app/groups/[slug]/page.tsx tests/routes/groups-slug-page.test.tsx
git commit -m "feat(groups): /groups/:slug route with locked-scope leaderboard"
```

---

### Task 1.4: Verify the route in a dev server smoke test

This is a quick manual check that the route boots — the route test in 1.3 only covers the page function, not the App Router routing layer.

- [ ] **Step 1: Run the dev server in the background**

Run: `bun run dev`
Expected: Next.js starts on `http://localhost:3000`.

- [ ] **Step 2: Curl the group route and confirm 200 + expected content**

Run: `curl -s http://localhost:3000/groups/default | grep -i 'the squad'`
Expected: matching lines containing "The Squad".

- [ ] **Step 3: Confirm 404 for an unknown slug**

Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/groups/no-such-group`
Expected: `404`.

- [ ] **Step 4: Stop the dev server.**

No commit — this is a verification task only.

---

## Phase 2 — On-profile group sections (Tasks 2.1, 2.2)

### Task 2.1: Create `<GroupLeaderboardSection>` wrapper

**Files:**
- Create: `components/GroupLeaderboardSection.tsx`
- Create: `tests/components/GroupLeaderboardSection.test.tsx`

- [ ] **Step 1: Write failing test**

Create `tests/components/GroupLeaderboardSection.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { GroupLeaderboardSection } from '@/components/GroupLeaderboardSection';
import type { LeaderboardData } from '@/lib/stats/leaderboard';

const data: LeaderboardData = {
  users: [
    { id: 'u1', github_handle: 'holden-alt', display_name: 'Holden' },
    { id: 'u2', github_handle: 'mira-builds', display_name: 'Mira' },
    { id: 'u3', github_handle: 'devon-ships', display_name: 'Devon' },
  ],
  statsByUser: {
    u1: [{ user_id: 'u1', date: '2026-05-14', tokens_total: 100, tokens_by_model: {},
      sessions: 1, deep_work_minutes: 0, machines: [], projects_touched: {},
      ships: {}, hourly_tokens: {}, source_synced_at: null }],
    u2: [{ user_id: 'u2', date: '2026-05-14', tokens_total: 500, tokens_by_model: {},
      sessions: 1, deep_work_minutes: 0, machines: [], projects_touched: {},
      ships: {}, hourly_tokens: {}, source_synced_at: null }],
    u3: [{ user_id: 'u3', date: '2026-05-14', tokens_total: 300, tokens_by_model: {},
      sessions: 1, deep_work_minutes: 0, machines: [], projects_touched: {},
      ships: {}, hourly_tokens: {}, source_synced_at: null }],
  },
  groupMemberUserIds: ['u1', 'u2', 'u3'],
  friendUserIds: [],
  viewerGroups: [
    { id: 'g1', slug: 'default', name: 'The Squad', color: 'cyan', description: null, memberUserIds: ['u1', 'u2'] },
  ],
};

describe('GroupLeaderboardSection', () => {
  it('renders the group name in the section heading', () => {
    const { container } = render(
      <GroupLeaderboardSection
        data={data}
        viewerId="u1"
        today="2026-05-14"
        group={data.viewerGroups[0]!}
      />,
    );
    expect(container.textContent).toContain('the squad');
    expect(container.querySelector('[data-leaderboard-section]')).toBeTruthy();
  });

  it('renders a leaderboard scoped to this group only', () => {
    const { container } = render(
      <GroupLeaderboardSection
        data={data}
        viewerId="u1"
        today="2026-05-14"
        group={data.viewerGroups[0]!}
      />,
    );
    const handles = Array.from(container.querySelectorAll('[data-rank-row]'))
      .map((r) => r.getAttribute('data-handle'))
      .sort();
    expect(handles).toEqual(['holden-alt', 'mira-builds']);
    // scope SegmentedControl is hidden
    expect(container.querySelector('[data-segment="global"]')).toBeFalsy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run vitest run tests/components/GroupLeaderboardSection.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `<GroupLeaderboardSection>`**

Create `components/GroupLeaderboardSection.tsx`:

```typescript
import type { LeaderboardData, Group } from '@/lib/stats/leaderboard';
import { Leaderboard } from '@/components/leaderboard/Leaderboard';

type GroupLeaderboardSectionProps = {
  data: LeaderboardData;
  viewerId: string;
  today: string;
  group: Group;
};

export function GroupLeaderboardSection({
  data,
  viewerId,
  today,
  group,
}: GroupLeaderboardSectionProps) {
  return (
    <section className="mt-3" data-leaderboard-section data-group-section={group.slug}>
      <h3
        className="text-[0.6rem] uppercase tracking-[0.12em] font-semibold mb-2"
        style={{ color: `var(--color-${group.color})` }}
      >
        {group.name.toLowerCase()}
      </h3>
      <Leaderboard
        data={data}
        viewerId={viewerId}
        today={today}
        lockedScope="groups"
        lockedGroupId={group.id}
      />
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run vitest run tests/components/GroupLeaderboardSection.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add components/GroupLeaderboardSection.tsx tests/components/GroupLeaderboardSection.test.tsx
git commit -m "feat(profile): GroupLeaderboardSection wrapper for per-group profile sections"
```

---

### Task 2.2: Render one `<GroupLeaderboardSection>` per group in `<ProfileLive>`

**Files:**
- Modify: `components/ProfileLive.tsx:69-97` (the JSX return)
- Modify: `tests/components/ProfileLive.test.tsx`

- [ ] **Step 1: Write failing test**

Edit `tests/components/ProfileLive.test.tsx`. Update the test fixture's `leaderboardData` to include a `viewerGroups` array with two groups, then add a new test inside the existing `describe`:

```typescript
it('renders one GroupLeaderboardSection per viewer group, below the global LeaderboardSection', () => {
  const leaderboardData = {
    users: [{ id: 'u1', github_handle: 'holden-alt', display_name: 'Holden' }],
    statsByUser: { u1: [] },
    groupMemberUserIds: ['u1'],
    friendUserIds: [],
    viewerGroups: [
      { id: 'g1', slug: 'default', name: 'The Squad', color: 'cyan', description: null, memberUserIds: ['u1'] },
      { id: 'g2', slug: 'opus-club', name: 'Opus Club', color: 'orange', description: null, memberUserIds: ['u1'] },
    ],
  };
  // Build initialData minimally — match whatever the existing test fixture uses.
  // (See lines 1-50 of this file for the existing fixture shape.)
  const initialData = makeMinimalProfileData('u1', 'holden-alt'); // existing helper or inline literal

  const { container } = render(
    <ProfileLive initialData={initialData} leaderboardData={leaderboardData} today="2026-05-14" />,
  );

  const sections = container.querySelectorAll('[data-leaderboard-section]');
  // 1 global + 2 group sections = 3 total
  expect(sections.length).toBe(3);

  // Verify the two group sections appear and carry the right group slug attribute.
  const groupSections = container.querySelectorAll('[data-group-section]');
  expect(groupSections.length).toBe(2);
  const slugs = Array.from(groupSections)
    .map((s) => s.getAttribute('data-group-section'))
    .sort();
  expect(slugs).toEqual(['default', 'opus-club']);
});
```

**Note for the implementer:** Before writing the new test, `Read` the existing `tests/components/ProfileLive.test.tsx` once. Find how the existing test constructs its `initialData` and `leaderboardData` fixtures (P4b-1 added both). Copy that exact construction pattern into the new test — do not invent a `makeMinimalProfileData` helper if the file doesn't already have one. Just inline the same literal shape the existing test uses, with `viewerGroups` set to the two-element array shown above.

Then, update every existing `leaderboardData` fixture in this file to include `viewerGroups: []` (empty array) so the file still type-checks after the `LeaderboardData` shape change from Task 0.1.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run vitest run tests/components/ProfileLive.test.tsx`
Expected: FAIL — only 1 `[data-leaderboard-section]` rendered.

- [ ] **Step 3: Render group sections in `<ProfileLive>`**

Edit `components/ProfileLive.tsx`. Add the import at the top:

```typescript
import { GroupLeaderboardSection } from '@/components/GroupLeaderboardSection';
```

Then update the return JSX so the existing `<LeaderboardSection ... />` line (line 95) is followed by group sections. Replace lines 95-96 with:

```typescript
      <LeaderboardSection data={leaderboardData} viewerId={user.id} today={today} />
      {leaderboardData.viewerGroups.map((group) => (
        <GroupLeaderboardSection
          key={group.id}
          data={leaderboardData}
          viewerId={user.id}
          today={today}
          group={group}
        />
      ))}
    </main>
```

(Keep the closing `</main>` exactly once — the existing one is being preserved.)

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run vitest run tests/components/ProfileLive.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run the full TS suite to confirm no regressions**

Run: `bun run vitest run && bun run typecheck`
Expected: all passing.

- [ ] **Step 6: Commit**

```bash
git add components/ProfileLive.tsx tests/components/ProfileLive.test.tsx
git commit -m "feat(profile): render one GroupLeaderboardSection per viewer group"
```

---

## Phase 3 — Head-to-head data layer (Tasks 3.1, 3.2)

### Task 3.1: `getHeadToHeadData` — two-user data fetch

**Files:**
- Create: `lib/stats/head-to-head-data.ts`
- Create: `tests/stats/head-to-head-data.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/stats/head-to-head-data.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { getHeadToHeadData } from '@/lib/stats/head-to-head-data';

function mockSupabase(tables: { users: unknown[]; daily_stats: unknown[] }) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'users') {
        return { select: () => ({ in: vi.fn(async () => ({ data: tables.users, error: null })) }) };
      }
      // daily_stats
      return {
        select: () => ({
          in: vi.fn(() => ({
            order: vi.fn(async () => ({ data: tables.daily_stats, error: null })),
          })),
        }),
      };
    }),
  };
}

describe('getHeadToHeadData', () => {
  it('returns both users and their daily_stats grouped by user', async () => {
    const supabase = mockSupabase({
      users: [
        { id: 'u1', github_handle: 'holden-alt', display_name: 'Holden' },
        { id: 'u2', github_handle: 'mira-builds', display_name: 'Mira' },
      ],
      daily_stats: [
        { user_id: 'u1', date: '2026-05-14', tokens_total: 100, tokens_by_model: {},
          sessions: 1, deep_work_minutes: 30, machines: [], projects_touched: {},
          ships: { commits: 2 }, hourly_tokens: {}, source_synced_at: null },
        { user_id: 'u2', date: '2026-05-14', tokens_total: 500, tokens_by_model: {},
          sessions: 2, deep_work_minutes: 90, machines: [], projects_touched: {},
          ships: { commits: 8 }, hourly_tokens: {}, source_synced_at: null },
      ],
    });
    const result = await getHeadToHeadData(supabase as never, 'holden-alt', 'mira-builds');
    expect(result).not.toBeNull();
    expect(result!.userA.github_handle).toBe('holden-alt');
    expect(result!.userB.github_handle).toBe('mira-builds');
    expect(result!.statsA).toHaveLength(1);
    expect(result!.statsB).toHaveLength(1);
    expect(result!.statsB[0]?.tokens_total).toBe(500);
  });

  it('returns null when either handle does not exist', async () => {
    const supabase = mockSupabase({
      users: [{ id: 'u1', github_handle: 'holden-alt', display_name: 'Holden' }],
      daily_stats: [],
    });
    const result = await getHeadToHeadData(supabase as never, 'holden-alt', 'no-such-user');
    expect(result).toBeNull();
  });

  it('preserves handle order regardless of database row order', async () => {
    // Supabase returns u2 first, but the caller asked for holden-alt as A.
    const supabase = mockSupabase({
      users: [
        { id: 'u2', github_handle: 'mira-builds', display_name: 'Mira' },
        { id: 'u1', github_handle: 'holden-alt', display_name: 'Holden' },
      ],
      daily_stats: [],
    });
    const result = await getHeadToHeadData(supabase as never, 'holden-alt', 'mira-builds');
    expect(result!.userA.github_handle).toBe('holden-alt');
    expect(result!.userB.github_handle).toBe('mira-builds');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run vitest run tests/stats/head-to-head-data.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `getHeadToHeadData`**

Create `lib/stats/head-to-head-data.ts`:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database';
import type { DailyStat } from '@/lib/stats/profile-data';

export type HeadToHeadUser = {
  id: string;
  github_handle: string;
  display_name: string | null;
};

export type HeadToHeadData = {
  userA: HeadToHeadUser;
  userB: HeadToHeadUser;
  statsA: DailyStat[];
  statsB: DailyStat[];
};

export async function getHeadToHeadData(
  supabase: SupabaseClient<Database>,
  handleA: string,
  handleB: string,
): Promise<HeadToHeadData | null> {
  const { data: users } = await supabase
    .from('users')
    .select('id, github_handle, display_name')
    .in('github_handle', [handleA, handleB]);

  if (!users || users.length < 2) return null;

  const userA = users.find((u) => u.github_handle === handleA);
  const userB = users.find((u) => u.github_handle === handleB);
  if (!userA || !userB) return null;

  const { data: stats } = await supabase
    .from('daily_stats')
    .select('*')
    .in('user_id', [userA.id, userB.id])
    .order('date', { ascending: false });

  const all = (stats ?? []) as DailyStat[];
  return {
    userA,
    userB,
    statsA: all.filter((s) => s.user_id === userA.id),
    statsB: all.filter((s) => s.user_id === userB.id),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run vitest run tests/stats/head-to-head-data.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/stats/head-to-head-data.ts tests/stats/head-to-head-data.test.ts
git commit -m "feat(h2h): getHeadToHeadData fetches two users + their daily_stats"
```

---

### Task 3.2: `computeHeadToHead` — pure compare function

**Files:**
- Create: `lib/stats/head-to-head.ts`
- Create: `tests/stats/head-to-head.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/stats/head-to-head.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { computeHeadToHead } from '@/lib/stats/head-to-head';
import type { HeadToHeadData } from '@/lib/stats/head-to-head-data';
import type { DailyStat } from '@/lib/stats/profile-data';

function stat(partial: Partial<DailyStat>): DailyStat {
  return {
    user_id: 'u1', date: '2026-05-14', tokens_total: 0, tokens_by_model: {},
    sessions: 0, deep_work_minutes: 0, machines: [], projects_touched: {},
    ships: {}, hourly_tokens: {}, source_synced_at: null, ...partial,
  };
}

const baseData: HeadToHeadData = {
  userA: { id: 'u1', github_handle: 'holden-alt', display_name: 'Holden' },
  userB: { id: 'u2', github_handle: 'mira-builds', display_name: 'Mira' },
  statsA: [
    stat({ user_id: 'u1', date: '2026-05-14', tokens_total: 100, sessions: 2,
      deep_work_minutes: 60, ships: { commits: 3 } }),
    stat({ user_id: 'u1', date: '2026-05-13', tokens_total: 50, sessions: 1,
      deep_work_minutes: 30, ships: { commits: 2 } }),
  ],
  statsB: [
    stat({ user_id: 'u2', date: '2026-05-14', tokens_total: 500, sessions: 1,
      deep_work_minutes: 90, ships: { commits: 1 } }),
    stat({ user_id: 'u2', date: '2026-05-13', tokens_total: 200, sessions: 1,
      deep_work_minutes: 60, ships: { commits: 1 } }),
  ],
};

describe('computeHeadToHead', () => {
  it('returns one row per metric in a stable order', () => {
    const rows = computeHeadToHead(baseData, 'all', '2026-05-14');
    expect(rows.map((r) => r.metric)).toEqual(['tokens', 'sessions', 'deepwork', 'streak', 'ships']);
  });

  it('declares the higher value the winner (A or B)', () => {
    const rows = computeHeadToHead(baseData, 'all', '2026-05-14');
    const tokens = rows.find((r) => r.metric === 'tokens')!;
    expect(tokens.valueA).toBe(150);
    expect(tokens.valueB).toBe(700);
    expect(tokens.winner).toBe('B');

    const sessions = rows.find((r) => r.metric === 'sessions')!;
    expect(sessions.valueA).toBe(3);
    expect(sessions.valueB).toBe(2);
    expect(sessions.winner).toBe('A');
  });

  it('marks tie when values are equal', () => {
    const tied: HeadToHeadData = {
      ...baseData,
      statsA: [stat({ user_id: 'u1', date: '2026-05-14', tokens_total: 100 })],
      statsB: [stat({ user_id: 'u2', date: '2026-05-14', tokens_total: 100 })],
    };
    const rows = computeHeadToHead(tied, 'all', '2026-05-14');
    expect(rows.find((r) => r.metric === 'tokens')!.winner).toBe('tie');
  });

  it('respects the time window for cumulative metrics', () => {
    const rows = computeHeadToHead(baseData, 'today', '2026-05-14');
    const tokens = rows.find((r) => r.metric === 'tokens')!;
    // today window keeps only 2026-05-14 rows: u1=100, u2=500
    expect(tokens.valueA).toBe(100);
    expect(tokens.valueB).toBe(500);
  });

  it('streak ignores the time window (uses computeStreak)', () => {
    const streakData: HeadToHeadData = {
      ...baseData,
      // u1: active 05-13 and 05-14 → streak 2
      // u2: active 05-14 only → streak 1
      statsA: [
        stat({ user_id: 'u1', date: '2026-05-14', tokens_total: 100 }),
        stat({ user_id: 'u1', date: '2026-05-13', tokens_total: 50 }),
      ],
      statsB: [stat({ user_id: 'u2', date: '2026-05-14', tokens_total: 500 })],
    };
    const rows = computeHeadToHead(streakData, 'today', '2026-05-14');
    const streak = rows.find((r) => r.metric === 'streak')!;
    expect(streak.valueA).toBe(2);
    expect(streak.valueB).toBe(1);
    expect(streak.winner).toBe('A');
  });

  it('emits 30-element sparkline arrays per user, oldest -> newest, gaps as 0', () => {
    const rows = computeHeadToHead(baseData, 'all', '2026-05-14');
    const tokens = rows.find((r) => r.metric === 'tokens')!;
    expect(tokens.sparkA).toHaveLength(30);
    expect(tokens.sparkB).toHaveLength(30);
    // newest day (index 29) is 2026-05-14
    expect(tokens.sparkA[29]).toBe(100);
    expect(tokens.sparkB[29]).toBe(500);
    // index 28 is 2026-05-13
    expect(tokens.sparkA[28]).toBe(50);
    expect(tokens.sparkB[28]).toBe(200);
    // earlier indices are 0 (no data)
    expect(tokens.sparkA[0]).toBe(0);
    expect(tokens.sparkB[0]).toBe(0);
  });

  it('streak sparkline is the running streak count over the 30 days', () => {
    const streakData: HeadToHeadData = {
      ...baseData,
      // u1: active every day from 05-12 through 05-14 → streak grows 1,2,3 on those days
      statsA: [
        stat({ user_id: 'u1', date: '2026-05-14', tokens_total: 100 }),
        stat({ user_id: 'u1', date: '2026-05-13', tokens_total: 100 }),
        stat({ user_id: 'u1', date: '2026-05-12', tokens_total: 100 }),
      ],
      statsB: [stat({ user_id: 'u2', date: '2026-05-14', tokens_total: 500 })],
    };
    const rows = computeHeadToHead(streakData, 'all', '2026-05-14');
    const streak = rows.find((r) => r.metric === 'streak')!;
    expect(streak.sparkA).toHaveLength(30);
    // day index 29 = 05-14, A's streak ending there = 3
    expect(streak.sparkA[29]).toBe(3);
    expect(streak.sparkA[28]).toBe(2);
    expect(streak.sparkA[27]).toBe(1);
    expect(streak.sparkA[26]).toBe(0);
    expect(streak.sparkB[29]).toBe(1);
    expect(streak.sparkB[28]).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run vitest run tests/stats/head-to-head.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `computeHeadToHead`**

Create `lib/stats/head-to-head.ts`:

```typescript
import type { DailyStat } from '@/lib/stats/profile-data';
import type { HeadToHeadData } from '@/lib/stats/head-to-head-data';
import { type StatsWindow, filterByWindow, computeStreak } from '@/lib/stats/aggregations';

export type HeadToHeadMetric = 'tokens' | 'sessions' | 'deepwork' | 'streak' | 'ships';

export type HeadToHeadRow = {
  metric: HeadToHeadMetric;
  valueA: number;
  valueB: number;
  winner: 'A' | 'B' | 'tie';
  sparkA: number[]; // length 30, oldest -> newest
  sparkB: number[]; // length 30, oldest -> newest
};

const METRIC_ORDER: HeadToHeadMetric[] = ['tokens', 'sessions', 'deepwork', 'streak', 'ships'];
const SPARK_DAYS = 30;
const MS_PER_DAY = 86_400_000;

function cumulativeValue(stats: DailyStat[], metric: Exclude<HeadToHeadMetric, 'streak'>): number {
  switch (metric) {
    case 'tokens':
      return stats.reduce((s, d) => s + d.tokens_total, 0);
    case 'sessions':
      return stats.reduce((s, d) => s + d.sessions, 0);
    case 'deepwork':
      return Math.round(stats.reduce((s, d) => s + d.deep_work_minutes, 0) / 60);
    case 'ships':
      return stats.reduce((s, d) => {
        const ships = (d.ships ?? {}) as { commits?: number };
        return s + Number(ships.commits ?? 0);
      }, 0);
  }
}

function compareValues(a: number, b: number): 'A' | 'B' | 'tie' {
  if (a > b) return 'A';
  if (b > a) return 'B';
  return 'tie';
}

// Builds a per-day series of length SPARK_DAYS ending at today.
// `extract` returns the per-day numeric value for a given DailyStat (or 0 if absent).
function buildDailySpark(
  stats: DailyStat[],
  today: string,
  extract: (s: DailyStat) => number,
): number[] {
  const todayMs = Date.parse(today + 'T00:00:00Z');
  const byDate = new Map(stats.map((s) => [s.date, s]));
  const out: number[] = [];
  for (let i = SPARK_DAYS - 1; i >= 0; i--) {
    const iso = new Date(todayMs - i * MS_PER_DAY).toISOString().slice(0, 10);
    const found = byDate.get(iso);
    out.push(found ? extract(found) : 0);
  }
  return out;
}

// Builds a per-day series of the running streak count over the last SPARK_DAYS.
function buildStreakSpark(stats: DailyStat[], today: string): number[] {
  const todayMs = Date.parse(today + 'T00:00:00Z');
  const active = new Set(stats.filter((s) => s.tokens_total > 0).map((s) => s.date));
  const out: number[] = [];
  for (let i = SPARK_DAYS - 1; i >= 0; i--) {
    const iso = new Date(todayMs - i * MS_PER_DAY).toISOString().slice(0, 10);
    // running streak ending at iso: walk backwards while active
    let streak = 0;
    const cursor = new Date(iso + 'T00:00:00Z');
    if (!active.has(iso)) {
      // streak ends at iso → 0 unless yesterday was active. Match computeStreak's "today no tokens
      // yet" relaxation: when iso is the current day, fall back to yesterday; otherwise iso-no-tokens
      // means streak = 0 ending at iso.
      if (iso === today) {
        cursor.setUTCDate(cursor.getUTCDate() - 1);
      } else {
        out.push(0);
        continue;
      }
    }
    while (active.has(cursor.toISOString().slice(0, 10))) {
      streak++;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    }
    out.push(streak);
  }
  return out;
}

export function computeHeadToHead(
  data: HeadToHeadData,
  window: StatsWindow,
  today: string,
): HeadToHeadRow[] {
  return METRIC_ORDER.map((metric) => {
    let valueA: number;
    let valueB: number;
    let sparkA: number[];
    let sparkB: number[];

    if (metric === 'streak') {
      valueA = computeStreak(data.statsA, today);
      valueB = computeStreak(data.statsB, today);
      sparkA = buildStreakSpark(data.statsA, today);
      sparkB = buildStreakSpark(data.statsB, today);
    } else {
      const filteredA = filterByWindow(data.statsA, today, window);
      const filteredB = filterByWindow(data.statsB, today, window);
      valueA = cumulativeValue(filteredA, metric);
      valueB = cumulativeValue(filteredB, metric);
      sparkA = buildDailySpark(data.statsA, today, (s) =>
        metric === 'tokens' ? s.tokens_total
        : metric === 'sessions' ? s.sessions
        : metric === 'deepwork' ? Math.round(s.deep_work_minutes / 60)
        : Number(((s.ships ?? {}) as { commits?: number }).commits ?? 0),
      );
      sparkB = buildDailySpark(data.statsB, today, (s) =>
        metric === 'tokens' ? s.tokens_total
        : metric === 'sessions' ? s.sessions
        : metric === 'deepwork' ? Math.round(s.deep_work_minutes / 60)
        : Number(((s.ships ?? {}) as { commits?: number }).commits ?? 0),
      );
    }

    return { metric, valueA, valueB, winner: compareValues(valueA, valueB), sparkA, sparkB };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run vitest run tests/stats/head-to-head.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/stats/head-to-head.ts tests/stats/head-to-head.test.ts
git commit -m "feat(h2h): computeHeadToHead pure compare function with 30-day sparklines"
```

---

## Phase 4 — Head-to-head components (Tasks 4.1, 4.2, 4.3, 4.4)

### Task 4.1: Add `--color-green` token

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Inspect `app/globals.css` and locate the `:root` color tokens block**

Read `app/globals.css`. Find the existing color tokens (e.g. `--color-orange`, `--color-cyan`, `--color-yellow`, `--color-dim`). Note the format used (likely `hsl(...)` or hex).

- [ ] **Step 2: Add `--color-green`**

Add a new line inside the same `:root { ... }` block, matching the format of the existing tokens. Suggested value: a saturated terminal-green that complements the existing palette. If the palette uses hsl, use `hsl(140 70% 55%)` or similar; if hex, `#5fd34d` or similar.

```css
  --color-green: hsl(140 70% 55%); /* head-to-head winner highlight */
```

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "feat(theme): add --color-green token for h2h winner highlight"
```

---

### Task 4.2: `<Sparkline>` — inline SVG, two overlaid polylines

**Files:**
- Create: `components/head-to-head/Sparkline.tsx`
- Create: `tests/components/Sparkline.test.tsx`

- [ ] **Step 1: Write failing test**

Create `tests/components/Sparkline.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Sparkline } from '@/components/head-to-head/Sparkline';

describe('Sparkline', () => {
  it('renders one SVG with two polylines (A in orange, B in cyan)', () => {
    const { container } = render(
      <Sparkline seriesA={[1, 2, 3]} seriesB={[3, 2, 1]} ariaLabel="tokens 3 days" />,
    );
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute('aria-label')).toBe('tokens 3 days');
    const polylines = container.querySelectorAll('polyline');
    expect(polylines.length).toBe(2);
    expect((polylines[0] as SVGPolylineElement).getAttribute('data-series')).toBe('A');
    expect((polylines[1] as SVGPolylineElement).getAttribute('data-series')).toBe('B');
  });

  it('renders a baseline placeholder when both series are all-zero', () => {
    const { container } = render(<Sparkline seriesA={[0, 0, 0]} seriesB={[0, 0, 0]} ariaLabel="x" />);
    // Polylines aren't drawn for all-zero series; a single baseline path is rendered instead.
    expect(container.querySelector('[data-baseline]')).toBeTruthy();
    expect(container.querySelectorAll('polyline').length).toBe(0);
  });

  it('handles series of unequal length by sampling each to the same x-axis length', () => {
    // The component requires both arrays to be the same length (length 30 in production).
    // If they aren't, it falls back to the shorter length.
    const { container } = render(
      <Sparkline seriesA={[1, 2, 3, 4]} seriesB={[1, 2]} ariaLabel="x" />,
    );
    const pointsA = container.querySelector('polyline[data-series="A"]')?.getAttribute('points');
    expect(pointsA?.split(' ').length).toBe(2); // truncated to len-2 of B
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run vitest run tests/components/Sparkline.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `<Sparkline>`**

Create `components/head-to-head/Sparkline.tsx`:

```typescript
type SparklineProps = {
  seriesA: number[];
  seriesB: number[];
  ariaLabel: string;
};

const VIEW_W = 100;
const VIEW_H = 30;

// Builds a "x,y x,y x,y" polyline points string.
function buildPoints(series: number[], max: number): string {
  if (series.length === 0) return '';
  const step = series.length > 1 ? VIEW_W / (series.length - 1) : 0;
  return series
    .map((v, i) => {
      const x = i * step;
      const y = max > 0 ? VIEW_H - (v / max) * VIEW_H : VIEW_H;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
}

export function Sparkline({ seriesA, seriesB, ariaLabel }: SparklineProps) {
  const n = Math.min(seriesA.length, seriesB.length);
  const a = seriesA.slice(0, n);
  const b = seriesB.slice(0, n);

  const sumA = a.reduce((s, v) => s + v, 0);
  const sumB = b.reduce((s, v) => s + v, 0);
  const allZero = sumA === 0 && sumB === 0;

  const max = Math.max(1, ...a, ...b);

  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="none"
      className="w-full h-[30px]"
    >
      {allZero ? (
        <line
          data-baseline
          x1={0}
          y1={VIEW_H - 0.5}
          x2={VIEW_W}
          y2={VIEW_H - 0.5}
          stroke="var(--color-dim)"
          strokeWidth={0.5}
        />
      ) : (
        <>
          <polyline
            data-series="A"
            fill="none"
            stroke="var(--color-orange)"
            strokeWidth={1}
            points={buildPoints(a, max)}
          />
          <polyline
            data-series="B"
            fill="none"
            stroke="var(--color-cyan)"
            strokeWidth={1}
            points={buildPoints(b, max)}
          />
        </>
      )}
    </svg>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run vitest run tests/components/Sparkline.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add components/head-to-head/Sparkline.tsx tests/components/Sparkline.test.tsx
git commit -m "feat(h2h): Sparkline component with two overlaid polylines"
```

---

### Task 4.3: `<StatRow>` — single metric row with winner highlight + sparkline

**Files:**
- Create: `components/head-to-head/StatRow.tsx`
- Create: `tests/components/StatRow.test.tsx`

- [ ] **Step 1: Write failing test**

Create `tests/components/StatRow.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { StatRow } from '@/components/head-to-head/StatRow';

describe('StatRow', () => {
  it('renders metric label, both values, and a sparkline', () => {
    const { container } = render(
      <StatRow
        metric="tokens"
        valueA={150}
        valueB={700}
        winner="B"
        sparkA={[1, 2, 3]}
        sparkB={[3, 2, 1]}
      />,
    );
    expect(container.textContent?.toLowerCase()).toContain('tokens');
    expect(container.querySelector('[data-stat-value="A"]')?.textContent).toContain('150');
    expect(container.querySelector('[data-stat-value="B"]')?.textContent).toContain('700');
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('marks the winning cell with data-winner=true', () => {
    const { container } = render(
      <StatRow metric="tokens" valueA={150} valueB={700} winner="B" sparkA={[]} sparkB={[]} />,
    );
    expect(container.querySelector('[data-stat-value="A"]')?.getAttribute('data-winner')).toBe('false');
    expect(container.querySelector('[data-stat-value="B"]')?.getAttribute('data-winner')).toBe('true');
  });

  it('marks neither cell as winner on a tie', () => {
    const { container } = render(
      <StatRow metric="tokens" valueA={100} valueB={100} winner="tie" sparkA={[]} sparkB={[]} />,
    );
    expect(container.querySelector('[data-stat-value="A"]')?.getAttribute('data-winner')).toBe('false');
    expect(container.querySelector('[data-stat-value="B"]')?.getAttribute('data-winner')).toBe('false');
  });

  it('shows the deepwork suffix "h" on the deepwork metric', () => {
    const { container } = render(
      <StatRow metric="deepwork" valueA={3} valueB={5} winner="B" sparkA={[]} sparkB={[]} />,
    );
    expect(container.querySelector('[data-stat-value="A"]')?.textContent).toMatch(/3\s*h/);
    expect(container.querySelector('[data-stat-value="B"]')?.textContent).toMatch(/5\s*h/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run vitest run tests/components/StatRow.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `<StatRow>`**

Create `components/head-to-head/StatRow.tsx`:

```typescript
import { Sparkline } from '@/components/head-to-head/Sparkline';
import type { HeadToHeadMetric } from '@/lib/stats/head-to-head';
import { formatValue } from '@/components/leaderboard/format';

type StatRowProps = {
  metric: HeadToHeadMetric;
  valueA: number;
  valueB: number;
  winner: 'A' | 'B' | 'tie';
  sparkA: number[];
  sparkB: number[];
};

const METRIC_LABELS: Record<HeadToHeadMetric, string> = {
  tokens: 'tokens',
  sessions: 'sessions',
  deepwork: 'deep work',
  streak: 'streak',
  ships: 'ships',
};

function formatMetric(metric: HeadToHeadMetric, value: number): string {
  if (metric === 'deepwork') return `${value}h`;
  if (metric === 'streak') return `${value}d`;
  return formatValue(value);
}

export function StatRow({ metric, valueA, valueB, winner, sparkA, sparkB }: StatRowProps) {
  const isAWinner = winner === 'A';
  const isBWinner = winner === 'B';
  return (
    <div
      data-stat-row
      data-metric={metric}
      className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-2 border-b"
      style={{ borderColor: 'var(--color-border)' }}
    >
      <div
        data-stat-value="A"
        data-winner={isAWinner ? 'true' : 'false'}
        className="text-right text-[0.95rem] font-mono"
        style={{ color: isAWinner ? 'var(--color-green)' : 'var(--color-fg)' }}
      >
        {formatMetric(metric, valueA)}
      </div>
      <div className="flex flex-col items-center w-[140px]">
        <div
          className="text-[0.55rem] uppercase tracking-[0.12em] mb-1"
          style={{ color: 'var(--color-dim)' }}
        >
          {METRIC_LABELS[metric]}
        </div>
        <Sparkline
          seriesA={sparkA}
          seriesB={sparkB}
          ariaLabel={`${METRIC_LABELS[metric]} last 30 days`}
        />
      </div>
      <div
        data-stat-value="B"
        data-winner={isBWinner ? 'true' : 'false'}
        className="text-left text-[0.95rem] font-mono"
        style={{ color: isBWinner ? 'var(--color-green)' : 'var(--color-fg)' }}
      >
        {formatMetric(metric, valueB)}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run vitest run tests/components/StatRow.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add components/head-to-head/StatRow.tsx tests/components/StatRow.test.tsx
git commit -m "feat(h2h): StatRow with winner highlight + per-row sparkline"
```

---

### Task 4.4: `<HeadToHead>` — client orchestrator (window state + rows)

**Files:**
- Create: `components/head-to-head/HeadToHead.tsx`
- Create: `tests/components/HeadToHead.test.tsx`

- [ ] **Step 1: Write failing test**

Create `tests/components/HeadToHead.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { HeadToHead } from '@/components/head-to-head/HeadToHead';
import type { HeadToHeadData } from '@/lib/stats/head-to-head-data';
import type { DailyStat } from '@/lib/stats/profile-data';

function stat(partial: Partial<DailyStat>): DailyStat {
  return {
    user_id: 'u1', date: '2026-05-14', tokens_total: 0, tokens_by_model: {},
    sessions: 0, deep_work_minutes: 0, machines: [], projects_touched: {},
    ships: {}, hourly_tokens: {}, source_synced_at: null, ...partial,
  };
}

const data: HeadToHeadData = {
  userA: { id: 'u1', github_handle: 'holden-alt', display_name: 'Holden' },
  userB: { id: 'u2', github_handle: 'mira-builds', display_name: 'Mira' },
  statsA: [stat({ user_id: 'u1', date: '2026-05-14', tokens_total: 100 })],
  statsB: [stat({ user_id: 'u2', date: '2026-05-14', tokens_total: 500 })],
};

describe('HeadToHead', () => {
  it('renders both display names as column headers', () => {
    const { container } = render(<HeadToHead data={data} today="2026-05-14" />);
    expect(container.textContent).toContain('Holden');
    expect(container.textContent).toContain('Mira');
  });

  it('renders exactly five metric rows', () => {
    const { container } = render(<HeadToHead data={data} today="2026-05-14" />);
    expect(container.querySelectorAll('[data-stat-row]').length).toBe(5);
  });

  it('renders the window SegmentedControl', () => {
    const { container } = render(<HeadToHead data={data} today="2026-05-14" />);
    expect(container.querySelector('[data-segment="all"]')).toBeTruthy();
    expect(container.querySelector('[data-segment="week"]')).toBeTruthy();
  });

  it('re-computes when window changes (e.g., switching to "today" keeps only today\'s stats)', () => {
    const dataMulti: HeadToHeadData = {
      ...data,
      statsA: [
        stat({ user_id: 'u1', date: '2026-05-14', tokens_total: 100 }),
        stat({ user_id: 'u1', date: '2026-01-01', tokens_total: 9999 }),
      ],
      statsB: [stat({ user_id: 'u2', date: '2026-05-14', tokens_total: 50 })],
    };
    const { container } = render(<HeadToHead data={dataMulti} today="2026-05-14" />);
    // Initial window = 'all': A has 10099 tokens, B has 50 → A wins
    let aValue = container.querySelector('[data-stat-row][data-metric="tokens"] [data-stat-value="A"]');
    expect(aValue?.getAttribute('data-winner')).toBe('true');
    // Switch to 'today': A has 100, B has 50 → A still wins, but value changes
    fireEvent.click(container.querySelector('[data-segment="today"]')!);
    aValue = container.querySelector('[data-stat-row][data-metric="tokens"] [data-stat-value="A"]');
    expect(aValue?.textContent).toContain('100');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run vitest run tests/components/HeadToHead.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `<HeadToHead>`**

Create `components/head-to-head/HeadToHead.tsx`:

```typescript
'use client';

import { useState } from 'react';
import type { HeadToHeadData } from '@/lib/stats/head-to-head-data';
import { computeHeadToHead } from '@/lib/stats/head-to-head';
import type { StatsWindow } from '@/lib/stats/aggregations';
import { SegmentedControl } from '@/components/SegmentedControl';
import { StatRow } from '@/components/head-to-head/StatRow';

type HeadToHeadProps = {
  data: HeadToHeadData;
  today: string;
};

const WINDOWS = [
  { id: 'today', label: 'today' },
  { id: 'week', label: 'week' },
  { id: 'month', label: 'month' },
  { id: 'quarter', label: 'quarter' },
  { id: 'year', label: 'year' },
  { id: 'all', label: 'all' },
] as const;

export function HeadToHead({ data, today }: HeadToHeadProps) {
  const [statsWindow, setStatsWindow] = useState<StatsWindow>('all');
  const rows = computeHeadToHead(data, statsWindow, today);

  const nameA = data.userA.display_name ?? data.userA.github_handle;
  const nameB = data.userB.display_name ?? data.userB.github_handle;

  return (
    <div
      className="rounded border p-3"
      style={{ borderColor: 'var(--color-border)', borderTop: '2px solid var(--color-yellow)' }}
      data-head-to-head
    >
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 mb-3">
        <div className="text-right">
          <div
            className="text-[0.55rem] uppercase tracking-[0.12em]"
            style={{ color: 'var(--color-orange)' }}
          >
            challenger A
          </div>
          <div className="text-[1.05rem] font-semibold" style={{ color: 'var(--color-fg)' }}>
            {nameA}
          </div>
          <div className="text-[0.7rem]" style={{ color: 'var(--color-dim)' }}>
            @{data.userA.github_handle}
          </div>
        </div>
        <div className="text-[0.85rem] font-semibold" style={{ color: 'var(--color-dim)' }}>
          vs
        </div>
        <div className="text-left">
          <div
            className="text-[0.55rem] uppercase tracking-[0.12em]"
            style={{ color: 'var(--color-cyan)' }}
          >
            challenger B
          </div>
          <div className="text-[1.05rem] font-semibold" style={{ color: 'var(--color-fg)' }}>
            {nameB}
          </div>
          <div className="text-[0.7rem]" style={{ color: 'var(--color-dim)' }}>
            @{data.userB.github_handle}
          </div>
        </div>
      </div>
      <div className="flex justify-center mb-3">
        <SegmentedControl options={WINDOWS} value={statsWindow} onChange={setStatsWindow} />
      </div>
      <div>
        {rows.map((row) => (
          <StatRow
            key={row.metric}
            metric={row.metric}
            valueA={row.valueA}
            valueB={row.valueB}
            winner={row.winner}
            sparkA={row.sparkA}
            sparkB={row.sparkB}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run vitest run tests/components/HeadToHead.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add components/head-to-head/HeadToHead.tsx tests/components/HeadToHead.test.tsx
git commit -m "feat(h2h): HeadToHead orchestrator with window picker and 5 metric rows"
```

---

## Phase 5 — Head-to-head route (Task 5.1)

### Task 5.1: `app/[handle]/vs/[opponent]/page.tsx`

**Files:**
- Create: `app/[handle]/vs/[opponent]/page.tsx`
- Create: `tests/routes/head-to-head-page.test.tsx`

- [ ] **Step 1: Write failing route test**

Create `tests/routes/head-to-head-page.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

const h2hData = {
  userA: { id: 'u1', github_handle: 'holden-alt', display_name: 'Holden' },
  userB: { id: 'u2', github_handle: 'mira-builds', display_name: 'Mira' },
  statsA: [{ user_id: 'u1', date: '2026-05-14', tokens_total: 100, tokens_by_model: {},
    sessions: 1, deep_work_minutes: 0, machines: [], projects_touched: {},
    ships: {}, hourly_tokens: {}, source_synced_at: null }],
  statsB: [{ user_id: 'u2', date: '2026-05-14', tokens_total: 500, tokens_by_model: {},
    sessions: 1, deep_work_minutes: 0, machines: [], projects_touched: {},
    ships: {}, hourly_tokens: {}, source_synced_at: null }],
};

const notFoundMock = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
vi.mock('next/navigation', () => ({ notFound: notFoundMock }));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({})),
}));

const getH2HMock = vi.fn(async () => h2hData);
vi.mock('@/lib/stats/head-to-head-data', () => ({
  getHeadToHeadData: getH2HMock,
}));

describe('/[handle]/vs/[opponent] route', () => {
  it('renders both users + the 5 stat rows when both handles resolve', async () => {
    getH2HMock.mockResolvedValueOnce(h2hData);
    const { default: H2HPage } = await import('../../app/[handle]/vs/[opponent]/page');
    const ui = await H2HPage({
      params: Promise.resolve({ handle: 'holden-alt', opponent: 'mira-builds' }),
    });
    const { container } = render(ui);
    expect(container.querySelector('[data-head-to-head]')).toBeTruthy();
    expect(container.textContent).toContain('Holden');
    expect(container.textContent).toContain('Mira');
    expect(container.querySelectorAll('[data-stat-row]').length).toBe(5);
  });

  it('calls notFound() when either handle is missing', async () => {
    getH2HMock.mockResolvedValueOnce(null);
    const { default: H2HPage } = await import('../../app/[handle]/vs/[opponent]/page');
    await expect(
      H2HPage({ params: Promise.resolve({ handle: 'holden-alt', opponent: 'no-such-user' }) }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('calls notFound() when handle === opponent (self-vs-self)', async () => {
    const { default: H2HPage } = await import('../../app/[handle]/vs/[opponent]/page');
    await expect(
      H2HPage({ params: Promise.resolve({ handle: 'holden-alt', opponent: 'holden-alt' }) }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
    // getHeadToHeadData should not be called for self-vs-self
    expect(getH2HMock).not.toHaveBeenCalledWith(expect.anything(), 'holden-alt', 'holden-alt');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run vitest run tests/routes/head-to-head-page.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the route**

Create `app/[handle]/vs/[opponent]/page.tsx`:

```typescript
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getHeadToHeadData } from '@/lib/stats/head-to-head-data';
import { HeadToHead } from '@/components/head-to-head/HeadToHead';

export const runtime = 'edge';

type HeadToHeadPageProps = {
  params: Promise<{ handle: string; opponent: string }>;
};

export default async function HeadToHeadPage({ params }: HeadToHeadPageProps) {
  const { handle, opponent } = await params;

  // Self-vs-self has no meaning; reject early without a database round-trip.
  if (handle === opponent) {
    notFound();
  }

  const supabase = await createClient();
  const data = await getHeadToHeadData(supabase, handle, opponent);
  if (!data) {
    notFound();
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <main className="min-h-screen px-6 py-4 max-w-[900px] mx-auto">
      <h1
        className="text-[0.7rem] uppercase tracking-[0.14em] font-semibold mb-3"
        style={{ color: 'var(--color-yellow)' }}
      >
        · head to head
      </h1>
      <HeadToHead data={data} today={today} />
    </main>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run vitest run tests/routes/head-to-head-page.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add app/[handle]/vs/[opponent]/page.tsx tests/routes/head-to-head-page.test.tsx
git commit -m "feat(h2h): /[handle]/vs/[opponent] route"
```

---

## Phase 6 — Full-suite verification + ship (Tasks 6.1, 6.2)

### Task 6.1: Run the full test suite + typecheck

- [ ] **Step 1: Full vitest run**

Run: `bun run vitest run`
Expected: every test in the repo passes. If anything fails, fix in-place (most likely a fixture missing `viewerGroups: []`).

- [ ] **Step 2: Typecheck**

Run: `bun run typecheck`
Expected: 0 errors.

- [ ] **Step 3: Smoke-test all new routes against the dev server**

```bash
bun run dev &
sleep 5
curl -s -o /dev/null -w "/groups/default → %{http_code}\n" http://localhost:3000/groups/default
curl -s -o /dev/null -w "/groups/no-such → %{http_code}\n" http://localhost:3000/groups/no-such
curl -s -o /dev/null -w "/holden-alt/vs/mira-builds → %{http_code}\n" http://localhost:3000/holden-alt/vs/mira-builds
curl -s -o /dev/null -w "/holden-alt/vs/no-such → %{http_code}\n" http://localhost:3000/holden-alt/vs/no-such
curl -s -o /dev/null -w "/holden-alt/vs/holden-alt → %{http_code}\n" http://localhost:3000/holden-alt/vs/holden-alt
curl -s http://localhost:3000/holden-alt | grep -q 'data-group-section' && echo "profile group sections OK" || echo "profile group sections MISSING"
kill %1
```

Expected:
- `/groups/default → 200`
- `/groups/no-such → 404`
- `/holden-alt/vs/mira-builds → 200`
- `/holden-alt/vs/no-such → 404`
- `/holden-alt/vs/holden-alt → 404`
- `profile group sections OK`

If any line fails, stop and investigate before pushing.

- [ ] **Step 4: No commit (verification only).**

---

### Task 6.2: Ship

Use the gstack `/ship` skill: it handles VERSION bump, CHANGELOG entry, push, and PR creation.

- [ ] **Step 1: Invoke `/ship`**

Pass to ship: "Plan 4b-2 — groups + head-to-head. Routes `/groups/:slug` (full leaderboard, scope pinned), `/:handle/vs/:opponent` (side-by-side stat cards, 30-day overlay sparklines, winner highlights), and one full GroupLeaderboardSection per group on each profile."

- [ ] **Step 2: After PR merges + Cloudflare Pages auto-deploys, run `/land-and-deploy`** to verify live state.

- [ ] **Step 3: Live verification** — same 6 curls as Task 6.1 Step 3, against `https://cc-dashboard-qab.pages.dev` instead of localhost.

---

## Out of scope for Plan 4b-2 (defer to later plans)

- **Persona scope on the leaderboard** — deferred to Plan 5 (personas don't fully exist as a queryable dimension yet).
- **Race chart view** — explicitly out of v1 per spec §11.
- **Auth-gated `/groups/:slug` writes** (join, leave, invite) — service_role writes only in v1 per Decision 8.
- **Custom group colors beyond the existing palette** — limited to the design token set; arbitrary hex requires a new `<GroupHeader>` strategy.
- **Sparkline tooltips / hover** — bare polylines in v1; add interactivity if/when /design-review surfaces a need.
- **`opus %` and ratio metrics** — same v2 polish bucket as the leaderboard ratio metric (P4b-1 Decision 5).
- **Sharing / OG image generation for h2h pages** — bigger SSR/AEO work item, lives in P7.
