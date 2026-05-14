import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { TrendsSection } from '@/components/TrendsSection';
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

describe('TrendsSection', () => {
  it('renders a 30-bar token trend and a 30-column model area chart', () => {
    const stats = [
      stat({ date: '2026-05-14', tokens_total: 300, tokens_by_model: { 'claude-opus-4-7': 300 } }),
    ];
    const { container } = render(<TrendsSection dailyStats={stats} today="2026-05-14" />);
    expect(container.querySelectorAll('[data-bar]').length).toBe(30);
    expect(container.querySelectorAll('[data-col]').length).toBe(30);
  });

  it('renders without crashing on empty stats', () => {
    const { container } = render(<TrendsSection dailyStats={[]} today="2026-05-14" />);
    expect(container.querySelectorAll('[data-bar]').length).toBe(30);
  });
});
