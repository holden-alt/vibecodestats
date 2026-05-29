-- 20260529000017_user_private.sql
-- Owner-only storage for opt-in contact info (PII). NOT on the public users
-- table (which has read=true RLS). Reads gated to the owner via auth.uid();
-- writes happen via the service-role client, which bypasses RLS.

create table if not exists public.user_private (
  user_id uuid primary key references public.users(id) on delete cascade,
  email text,
  email_opt_in boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.user_private enable row level security;

drop policy if exists "user_private_select_own" on public.user_private;
create policy "user_private_select_own" on public.user_private
  for select using (
    exists (
      select 1 from public.users u
      where u.id = user_private.user_id and u.auth_id = auth.uid()
    )
  );

-- No insert/update/delete policy: those happen via service role (bypasses RLS).
revoke insert, update, delete on public.user_private from anon, authenticated;
