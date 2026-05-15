import { describe, it, expect } from 'vitest';
import { rankUsers, type LeaderboardData } from '@/lib/stats/leaderboard';
import type { DailyStat } from '@/lib/stats/profile-data';

function stat(partial: Partial<DailyStat>): DailyStat {
  return {
    user_id: 'u1', date: '2026-05-14', tokens_total: 0, tokens_by_model: {},
    sessions: 0, deep_work_minutes: 0, machines: [], projects_touched: {},
    ships: {}, hourly_tokens: {}, source_synced_at: null, ...partial,
  };
}

const data: LeaderboardData = {
  users: [
    { id: 'u1', github_handle: 'holden-alt', display_name: 'Holden' },
    { id: 'u2', github_handle: 'mira-builds', display_name: 'Mira' },
    { id: 'u3', github_handle: 'devon-ships', display_name: 'Devon' },
  ],
  statsByUser: {
    u1: [stat({ user_id: 'u1', date: '2026-05-14', tokens_total: 100, sessions: 2 })],
    u2: [stat({ user_id: 'u2', date: '2026-05-14', tokens_total: 500, sessions: 1 })],
    u3: [stat({ user_id: 'u3', date: '2026-05-14', tokens_total: 300, sessions: 9 })],
  },
  groupMemberUserIds: ['u1', 'u2'],
  friendUserIds: ['u3'],
  viewerGroups: [],
};

describe('rankUsers', () => {
  it('ranks all users by tokens descending for the global scope', () => {
    const ranked = rankUsers(data, {
      metric: 'tokens', window: 'all', scope: 'global', viewerId: 'u1', today: '2026-05-14',
    });
    expect(ranked.map((r) => r.handle)).toEqual(['mira-builds', 'devon-ships', 'holden-alt']);
    expect(ranked[0]!.rank).toBe(1);
    expect(ranked[2]!.rank).toBe(3);
  });

  it('marks the viewer', () => {
    const ranked = rankUsers(data, {
      metric: 'tokens', window: 'all', scope: 'global', viewerId: 'u1', today: '2026-05-14',
    });
    expect(ranked.find((r) => r.handle === 'holden-alt')!.isViewer).toBe(true);
    expect(ranked.find((r) => r.handle === 'mira-builds')!.isViewer).toBe(false);
  });

  it('restricts to group members for the groups scope', () => {
    const ranked = rankUsers(data, {
      metric: 'tokens', window: 'all', scope: 'groups', viewerId: 'u1', today: '2026-05-14',
    });
    expect(ranked.map((r) => r.handle).sort()).toEqual(['holden-alt', 'mira-builds']);
  });

  it('restricts to the viewer plus friends for the friends scope', () => {
    const ranked = rankUsers(data, {
      metric: 'tokens', window: 'all', scope: 'friends', viewerId: 'u1', today: '2026-05-14',
    });
    expect(ranked.map((r) => r.handle).sort()).toEqual(['devon-ships', 'holden-alt']);
  });

  it('ranks by sessions when the metric is sessions', () => {
    const ranked = rankUsers(data, {
      metric: 'sessions', window: 'all', scope: 'global', viewerId: 'u1', today: '2026-05-14',
    });
    expect(ranked.map((r) => r.handle)).toEqual(['devon-ships', 'holden-alt', 'mira-builds']);
  });

  it('respects the time window for cumulative metrics', () => {
    const windowed: LeaderboardData = {
      ...data,
      statsByUser: {
        u1: [
          stat({ user_id: 'u1', date: '2026-05-14', tokens_total: 10 }),
          stat({ user_id: 'u1', date: '2026-01-01', tokens_total: 9999 }),
        ],
        u2: [stat({ user_id: 'u2', date: '2026-05-14', tokens_total: 50 })],
        u3: [stat({ user_id: 'u3', date: '2026-05-14', tokens_total: 30 })],
      },
    };
    const ranked = rankUsers(windowed, {
      metric: 'tokens', window: 'today', scope: 'global', viewerId: 'u1', today: '2026-05-14',
    });
    // the 2026-01-01 row is outside the 'today' window, so u1 = 10
    expect(ranked.find((r) => r.handle === 'holden-alt')!.value).toBe(10);
    expect(ranked[0]!.handle).toBe('mira-builds'); // 50 > 30 > 10
  });

  it('ranks by streak, ignoring the time window', () => {
    const streakData: LeaderboardData = {
      ...data,
      statsByUser: {
        // u1: active 05-14 and 05-13 -> streak 2
        u1: [
          stat({ user_id: 'u1', date: '2026-05-14', tokens_total: 100 }),
          stat({ user_id: 'u1', date: '2026-05-13', tokens_total: 100 }),
        ],
        // u2: active 05-14 only -> streak 1
        u2: [stat({ user_id: 'u2', date: '2026-05-14', tokens_total: 100 })],
        // u3: active 05-10 only, nothing recent -> streak 0
        u3: [stat({ user_id: 'u3', date: '2026-05-10', tokens_total: 100 })],
      },
    };
    // window 'today' is passed but streak must ignore it (u1 still = 2, not 1)
    const ranked = rankUsers(streakData, {
      metric: 'streak', window: 'today', scope: 'global', viewerId: 'u1', today: '2026-05-14',
    });
    expect(ranked.map((r) => r.handle)).toEqual(['holden-alt', 'mira-builds', 'devon-ships']);
    expect(ranked.find((r) => r.handle === 'holden-alt')!.value).toBe(2);
    expect(ranked.find((r) => r.handle === 'devon-ships')!.value).toBe(0);
  });

  it('ranks by deepwork hours (minutes / 60, rounded)', () => {
    const dwData: LeaderboardData = {
      ...data,
      statsByUser: {
        u1: [stat({ user_id: 'u1', date: '2026-05-14', deep_work_minutes: 120 })], // 2h
        u2: [stat({ user_id: 'u2', date: '2026-05-14', deep_work_minutes: 200 })], // round(3.33) = 3h
        u3: [stat({ user_id: 'u3', date: '2026-05-14', deep_work_minutes: 45 })],  // round(0.75) = 1h
      },
    };
    const ranked = rankUsers(dwData, {
      metric: 'deepwork', window: 'all', scope: 'global', viewerId: 'u1', today: '2026-05-14',
    });
    expect(ranked.map((r) => r.handle)).toEqual(['mira-builds', 'holden-alt', 'devon-ships']);
    expect(ranked.find((r) => r.handle === 'mira-builds')!.value).toBe(3);
    expect(ranked.find((r) => r.handle === 'devon-ships')!.value).toBe(1);
  });

  it('ranks by ships (commits from the ships jsonb)', () => {
    const shipsData: LeaderboardData = {
      ...data,
      statsByUser: {
        u1: [stat({ user_id: 'u1', date: '2026-05-14', ships: { commits: 5, repos: 1 } })],
        u2: [stat({ user_id: 'u2', date: '2026-05-14', ships: { commits: 1, repos: 1 } })],
        u3: [stat({ user_id: 'u3', date: '2026-05-14', ships: { commits: 10, repos: 2 } })],
      },
    };
    const ranked = rankUsers(shipsData, {
      metric: 'ships', window: 'all', scope: 'global', viewerId: 'u1', today: '2026-05-14',
    });
    expect(ranked.map((r) => r.handle)).toEqual(['devon-ships', 'holden-alt', 'mira-builds']);
    expect(ranked.find((r) => r.handle === 'devon-ships')!.value).toBe(10);
  });

  // groupId scoping tests
  const dataWithTwoGroups: LeaderboardData = {
    ...data,
    viewerGroups: [
      { id: 'g1', slug: 'squad', name: 'Squad', color: 'cyan', description: null, memberUserIds: ['u1', 'u2'] },
      { id: 'g2', slug: 'opus-club', name: 'Opus Club', color: 'orange', description: null, memberUserIds: ['u1', 'u3'] },
    ],
  };

  it('with groupId, restricts scope to that specific group\'s members only', () => {
    const ranked = rankUsers(dataWithTwoGroups, {
      metric: 'tokens', window: 'all', scope: 'groups', viewerId: 'u1', today: '2026-05-14',
      groupId: 'g1',
    });
    expect(ranked.map((r) => r.handle).sort()).toEqual(['holden-alt', 'mira-builds']);
  });

  it('with a different groupId, restricts to that group\'s members instead', () => {
    const ranked = rankUsers(dataWithTwoGroups, {
      metric: 'tokens', window: 'all', scope: 'groups', viewerId: 'u1', today: '2026-05-14',
      groupId: 'g2',
    });
    expect(ranked.map((r) => r.handle).sort()).toEqual(['devon-ships', 'holden-alt']);
  });

  it('with groupId pointing at an unknown group, returns an empty list', () => {
    const ranked = rankUsers(dataWithTwoGroups, {
      metric: 'tokens', window: 'all', scope: 'groups', viewerId: 'u1', today: '2026-05-14',
      groupId: 'g-nonexistent',
    });
    expect(ranked).toEqual([]);
  });

  it('without groupId, falls back to existing groups behavior (union of all viewer groups)', () => {
    const ranked = rankUsers(dataWithTwoGroups, {
      metric: 'tokens', window: 'all', scope: 'groups', viewerId: 'u1', today: '2026-05-14',
      // no groupId
    });
    // groupMemberUserIds = ['u1', 'u2'] in the base fixture (still the union shape from getLeaderboardData)
    expect(ranked.map((r) => r.handle).sort()).toEqual(['holden-alt', 'mira-builds']);
  });

  it('groupId is ignored for non-groups scopes', () => {
    const ranked = rankUsers(dataWithTwoGroups, {
      metric: 'tokens', window: 'all', scope: 'global', viewerId: 'u1', today: '2026-05-14',
      groupId: 'g1', // should have no effect
    });
    expect(ranked.map((r) => r.handle).sort()).toEqual(['devon-ships', 'holden-alt', 'mira-builds']);
  });
});
