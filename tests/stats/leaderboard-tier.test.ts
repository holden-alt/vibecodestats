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

// u1: 10_000_000 tokens (top 1% of 4 → S tier)
// u2:  5_000_000 tokens (2nd of 4 → A tier)
// u3:    100_000 tokens (3rd of 4 → B tier)
// u4:          1 token  (4th of 4 → D tier)
// Percentiles relative to 4-user cohort (all-time):
//   u1: 0/4 = 0.00   → S  (< 1%)
//   u2: 1/4 = 0.25   → B  (< 40%) — NOTE: 1 user strictly ahead
//   u3: 2/4 = 0.50   → C  (< 75%) — NOTE: 2 users strictly ahead
//   u4: 3/4 = 0.75   → D  (= 75%, which is NOT < 75%, falls to D)

const tierData: LeaderboardData = {
  users: [
    { id: 'u1', github_handle: 'alpha', display_name: 'Alpha' },
    { id: 'u2', github_handle: 'beta', display_name: 'Beta' },
    { id: 'u3', github_handle: 'gamma', display_name: 'Gamma' },
    { id: 'u4', github_handle: 'delta', display_name: 'Delta' },
  ],
  statsByUser: {
    u1: [stat({ user_id: 'u1', date: '2026-05-14', tokens_total: 10_000_000 })],
    u2: [stat({ user_id: 'u2', date: '2026-05-14', tokens_total: 5_000_000 })],
    u3: [stat({ user_id: 'u3', date: '2026-05-14', tokens_total: 100_000 })],
    u4: [stat({ user_id: 'u4', date: '2026-05-14', tokens_total: 1 })],
  },
  groupMemberUserIds: [],
  friendUserIds: [],
  viewerGroups: [],
  allTimeByUser: {
    u1: 10_000_000,
    u2: 5_000_000,
    u3: 100_000,
    u4: 1,
  },
};

describe('rankUsers — tier badges', () => {
  it('attaches a tier to every RankedEntry', () => {
    const ranked = rankUsers(tierData, {
      metric: 'tokens', window: 'all', scope: 'global', viewerId: 'u1', today: '2026-05-14',
    });
    for (const entry of ranked) {
      expect(entry.tier).toBeDefined();
    }
  });

  it('gives the highest all-time user an S tier', () => {
    const ranked = rankUsers(tierData, {
      metric: 'tokens', window: 'all', scope: 'global', viewerId: 'u1', today: '2026-05-14',
    });
    const alpha = ranked.find((r) => r.handle === 'alpha');
    expect(alpha?.tier).toBe('S');
  });

  it('tier is computed from all-time tokens even when the window filters to a different leader', () => {
    // Use a 'today' window so the current-window ranking differs, but tier must
    // still reflect the all-time cohort.
    const shortWindow: LeaderboardData = {
      ...tierData,
      statsByUser: {
        // u3 leads today, but u1 still has more all-time → u1 stays S
        u1: [
          stat({ user_id: 'u1', date: '2026-05-14', tokens_total: 50 }),
          stat({ user_id: 'u1', date: '2026-05-01', tokens_total: 9_999_950 }), // old days
        ],
        u2: [stat({ user_id: 'u2', date: '2026-05-14', tokens_total: 200 })],
        u3: [
          stat({ user_id: 'u3', date: '2026-05-14', tokens_total: 1000 }), // today leader
          stat({ user_id: 'u3', date: '2026-05-01', tokens_total: 99_000 }),
        ],
        u4: [stat({ user_id: 'u4', date: '2026-05-14', tokens_total: 1 })],
      },
      // allTimeByUser is fixed — does NOT change with statsByUser override above;
      // tests that rankUsers reads tier from allTimeByUser, not from the window.
    };
    const ranked = rankUsers(shortWindow, {
      metric: 'tokens', window: 'today', scope: 'global', viewerId: 'u1', today: '2026-05-14',
    });
    const alpha = ranked.find((r) => r.handle === 'alpha');
    expect(alpha?.tier).toBe('S');
  });

  it('assigns handcoder tier to users with zero all-time tokens', () => {
    const withHandcoder: LeaderboardData = {
      ...tierData,
      users: [...tierData.users, { id: 'u5', github_handle: 'handcoder', display_name: 'Zero' }],
      statsByUser: {
        ...tierData.statsByUser,
        u5: [],
      },
      allTimeByUser: {
        ...tierData.allTimeByUser,
        u5: 0,
      },
    };
    const ranked = rankUsers(withHandcoder, {
      metric: 'tokens', window: 'all', scope: 'global', viewerId: 'u1', today: '2026-05-14',
    });
    const handcoder = ranked.find((r) => r.handle === 'handcoder');
    expect(handcoder?.tier).toBe('handcoder');
  });
});
