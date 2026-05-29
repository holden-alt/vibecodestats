-- 20260529000016_team_and_signup_lockdown.sql
-- Team allegiance on users (public, shown on cards/leaderboard) + lock down the
-- signup_events telemetry table.
--
-- NOTE: contact-PII columns are intentionally NOT added here. public.users has a
-- public (read=true) RLS policy, so any PII placed on it is readable with the anon
-- key. Opt-in contact storage is deferred to Phase 3 in a separate owner-only
-- `user_private` table. This migration adds only non-sensitive, public-by-design
-- columns.

-- 1. Team allegiance columns on users (public by design)
alter table public.users
  add column if not exists team text
    check (team is null or team in ('claude_code', 'codex')),
  add column if not exists team_switched_at timestamptz;

comment on column public.users.team is 'Chosen allegiance: claude_code | codex (nullable until picked). Public.';
comment on column public.users.team_switched_at is 'Last team switch; enforces 1 switch / 30 days in app.';

-- 2. Lock down signup_events. It ALREADY EXISTS in the live project with RLS
-- DISABLED (anon key could read AND modify all rows of funnel telemetry). Enable
-- RLS and grant NO public policy: reads (admin dashboard) and writes (signup
-- logger) both use the service-role client, which bypasses RLS entirely.
-- The CREATE is a safe no-op against the existing live table.
create table if not exists public.signup_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_type text not null,
  auth_user_id uuid,
  user_id uuid references public.users(id) on delete set null,
  github_handle text,
  user_agent text,
  referer text,
  error_message text,
  is_new_user boolean,
  metadata jsonb not null default '{}'
);

create index if not exists signup_events_created_at_idx on public.signup_events (created_at desc);

alter table public.signup_events enable row level security;

-- Remove any pre-existing public read policy and revoke direct grants from the
-- anon/authenticated roles. Service role bypasses RLS, so the admin page and the
-- signup logger keep working; nothing else reads this table.
drop policy if exists "signup_events_select_all" on public.signup_events;
revoke select on public.signup_events from anon, authenticated;
