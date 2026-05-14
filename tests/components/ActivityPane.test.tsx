import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ActivityPane } from '@/components/ActivityPane';
import type { DailyStat } from '@/lib/stats/profile-data';

const stats: DailyStat[] = [
  {
    date: '2026-05-14', user_id: 'u1', tokens_total: 487231,
    tokens_by_model: { 'claude-opus-4-7': 480000, 'claude-sonnet-4-6': 7231 },
    sessions: 6, deep_work_minutes: 240, machines: ['iMac', 'MacBook-Air'],
    projects_touched: {}, ships: { commits: 1, repos: 1 }, hourly_tokens: {}, source_synced_at: null,
  },
];

const baseProps = {
  tokensToday: 487231,
  sessionsToday: 6,
  machinesCount: 2,
  deepWorkMinutes: 240,
  tokensByModel: { 'claude-opus-4-7': 480000, 'claude-sonnet-4-6': 7231 },
  dailyStats: stats,
  today: '2026-05-14',
};

describe('ActivityPane', () => {
  it('renders the real token total', () => {
    render(<ActivityPane {...baseProps} />);
    expect(screen.getByText('487K')).toBeInTheDocument();
  });
  it('renders the machines count', () => {
    render(<ActivityPane {...baseProps} />);
    expect(screen.getByText('2')).toBeInTheDocument();
  });
  it('renders the model stack legend', () => {
    render(<ActivityPane {...baseProps} />);
    expect(screen.getByText(/opus/i)).toBeInTheDocument();
    expect(screen.getByText(/sonnet/i)).toBeInTheDocument();
  });
  it('embeds the heatmap', () => {
    render(<ActivityPane {...baseProps} />);
    expect(screen.getByRole('img', { name: /52-week activity heatmap/i })).toBeInTheDocument();
  });
  it('renders 0 gracefully when there is no data today', () => {
    render(<ActivityPane {...baseProps} tokensToday={0} sessionsToday={0} machinesCount={0}
      deepWorkMinutes={0} tokensByModel={{}} dailyStats={[]} />);
    // tokens, sessions, and machines all render "0" with no data — assert at least one.
    expect(screen.getAllByText('0').length).toBeGreaterThan(0);
  });
});
