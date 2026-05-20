import { describe, it, expect } from 'vitest';
import {
  computeRollingAverage,
  computeWeekTotal,
  computeMonthTotal,
  computeAllTimeTotals,
  computePersonalBests,
  computeNextMilestone,
} from '@/lib/stats/aggregations';
import type { DailyStat } from '@/lib/stats/profile-data';

const stat = (date: string, tokens: number, sessions = 1, ships = 0): DailyStat => ({
  user_id: 'u1', date, tokens_total: tokens,
  tokens_by_model: {}, sessions, deep_work_minutes: 0, machines: [],
  projects_touched: {}, ships: { commits: ships, repos: 1 },
  hourly_tokens: {}, source_synced_at: null,
} as DailyStat);

describe('computeRollingAverage', () => {
  it('returns the mean of the last N days', () => {
    const stats = [stat('2026-05-19', 100), stat('2026-05-18', 200), stat('2026-05-17', 300)];
    expect(computeRollingAverage(stats, '2026-05-19', 3)).toBe(200);
    expect(computeRollingAverage(stats, '2026-05-19', 1)).toBe(100);
  });
  it('returns 0 when no stats', () => {
    expect(computeRollingAverage([], '2026-05-19', 7)).toBe(0);
  });
});

describe('computeWeekTotal', () => {
  it('sums last 7 days inclusive of anchor', () => {
    const stats = Array.from({ length: 10 }, (_, i) => {
      const d = new Date('2026-05-19T00:00:00Z');
      d.setUTCDate(d.getUTCDate() - i);
      return stat(d.toISOString().slice(0, 10), 1000);
    });
    expect(computeWeekTotal(stats, '2026-05-19')).toBe(7000);
  });
});

describe('computeMonthTotal', () => {
  it('sums rows within the calendar month of the anchor', () => {
    const stats = [
      stat('2026-05-01', 1000), stat('2026-05-15', 2000), stat('2026-05-31', 3000),
      stat('2026-04-30', 500), stat('2026-06-01', 700),
    ];
    expect(computeMonthTotal(stats, '2026-05-19')).toBe(6000);
  });
});

describe('computeAllTimeTotals', () => {
  it('returns lifetime tokens + days active + lifetime ships', () => {
    const stats = [stat('2026-05-19', 500, 1, 3), stat('2026-05-18', 1000, 1, 5)];
    const t = computeAllTimeTotals(stats);
    expect(t.tokens).toBe(1500);
    expect(t.daysActive).toBe(2);
    expect(t.ships).toBe(8);
  });
});

describe('computePersonalBests', () => {
  it('finds the highest tokens day and its date', () => {
    const stats = [stat('2026-05-19', 500), stat('2026-05-18', 9000), stat('2026-05-17', 200)];
    const pb = computePersonalBests(stats);
    expect(pb.bestDayTokens).toBe(9000);
    expect(pb.bestDayDate).toBe('2026-05-18');
  });
  it('finds the most ships in a day', () => {
    const stats = [stat('2026-05-19', 500, 1, 3), stat('2026-05-18', 100, 1, 12)];
    expect(computePersonalBests(stats).bestShipsCount).toBe(12);
  });
});

describe('computeNextMilestone', () => {
  it('returns the next lifetime-token milestone above current', () => {
    expect(computeNextMilestone(820_000).target).toBe(1_000_000);
    expect(computeNextMilestone(2_500_000).target).toBe(5_000_000);
    expect(computeNextMilestone(120_000_000).target).toBeGreaterThan(120_000_000);
  });
  it('returns progress fraction 0..1', () => {
    const m = computeNextMilestone(800_000);
    expect(m.progress).toBeCloseTo(0.8, 1);
  });
});
