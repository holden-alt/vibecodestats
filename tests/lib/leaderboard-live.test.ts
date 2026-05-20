import { describe, it, expect } from 'vitest';
import { computeLiveDailyRanking } from '@/lib/stats/leaderboard-live';

const row = (user_id: string, github_handle: string, tokens: number) =>
  ({ user_id, github_handle, tokens_total: tokens });

describe('computeLiveDailyRanking', () => {
  it('ranks users by tokens descending and returns viewer position', () => {
    const rows = [
      row('a', 'alpha', 5000),
      row('b', 'beta', 3000),
      row('c', 'gamma', 1000),
    ];
    const r = computeLiveDailyRanking(rows, 'b');
    expect(r.rank).toBe(2);
    expect(r.total).toBe(3);
    expect(r.percentile).toBeCloseTo(0.66, 1); // 2/3 of users at or above
    expect(r.closestAbove?.handle).toBe('alpha');
    expect(r.closestAbove?.tokensAhead).toBe(2000);
    expect(r.closestBelow?.handle).toBe('gamma');
    expect(r.closestBelow?.tokensBehind).toBe(2000);
  });
  it('handles viewer not in data', () => {
    const rows = [row('a', 'alpha', 5000)];
    const r = computeLiveDailyRanking(rows, 'missing');
    expect(r.rank).toBe(null);
    expect(r.total).toBe(1);
  });
  it('handles empty data', () => {
    const r = computeLiveDailyRanking([], 'a');
    expect(r.rank).toBe(null);
    expect(r.total).toBe(0);
    expect(r.percentile).toBe(0);
  });
  it('marks rank #1 with no closestAbove', () => {
    const rows = [row('a', 'alpha', 5000), row('b', 'beta', 3000)];
    const r = computeLiveDailyRanking(rows, 'a');
    expect(r.rank).toBe(1);
    expect(r.closestAbove).toBe(null);
    expect(r.percentile).toBeCloseTo(1.0, 2);
  });
});
