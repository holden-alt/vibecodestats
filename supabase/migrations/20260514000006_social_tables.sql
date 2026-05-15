-- 20260514000006_social_tables.sql
-- Groups, group memberships, and friendships. All public-read (this is a public
-- dashboard); writes are service_role only in v1 (no creation UI yet — that is v2).

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  color text not null default 'cyan',
  owner_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index group_members_user_idx on public.group_members (user_id);

-- Symmetric friendships: both directions are stored as separate rows.
create table public.friendships (
  user_id uuid not null references public.users (id) on delete cascade,
  friend_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id)
);

create index friendships_friend_idx on public.friendships (friend_id);

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.friendships enable row level security;

create policy groups_select_all on public.groups for select using (true);
create policy group_members_select_all on public.group_members for select using (true);
create policy friendships_select_all on public.friendships for select using (true);
-- writes via service_role only in v1.
