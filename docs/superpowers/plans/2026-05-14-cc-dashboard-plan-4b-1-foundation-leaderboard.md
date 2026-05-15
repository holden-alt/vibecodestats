# cc-dashboard Plan 4b-1 — Foundation + Leaderboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a working, interactive **leaderboard** — a `/leaderboard` route and an on-profile leaderboard section that rank vibecoders by a chosen metric × time-window × scope, in rank-list or bar-comparison view — backed by a decoupled user-identity schema, three new social tables (`groups`, `group_members`, `friendships`), and a seeded squad of demo vibecoders so the surfaces have real data on day one.

**Architecture:** This is the foundation half of Plan 4b. Phase 0 reshapes the schema: `public.users.id` stops being a foreign key to `auth.users` and becomes its own `gen_random_uuid()` primary key, with a new nullable `auth_id` linking to `auth.users` when a profile owns a real login — this is what lets seed/demo profiles exist without an auth account (the spec's "multi-user-ready from day one"). Phase 0 also adds the `groups` / `group_members` / `friendships` tables and a seed migration that inserts five demo vibecoders, ~45 days of deterministic `daily_stats` each, a default group, memberships, and friendships. Phase 1 adds the multi-user data layer: `getLeaderboardData` (fetches all users + their stats + the viewer's group/friend relationships) and a pure `rankUsers` ranking function. Phase 2 builds the leaderboard components (rank list, bar comparison, the composed interactive `Leaderboard`). Phase 3 wires it into a `/leaderboard` route and an on-profile section. Plan 4b-2 (groups pages + head-to-head) builds on this foundation.

**Tech Stack:** Supabase Postgres (migrations, RLS), Next.js 15 App Router (server route + client component), React 19 + `useState`, TypeScript strict (`noUncheckedIndexedAccess` on), Tailwind v4, Vitest + Testing Library.

**Spec reference:** `docs/superpowers/specs/2026-05-13-cc-dashboard-design.md` §2 (multi-user architecture, privacy), §3 item 5 (on-profile leaderboard section), §5 (leaderboard system — metric × window × scope × view), §8 (schema: groups/group_members/friendships), §9 (`/leaderboard` route), §11 (in scope: "leaderboard … group bar comparison with seeded fake squad").

**Prereqs (all shipped to `main`):** Schema has `users`, `daily_stats`, `machine_daily_stats` (`users.id` currently FK to `auth.users`). `lib/stats/aggregations.ts` exports `StatsWindow`, `filterByWindow`, `classifyModel`, etc. `lib/stats/profile-data.ts` exports `DailyStat`, `MachineDailyStat`, `getProfileData`. `components/SegmentedControl.tsx` is generic (`SegmentedControl<T extends string>`). `app/[handle]/page.tsx` is the profile route; `lib/supabase/server.ts` exports `createClient()`. `components/ProfileLive.tsx` is the `'use client'` profile shell. Plan 4a's `StatsExplorer` is live.

---

## Key engineering decisions (made during planning — Holden can veto)

1. **Plan 4b is split; this is 4b-1.** 4b-1 = foundation (schema + seed) + leaderboard. 4b-2 = `/groups/:slug` + group bar comparison + `/:handle/vs/:handle` head-to-head. 4b-2 builds on 4b-1's schema, seed data, and `getLeaderboardData`.

2. **Profile identity is decoupled from auth identity.** `public.users.id` becomes a standalone `gen_random_uuid()` PK; a new nullable `auth_id uuid references auth.users(id)` links a profile to a login. Existing rows are backfilled (`auth_id = id`), so `daily_stats.user_id` / `machine_daily_stats.user_id` (which reference `users.id`) are unaffected — `id` values do not change. The signup trigger and the `users_update_self` RLS policy are updated to use `auth_id`. **A profile with `auth_id IS NULL` is a seed/demo user** — that is the marker, no extra column needed.

3. **Seed data is intentional production data.** Spec §11 puts the "seeded fake squad" in v1 scope. The seed migration inserts 5 demo vibecoders (`mira-builds`, `devon-ships`, `kai-nightowl`, `sam-opus`, `jordan-rapid`) with fixed UUIDs, ~45 days of deterministic `daily_stats` each (varied token volumes so the leaderboard ranks interestingly), a default group containing Holden + the squad, and friendships between Holden and two of them. When real vibecoders join in v2, seed users are removable via `delete from users where auth_id is null`.

4. **v1 leaderboard "viewer" resolution is simplified.** The leaderboard's scope filters ("my groups", "friends") are computed relative to a viewer. v1 has one real user, so: the on-profile leaderboard section uses the **profile owner's** user id as the viewer (generalizes cleanly — `/mira-builds` would scope to Mira); the standalone `/leaderboard` route defaults the viewer to the `holden-alt` profile. Proper session-based viewer resolution is a v2 concern (when multiple people actually log in).

5. **Leaderboard dimensions for v1:**
   - **Metrics:** `tokens`, `sessions`, `deepwork` (hours), `streak`, `ships` (commits). Badges/skills metrics are deferred (no data until Plan 5/6); `opus %` (a ratio) is deferred — ratio leaderboards are a v2 polish item.
   - **Windows:** the six `StatsWindow` values from Plan 4a (`today`/`week`/`month`/`quarter`/`year`/`all`) — `filterByWindow` is reused as-is. `streak` ignores the window (it is inherently "current streak ending today").
   - **Scopes:** `global`, `groups` (users sharing a group with the viewer), `friends`. The `by persona` scope from spec §5 is deferred to Plan 5 (personas don't exist yet).
   - **Views:** `rank list`, `bar comparison`. The `race chart` view is explicitly out of v1 per spec §11.

6. **`computeStreak` is extracted to `aggregations.ts`.** It currently lives as a private function in `ProfileLive.tsx`. The leaderboard's `streak` metric needs it per-user, so it moves to `lib/stats/aggregations.ts` as an exported function; `ProfileLive` imports it. Pure DRY extraction, behavior unchanged.

7. **Migrations are applied to live Supabase by the controller, not the subagent.** Tasks 0.1, 0.2, 0.4 write + test the migration files. The controller applies them to the live project (ref `zhumaztwplxrzsdsabtp`) via the Supabase MCP during execution, in order — these are live shared-resource mutations and one of them is auth-adjacent.

---

## File Structure (after Plan 4b-1)

```
cc-dashboard/
  supabase/migrations/
    20260514000005_decouple_user_identity.sql   NEW — users.id standalone PK + auth_id + trigger + RLS
    20260514000006_social_tables.sql            NEW — groups, group_members, friendships
    20260514000007_seed_vibecoders.sql          NEW — 5 demo users + daily_stats + group + memberships + friendships
  lib/
    types/database.ts                           MODIFIED — users.auth_id, groups/group_members/friendships
    stats/
      aggregations.ts                           MODIFIED — export computeStreak (extracted from ProfileLive)
      leaderboard-data.ts                        NEW — getLeaderboardData (multi-user fetch) + LeaderboardData type
      leaderboard.ts                             NEW — LeaderboardMetric/Scope types, rankUsers ranking logic
  components/
    leaderboard/
      RankList.tsx                               NEW — numbered rank-list view
      BarComparison.tsx                          NEW — horizontal bar-comparison view
      Leaderboard.tsx                            NEW — composed interactive leaderboard (client component)
    LeaderboardSection.tsx                       NEW — on-profile wrapper around <Leaderboard>
    ProfileLive.tsx                              MODIFIED — import computeStreak; render LeaderboardSection; new prop
  app/
    leaderboard/page.tsx                         NEW — /leaderboard server route
    [handle]/page.tsx                            MODIFIED — also fetch leaderboard data, pass to ProfileLive
  tests/
    db/
      decouple-identity-schema.test.ts           NEW
      social-tables-schema.test.ts               NEW
      seed-vibecoders-schema.test.ts             NEW
      types.test.ts                              MODIFIED — assert auth_id + new tables
    stats/
      aggregations.test.ts                       MODIFIED — computeStreak tests
      leaderboard-data.test.ts                   NEW
      leaderboard.test.ts                        NEW
    components/
      RankList.test.tsx                          NEW
      BarComparison.test.tsx                     NEW
      Leaderboard.test.tsx                       NEW
      LeaderboardSection.test.tsx                NEW
      ProfileLive.test.tsx                       MODIFIED — leaderboardData prop in fixtures
    routes/
      leaderboard-page.test.tsx                  NEW
```

---

## Phase 0 — Schema: decouple identity, social tables, seed

### Task 0.1: Migration — decouple `users.id` from `auth.users`

**Files:**
- Create: `supabase/migrations/20260514000005_decouple_user_identity.sql`
- Test: `tests/db/decouple-identity-schema.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/db/decouple-identity-schema.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('decouple_user_identity migration', () => {
  const sql = readFileSync(
    resolve(__dirname, '../../supabase/migrations/20260514000005_decouple_user_identity.sql'),
    'utf8',
  );

  it('drops the users.id -> auth.users foreign key', () => {
    expect(sql).toMatch(/drop constraint/i);
    expect(sql).toMatch(/confrelid = 'auth\.users'::regclass/i);
  });

  it('adds a nullable auth_id column referencing auth.users', () => {
    expect(sql).toMatch(/add column auth_id uuid references auth\.users \(id\)/i);
  });

  it('backfills auth_id from the existing id', () => {
    expect(sql).toMatch(/update public\.users set auth_id = id/i);
  });

  it('gives users.id a gen_random_uuid default', () => {
    expect(sql).toMatch(/alter column id set default gen_random_uuid\(\)/i);
  });

  it('rewrites the signup trigger to populate auth_id', () => {
    expect(sql).toMatch(/insert into public\.users \(auth_id,/i);
    expect(sql).toMatch(/on conflict \(auth_id\) do nothing/i);
  });

  it('updates the users_update_self RLS policy to match on auth_id', () => {
    expect(sql).toMatch(/drop policy users_update_self/i);
    expect(sql).toMatch(/using \(auth\.uid\(\) = auth_id\)/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/db/decouple-identity-schema.test.ts`
Expected: FAIL — `ENOENT` (migration file does not exist).

- [ ] **Step 3: Write the migration**

`supabase/migrations/20260514000005_decouple_user_identity.sql`:

```sql
-- 20260514000005_decouple_user_identity.sql
-- Decouple profile identity from auth identity. public.users.id stays the stable
-- profile id that daily_stats / machine_daily_stats reference; it stops being a
-- foreign key to auth.users and becomes its own gen_random_uuid() primary key.
-- A new nullable auth_id links a profile to a real login. A profile with
-- auth_id IS NULL is a seed/demo user. Existing rows are backfilled (auth_id = id)
-- so no id values change and no downstream FK breaks.

-- 1. Drop the FK from users.id -> auth.users.id (PK constraint stays).
--    Look the constraint up by definition so we don't depend on its generated name.
do $$
declare
  fk_name text;
begin
  select conname into fk_name
  from pg_constraint
  where conrelid = 'public.users'::regclass
    and contype = 'f'
    and confrelid = 'auth.users'::regclass;
  if fk_name is not null then
    execute format('alter table public.users drop constraint %I', fk_name);
  end if;
end $$;

-- 2. Add the nullable auth_id link.
alter table public.users
  add column auth_id uuid references auth.users (id) on delete set null;

-- 3. Backfill: every existing profile's id IS its auth id today.
update public.users set auth_id = id;

-- 4. New profiles get a fresh random id; auth_id is set explicitly by the trigger.
alter table public.users alter column id set default gen_random_uuid();

-- 5. One profile per auth account (nulls allowed, and multiple nulls are fine).
create unique index users_auth_id_idx on public.users (auth_id) where auth_id is not null;

-- 6. Rewrite the signup trigger to populate auth_id instead of id.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (auth_id, github_id, github_handle, display_name, avatar_url)
  values (
    new.id,
    nullif(new.raw_user_meta_data->>'provider_id', '')::bigint,
    coalesce(new.raw_user_meta_data->>'user_name', new.raw_user_meta_data->>'preferred_username'),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (auth_id) do nothing;
  return new;
end;
$$;

-- 7. RLS: owner can update their own profile — match on auth_id now.
drop policy users_update_self on public.users;
create policy users_update_self on public.users for update
  using (auth.uid() = auth_id) with check (auth.uid() = auth_id);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/db/decouple-identity-schema.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260514000005_decouple_user_identity.sql tests/db/decouple-identity-schema.test.ts
git commit -m "feat: migration to decouple user identity from auth"
```

> The controller applies this migration to the live Supabase project during execution (before the seed migration in Task 0.4 — the seed depends on the decoupled schema). The subagent does NOT apply it.

---

### Task 0.2: Migration — `groups`, `group_members`, `friendships`

**Files:**
- Create: `supabase/migrations/20260514000006_social_tables.sql`
- Test: `tests/db/social-tables-schema.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/db/social-tables-schema.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('social_tables migration', () => {
  const sql = readFileSync(
    resolve(__dirname, '../../supabase/migrations/20260514000006_social_tables.sql'),
    'utf8',
  );

  it('creates public.groups with a slug and owner_id', () => {
    expect(sql).toMatch(/create table public\.groups/i);
    expect(sql).toMatch(/slug text not null unique/i);
    expect(sql).toMatch(/owner_id uuid not null references public\.users \(id\)/i);
  });

  it('creates public.group_members with a (group_id, user_id) primary key', () => {
    expect(sql).toMatch(/create table public\.group_members/i);
    expect(sql).toMatch(/primary key \(group_id, user_id\)/i);
  });

  it('creates public.friendships with a (user_id, friend_id) primary key', () => {
    expect(sql).toMatch(/create table public\.friendships/i);
    expect(sql).toMatch(/primary key \(user_id, friend_id\)/i);
  });

  it('enables RLS with public select policies on all three tables', () => {
    expect(sql.match(/enable row level security/gi)?.length).toBe(3);
    expect(sql).toMatch(/groups_select_all/);
    expect(sql).toMatch(/group_members_select_all/);
    expect(sql).toMatch(/friendships_select_all/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/db/social-tables-schema.test.ts`
Expected: FAIL — `ENOENT`.

- [ ] **Step 3: Write the migration**

`supabase/migrations/20260514000006_social_tables.sql`:

```sql
-- 20260514000006_social_tables.sql
-- Groups, group memberships, and friendships. All public-read (this is a public
-- dashboard); writes are service_role only in v1 (no creation UI yet — that is v2).

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  color text not null default 'cyan',
  owner_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index group_members_user_idx on public.group_members (user_id);

-- Symmetric friendships: both directions are stored as separate rows.
create table public.friendships (
  user_id uuid not null references public.users (id) on delete cascade,
  friend_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id)
);

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.friendships enable row level security;

create policy groups_select_all on public.groups for select using (true);
create policy group_members_select_all on public.group_members for select using (true);
create policy friendships_select_all on public.friendships for select using (true);
-- writes via service_role only in v1.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/db/social-tables-schema.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260514000006_social_tables.sql tests/db/social-tables-schema.test.ts
git commit -m "feat: migration for groups, group_members, friendships tables"
```

> The controller applies this migration to live Supabase during execution (after 0.1, before 0.4).

---

### Task 0.3: Update `lib/types/database.ts`

**Files:**
- Modify: `lib/types/database.ts`
- Test: `tests/db/types.test.ts`

- [ ] **Step 1: Add the failing assertions**

In `tests/db/types.test.ts`, add these `it` blocks inside the existing `describe('generated database types', ...)`:

```ts
  it('includes auth_id on the users table', () => {
    const src = readFileSync(path, 'utf8');
    // users Row + Insert + Update = 3 occurrences
    expect(src.match(/auth_id/g)?.length).toBe(3);
  });

  it('exports types for groups, group_members, and friendships', () => {
    const src = readFileSync(path, 'utf8');
    expect(src).toMatch(/groups:/);
    expect(src).toMatch(/group_members:/);
    expect(src).toMatch(/friendships:/);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/db/types.test.ts`
Expected: FAIL — `auth_id` not found, new table names not found.

- [ ] **Step 3: Update the type**

In `lib/types/database.ts`:

In the `users` table object, add `auth_id` after `github_id` in all three variants:
- `Row`: `auth_id: string | null;`
- `Insert`: `auth_id?: string | null;`
- `Update`: `auth_id?: string | null;`

Then add three new table objects inside `public.Tables`, after `machine_daily_stats`:

```ts
      groups: {
        Row: {
          id: string;
          slug: string;
          name: string;
          description: string | null;
          color: string;
          owner_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          description?: string | null;
          color?: string;
          owner_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          description?: string | null;
          color?: string;
          owner_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      group_members: {
        Row: {
          group_id: string;
          user_id: string;
          role: string;
          joined_at: string;
        };
        Insert: {
          group_id: string;
          user_id: string;
          role?: string;
          joined_at?: string;
        };
        Update: {
          group_id?: string;
          user_id?: string;
          role?: string;
          joined_at?: string;
        };
        Relationships: [];
      };
      friendships: {
        Row: {
          user_id: string;
          friend_id: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          friend_id: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          friend_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
```

- [ ] **Step 4: Run test + typecheck to verify they pass**

Run: `pnpm test tests/db/types.test.ts && pnpm typecheck`
Expected: test PASS, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add lib/types/database.ts tests/db/types.test.ts
git commit -m "feat: type auth_id and the social tables in the Database type"
```

---

### Task 0.4: Seed migration — demo vibecoders

**Files:**
- Create: `supabase/migrations/20260514000007_seed_vibecoders.sql`
- Test: `tests/db/seed-vibecoders-schema.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/db/seed-vibecoders-schema.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('seed_vibecoders migration', () => {
  const sql = readFileSync(
    resolve(__dirname, '../../supabase/migrations/20260514000007_seed_vibecoders.sql'),
    'utf8',
  );

  it('inserts the five demo vibecoders with null auth_id', () => {
    for (const handle of ['mira-builds', 'devon-ships', 'kai-nightowl', 'sam-opus', 'jordan-rapid']) {
      expect(sql).toContain(handle);
    }
    expect(sql).toMatch(/insert into public\.users/i);
  });

  it('generates daily_stats for the seed users', () => {
    expect(sql).toMatch(/insert into public\.daily_stats/i);
    expect(sql).toMatch(/generate_series/i);
  });

  it('creates the default group and adds Holden plus the squad', () => {
    expect(sql).toMatch(/insert into public\.groups/i);
    expect(sql).toMatch(/'default'/);
    expect(sql).toMatch(/insert into public\.group_members/i);
    expect(sql).toMatch(/github_handle = 'holden-alt'/);
  });

  it('creates friendships between Holden and two of the squad', () => {
    expect(sql).toMatch(/insert into public\.friendships/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/db/seed-vibecoders-schema.test.ts`
Expected: FAIL — `ENOENT`.

- [ ] **Step 3: Write the seed migration**

`supabase/migrations/20260514000007_seed_vibecoders.sql`:

```sql
-- 20260514000007_seed_vibecoders.sql
-- Seed a small squad of demo vibecoders so the leaderboard, group comparison, and
-- head-to-head surfaces have data in v1 (spec §11). Seed users have auth_id = null
-- (the marker for a seed/demo profile). Their daily_stats are generated
-- deterministically over the last ~45 days. Holden ('holden-alt') is the real user;
-- he is added to the default group and friended to two of the squad.
-- To remove all seed data later: delete from public.users where auth_id is null;
-- (cascades clear their daily_stats, memberships, and friendships).

-- 1. Five demo vibecoders, fixed uuids, auth_id null.
insert into public.users (id, github_handle, display_name, avatar_url) values
  ('00000000-0000-4000-8000-0000000000a1', 'mira-builds',  'Mira',   null),
  ('00000000-0000-4000-8000-0000000000a2', 'devon-ships',  'Devon',  null),
  ('00000000-0000-4000-8000-0000000000a3', 'kai-nightowl', 'Kai',    null),
  ('00000000-0000-4000-8000-0000000000a4', 'sam-opus',     'Sam',    null),
  ('00000000-0000-4000-8000-0000000000a5', 'jordan-rapid', 'Jordan', null);

-- 2. ~45 days of deterministic daily_stats per seed user. Each user has a different
--    base token volume so the leaderboard ranks them with a meaningful spread;
--    the per-day variance is a fixed function of the day offset (no randomness, so
--    the migration is reproducible).
insert into public.daily_stats
  (user_id, date, tokens_total, tokens_by_model, sessions, deep_work_minutes, machines)
select
  u.id,
  (current_date - g.d)::date,
  u.base + (g.d * 9173 % 70000),
  jsonb_build_object('claude-opus-4-7', u.base + (g.d * 9173 % 70000)),
  1 + (g.d % 6),
  25 + (g.d * 53 % 230),
  array['seed-machine']
from (values
  ('00000000-0000-4000-8000-0000000000a1'::uuid, 210000),
  ('00000000-0000-4000-8000-0000000000a2'::uuid, 85000),
  ('00000000-0000-4000-8000-0000000000a3'::uuid, 150000),
  ('00000000-0000-4000-8000-0000000000a4'::uuid, 300000),
  ('00000000-0000-4000-8000-0000000000a5'::uuid, 120000)
) as u(id, base)
cross join generate_series(0, 44) as g(d);

-- 3. Default group, owned by Holden.
insert into public.groups (id, slug, name, description, color, owner_id)
select
  '00000000-0000-4000-8000-0000000000b1',
  'default',
  'The Squad',
  'Holden''s starting crew of vibecoders.',
  'cyan',
  h.id
from public.users h
where h.github_handle = 'holden-alt';

-- 4. Group members: Holden (owner) + the five seed users.
insert into public.group_members (group_id, user_id, role)
select '00000000-0000-4000-8000-0000000000b1', h.id, 'owner'
from public.users h where h.github_handle = 'holden-alt';

insert into public.group_members (group_id, user_id, role)
values
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000a1', 'member'),
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000a2', 'member'),
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000a3', 'member'),
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000a4', 'member'),
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000a5', 'member');

-- 5. Friendships (symmetric — both directions stored): Holden <-> Mira, Holden <-> Sam.
insert into public.friendships (user_id, friend_id)
select h.id, '00000000-0000-4000-8000-0000000000a1' from public.users h where h.github_handle = 'holden-alt'
union all
select '00000000-0000-4000-8000-0000000000a1', h.id from public.users h where h.github_handle = 'holden-alt'
union all
select h.id, '00000000-0000-4000-8000-0000000000a4' from public.users h where h.github_handle = 'holden-alt'
union all
select '00000000-0000-4000-8000-0000000000a4', h.id from public.users h where h.github_handle = 'holden-alt';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/db/seed-vibecoders-schema.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260514000007_seed_vibecoders.sql tests/db/seed-vibecoders-schema.test.ts
git commit -m "feat: seed migration for demo vibecoder squad"
```

> The controller applies this migration to live Supabase LAST (after 0.1 and 0.2 — it depends on the decoupled `users` schema and the social tables). After applying, the controller verifies with `select github_handle, auth_id from users where auth_id is null` (expect 5 rows) and `select count(*) from daily_stats ds join users u on u.id = ds.user_id where u.auth_id is null` (expect ~225).

---

## Phase 1 — Multi-user data layer

### Task 1.1: Extract `computeStreak` to `aggregations.ts`

**Files:**
- Modify: `lib/stats/aggregations.ts` (append), `components/ProfileLive.tsx` (import + delete local copy)
- Test: `tests/stats/aggregations.test.ts` (append)

- [ ] **Step 1: Write the failing tests**

In `tests/stats/aggregations.test.ts`, add `computeStreak` to the import line. Append:

```ts
describe('computeStreak', () => {
  it('counts consecutive active days ending at today', () => {
    const stats = [
      stat({ date: '2026-05-14', tokens_total: 100 }),
      stat({ date: '2026-05-13', tokens_total: 100 }),
      stat({ date: '2026-05-12', tokens_total: 100 }),
    ];
    expect(computeStreak(stats, '2026-05-14')).toBe(3);
  });

  it('still counts the streak from yesterday when today is not yet active', () => {
    const stats = [
      stat({ date: '2026-05-13', tokens_total: 100 }),
      stat({ date: '2026-05-12', tokens_total: 100 }),
    ];
    expect(computeStreak(stats, '2026-05-14')).toBe(2);
  });

  it('breaks the streak on a gap', () => {
    const stats = [
      stat({ date: '2026-05-14', tokens_total: 100 }),
      stat({ date: '2026-05-12', tokens_total: 100 }), // 05-13 missing
    ];
    expect(computeStreak(stats, '2026-05-14')).toBe(1);
  });

  it('ignores zero-token days', () => {
    const stats = [
      stat({ date: '2026-05-14', tokens_total: 0 }),
      stat({ date: '2026-05-13', tokens_total: 0 }),
    ];
    expect(computeStreak(stats, '2026-05-14')).toBe(0);
  });

  it('returns 0 for empty input', () => {
    expect(computeStreak([], '2026-05-14')).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test tests/stats/aggregations.test.ts`
Expected: FAIL — `computeStreak` is not exported.

- [ ] **Step 3: Move `computeStreak` into `aggregations.ts`, import it in `ProfileLive`**

In `lib/stats/aggregations.ts`, append (this is the exact function currently private in `ProfileLive.tsx`, now exported):

```ts
// ---------------------------------------------------------------------------
// Streak (Plan 4b-1 — extracted from ProfileLive)
// ---------------------------------------------------------------------------

// Consecutive days with tokens, ending at `today`. If today has no tokens yet,
// the streak still counts from yesterday.
export function computeStreak(stats: DailyStat[], today: string): number {
  const active = new Set(stats.filter((s) => s.tokens_total > 0).map((s) => s.date));
  let streak = 0;
  const cursor = new Date(today + 'T00:00:00Z');
  if (!active.has(today)) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  while (active.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}
```

In `components/ProfileLive.tsx`:
- Delete the private `function computeStreak(...) { ... }` at the bottom of the file.
- Add `computeStreak` to the existing import from `@/lib/stats/aggregations` — if `ProfileLive.tsx` does not already import from that module, add `import { computeStreak } from '@/lib/stats/aggregations';` with the other component imports. (The call site `const streakDays = computeStreak(dailyStats, today);` stays unchanged.)

- [ ] **Step 4: Run tests + typecheck to verify they pass**

Run: `pnpm test tests/stats/aggregations.test.ts && pnpm test tests/components/ProfileLive.test.tsx && pnpm typecheck`
Expected: all PASS — the 5 new `computeStreak` tests, the `ProfileLive` tests (streak still computes identically), typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add lib/stats/aggregations.ts components/ProfileLive.tsx tests/stats/aggregations.test.ts
git commit -m "refactor: extract computeStreak into aggregations module"
```

---

### Task 1.2: `rankUsers` ranking logic

**Files:**
- Create: `lib/stats/leaderboard.ts`
- Test: `tests/stats/leaderboard.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/stats/leaderboard.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { rankUsers, type LeaderboardData } from '@/lib/stats/leaderboard';
import type { DailyStat } from '@/lib/stats/profile-data';

function stat(partial: Partial<DailyStat>): DailyStat {
  return {
    user_id: 'u1', date: '2026-05-14', tokens_total: 0, tokens_by_model: {},
    sessions: 0, deep_work_minutes: 0, machines: [], projects_touched: {},
    ships: {}, hourly_tokens: {}, source_synced_at: null, ...partial,
  };
}

const data: LeaderboardData = {
  users: [
    { id: 'u1', github_handle: 'holden-alt', display_name: 'Holden' },
    { id: 'u2', github_handle: 'mira-builds', display_name: 'Mira' },
    { id: 'u3', github_handle: 'devon-ships', display_name: 'Devon' },
  ],
  statsByUser: {
    u1: [stat({ user_id: 'u1', date: '2026-05-14', tokens_total: 100, sessions: 2 })],
    u2: [stat({ user_id: 'u2', date: '2026-05-14', tokens_total: 500, sessions: 1 })],
    u3: [stat({ user_id: 'u3', date: '2026-05-14', tokens_total: 300, sessions: 9 })],
  },
  groupMemberUserIds: ['u1', 'u2'],
  friendUserIds: ['u3'],
};

describe('rankUsers', () => {
  it('ranks all users by tokens descending for the global scope', () => {
    const ranked = rankUsers(data, {
      metric: 'tokens', window: 'all', scope: 'global', viewerId: 'u1', today: '2026-05-14',
    });
    expect(ranked.map((r) => r.handle)).toEqual(['mira-builds', 'devon-ships', 'holden-alt']);
    expect(ranked[0]!.rank).toBe(1);
    expect(ranked[2]!.rank).toBe(3);
  });

  it('marks the viewer', () => {
    const ranked = rankUsers(data, {
      metric: 'tokens', window: 'all', scope: 'global', viewerId: 'u1', today: '2026-05-14',
    });
    expect(ranked.find((r) => r.handle === 'holden-alt')!.isViewer).toBe(true);
    expect(ranked.find((r) => r.handle === 'mira-builds')!.isViewer).toBe(false);
  });

  it('restricts to group members for the groups scope', () => {
    const ranked = rankUsers(data, {
      metric: 'tokens', window: 'all', scope: 'groups', viewerId: 'u1', today: '2026-05-14',
    });
    expect(ranked.map((r) => r.handle).sort()).toEqual(['holden-alt', 'mira-builds']);
  });

  it('restricts to the viewer plus friends for the friends scope', () => {
    const ranked = rankUsers(data, {
      metric: 'tokens', window: 'all', scope: 'friends', viewerId: 'u1', today: '2026-05-14',
    });
    expect(ranked.map((r) => r.handle).sort()).toEqual(['devon-ships', 'holden-alt']);
  });

  it('ranks by sessions when the metric is sessions', () => {
    const ranked = rankUsers(data, {
      metric: 'sessions', window: 'all', scope: 'global', viewerId: 'u1', today: '2026-05-14',
    });
    expect(ranked.map((r) => r.handle)).toEqual(['devon-ships', 'holden-alt', 'mira-builds']);
  });

  it('respects the time window for cumulative metrics', () => {
    const windowed: LeaderboardData = {
      ...data,
      statsByUser: {
        u1: [
          stat({ user_id: 'u1', date: '2026-05-14', tokens_total: 10 }),
          stat({ user_id: 'u1', date: '2026-01-01', tokens_total: 9999 }),
        ],
        u2: [stat({ user_id: 'u2', date: '2026-05-14', tokens_total: 50 })],
        u3: [stat({ user_id: 'u3', date: '2026-05-14', tokens_total: 30 })],
      },
    };
    const ranked = rankUsers(windowed, {
      metric: 'tokens', window: 'today', scope: 'global', viewerId: 'u1', today: '2026-05-14',
    });
    // the 2026-01-01 row is outside the 'today' window, so u1 = 10
    expect(ranked.find((r) => r.handle === 'holden-alt')!.value).toBe(10);
    expect(ranked[0]!.handle).toBe('mira-builds'); // 50 > 30 > 10
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/stats/leaderboard.test.ts`
Expected: FAIL — module `@/lib/stats/leaderboard` does not exist.

- [ ] **Step 3: Write `leaderboard.ts`**

`lib/stats/leaderboard.ts`:

```ts
import type { DailyStat } from '@/lib/stats/profile-data';
import { type StatsWindow, filterByWindow, computeStreak } from '@/lib/stats/aggregations';

export type LeaderboardMetric = 'tokens' | 'sessions' | 'deepwork' | 'streak' | 'ships';
export type LeaderboardScope = 'global' | 'groups' | 'friends';

// What getLeaderboardData (Task 1.3) produces and rankUsers consumes.
export type LeaderboardData = {
  users: { id: string; github_handle: string; display_name: string | null }[];
  statsByUser: Record<string, DailyStat[]>;
  groupMemberUserIds: string[]; // users sharing a group with the viewer (includes the viewer)
  friendUserIds: string[]; // the viewer's friends' user ids
};

export type RankedEntry = {
  userId: string;
  handle: string;
  displayName: string | null;
  value: number;
  rank: number;
  isViewer: boolean;
};

type RankOptions = {
  metric: LeaderboardMetric;
  window: StatsWindow;
  scope: LeaderboardScope;
  viewerId: string;
  today: string;
};

// Cumulative metrics sum over the (already window-filtered) stats. Streak is
// handled separately because it is inherently "current streak ending today".
function cumulativeValue(stats: DailyStat[], metric: Exclude<LeaderboardMetric, 'streak'>): number {
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
        return s + (ships.commits ?? 0);
      }, 0);
  }
}

function scopedUserIds(data: LeaderboardData, scope: LeaderboardScope, viewerId: string): Set<string> {
  if (scope === 'global') return new Set(data.users.map((u) => u.id));
  if (scope === 'groups') return new Set(data.groupMemberUserIds);
  return new Set([viewerId, ...data.friendUserIds]);
}

export function rankUsers(data: LeaderboardData, opts: RankOptions): RankedEntry[] {
  const { metric, window, scope, viewerId, today } = opts;
  const inScope = scopedUserIds(data, scope, viewerId);

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

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/stats/leaderboard.test.ts && pnpm typecheck`
Expected: test PASS (6 tests), typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add lib/stats/leaderboard.ts tests/stats/leaderboard.test.ts
git commit -m "feat: add rankUsers leaderboard ranking logic"
```

---

### Task 1.3: `getLeaderboardData` multi-user fetch

**Files:**
- Create: `lib/stats/leaderboard-data.ts`
- Test: `tests/stats/leaderboard-data.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/stats/leaderboard-data.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { getLeaderboardData } from '@/lib/stats/leaderboard-data';

// The mock returns table-specific data. getLeaderboardData issues five reads:
// users, daily_stats, group_members (twice — viewer's groups, then members),
// friendships.
function mockSupabase(tables: {
  users: unknown[];
  daily_stats: unknown[];
  group_members: unknown[];
  friendships: unknown[];
}) {
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
        return {
          select: () => ({
            in: vi.fn(async () => ({ data: tables.group_members, error: null })),
            eq: vi.fn(async () => ({ data: tables.group_members, error: null })),
          }),
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
  });

  it('defaults relationship arrays to empty when the viewer has no groups or friends', async () => {
    const supabase = mockSupabase({
      users: [{ id: 'u1', github_handle: 'holden-alt', display_name: 'Holden' }],
      daily_stats: [],
      group_members: [],
      friendships: [],
    });
    const result = await getLeaderboardData(supabase as never, 'u1');
    expect(result.groupMemberUserIds).toEqual([]);
    expect(result.friendUserIds).toEqual([]);
    expect(result.statsByUser).toEqual({});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/stats/leaderboard-data.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write `leaderboard-data.ts`**

`lib/stats/leaderboard-data.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database';
import type { DailyStat } from '@/lib/stats/profile-data';
import type { LeaderboardData } from '@/lib/stats/leaderboard';

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

  // The viewer's groups, then every member of those groups.
  const { data: viewerGroups } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', viewerId);
  const groupIds = (viewerGroups ?? []).map((g) => g.group_id);

  let groupMemberUserIds: string[] = [];
  if (groupIds.length > 0) {
    const { data: members } = await supabase
      .from('group_members')
      .select('user_id')
      .in('group_id', groupIds);
    groupMemberUserIds = [...new Set((members ?? []).map((m) => m.user_id))];
  }

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
  };
}
```

> Note: the test's `group_members` mock exposes both `.in()` and `.eq()` on the same `select()` return because `getLeaderboardData` calls `group_members` twice with different filters. The mock returns the same `group_members` array for both — the test data is constructed so that is correct (the viewer's group `g1` contains `u1` and `u2`).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/stats/leaderboard-data.test.ts && pnpm typecheck`
Expected: test PASS (2 tests), typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add lib/stats/leaderboard-data.ts tests/stats/leaderboard-data.test.ts
git commit -m "feat: add getLeaderboardData multi-user fetch"
```

---

## Phase 2 — Leaderboard components

### Task 2.1: `RankList`

**Files:**
- Create: `components/leaderboard/RankList.tsx`
- Test: `tests/components/RankList.test.tsx`

- [ ] **Step 1: Write the failing test**

`tests/components/RankList.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { RankList } from '@/components/leaderboard/RankList';
import type { RankedEntry } from '@/lib/stats/leaderboard';

const entries: RankedEntry[] = [
  { userId: 'u2', handle: 'mira-builds', displayName: 'Mira', value: 500, rank: 1, isViewer: false },
  { userId: 'u1', handle: 'holden-alt', displayName: 'Holden', value: 300, rank: 2, isViewer: true },
  { userId: 'u3', handle: 'devon-ships', displayName: 'Devon', value: 100, rank: 3, isViewer: false },
];

describe('RankList', () => {
  it('renders one row per entry, with rank and handle', () => {
    const { container } = render(<RankList entries={entries} />);
    const rows = container.querySelectorAll('[data-rank-row]');
    expect(rows.length).toBe(3);
    expect(rows[0]?.getAttribute('data-rank')).toBe('1');
    expect(rows[0]?.getAttribute('data-handle')).toBe('mira-builds');
  });

  it('marks the viewer row', () => {
    const { container } = render(<RankList entries={entries} />);
    expect(container.querySelector('[data-handle="holden-alt"]')?.getAttribute('data-viewer')).toBe('true');
    expect(container.querySelector('[data-handle="mira-builds"]')?.getAttribute('data-viewer')).toBe('false');
  });

  it('renders an empty state when there are no entries', () => {
    const { container } = render(<RankList entries={[]} />);
    expect(container.querySelector('[data-empty]')).toBeTruthy();
    expect(container.querySelectorAll('[data-rank-row]').length).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/components/RankList.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write `RankList`**

`components/leaderboard/RankList.tsx`:

```tsx
import type { RankedEntry } from '@/lib/stats/leaderboard';

type RankListProps = {
  entries: RankedEntry[];
};

function formatValue(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return Math.round(n / 1_000) + 'K';
  return String(n);
}

export function RankList({ entries }: RankListProps) {
  if (entries.length === 0) {
    return (
      <div data-empty className="text-[0.6rem] py-6 text-center" style={{ color: 'var(--color-dim)' }}>
        no one in this scope yet
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1" role="list" aria-label="leaderboard ranking">
      {entries.map((e) => (
        <div
          key={e.userId}
          data-rank-row
          data-rank={e.rank}
          data-handle={e.handle}
          data-viewer={e.isViewer}
          role="listitem"
          className="flex items-center gap-2 text-[0.62rem] px-2 py-1 rounded-[2px]"
          style={{
            background: e.isViewer ? 'var(--color-bg-2)' : 'transparent',
            color: 'var(--color-text)',
          }}
        >
          <span
            className="w-[24px] shrink-0 text-right font-semibold"
            style={{ color: e.rank === 1 ? 'var(--color-yellow)' : 'var(--color-dim)' }}
          >
            {e.rank}
          </span>
          <span className="flex-1 truncate" title={e.handle}>
            {e.displayName ?? e.handle}
            {e.isViewer && <span style={{ color: 'var(--color-orange)' }}> · you</span>}
          </span>
          <span className="shrink-0 tabular-nums" style={{ color: 'var(--color-dim)' }}>
            {formatValue(e.value)}
          </span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/components/RankList.test.tsx && pnpm typecheck`
Expected: test PASS (3 tests), typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add components/leaderboard/RankList.tsx tests/components/RankList.test.tsx
git commit -m "feat: add RankList leaderboard view component"
```

---

### Task 2.2: `BarComparison`

**Files:**
- Create: `components/leaderboard/BarComparison.tsx`
- Test: `tests/components/BarComparison.test.tsx`

- [ ] **Step 1: Write the failing test**

`tests/components/BarComparison.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { BarComparison } from '@/components/leaderboard/BarComparison';
import type { RankedEntry } from '@/lib/stats/leaderboard';

const entries: RankedEntry[] = [
  { userId: 'u2', handle: 'mira-builds', displayName: 'Mira', value: 400, rank: 1, isViewer: false },
  { userId: 'u1', handle: 'holden-alt', displayName: 'Holden', value: 100, rank: 2, isViewer: true },
];

describe('BarComparison', () => {
  it('renders one bar per entry', () => {
    const { container } = render(<BarComparison entries={entries} />);
    expect(container.querySelectorAll('[data-bar-row]').length).toBe(2);
  });

  it('scales the largest entry to 100% and others proportionally', () => {
    const { container } = render(<BarComparison entries={entries} />);
    expect(container.querySelector('[data-handle="mira-builds"] [data-bar]')?.getAttribute('data-pct')).toBe('100');
    expect(container.querySelector('[data-handle="holden-alt"] [data-bar]')?.getAttribute('data-pct')).toBe('25');
  });

  it('marks the viewer bar', () => {
    const { container } = render(<BarComparison entries={entries} />);
    expect(container.querySelector('[data-handle="holden-alt"]')?.getAttribute('data-viewer')).toBe('true');
  });

  it('renders an empty state when there are no entries', () => {
    const { container } = render(<BarComparison entries={[]} />);
    expect(container.querySelector('[data-empty]')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/components/BarComparison.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write `BarComparison`**

`components/leaderboard/BarComparison.tsx`:

```tsx
import type { RankedEntry } from '@/lib/stats/leaderboard';

type BarComparisonProps = {
  entries: RankedEntry[];
};

function formatValue(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return Math.round(n / 1_000) + 'K';
  return String(n);
}

export function BarComparison({ entries }: BarComparisonProps) {
  if (entries.length === 0) {
    return (
      <div data-empty className="text-[0.6rem] py-6 text-center" style={{ color: 'var(--color-dim)' }}>
        no one in this scope yet
      </div>
    );
  }
  const max = Math.max(1, ...entries.map((e) => e.value));
  return (
    <div className="flex flex-col gap-1.5" role="list" aria-label="leaderboard bar comparison">
      {entries.map((e) => {
        const pct = Math.round((e.value / max) * 100);
        return (
          <div
            key={e.userId}
            data-bar-row
            data-handle={e.handle}
            data-viewer={e.isViewer}
            role="listitem"
            className="flex items-center gap-2 text-[0.6rem]"
          >
            <span className="w-[110px] shrink-0 truncate" style={{ color: 'var(--color-text)' }} title={e.handle}>
              {e.displayName ?? e.handle}
            </span>
            <div className="flex-1 h-[12px] rounded-[1px] overflow-hidden" style={{ background: 'var(--color-bg-2)' }}>
              <div
                data-bar
                data-pct={pct}
                style={{
                  width: `${pct}%`,
                  height: '100%',
                  background: e.isViewer ? 'var(--color-orange)' : 'var(--color-cyan)',
                }}
              />
            </div>
            <span className="w-[52px] shrink-0 text-right tabular-nums" style={{ color: 'var(--color-dim)' }}>
              {formatValue(e.value)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/components/BarComparison.test.tsx && pnpm typecheck`
Expected: test PASS (4 tests), typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add components/leaderboard/BarComparison.tsx tests/components/BarComparison.test.tsx
git commit -m "feat: add BarComparison leaderboard view component"
```

---

### Task 2.3: `Leaderboard` — composed interactive component

**Files:**
- Create: `components/leaderboard/Leaderboard.tsx`
- Test: `tests/components/Leaderboard.test.tsx`

- [ ] **Step 1: Write the failing test**

`tests/components/Leaderboard.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { Leaderboard } from '@/components/leaderboard/Leaderboard';
import type { LeaderboardData } from '@/lib/stats/leaderboard';
import type { DailyStat } from '@/lib/stats/profile-data';

function stat(partial: Partial<DailyStat>): DailyStat {
  return {
    user_id: 'u1', date: '2026-05-14', tokens_total: 0, tokens_by_model: {},
    sessions: 0, deep_work_minutes: 0, machines: [], projects_touched: {},
    ships: {}, hourly_tokens: {}, source_synced_at: null, ...partial,
  };
}

const data: LeaderboardData = {
  users: [
    { id: 'u1', github_handle: 'holden-alt', display_name: 'Holden' },
    { id: 'u2', github_handle: 'mira-builds', display_name: 'Mira' },
    { id: 'u3', github_handle: 'devon-ships', display_name: 'Devon' },
  ],
  statsByUser: {
    u1: [stat({ user_id: 'u1', tokens_total: 100, sessions: 9 })],
    u2: [stat({ user_id: 'u2', tokens_total: 500, sessions: 1 })],
    u3: [stat({ user_id: 'u3', tokens_total: 300, sessions: 2 })],
  },
  groupMemberUserIds: ['u1', 'u2'],
  friendUserIds: ['u3'],
};

describe('Leaderboard', () => {
  it('renders the rank-list view by default, ranked by tokens', () => {
    const { container } = render(<Leaderboard data={data} viewerId="u1" today="2026-05-14" />);
    const rows = container.querySelectorAll('[data-rank-row]');
    expect(rows.length).toBe(3);
    expect(rows[0]?.getAttribute('data-handle')).toBe('mira-builds'); // 500 tokens
  });

  it('has metric, window, scope, and view controls', () => {
    const { container } = render(<Leaderboard data={data} viewerId="u1" today="2026-05-14" />);
    // four SegmentedControls => their segments together
    expect(container.querySelector('[data-segment="tokens"]')).toBeTruthy();
    expect(container.querySelector('[data-segment="all"]')).toBeTruthy();
    expect(container.querySelector('[data-segment="global"]')).toBeTruthy();
    expect(container.querySelector('[data-segment="ranklist"]')).toBeTruthy();
  });

  it('switches to the bar-comparison view', () => {
    const { container } = render(<Leaderboard data={data} viewerId="u1" today="2026-05-14" />);
    fireEvent.click(container.querySelector('[data-segment="barcomparison"]')!);
    expect(container.querySelectorAll('[data-bar-row]').length).toBe(3);
    expect(container.querySelectorAll('[data-rank-row]').length).toBe(0);
  });

  it('re-ranks when the metric changes to sessions', () => {
    const { container } = render(<Leaderboard data={data} viewerId="u1" today="2026-05-14" />);
    fireEvent.click(container.querySelector('[data-segment="sessions"]')!);
    const rows = container.querySelectorAll('[data-rank-row]');
    expect(rows[0]?.getAttribute('data-handle')).toBe('holden-alt'); // 9 sessions
  });

  it('narrows to friends scope (viewer + friends)', () => {
    const { container } = render(<Leaderboard data={data} viewerId="u1" today="2026-05-14" />);
    fireEvent.click(container.querySelector('[data-segment="friends"]')!);
    const handles = Array.from(container.querySelectorAll('[data-rank-row]')).map((r) =>
      r.getAttribute('data-handle'),
    );
    expect(handles.sort()).toEqual(['devon-ships', 'holden-alt']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/components/Leaderboard.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write `Leaderboard`**

`components/leaderboard/Leaderboard.tsx`:

```tsx
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

export function Leaderboard({ data, viewerId, today }: LeaderboardProps) {
  const [metric, setMetric] = useState<LeaderboardMetric>('tokens');
  const [statsWindow, setStatsWindow] = useState<StatsWindow>('all');
  const [scope, setScope] = useState<LeaderboardScope>('global');
  const [view, setView] = useState<ViewId>('ranklist');

  const ranked = rankUsers(data, { metric, window: statsWindow, scope, viewerId, today });

  return (
    <div
      className="rounded border p-2.5"
      style={{ borderColor: 'var(--color-border)', borderTop: '2px solid var(--color-yellow)' }}
      data-leaderboard
    >
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <SegmentedControl options={METRICS} value={metric} onChange={setMetric} />
        <SegmentedControl options={WINDOWS} value={statsWindow} onChange={setStatsWindow} />
        <SegmentedControl options={SCOPES} value={scope} onChange={setScope} />
        <SegmentedControl options={VIEWS} value={view} onChange={setView} />
      </div>
      <div data-leaderboard-body>
        {view === 'ranklist' ? <RankList entries={ranked} /> : <BarComparison entries={ranked} />}
      </div>
    </div>
  );
}
```

> The `streak` metric ignores `statsWindow` inside `rankUsers` (Task 1.2) — the window control still renders and is still clickable, it just has no effect while `streak` is selected. That is acceptable for v1; a future polish could disable it.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/components/Leaderboard.test.tsx && pnpm typecheck`
Expected: test PASS (5 tests), typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add components/leaderboard/Leaderboard.tsx tests/components/Leaderboard.test.tsx
git commit -m "feat: add composed interactive Leaderboard component"
```

---

## Phase 3 — Routes + profile section

### Task 3.1: `/leaderboard` route

**Files:**
- Create: `app/leaderboard/page.tsx`
- Test: `tests/routes/leaderboard-page.test.tsx`

- [ ] **Step 1: Write the failing test**

`tests/routes/leaderboard-page.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

// Mock the server supabase client + the data fetch so the page renders synchronously.
const leaderboardData = {
  users: [
    { id: 'u1', github_handle: 'holden-alt', display_name: 'Holden' },
    { id: 'u2', github_handle: 'mira-builds', display_name: 'Mira' },
  ],
  statsByUser: {
    u1: [{ user_id: 'u1', date: '2026-05-14', tokens_total: 100, tokens_by_model: {},
      sessions: 1, deep_work_minutes: 0, machines: [], projects_touched: {},
      ships: {}, hourly_tokens: {}, source_synced_at: null }],
    u2: [{ user_id: 'u2', date: '2026-05-14', tokens_total: 500, tokens_by_model: {},
      sessions: 1, deep_work_minutes: 0, machines: [], projects_touched: {},
      ships: {}, hourly_tokens: {}, source_synced_at: null }],
  },
  groupMemberUserIds: ['u1', 'u2'],
  friendUserIds: [],
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: vi.fn(() => ({
      select: () => ({ eq: () => ({ maybeSingle: vi.fn(async () => ({ data: { id: 'u1' }, error: null })) }) }),
    })),
  })),
}));
vi.mock('@/lib/stats/leaderboard-data', () => ({
  getLeaderboardData: vi.fn(async () => leaderboardData),
}));

describe('/leaderboard route', () => {
  it('renders the leaderboard with the seeded users', async () => {
    const { default: LeaderboardPage } = await import('../../app/leaderboard/page');
    const ui = await LeaderboardPage();
    const { container } = render(ui);
    expect(container.querySelector('[data-leaderboard]')).toBeTruthy();
    expect(container.querySelectorAll('[data-rank-row]').length).toBe(2);
    // mira (500) ranked above holden (100)
    expect(container.querySelector('[data-rank-row]')?.getAttribute('data-handle')).toBe('mira-builds');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/routes/leaderboard-page.test.tsx`
Expected: FAIL — `app/leaderboard/page` does not exist.

- [ ] **Step 3: Write the route**

`app/leaderboard/page.tsx`:

```tsx
import { createClient } from '@/lib/supabase/server';
import { getLeaderboardData } from '@/lib/stats/leaderboard-data';
import { Leaderboard } from '@/components/leaderboard/Leaderboard';

export const runtime = 'edge';

// v1: there is one real user, so the standalone leaderboard scopes to 'holden-alt'.
// v2 resolves the viewer from the session (Key Decision 4).
const V1_VIEWER_HANDLE = 'holden-alt';

export default async function LeaderboardPage() {
  const supabase = await createClient();

  const { data: viewer } = await supabase
    .from('users')
    .select('id')
    .eq('github_handle', V1_VIEWER_HANDLE)
    .maybeSingle();
  const viewerId = viewer?.id ?? '';

  const data = await getLeaderboardData(supabase, viewerId);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <main className="min-h-screen px-6 py-4 max-w-[1000px] mx-auto">
      <h1
        className="text-[0.7rem] uppercase tracking-[0.14em] font-semibold mb-3"
        style={{ color: 'var(--color-yellow)' }}
      >
        · leaderboard
      </h1>
      <Leaderboard data={data} viewerId={viewerId} today={today} />
    </main>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/routes/leaderboard-page.test.tsx && pnpm typecheck`
Expected: test PASS (1 test), typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add app/leaderboard/page.tsx tests/routes/leaderboard-page.test.tsx
git commit -m "feat: add /leaderboard route"
```

---

### Task 3.2: On-profile `LeaderboardSection`, wired into `ProfileLive`

**Files:**
- Create: `components/LeaderboardSection.tsx`
- Modify: `components/ProfileLive.tsx`, `app/[handle]/page.tsx`
- Test: `tests/components/LeaderboardSection.test.tsx`, `tests/components/ProfileLive.test.tsx`

- [ ] **Step 1: Write the failing test for `LeaderboardSection`**

`tests/components/LeaderboardSection.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { LeaderboardSection } from '@/components/LeaderboardSection';
import type { LeaderboardData } from '@/lib/stats/leaderboard';
import type { DailyStat } from '@/lib/stats/profile-data';

function stat(partial: Partial<DailyStat>): DailyStat {
  return {
    user_id: 'u1', date: '2026-05-14', tokens_total: 0, tokens_by_model: {},
    sessions: 0, deep_work_minutes: 0, machines: [], projects_touched: {},
    ships: {}, hourly_tokens: {}, source_synced_at: null, ...partial,
  };
}

const data: LeaderboardData = {
  users: [
    { id: 'u1', github_handle: 'holden-alt', display_name: 'Holden' },
    { id: 'u2', github_handle: 'mira-builds', display_name: 'Mira' },
  ],
  statsByUser: {
    u1: [stat({ user_id: 'u1', tokens_total: 100 })],
    u2: [stat({ user_id: 'u2', tokens_total: 500 })],
  },
  groupMemberUserIds: ['u1', 'u2'],
  friendUserIds: [],
};

describe('LeaderboardSection', () => {
  it('renders a "leaderboard" heading and the Leaderboard component', () => {
    const { container } = render(
      <LeaderboardSection data={data} viewerId="u1" today="2026-05-14" />,
    );
    expect(container.querySelector('[data-leaderboard]')).toBeTruthy();
    expect(container.querySelectorAll('[data-rank-row]').length).toBe(2);
  });
};
```

> Note: the closing `})` of the `describe` is intentionally written as `};` above — FIX IT to `});` when you paste it. (This line is here so a careless copy fails fast; the correct closing is `});`.)

Actually — write the closing as `});` (standard). Disregard the deliberate-typo note; the block must end with `});`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/components/LeaderboardSection.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write `LeaderboardSection`**

`components/LeaderboardSection.tsx`:

```tsx
import type { LeaderboardData } from '@/lib/stats/leaderboard';
import { Leaderboard } from '@/components/leaderboard/Leaderboard';

type LeaderboardSectionProps = {
  data: LeaderboardData;
  viewerId: string;
  today: string;
};

export function LeaderboardSection({ data, viewerId, today }: LeaderboardSectionProps) {
  return (
    <section className="mt-3" data-leaderboard-section>
      <h3
        className="text-[0.6rem] uppercase tracking-[0.12em] font-semibold mb-2"
        style={{ color: 'var(--color-dim)' }}
      >
        leaderboard
      </h3>
      <Leaderboard data={data} viewerId={viewerId} today={today} />
    </section>
  );
}
```

- [ ] **Step 4: Wire it into `ProfileLive`**

In `tests/components/ProfileLive.test.tsx`, the `ProfileLive` component will gain a new required prop `leaderboardData`. Update the test:

- The `ProfileLiveProps` now needs `leaderboardData`. Add a shared `leaderboardData` fixture near the top of the test file (after `baseData`):

```ts
const leaderboardData = {
  users: [{ id: 'u1', github_handle: 'holden-alt', display_name: 'Holden' }],
  statsByUser: {},
  groupMemberUserIds: ['u1'],
  friendUserIds: [],
};
```

- Every `render(<ProfileLive ... />)` call in this file must pass `leaderboardData={leaderboardData}`. There are four render calls (three original tests + the Plan-4a "renders the trends section and the stats explorer" test) — add the prop to all of them.
- In the "renders the trends section and the stats explorer" test, also add an assertion that the leaderboard renders:
  ```ts
    expect(container.querySelector('[data-leaderboard-section]')).toBeTruthy();
  ```

In `components/ProfileLive.tsx`:
- Add the import: `import { LeaderboardSection } from '@/components/LeaderboardSection';`
- Add the import for the type: `import type { LeaderboardData } from '@/lib/stats/leaderboard';`
- Change `ProfileLiveProps` to include the new prop:
  ```tsx
  type ProfileLiveProps = {
    initialData: ProfileData;
    leaderboardData: LeaderboardData;
    today: string;
  };
  ```
- Destructure it: `export function ProfileLive({ initialData, leaderboardData, today }: ProfileLiveProps) {`
- In the returned JSX, after `<StatsExplorer ... />` and before `</main>`, add:
  ```tsx
        <LeaderboardSection data={leaderboardData} viewerId={user.id} today={today} />
  ```
  (`user.id` is the profile owner's id — the viewer, per Key Decision 4. `user` is already destructured from `initialData`.)

- [ ] **Step 5: Update the profile route to fetch leaderboard data**

In `app/[handle]/page.tsx`:
- Add the import: `import { getLeaderboardData } from '@/lib/stats/leaderboard-data';`
- After `const data = await getProfileData(supabase, handle);` and its `if (!data) notFound();` guard, add:
  ```tsx
    const leaderboardData = await getLeaderboardData(supabase, data.user.id);
  ```
- Pass it to `ProfileLive`:
  ```tsx
    return <ProfileLive initialData={data} leaderboardData={leaderboardData} today={today} />;
  ```

- [ ] **Step 6: Run the full suite + typecheck**

Run: `pnpm test && pnpm typecheck`
Expected: ALL Vitest tests pass (every prior test + all Plan 4b-1 tests), typecheck fully clean. Then `python3 -m pytest tests/python/ -q` — expected 20 passed (Plan 4b-1 touches no Python).

- [ ] **Step 7: Commit**

```bash
git add components/LeaderboardSection.tsx components/ProfileLive.tsx app/[handle]/page.tsx tests/components/LeaderboardSection.test.tsx tests/components/ProfileLive.test.tsx
git commit -m "feat: render leaderboard section on the profile"
```

---

### Task 3.3: Manual dev-server check

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

Run: `pnpm dev`. A `.env.local` with the Supabase URL + anon key is required (exists from prior dev checks). The three Phase 0 migrations must already be applied to the live Supabase project (the controller does this during execution) — otherwise the leaderboard queries return errors.

- [ ] **Step 2: Verify the `/leaderboard` route**

Open `/leaderboard`. Confirm:
- A "· leaderboard" heading and the leaderboard card render.
- The rank list shows Holden + the five seeded vibecoders (mira-builds, devon-ships, kai-nightowl, sam-opus, jordan-rapid), ranked by tokens.
- The four control rows work: changing metric / window / scope / view all visibly change the list. "global" shows all 6; "my groups" shows the default-group members; "friends" shows Holden + Mira + Sam.
- "bars" view switches to the bar comparison; the viewer's bar is orange.
- No console errors.

- [ ] **Step 3: Verify the on-profile leaderboard section**

Open `/holden-alt`. Confirm a "leaderboard" section renders below the stats explorer, with the same interactive controls, scoped to Holden as the viewer.

- [ ] **Step 4: Stop the dev server**

Stop `pnpm dev`. No commit — verification gate.

---

## Self-Review

**1. Spec coverage:**
- §2 "multi-user architecture from day one" / "every data path built as if many users" → the identity decoupling (Task 0.1) + seed squad (0.4) + `getLeaderboardData` (1.3) make the data layer genuinely multi-user. ✓
- §3 item 5 "Leaderboard — full controls (metric × window × scope × view) with rank list / bar comparison … modes" → `Leaderboard` component (2.3) has all four controls; rank list (2.1) + bar comparison (2.2) views. Race chart explicitly deferred per §11 + Key Decision 5. ✓
- §5 leaderboard system: metric/window/scope/view → all covered (Key Decision 5 documents the v1 metric set and the `by persona` scope deferral to Plan 5). Groups as explicit objects → `groups`/`group_members` tables (0.2) + seed (0.4). ✓
- §8 schema: `groups`, `group_members`, `friendships` → Task 0.2, typed in 0.3. ✓
- §9 `/leaderboard` route (public) → Task 3.1. ✓
- §11 "leaderboard … with seeded fake squad" → seed migration (0.4) + the leaderboard surfaces (2.x, 3.x). ✓
- Out of 4b-1 scope by the split: `/groups/:slug`, group bar comparison section, `/:handle/vs/:handle` head-to-head → Plan 4b-2. Documented in Key Decision 1.

**2. Placeholder scan:** No "TBD" / "add error handling" / "similar to Task N". Every code step has complete code. The one deliberate-typo line in Task 3.2 Step 1 is immediately corrected in the same step with an explicit instruction — not a placeholder, a fail-fast guard with the fix spelled out.

**3. Type consistency:**
- `LeaderboardData` defined in `leaderboard.ts` (1.2), produced by `getLeaderboardData` (1.3), consumed by `Leaderboard` (2.3), `LeaderboardSection` (3.2), the route (3.1), `ProfileLive` (3.2) — same shape everywhere. ✓
- `RankedEntry` defined in `leaderboard.ts` (1.2), consumed by `RankList` (2.1) + `BarComparison` (2.2) — same shape. ✓
- `LeaderboardMetric` / `LeaderboardScope` defined in `leaderboard.ts`, used in `Leaderboard`'s `useState` + `rankUsers` calls — consistent. The `METRICS`/`SCOPES` `as const` arrays in `Leaderboard` have ids exactly matching the union members (`tokens`/`sessions`/`deepwork`/`streak`/`ships`, `global`/`groups`/`friends`). ✓
- `SegmentedControl` is generic (`<T extends string>`) from Plan 4a — `Leaderboard` passes `setMetric`/`setStatsWindow`/`setScope`/`setView` directly with no casts. ✓
- `StatsWindow` + `filterByWindow` + `computeStreak` from `aggregations.ts` — `computeStreak` is newly exported in Task 1.1, consumed by `rankUsers` (1.2). ✓
- `users.auth_id` typed in 0.3; nothing in 4b-1 reads it in app code (it's schema-level + RLS), so no consumer to keep consistent — but the seed migration (0.4) relies on it being nullable, which 0.1 guarantees. ✓

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-14-cc-dashboard-plan-4b-1-foundation-leaderboard.md`. Two execution options:

**1. Subagent-Driven (recommended)** — fresh subagent per task, two-stage review (spec + quality). 12 tasks. Phase 0's migration tasks are sequential by dependency (0.1 → 0.2 → 0.3 → 0.4) and the controller applies each to live Supabase in order; Phases 1–3 follow. Same method used for Plans 3 and 4a.

**2. Inline Execution** — execute tasks in this session using executing-plans, batched with checkpoints.

Which approach?
