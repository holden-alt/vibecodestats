-- Install/ingest telemetry.
--
-- One row per POST /api/ingest attempt so we can answer, for any user:
--   - did they try at all?            -> any ingest_events row
--   - did it work?                    -> outcome = 'success'
--   - did it fail, and why?           -> outcome in (invalid_token, bad_payload, missing_auth, error) + detail
--   - did they never even install?    -> zero ingest_events rows AND zero daily_stats
--
-- Before this, failed pushes left no trace (the route returned 401/405/400
-- silently), so we couldn't tell whether a signup like tej8768 ever ran the
-- installer. This closes that blind spot.

create table if not exists public.ingest_events (
  id           bigint generated always as identity primary key,
  created_at   timestamptz not null default now(),
  user_id      uuid references public.users(id) on delete set null,
  github_handle text,
  machine      text,
  outcome      text not null check (outcome in (
                 'success', 'invalid_token', 'missing_auth', 'bad_payload', 'error'
               )),
  detail       text,
  user_agent   text,
  payload_date date,
  tokens_total bigint
);

create index if not exists idx_ingest_events_created on public.ingest_events (created_at desc);
create index if not exists idx_ingest_events_user    on public.ingest_events (user_id, created_at desc);
create index if not exists idx_ingest_events_outcome on public.ingest_events (outcome, created_at desc);

-- Written by the service-role ingest route only. No public policies => locked
-- down by default; admin reads go through the service role.
alter table public.ingest_events enable row level security;
