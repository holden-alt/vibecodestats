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

-- 3-5. Group, memberships, and friendships — all depend on Holden's user row.
-- Wrapped in a guard so the migration still succeeds on a fresh database where
-- 'holden-alt' has not signed in yet (the group/friendship seeding is simply
-- skipped in that case; re-seed manually once the real user exists).
do $$
declare
  holden_id uuid;
begin
  select id into holden_id from public.users where github_handle = 'holden-alt';
  if holden_id is null then
    raise notice 'seed_vibecoders: holden-alt not found — skipping group/friendship seed';
    return;
  end if;

  -- 3. Default group, owned by Holden.
  insert into public.groups (id, slug, name, description, color, owner_id)
  values (
    '00000000-0000-4000-8000-0000000000b1',
    'default',
    'The Squad',
    'Holden''s starting crew of vibecoders.',
    'cyan',
    holden_id
  );

  -- 4. Group members: Holden (owner) + the five seed users.
  insert into public.group_members (group_id, user_id, role) values
    ('00000000-0000-4000-8000-0000000000b1', holden_id, 'owner'),
    ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000a1', 'member'),
    ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000a2', 'member'),
    ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000a3', 'member'),
    ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000a4', 'member'),
    ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000a5', 'member');

  -- 5. Friendships (symmetric — both directions stored): Holden <-> Mira, Holden <-> Sam.
  insert into public.friendships (user_id, friend_id) values
    (holden_id, '00000000-0000-4000-8000-0000000000a1'),
    ('00000000-0000-4000-8000-0000000000a1', holden_id),
    (holden_id, '00000000-0000-4000-8000-0000000000a4'),
    ('00000000-0000-4000-8000-0000000000a4', holden_id);
end $$;
