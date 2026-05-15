import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { HeadToHead } from '@/components/head-to-head/HeadToHead';
import type { HeadToHeadData } from '@/lib/stats/head-to-head-data';
import type { DailyStat } from '@/lib/stats/profile-data';

function stat(partial: Partial<DailyStat>): DailyStat {
  return {
    user_id: 'u1', date: '2026-05-14', tokens_total: 0, tokens_by_model: {},
    sessions: 0, deep_work_minutes: 0, machines: [], projects_touched: {},
    ships: {}, hourly_tokens: {}, source_synced_at: null, ...partial,
  };
}

const data: HeadToHeadData = {
  userA: { id: 'u1', github_handle: 'holden-alt', display_name: 'Holden' },
  userB: { id: 'u2', github_handle: 'mira-builds', display_name: 'Mira' },
  statsA: [stat({ user_id: 'u1', date: '2026-05-14', tokens_total: 100 })],
  statsB: [stat({ user_id: 'u2', date: '2026-05-14', tokens_total: 500 })],
};

describe('HeadToHead', () => {
  it('renders both display names as column headers', () => {
    const { container } = render(<HeadToHead data={data} today="2026-05-14" />);
    expect(container.textContent).toContain('Holden');
    expect(container.textContent).toContain('Mira');
  });

  it('renders exactly five metric rows', () => {
    const { container } = render(<HeadToHead data={data} today="2026-05-14" />);
    expect(container.querySelectorAll('[data-stat-row]').length).toBe(5);
  });

  it('renders the window SegmentedControl', () => {
    const { container } = render(<HeadToHead data={data} today="2026-05-14" />);
    expect(container.querySelector('[data-segment="all"]')).toBeTruthy();
    expect(container.querySelector('[data-segment="week"]')).toBeTruthy();
  });

  it('re-computes when window changes (e.g., switching to "today" keeps only today\'s stats)', () => {
    const dataMulti: HeadToHeadData = {
      ...data,
      statsA: [
        stat({ user_id: 'u1', date: '2026-05-14', tokens_total: 100 }),
        stat({ user_id: 'u1', date: '2026-01-01', tokens_total: 9999 }),
      ],
      statsB: [stat({ user_id: 'u2', date: '2026-05-14', tokens_total: 50 })],
    };
    const { container } = render(<HeadToHead data={dataMulti} today="2026-05-14" />);
    // Initial window = 'all': A has 10099 tokens, B has 50 → A wins
    let aValue = container.querySelector('[data-stat-row][data-metric="tokens"] [data-stat-value="A"]');
    expect(aValue?.getAttribute('data-winner')).toBe('true');
    // Switch to 'today': A has 100, B has 50 → A still wins, but value changes
    fireEvent.click(container.querySelector('[data-segment="today"]')!);
    aValue = container.querySelector('[data-stat-row][data-metric="tokens"] [data-stat-value="A"]');
    expect(aValue?.textContent).toContain('100');
  });
});
