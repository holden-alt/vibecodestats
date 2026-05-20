-- 20260520000010_fix_signup_trigger.sql
-- Two bugs in the signup trigger surfaced during E2E new-user testing:
--
-- 1. The `ingest_token` column default + the trigger both used `gen_random_bytes(24)`
--    unqualified. pgcrypto lives in the `extensions` schema, and the trigger's
--    `search_path = public` couldn't find it. Every brand-new sign-in failed with
--    SQLSTATE 42883 ("function gen_random_bytes(integer) does not exist").
--
-- 2. The INSERT used `on conflict (auth_id) do nothing`, but `auth_id` has only
--    a PARTIAL unique index (`where auth_id is not null` from migration 5).
--    Postgres can't use a partial index for ON CONFLICT, so every brand-new
--    sign-in also failed with SQLSTATE 42P10. The UPDATE branch above the
--    INSERT already handles the existing-profile case, so the ON CONFLICT
--    clause was redundant and can be dropped.
--
-- These bugs only manifested on the INSERT branch (truly brand-new sign-ins).
-- The UPDATE branch (adopting an existing profile row, e.g. holden-alt's
-- pre-seeded row) was unaffected, which is why the bugs went unnoticed until
-- E2E testing of new-user onboarding.

alter table public.users
  alter column ingest_token set default encode(extensions.gen_random_bytes(24), 'hex');

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
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
         ingest_token = coalesce(ingest_token, encode(extensions.gen_random_bytes(24), 'hex')),
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
  );
  return new;
end;
$$;
