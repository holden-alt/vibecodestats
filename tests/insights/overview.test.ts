import { describe, it, expect } from 'vitest';
import {
  bucketVendorDays,
  buildModelRanking,
  buildShowdown,
  buildVendorDays,
} from '@/lib/insights/compute';
import type { ModelDailyRow, VendorDay } from '@/lib/insights/types';

function md(p: Partial<ModelDailyRow> & Pick<ModelDailyRow, 'date' | 'source' | 'model'>): ModelDailyRow {
  return {
    input_tokens: 0, output_tokens: 0, cache_read_tokens: 0, cache_create_tokens: 0, reasoning_tokens: 0,
    turns: 0, tool_calls: 0, sessions: 0, active_minutes: 0, cost_usd: null, ...p,
  };
}
const day = (date: string, claude: number, codex: number, other = 0): VendorDay => ({ date, claude, codex, other });

describe('buildVendorDays', () => {
  it('splits every token class by vendor and zero-fills through today', () => {
    const rows = [
      md({ date: '2026-10-01', source: 'claude-code', model: 'claude-opus-5-5', input_tokens: 10, cache_read_tokens: 90 }),
      md({ date: '2026-10-01', source: 'codex', model: 'gpt-6.1-sol', output_tokens: 40, reasoning_tokens: 10 }),
      md({ date: '2026-10-03', source: 'grok', model: 'grok-4.6-build', output_tokens: 7 }),
      md({ date: '2026-10-03', source: 'claude-code', model: 'approx-history', cache_read_tokens: 5 }),
    ];
    expect(buildVendorDays(rows, '2026-10-04')).toEqual([
      day('2026-10-01', 100, 50),
      day('2026-10-02', 0, 0),
      day('2026-10-03', 5, 0, 7),
      day('2026-10-04', 0, 0),
    ]);
  });

  it('ignores future rows and returns nothing without usage', () => {
    expect(buildVendorDays([md({ date: '2026-10-09', source: 'codex', model: 'gpt-6-sol', output_tokens: 1 })], '2026-10-04')).toEqual([]);
    expect(buildVendorDays([], '2026-10-04')).toEqual([]);
  });
});

describe('bucketVendorDays', () => {
  // 2026-09-28 is a Monday.
  const days = [
    day('2026-09-28', 10, 30),
    day('2026-09-30', 10, 0),
    day('2026-10-04', 0, 20), // Sunday — closes the first week
    day('2026-10-05', 5, 5), // next Monday
  ];

  it('sums Monday-start weeks and flags the unfinished last week', () => {
    const weeks = bucketVendorDays(days, 'week');
    expect(weeks.map((w) => [w.start, w.end, w.claude, w.codex, w.total, w.partial])).toEqual([
      ['2026-09-28', '2026-10-04', 20, 50, 70, false],
      ['2026-10-05', '2026-10-05', 5, 5, 10, true],
    ]);
    expect(weeks[0]!.codexShare).toBeCloseTo(50 / 70);
    expect(weeks[1]!.codexShare).toBe(0.5);
  });

  it('sums calendar months and flags the month in progress', () => {
    const months = bucketVendorDays(days, 'month');
    expect(months.map((m) => [m.start, m.claude, m.codex, m.partial])).toEqual([
      ['2026-09-01', 20, 30, false],
      ['2026-10-01', 5, 25, true],
    ]);
  });

  it('marks a completed month as complete', () => {
    const months = bucketVendorDays([day('2026-09-01', 1, 0), day('2026-09-30', 1, 1)], 'month');
    expect(months[0]!.partial).toBe(false);
  });

  it('keeps days as days with a null share when neither tool ran', () => {
    const out = bucketVendorDays([day('2026-10-01', 0, 0, 3)], 'day');
    expect(out[0]).toMatchObject({ start: '2026-10-01', total: 3, codexShare: null, partial: false });
  });
});

describe('buildShowdown', () => {
  const days = [day('2026-09-01', 300, 0), day('2026-10-17', 100, 200), day('2026-10-18', 0, 100)];

  it('names the leader and how many times more it was used', () => {
    expect(buildShowdown(days, '2026-10-18', '7d')).toEqual({
      claude: 100, codex: 300, codexShare: 0.75, leader: 'codex', ratio: 3,
    });
  });

  it('reads all time across the full history', () => {
    const all = buildShowdown(days, '2026-10-18', 'all');
    expect(all).toMatchObject({ claude: 400, codex: 300, leader: 'claude' });
    expect(all.ratio).toBeCloseTo(4 / 3);
  });

  it('calls a near tie even and leaves the ratio null when one tool never ran', () => {
    expect(buildShowdown([day('2026-10-18', 100, 102)], '2026-10-18', '7d').leader).toBe('even');
    expect(buildShowdown([day('2026-10-18', 0, 50)], '2026-10-18', '7d')).toMatchObject({ leader: 'codex', ratio: null, codexShare: 1 });
    expect(buildShowdown([], '2026-10-18', '30d')).toMatchObject({ leader: null, ratio: null, codexShare: null });
  });
});

describe('buildModelRanking', () => {
  const rows = [
    md({ date: '2026-10-18', source: 'claude-code', model: 'claude-opus-5-5', cache_read_tokens: 600 }),
    md({ date: '2026-10-18', source: 'codex', model: 'gpt-6.1-sol', output_tokens: 300 }),
    md({ date: '2026-10-17', source: 'codex', model: 'gpt-6-astra', output_tokens: 50 }),
    md({ date: '2026-10-17', source: 'grok', model: 'grok-4.6-build', output_tokens: 30 }),
    md({ date: '2026-05-01', source: 'claude-code', model: 'approx-history', cache_read_tokens: 1000 }),
  ];

  it('ranks models by tokens with vendor, color, and share of the window', () => {
    const r = buildModelRanking(rows, '2026-10-18', 30);
    expect(r.map((m) => [m.model, m.vendor, m.tokens])).toEqual([
      ['claude-opus-5-5', 'anthropic', 600],
      ['gpt-6.1-sol', 'openai', 300],
      ['gpt-6-astra', 'openai', 50],
      ['grok-4.6-build', 'xai', 30],
    ]);
    expect(r[0]!.share).toBeCloseTo(600 / 980);
    expect(r[1]!.label).toBe('GPT 6.1 Sol');
  });

  it('includes restored history all-time under its honest label', () => {
    const r = buildModelRanking(rows, '2026-10-18', null);
    expect(r[0]).toMatchObject({ model: 'approx-history', label: 'claude (unattributed)', vendor: 'anthropic' });
  });

  it('folds the tail into one grey bar instead of a ninth hue', () => {
    const r = buildModelRanking(rows, '2026-10-18', null, 3);
    expect(r).toHaveLength(3);
    expect(r[2]).toMatchObject({ model: 'other', vendor: 'other', label: '3 other models', tokens: 380 });
  });
});
