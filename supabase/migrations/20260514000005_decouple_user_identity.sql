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
  add column if not exists auth_id uuid references auth.users (id) on delete set null;

-- 3. Backfill: every existing profile's id IS its auth id today.
update public.users set auth_id = id;

-- 4. New profiles get a fresh random id; auth_id is set explicitly by the trigger.
alter table public.users alter column id set default gen_random_uuid();

-- 5. One profile per auth account (nulls allowed, and multiple nulls are fine).
create unique index if not exists users_auth_id_idx on public.users (auth_id) where auth_id is not null;

-- 6. Rewrite the signup trigger to populate auth_id instead of id.
--    The `on conflict (auth_id)` clause below relies on the partial unique index from step 5.
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
drop policy if exists users_update_self on public.users;
create policy users_update_self on public.users for update
  using (auth.uid() = auth_id) with check (auth.uid() = auth_id);
