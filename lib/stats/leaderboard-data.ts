import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database';
import type { DailyStat } from '@/lib/stats/profile-data';
import type { LeaderboardData } from '@/lib/stats/leaderboard';

const STATS_LIMIT = 4000; // ~6 users x ~hundreds of days of headroom for v1

export async function getLeaderboardData(
  supabase: SupabaseClient<Database>,
  viewerId: string,
): Promise<LeaderboardData> {
  const { data: users } = await supabase
    .from('users')
    .select('id, github_handle, display_name');

  const { data: stats } = await supabase
    .from('daily_stats')
    .select('*')
    .order('date', { ascending: false })
    .limit(STATS_LIMIT);

  // The viewer's groups, then every member of those groups.
  const { data: viewerGroups } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', viewerId);
  const groupIds = (viewerGroups ?? []).map((g) => g.group_id);

  let groupMemberUserIds: string[] = [];
  if (groupIds.length > 0) {
    const { data: members } = await supabase
      .from('group_members')
      .select('user_id')
      .in('group_id', groupIds);
    groupMemberUserIds = [...new Set((members ?? []).map((m) => m.user_id))];
  }

  const { data: friendships } = await supabase
    .from('friendships')
    .select('friend_id')
    .eq('user_id', viewerId);
  const friendUserIds = (friendships ?? []).map((f) => f.friend_id);

  const statsByUser: Record<string, DailyStat[]> = {};
  for (const row of (stats ?? []) as DailyStat[]) {
    (statsByUser[row.user_id] ??= []).push(row);
  }

  return {
    users: users ?? [],
    statsByUser,
    groupMemberUserIds,
    friendUserIds,
  };
}
