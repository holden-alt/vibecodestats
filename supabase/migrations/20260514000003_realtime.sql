-- 20260514000003_realtime.sql
-- Add daily_stats to the realtime publication so the profile page gets live updates.
alter publication supabase_realtime add table public.daily_stats;
