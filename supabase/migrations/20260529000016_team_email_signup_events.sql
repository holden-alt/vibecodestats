-- 20260529000016_team_email_signup_events.sql
-- Team allegiance + email opt-in on users; codify the signup_events table
-- (previously only present in the live project, missing from source control).

-- 1. New columns on users
alter table public.users
  add column if not exists team text
    check (team is null or team in ('claude_code', 'codex')),
  add column if not exists team_switched_at timestamptz,
  add column if not exists email text,
  add column if not exists email_opt_in boolean not null default false;

comment on column public.users.team is 'Chosen allegiance: claude_code | codex (nullable until picked).';
comment on column public.users.team_switched_at is 'Last team switch; enforces 1 switch / 30 days in app.';

-- 2. Codify signup_events (already exists in live project; adding to source control)
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

drop policy if exists "signup_events_select_all" on public.signup_events;
create policy "signup_events_select_all" on public.signup_events
  for select using (true);
