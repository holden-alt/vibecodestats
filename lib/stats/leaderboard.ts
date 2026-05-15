import type { DailyStat } from '@/lib/stats/profile-data';
import { type StatsWindow, filterByWindow, computeStreak } from '@/lib/stats/aggregations';

export type LeaderboardMetric = 'tokens' | 'sessions' | 'deepwork' | 'streak' | 'ships';
export type LeaderboardScope = 'global' | 'groups' | 'friends';

// What getLeaderboardData (Task 1.3) produces and rankUsers consumes.
export type LeaderboardData = {
  users: { id: string; github_handle: string; display_name: string | null }[];
  statsByUser: Record<string, DailyStat[]>;
  groupMemberUserIds: string[]; // users sharing a group with the viewer (includes the viewer)
  friendUserIds: string[]; // the viewer's friends' user ids
};

export type RankedEntry = {
  userId: string;
  handle: string;
  displayName: string | null;
  value: number;
  rank: number;
  isViewer: boolean;
};

type RankOptions = {
  metric: LeaderboardMetric;
  window: StatsWindow;
  scope: LeaderboardScope;
  viewerId: string;
  today: string;
};

// Cumulative metrics sum over the (already window-filtered) stats. Streak is
// handled separately because it is inherently "current streak ending today".
function cumulativeValue(stats: DailyStat[], metric: Exclude<LeaderboardMetric, 'streak'>): number {
  switch (metric) {
    case 'tokens':
      return stats.reduce((s, d) => s + d.tokens_total, 0);
    case 'sessions':
      return stats.reduce((s, d) => s + d.sessions, 0);
    case 'deepwork':
      return Math.round(stats.reduce((s, d) => s + d.deep_work_minutes, 0) / 60);
    case 'ships':
      return stats.reduce((s, d) => {
        const ships = (d.ships ?? {}) as { commits?: number };
        return s + (ships.commits ?? 0);
      }, 0);
  }
}

function scopedUserIds(data: LeaderboardData, scope: LeaderboardScope, viewerId: string): Set<string> {
  if (scope === 'global') return new Set(data.users.map((u) => u.id));
  if (scope === 'groups') return new Set(data.groupMemberUserIds);
  return new Set([viewerId, ...data.friendUserIds]);
}

export function rankUsers(data: LeaderboardData, opts: RankOptions): RankedEntry[] {
  const { metric, window, scope, viewerId, today } = opts;
  const inScope = scopedUserIds(data, scope, viewerId);

  const entries = data.users
    .filter((u) => inScope.has(u.id))
    .map((u) => {
      const allStats = data.statsByUser[u.id] ?? [];
      const value =
        metric === 'streak'
          ? computeStreak(allStats, today)
          : cumulativeValue(filterByWindow(allStats, today, window), metric);
      return { userId: u.id, handle: u.github_handle, displayName: u.display_name, value };
    });

  entries.sort((a, b) => b.value - a.value);
  return entries.map((e, i) => ({ ...e, rank: i + 1, isViewer: e.userId === viewerId }));
}
