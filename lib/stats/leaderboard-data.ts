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

// Daily Team Scoreboard aggregation (Phase 5 T3). PURE, no new DB query.
// Reuses the already-loaded leaderboardData.statsByUser. For each loaded user
// it pulls the single daily_stats row matching `date` and returns that row's
// tokens_by_model map (null when the user has no row for the day). The result
// feeds campScoreboard() in lib/stats/team.ts to derive the claude/codex split.
//
// NOTE: statsByUser is bounded by the same STATS_LIMIT ceiling documented at
// the allTimeByUser comment above. If a user's today-row was trimmed by the
// limit, their split is simply absent from the daily scoreboard, identical
// boundedness to the existing leaderboard, acceptable at current scale.
export function getTeamScoreboardMaps(
  data: LeaderboardData,
  date: string,
): Array<Record<string, number> | null> {
  return Object.values(data.statsByUser).map((rows) => {
    const row = rows.find((r) => r.date === date);
    if (!row) return null;
    return (row.tokens_by_model ?? null) as Record<string, number> | null;
  });
}

// All-time variant of the scoreboard maps (Phase 5 / Task 3 toggle). For each
// loaded user it merges every loaded daily row's tokens_by_model into a single
// per-model total, so the resulting maps feed campScoreboard() exactly like the
// daily path does — but over the user's entire (loaded) history rather than one
// day. The daily view stays the DEFAULT because it visibly swings through the
// day; this powers the optional all-time toggle.
//
// Same STATS_LIMIT boundedness as allTimeByUser / the daily helper above:
// "all-time" here means "over the loaded rows", exact while total rows < cap.
export function getTeamScoreboardMapsAllTime(
  data: LeaderboardData,
): Array<Record<string, number> | null> {
  return Object.values(data.statsByUser).map((rows) => {
    const merged: Record<string, number> = {};
    let any = false;
    for (const row of rows) {
      const byModel = (row.tokens_by_model ?? null) as Record<string, number> | null;
      if (!byModel) continue;
      for (const [model, count] of Object.entries(byModel)) {
        merged[model] = (merged[model] ?? 0) + (Number(count) || 0);
        any = true;
      }
    }
    return any ? merged : null;
  });
}
