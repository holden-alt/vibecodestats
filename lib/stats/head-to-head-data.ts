import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database';
import type { DailyStat } from '@/lib/stats/profile-data';

export type HeadToHeadUser = {
  id: string;
  github_handle: string;
  display_name: string | null;
};

export type HeadToHeadData = {
  userA: HeadToHeadUser;
  userB: HeadToHeadUser;
  statsA: DailyStat[];
  statsB: DailyStat[];
};

export async function getHeadToHeadData(
  supabase: SupabaseClient<Database>,
  handleA: string,
  handleB: string,
): Promise<HeadToHeadData | null> {
  const { data: users } = await supabase
    .from('users')
    .select('id, github_handle, display_name')
    .in('github_handle', [handleA, handleB]);

  if (!users || users.length < 2) return null;

  const userA = users.find((u) => u.github_handle === handleA);
  const userB = users.find((u) => u.github_handle === handleB);
  if (!userA || !userB) return null;

  const { data: stats } = await supabase
    .from('daily_stats')
    .select('*')
    .in('user_id', [userA.id, userB.id])
    .order('date', { ascending: false });

  const all = (stats ?? []) as DailyStat[];
  return {
    userA,
    userB,
    statsA: all.filter((s) => s.user_id === userA.id),
    statsB: all.filter((s) => s.user_id === userB.id),
  };
}
