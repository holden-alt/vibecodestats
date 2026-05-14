import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ChartsSection } from '@/components/ChartsSection';
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

describe('ChartsSection', () => {
  it('renders the donut, day-of-week chart, and time-of-day histogram', () => {
    const stats = [
      stat({
        date: '2026-05-14',
        tokens_total: 300,
        tokens_by_model: { 'claude-opus-4-7': 300 },
        hourly_tokens: { '14': 300 },
      }),
    ];
    const { container } = render(<ChartsSection dailyStats={stats} />);
    expect(container.querySelector('[data-donut]')).toBeTruthy();
    expect(container.querySelectorAll('[data-day]').length).toBe(7);
    expect(container.querySelectorAll('[data-hour]').length).toBe(24);
  });

  it('renders without crashing on empty stats', () => {
    const { container } = render(<ChartsSection dailyStats={[]} />);
    expect(container.querySelector('[data-donut]')).toBeTruthy();
  });
});
