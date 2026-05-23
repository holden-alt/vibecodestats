import type { DailyStat } from '@/lib/stats/profile-data';
import { type StatsWindow, filterByWindow, computeStreak } from '@/lib/stats/aggregations';

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
  groupId?: string; // when scope === 'groups', restricts to this specific group's members
};

// Cumulative metrics sum over the (already window-filtered) stats. Streak is
// handled separately because it is inherently "current streak ending today".
function cumulativeValue(stats: DailyStat[], metric: Exclude<LeaderboardMetric, 'streak'>): number {
  switch (metric) {
    case 'tokens':
      return stats.reduce((s, d) => s + d.tokens_total, 0);
    case 'vbw':
      // For "today" window this just reads today's vbw_total; for longer
      // windows it sums per-day VBW. Cumulative VBW isn't a perfect metric
      // for long windows (each day's score is bounded 0-10K, so a week's
      // ceiling is 70K), but it's the cleanest cross-window ranking — bigger
      // weekly total = more consistently productive days.
      return stats.reduce((s, d) => s + (d.vbw_total ?? 0), 0);
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
  // Ordinal ranking: ties still get distinct sequential ranks (1, 2, 3 — not 1, 1, 3).
  return entries.map((e, i) => ({ ...e, rank: i + 1, isViewer: e.userId === viewerId }));
}
