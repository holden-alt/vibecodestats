-- 20260524000014_remove_seed_users.sql
-- Going solo. Recruit the first real user from here.
-- Removes the five seeded demo vibecoders and "The Squad" group introduced in
-- 20260514000007_seed_vibecoders.sql. User deletes cascade to daily_stats,
-- group_members, and friendships per FK ON DELETE CASCADE.

delete from public.groups where id = '00000000-0000-4000-8000-0000000000b1';
delete from public.users  where auth_id is null;
