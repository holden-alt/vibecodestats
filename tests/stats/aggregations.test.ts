import { describe, it, expect } from 'vitest';
import { classifyModel, modelTotals, last30Days, dayOfWeekAverages, hourlyTotals } from '@/lib/stats/aggregations';
import type { DailyStat } from '@/lib/stats/profile-data';

function stat(partial: Partial<DailyStat>): DailyStat {
  return {
    user_id: 'u1',
    date: '2026-05-14',
    tokens_total: 0,
    tokens_by_model: {},
    sessions: 0,
    deep_work_minutes: 0,
    machines: [],
    projects_touched: {},
    ships: {},
    hourly_tokens: {},
    source_synced_at: null,
    ...partial,
  };
}

describe('classifyModel', () => {
  it('classifies opus, sonnet, haiku by substring', () => {
    expect(classifyModel('claude-opus-4-7')).toBe('opus');
    expect(classifyModel('claude-sonnet-4-6')).toBe('sonnet');
    expect(classifyModel('claude-haiku-4-5-20251001')).toBe('haiku');
  });
  it('classifies anything else as other', () => {
    expect(classifyModel('gpt-4o')).toBe('other');
    expect(classifyModel('unknown')).toBe('other');
  });
});

describe('modelTotals', () => {
  it('sums tokens by model class across all stats', () => {
    const stats = [
      stat({ tokens_by_model: { 'claude-opus-4-7': 100, 'claude-sonnet-4-6': 50 } }),
      stat({ tokens_by_model: { 'claude-opus-4-7': 200, 'gpt-4o': 10 } }),
    ];
    expect(modelTotals(stats)).toEqual({ opus: 300, sonnet: 50, haiku: 0, other: 10 });
  });
  it('returns all-zero for empty input', () => {
    expect(modelTotals([])).toEqual({ opus: 0, sonnet: 0, haiku: 0, other: 0 });
  });
});

describe('last30Days', () => {
  it('returns exactly 30 days ending at today, oldest first', () => {
    const days = last30Days([], '2026-05-14');
    expect(days.length).toBe(30);
    expect(days[0]!.date).toBe('2026-04-15');
    expect(days[29]!.date).toBe('2026-05-14');
  });

  it('fills missing days with zeros', () => {
    const days = last30Days([], '2026-05-14');
    expect(days.every((d) => d.tokens === 0 && d.opus === 0)).toBe(true);
  });

  it('maps a present day onto its slot with model breakdown', () => {
    const stats = [
      stat({
        date: '2026-05-14',
        tokens_total: 300,
        tokens_by_model: { 'claude-opus-4-7': 250, 'claude-sonnet-4-6': 50 },
      }),
    ];
    const days = last30Days(stats, '2026-05-14');
    const today = days[29]!;
    expect(today.tokens).toBe(300);
    expect(today.opus).toBe(250);
    expect(today.sonnet).toBe(50);
    expect(today.haiku).toBe(0);
  });

  it('ignores stats outside the 30-day window', () => {
    const stats = [stat({ date: '2026-01-01', tokens_total: 999 })];
    const days = last30Days(stats, '2026-05-14');
    expect(days.some((d) => d.tokens === 999)).toBe(false);
  });
});

describe('dayOfWeekAverages', () => {
  it('returns a length-7 array, index 0 = Sunday', () => {
    expect(dayOfWeekAverages([]).length).toBe(7);
  });

  it('averages tokens per weekday over the days observed', () => {
    // 2026-05-14 is a Thursday (getUTCDay() === 4). 2026-05-07 also Thursday.
    const stats = [
      stat({ date: '2026-05-14', tokens_total: 100 }),
      stat({ date: '2026-05-07', tokens_total: 300 }),
    ];
    const avgs = dayOfWeekAverages(stats);
    expect(avgs[4]!).toBe(200); // (100 + 300) / 2 Thursdays
  });

  it('returns 0 for weekdays with no data', () => {
    const stats = [stat({ date: '2026-05-14', tokens_total: 100 })]; // Thursday only
    const avgs = dayOfWeekAverages(stats);
    expect(avgs[0]!).toBe(0); // Sunday
    expect(avgs[1]!).toBe(0); // Monday
  });

  it('rounds the average to an integer', () => {
    const stats = [
      stat({ date: '2026-05-14', tokens_total: 100 }), // Thursday
      stat({ date: '2026-05-07', tokens_total: 101 }), // Thursday
    ];
    expect(dayOfWeekAverages(stats)[4]!).toBe(101); // round(100.5)
  });
});

describe('hourlyTotals', () => {
  it('returns a length-24 array', () => {
    expect(hourlyTotals([]).length).toBe(24);
  });

  it('sums hourly_tokens across all stats by hour index', () => {
    const stats = [
      stat({ hourly_tokens: { '9': 100, '22': 50 } }),
      stat({ hourly_tokens: { '9': 200, '10': 30 } }),
    ];
    const hours = hourlyTotals(stats);
    expect(hours[9]!).toBe(300);
    expect(hours[10]!).toBe(30);
    expect(hours[22]!).toBe(50);
    expect(hours[0]!).toBe(0);
  });

  it('ignores out-of-range or non-integer hour keys', () => {
    const stats = [stat({ hourly_tokens: { '25': 999, 'x': 999, '-1': 999 } })];
    const hours = hourlyTotals(stats);
    expect(hours.every((n) => n === 0)).toBe(true);
  });
});
