-- 20260529000018_lock_team_columns.sql
-- Close the team-switch bypass. The users_update_self RLS policy (migration
-- 20260514000005) lets a signed-in user update their OWN row via the browser
-- anon key, which let them rewrite team / team_switched_at directly and bypass
-- the 1-switch-per-30-days rule enforced by the service-role /api/team and
-- /api/onboarding endpoints.
--
-- Fix at the data layer with column-level UPDATE privileges: the authenticated
-- role may self-update ONLY the two columns the user-client routes legitimately
-- touch (private_project_names via /api/me/privacy, ingest_token via
-- /api/me/regenerate-token). All other columns -- including team and
-- team_switched_at -- can only be written by the service role (which bypasses
-- both column grants and RLS), so the cooldown is enforced for real.
--
-- Non-destructive: privilege change only, no schema/data change. Idempotent.

revoke update on public.users from anon;
revoke update on public.users from authenticated;
grant update (private_project_names, ingest_token) on public.users to authenticated;
