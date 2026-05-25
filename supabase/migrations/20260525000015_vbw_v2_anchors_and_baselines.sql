-- 20260525000015_vbw_v2_anchors_and_baselines.sql
-- VBW v2: sigmoid-anchored dimensions + personal-baseline "vs You" + intraday projection.
--
-- Three new tables and one new column on users:
--   1. users.timezone — IANA tz for future local-date scoring (Phase 2; v2 still uses UTC dates).
--   2. dim_anchor      — platform-wide sigmoid anchor + steepness per dimension.
--   3. user_dim_baseline   — per-user robust center + scale per dimension (for Pxx vs you).
--   4. user_intraday_share — per-user fraction of daily token volume contributed in each UTC hour.
--
-- Re-scoring of existing daily_stats happens in the next migration so this file stays
-- pure DDL + seed data.

-- 1. timezone column on users
alter table public.users
  add column if not exists timezone text not null default 'America/New_York';

-- 2. dimension anchors — seeded with values calibrated against Holden's actual
--    14-day data (median heavy day per dim). Anchor is log10(raw_value) for
--    tokens/calls dims; raw for ships+depth which are already small numbers.
--    The sigmoid is: score = 100 / (1 + exp(-k * (input - anchor))).
--    For tokens-style dims, `input` = log10(raw + 1). For ships+depth, `input` = log10(raw + 1) too
--    (uniform pipeline; the anchor compensates).
create table if not exists public.dim_anchor (
  dim text primary key,
  anchor double precision not null,
  k double precision not null,
  notes text,
  updated_at timestamptz not null default now()
);

insert into public.dim_anchor (dim, anchor, k, notes) values
  ('output',    6.0,  1.2,  'log10(1M output tokens) — median heavy day at score 50; 5M ~ 75; 50M ~ 92'),
  ('substance', 7.0,  1.5,  'log10(10M cache_creation) — anchor 50; 100M ~ 82'),
  ('tools',     3.0,  1.5,  'log10(1K tool_calls) — anchor 50; 5K ~ 78'),
  ('ships',     1.7,  1.5,  'log10(50 ship_quality + 1) — anchor 50; 250 ~ 82'),
  ('depth',     2.5,  1.3,  'log10(316 deep_work_minutes + 1) — anchor 50; 600 min ~ 81')
on conflict (dim) do update set
  anchor = excluded.anchor,
  k = excluded.k,
  notes = excluded.notes,
  updated_at = now();

-- 3. per-user personal baselines for "P64 vs you" Pxx labels
create table if not exists public.user_dim_baseline (
  user_id uuid not null references public.users(id) on delete cascade,
  dim text not null,
  m_hat double precision not null,
  s_hat double precision not null,
  n int not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, dim)
);

alter table public.user_dim_baseline enable row level security;

drop policy if exists "user_dim_baseline_select_all" on public.user_dim_baseline;
create policy "user_dim_baseline_select_all" on public.user_dim_baseline
  for select using (true);

-- 4. per-user intraday share curves: fraction of the day's total tokens
--    typically contributed in each UTC hour (avg over last 30 days).
create table if not exists public.user_intraday_share (
  user_id uuid not null references public.users(id) on delete cascade,
  dim text not null,
  hour int not null check (hour between 0 and 23),
  share double precision not null check (share >= 0 and share <= 1),
  updated_at timestamptz not null default now(),
  primary key (user_id, dim, hour)
);

alter table public.user_intraday_share enable row level security;

drop policy if exists "user_intraday_share_select_all" on public.user_intraday_share;
create policy "user_intraday_share_select_all" on public.user_intraday_share
  for select using (true);

-- 5. dim_anchor: public read so client renderers can fetch + reproduce scores
alter table public.dim_anchor enable row level security;

drop policy if exists "dim_anchor_select_all" on public.dim_anchor;
create policy "dim_anchor_select_all" on public.dim_anchor
  for select using (true);
