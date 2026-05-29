import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database';
import type { DailyStat } from '@/lib/stats/profile-data';
import type { Group, LeaderboardData } from '@/lib/stats/leaderboard';
import { computeAllTimeTotals } from '@/lib/stats/aggregations';

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

  // Viewer's groups (just the ids, used to drive the next two reads).
  const { data: viewerGroupRows } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', viewerId);
  const groupIds = (viewerGroupRows ?? []).map((g) => g.group_id);

  // Group details for those groups, and every member of those groups.
  let groupDetails: Omit<Group, 'memberUserIds'>[] = [];
  let allMembers: { group_id: string; user_id: string }[] = [];
  if (groupIds.length > 0) {
    const { data: groupsData } = await supabase
      .from('groups')
      .select('id, slug, name, color, description')
      .in('id', groupIds);
    groupDetails = groupsData ?? [];
    const { data: members } = await supabase
      .from('group_members')
      .select('group_id, user_id')
      .in('group_id', groupIds);
    allMembers = members ?? [];
  }

  // Per-group membership map for viewerGroups.
  const membersByGroupId = new Map<string, string[]>();
  for (const m of allMembers) {
    const list = membersByGroupId.get(m.group_id) ?? [];
    list.push(m.user_id);
    membersByGroupId.set(m.group_id, list);
  }
  const viewerGroups: Group[] = groupDetails.map((g) => ({
    id: g.id,
    slug: g.slug,
    name: g.name,
    color: g.color,
    description: g.description,
    memberUserIds: membersByGroupId.get(g.id) ?? [],
  }));

  // Union of all members across the viewer's groups (existing groupMemberUserIds shape).
  const groupMemberUserIds = [...new Set(allMembers.map((m) => m.user_id))];

  const { data: friendships } = await supabase
    .from('friendships')
    .select('friend_id')
    .eq('user_id', viewerId);
  const friendUserIds = (friendships ?? []).map((f) => f.friend_id);

  const statsByUser: Record<string, DailyStat[]> = {};
  for (const row of (stats ?? []) as DailyStat[]) {
    (statsByUser[row.user_id] ??= []).push(row);
  }

  // All-time token totals per user — used by rankUsers to compute stable tier badges.
  // NOTE: summed from statsByUser, which is bounded by STATS_LIMIT rows. Exact while total daily_stats rows < STATS_LIMIT (years away at current user count). TODO(perf): replace with an unbounded SUM aggregate (RPC or view) before the cap is reached.
  const allTimeByUser: Record<string, number> = {};
  for (const user of (users ?? [])) {
    allTimeByUser[user.id] = computeAllTimeTotals(statsByUser[user.id] ?? []).tokens;
  }

  return {
    users: users ?? [],
    statsByUser,
    groupMemberUserIds,
    friendUserIds,
    viewerGroups,
    allTimeByUser,
  };
}
