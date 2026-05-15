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
});
