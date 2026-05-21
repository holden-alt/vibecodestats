-- Add privacy opt-out flag to users.
-- When true, project names are replaced with anonymized labels
-- ("project 1", "project 2", ...) when anyone other than the owner views the profile.
alter table public.users
  add column if not exists private_project_names boolean not null default false;
