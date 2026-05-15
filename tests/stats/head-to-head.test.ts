import { describe, it, expect } from 'vitest';
import { computeHeadToHead } from '@/lib/stats/head-to-head';
import type { HeadToHeadData } from '@/lib/stats/head-to-head-data';
import type { DailyStat } from '@/lib/stats/profile-data';

function stat(partial: Partial<DailyStat>): DailyStat {
  return {
    user_id: 'u1', date: '2026-05-14', tokens_total: 0, tokens_by_model: {},
    sessions: 0, deep_work_minutes: 0, machines: [], projects_touched: {},
    ships: {}, hourly_tokens: {}, source_synced_at: null, ...partial,
  };
}

const baseData: HeadToHeadData = {
  userA: { id: 'u1', github_handle: 'holden-alt', display_name: 'Holden' },
  userB: { id: 'u2', github_handle: 'mira-builds', display_name: 'Mira' },
  statsA: [
    stat({ user_id: 'u1', date: '2026-05-14', tokens_total: 100, sessions: 2,
      deep_work_minutes: 60, ships: { commits: 3 } }),
    stat({ user_id: 'u1', date: '2026-05-13', tokens_total: 50, sessions: 1,
      deep_work_minutes: 30, ships: { commits: 2 } }),
  ],
  statsB: [
    stat({ user_id: 'u2', date: '2026-05-14', tokens_total: 500, sessions: 1,
      deep_work_minutes: 90, ships: { commits: 1 } }),
    stat({ user_id: 'u2', date: '2026-05-13', tokens_total: 200, sessions: 1,
      deep_work_minutes: 60, ships: { commits: 1 } }),
  ],
};

describe('computeHeadToHead', () => {
  it('returns one row per metric in a stable order', () => {
    const rows = computeHeadToHead(baseData, 'all', '2026-05-14');
    expect(rows.map((r) => r.metric)).toEqual(['tokens', 'sessions', 'deepwork', 'streak', 'ships']);
  });

  it('declares the higher value the winner (A or B)', () => {
    const rows = computeHeadToHead(baseData, 'all', '2026-05-14');
    const tokens = rows.find((r) => r.metric === 'tokens')!;
    expect(tokens.valueA).toBe(150);
    expect(tokens.valueB).toBe(700);
    expect(tokens.winner).toBe('B');

    const sessions = rows.find((r) => r.metric === 'sessions')!;
    expect(sessions.valueA).toBe(3);
    expect(sessions.valueB).toBe(2);
    expect(sessions.winner).toBe('A');
  });

  it('marks tie when values are equal', () => {
    const tied: HeadToHeadData = {
      ...baseData,
      statsA: [stat({ user_id: 'u1', date: '2026-05-14', tokens_total: 100 })],
      statsB: [stat({ user_id: 'u2', date: '2026-05-14', tokens_total: 100 })],
    };
    const rows = computeHeadToHead(tied, 'all', '2026-05-14');
    expect(rows.find((r) => r.metric === 'tokens')!.winner).toBe('tie');
  });

  it('respects the time window for cumulative metrics', () => {
    const rows = computeHeadToHead(baseData, 'today', '2026-05-14');
    const tokens = rows.find((r) => r.metric === 'tokens')!;
    // today window keeps only 2026-05-14 rows: u1=100, u2=500
    expect(tokens.valueA).toBe(100);
    expect(tokens.valueB).toBe(500);
  });

  it('streak ignores the time window (uses computeStreak)', () => {
    const streakData: HeadToHeadData = {
      ...baseData,
      // u1: active 05-13 and 05-14 → streak 2
      // u2: active 05-14 only → streak 1
      statsA: [
        stat({ user_id: 'u1', date: '2026-05-14', tokens_total: 100 }),
        stat({ user_id: 'u1', date: '2026-05-13', tokens_total: 50 }),
      ],
      statsB: [stat({ user_id: 'u2', date: '2026-05-14', tokens_total: 500 })],
    };
    const rows = computeHeadToHead(streakData, 'today', '2026-05-14');
    const streak = rows.find((r) => r.metric === 'streak')!;
    expect(streak.valueA).toBe(2);
    expect(streak.valueB).toBe(1);
    expect(streak.winner).toBe('A');
  });

  it('emits 30-element sparkline arrays per user, oldest -> newest, gaps as 0', () => {
    const rows = computeHeadToHead(baseData, 'all', '2026-05-14');
    const tokens = rows.find((r) => r.metric === 'tokens')!;
    expect(tokens.sparkA).toHaveLength(30);
    expect(tokens.sparkB).toHaveLength(30);
    // newest day (index 29) is 2026-05-14
    expect(tokens.sparkA[29]).toBe(100);
    expect(tokens.sparkB[29]).toBe(500);
    // index 28 is 2026-05-13
    expect(tokens.sparkA[28]).toBe(50);
    expect(tokens.sparkB[28]).toBe(200);
    // earlier indices are 0 (no data)
    expect(tokens.sparkA[0]).toBe(0);
    expect(tokens.sparkB[0]).toBe(0);
  });

  it('streak sparkline is the running streak count over the 30 days', () => {
    const streakData: HeadToHeadData = {
      ...baseData,
      // u1: active every day from 05-12 through 05-14 → streak grows 1,2,3 on those days
      statsA: [
        stat({ user_id: 'u1', date: '2026-05-14', tokens_total: 100 }),
        stat({ user_id: 'u1', date: '2026-05-13', tokens_total: 100 }),
        stat({ user_id: 'u1', date: '2026-05-12', tokens_total: 100 }),
      ],
      statsB: [stat({ user_id: 'u2', date: '2026-05-14', tokens_total: 500 })],
    };
    const rows = computeHeadToHead(streakData, 'all', '2026-05-14');
    const streak = rows.find((r) => r.metric === 'streak')!;
    expect(streak.sparkA).toHaveLength(30);
    // day index 29 = 05-14, A's streak ending there = 3
    expect(streak.sparkA[29]).toBe(3);
    expect(streak.sparkA[28]).toBe(2);
    expect(streak.sparkA[27]).toBe(1);
    expect(streak.sparkA[26]).toBe(0);
    expect(streak.sparkB[29]).toBe(1);
    expect(streak.sparkB[28]).toBe(0);
  });
});
