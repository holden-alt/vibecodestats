-- 20260520000009_ingest_tokens.sql
-- Per-user ingest token replaces the shared HMAC secret. New users get one
-- automatically on signup; existing users get backfilled with random tokens.

create extension if not exists "pgcrypto";

alter table public.users
  add column if not exists ingest_token text unique;

-- Backfill: every existing user gets a random token.
update public.users
   set ingest_token = encode(gen_random_bytes(24), 'hex')
 where ingest_token is null;

-- After backfill the column is safe to require.
alter table public.users
  alter column ingest_token set not null;

-- Default for new inserts.
alter table public.users
  alter column ingest_token set default encode(gen_random_bytes(24), 'hex');

-- Update the signup trigger to ensure ingest_token is populated even on the
-- adopt-existing-profile branch.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_handle text;
begin
  v_handle := coalesce(
    new.raw_user_meta_data->>'user_name',
    new.raw_user_meta_data->>'preferred_username'
  );

  update public.users
     set auth_id = new.id,
         github_id = coalesce(
           github_id,
           nullif(new.raw_user_meta_data->>'provider_id', '')::bigint
         ),
         display_name = coalesce(
           display_name,
           new.raw_user_meta_data->>'full_name',
           new.raw_user_meta_data->>'name'
         ),
         avatar_url = coalesce(avatar_url, new.raw_user_meta_data->>'avatar_url'),
         ingest_token = coalesce(ingest_token, encode(gen_random_bytes(24), 'hex')),
         updated_at = now()
   where github_handle = v_handle
     and auth_id is null;
  if found then return new; end if;

  insert into public.users (auth_id, github_id, github_handle, display_name, avatar_url)
  values (
    new.id,
    nullif(new.raw_user_meta_data->>'provider_id', '')::bigint,
    v_handle,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (auth_id) do nothing;
  return new;
end;
$$;
