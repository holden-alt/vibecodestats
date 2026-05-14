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
