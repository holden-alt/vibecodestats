-- 20260514000002_machine_stats.sql
-- Per-machine daily sub-totals. daily_stats stays the cross-machine rollup;
-- machine_daily_stats holds each machine's own latest cumulative number for the day.

create table public.machine_daily_stats (
  user_id uuid not null references public.users (id) on delete cascade,
  date date not null,
  machine text not null,
  tokens_total bigint not null default 0,
  tokens_by_model jsonb not null default '{}'::jsonb,
  sessions integer not null default 0,
  deep_work_minutes integer not null default 0,
  projects_touched jsonb not null default '{}'::jsonb,
  ships jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, date, machine)
);

create index machine_daily_stats_user_date_idx
  on public.machine_daily_stats (user_id, date desc);

alter table public.machine_daily_stats enable row level security;
create policy machine_daily_stats_select_all
  on public.machine_daily_stats for select using (true);
-- writes via service_role only.
