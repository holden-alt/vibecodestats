import { describe, it, expect } from 'vitest';
import { classifyModel, modelTotals } from '@/lib/stats/aggregations';
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
