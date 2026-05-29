import type { DailyStat } from '@/lib/stats/profile-data';
import { type StatsWindow, filterByWindow, computeStreak, WINDOW_DAYS } from '@/lib/stats/aggregations';
import { type Tier, computeTier } from '@/lib/stats/tier';

export type LeaderboardMetric = 'tokens' | 'vbw' | 'sessions' | 'deepwork' | 'streak' | 'ships';
export type LeaderboardScope = 'global' | 'groups' | 'friends';

// Group with full details + the user ids of its members. Used both for the
// per-group profile sections and for the /groups/:slug route header.
export type Group = {
  id: string;
  slug: string;
  name: string;
  color: string;
  description: string | null;
  memberUserIds: string[];
};

// What getLeaderboardData produces and rankUsers consumes.
export type LeaderboardData = {
  users: { id: string; github_handle: string; display_name: string | null }[];
  statsByUser: Record<string, DailyStat[]>;
  groupMemberUserIds: string[]; // union of all the viewer's groups' members (includes the viewer)
  friendUserIds: string[]; // the viewer's friends' user ids
  viewerGroups: Group[]; // every group the viewer belongs to, with per-group membership
  allTimeByUser: Record<string, number>; // sum of tokens_total across the loaded daily_stats (see STATS_LIMIT note in leaderboard-data.ts) per user
};

export type RankedEntry = {
  userId: string;
  handle: string;
  displayName: string | null;
  value: number;
  rank: number;
  isViewer: boolean;
  tier: Tier;
};

type RankOptions = {
  metric: LeaderboardMetric;
  window: StatsWindow;
  scope: LeaderboardScope;
  viewerId: string;
  today: string;
  groupId?: string; // when scope === 'groups', restricts to this specific group's members
};

// Cumulative metrics sum over the (already window-filtered) stats. Streak is
// handled separately because it is inherently "current streak ending today".
// VBW is the only non-cumulative metric — it's a normalized 0-10K daily score,
// so we take the mean across the full calendar window (rest days included),
// keeping the result on the same 0-10K scale across today/week/month/etc.
function cumulativeValue(
  stats: DailyStat[],
  metric: Exclude<LeaderboardMetric, 'streak'>,
  window: StatsWindow,
  allStatsForUser: DailyStat[],
): number {
  switch (metric) {
    case 'tokens':
      return stats.reduce((s, d) => s + d.tokens_total, 0);
    case 'vbw': {
      // Divisor is the FULL window length (e.g. 7 for week, 30 for month) so
      // that rest days legitimately pull the average down — VBW measures
      // typical daily productivity over the window, not just the days you
      // happened to log activity. For "all", use the user's actual range
      // (earliest stat → today) so we don't divide by years of pre-launch days.
      const sum = stats.reduce((s, d) => s + (d.vbw_total ?? 0), 0);
      let divisor: number;
      if (window === 'all') {
        if (allStatsForUser.length === 0) return 0;
        const dates = allStatsForUser.map((s) => s.date).sort();
        const firstMs = Date.parse(dates[0]! + 'T00:00:00Z');
        const lastMs = Date.parse(dates[dates.length - 1]! + 'T00:00:00Z');
        divisor = Math.max(1, Math.round((lastMs - firstMs) / 86400_000) + 1);
      } else {
        divisor = WINDOW_DAYS[window];
      }
      return Math.round(sum / divisor);
    }
    case 'sessions':
      return stats.reduce((s, d) => s + d.sessions, 0);
    case 'deepwork':
      return Math.round(stats.reduce((s, d) => s + d.deep_work_minutes, 0) / 60);
    case 'ships':
      return stats.reduce((s, d) => {
        const ships = (d.ships ?? {}) as { commits?: number };
        return s + Number(ships.commits ?? 0);
      }, 0);
  }
}

function scopedUserIds(
  data: LeaderboardData,
  scope: LeaderboardScope,
  viewerId: string,
  groupId?: string,
): Set<string> {
  if (scope === 'global') return new Set(data.users.map((u) => u.id));
  if (scope === 'groups') {
    if (groupId) {
      const group = data.viewerGroups.find((g) => g.id === groupId);
      return new Set(group?.memberUserIds ?? []);
    }
    return new Set(data.groupMemberUserIds);
  }
  return new Set([viewerId, ...data.friendUserIds]);
}

export function rankUsers(data: LeaderboardData, opts: RankOptions): RankedEntry[] {
  const { metric, window, scope, viewerId, today, groupId } = opts;
  const inScope = scopedUserIds(data, scope, viewerId, groupId);

  // Tier cohort: all users' all-time token totals (not scope-filtered — tier is a
  // global identity badge, not relative to the current leaderboard scope).
  const cohort = Object.values(data.allTimeByUser);

  const entries = data.users
    .filter((u) => inScope.has(u.id))
    .map((u) => {
      const allStats = data.statsByUser[u.id] ?? [];
      const value =
        metric === 'streak'
          ? computeStreak(allStats, today)
          : cumulativeValue(filterByWindow(allStats, today, window), metric, window, allStats);
      return { userId: u.id, handle: u.github_handle, displayName: u.display_name, value };
    });

  entries.sort((a, b) => b.value - a.value);
  // Ordinal ranking: ties still get distinct sequential ranks (1, 2, 3 — not 1, 1, 3).
  return entries.map((e, i) => ({
    ...e,
    rank: i + 1,
    isViewer: e.userId === viewerId,
    tier: computeTier(data.allTimeByUser[e.userId] ?? 0, cohort).tier,
  }));
}
