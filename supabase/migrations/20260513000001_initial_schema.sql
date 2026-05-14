-- 20260513000001_initial_schema.sql
-- cc-dashboard v1: minimal multi-user-ready schema.

create extension if not exists "pgcrypto";

-- Users mirror auth.users with vibecoder profile fields.
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  github_id bigint unique,
  github_handle text unique not null,
  display_name text,
  avatar_url text,
  primary_persona text,
  secondary_personas text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index users_github_handle_idx on public.users (lower(github_handle));

-- Daily aggregated stats per user.
create table public.daily_stats (
  user_id uuid not null references public.users (id) on delete cascade,
  date date not null,
  tokens_total bigint not null default 0,
  tokens_by_model jsonb not null default '{}'::jsonb,
  sessions integer not null default 0,
  deep_work_minutes integer not null default 0,
  machines text[] not null default '{}',
  projects_touched jsonb not null default '{}'::jsonb,
  ships jsonb not null default '{}'::jsonb,
  source_synced_at timestamptz,
  primary key (user_id, date)
);

create index daily_stats_user_date_idx on public.daily_stats (user_id, date desc);

-- RLS: public read of users/daily_stats (this is a public dashboard).
alter table public.users enable row level security;
alter table public.daily_stats enable row level security;

create policy users_select_all on public.users for select using (true);
create policy daily_stats_select_all on public.daily_stats for select using (true);

-- Only owner can update their own user row.
create policy users_update_self on public.users for update
  using (auth.uid() = id) with check (auth.uid() = id);

-- Writes to daily_stats happen via service_role only (ingestion webhook). No public insert/update policy.

-- Trigger to mirror new auth.users into public.users on signup.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, github_id, github_handle, display_name, avatar_url)
  values (
    new.id,
    nullif(new.raw_user_meta_data->>'provider_id', '')::bigint,
    coalesce(new.raw_user_meta_data->>'user_name', new.raw_user_meta_data->>'preferred_username'),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();
