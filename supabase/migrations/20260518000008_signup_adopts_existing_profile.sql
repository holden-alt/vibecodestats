-- 20260518000008_signup_adopts_existing_profile.sql
-- The seed pattern (seed_vibecoders) creates profile rows with auth_id IS NULL,
-- intended to be "adopted" by a real auth user when they later sign in via GitHub.
-- The original trigger only handled the conflict on auth_id, so signup with a
-- matching github_handle would 23505-fail on the users_github_handle_key constraint
-- and break sign-in. Make signup link the new auth user to any existing
-- handle-matching, auth_id-null profile instead of inserting a duplicate.

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
