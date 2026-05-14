import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { StatsExplorer } from '@/components/StatsExplorer';
import type { DailyStat, MachineDailyStat } from '@/lib/stats/profile-data';

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

function machineStat(partial: Partial<MachineDailyStat>): MachineDailyStat {
  return {
    user_id: 'u1',
    date: '2026-05-14',
    machine: 'iMac',
    tokens_total: 0,
    tokens_by_model: {},
    sessions: 0,
    deep_work_minutes: 0,
    projects_touched: {},
    ships: {},
    hourly_tokens: {},
    updated_at: '2026-05-14T12:00:00Z',
    ...partial,
  };
}

const dailyStats: DailyStat[] = [
  stat({
    date: '2026-05-14',
    tokens_total: 300,
    tokens_by_model: { 'claude-opus-4-7': 300 },
    hourly_tokens: { '14': 300 },
    projects_touched: { 'holden-alt/cc-dashboard': 300 },
  }),
  stat({
    date: '2026-05-01',
    tokens_total: 100,
    tokens_by_model: { 'claude-sonnet-4-6': 100 },
    hourly_tokens: { '9': 100 },
    projects_touched: { 'realsavvy/agnt-portal': 100 },
  }),
];

const machineStats: MachineDailyStat[] = [
  machineStat({ date: '2026-05-14', machine: 'iMac', tokens_total: 300 }),
  machineStat({ date: '2026-05-01', machine: 'MacBook-Air', tokens_total: 100 }),
];

describe('StatsExplorer', () => {
  it('renders with the trends tab active by default', () => {
    const { container } = render(
      <StatsExplorer dailyStats={dailyStats} machineStats={machineStats} today="2026-05-14" />,
    );
    expect(container.querySelector('[data-stats-explorer]')).toBeTruthy();
    // trends tab => TokenTrendChart bars
    expect(container.querySelectorAll('[data-explorer-body] [data-bar]').length).toBeGreaterThan(0);
    // tab + window controls each render their segments
    expect(container.querySelectorAll('[data-segment]').length).toBe(12); // 6 tabs + 6 windows
  });

  it('switches to the projects tab and renders a RankedBarList', () => {
    const { container } = render(
      <StatsExplorer dailyStats={dailyStats} machineStats={machineStats} today="2026-05-14" />,
    );
    fireEvent.click(container.querySelector('[data-segment="projects"]')!);
    const rows = container.querySelectorAll('[data-explorer-body] [data-row]');
    expect(rows.length).toBe(2); // both projects, all-window default
  });

  it('switches to the machines tab and ranks machines by tokens', () => {
    const { container } = render(
      <StatsExplorer dailyStats={dailyStats} machineStats={machineStats} today="2026-05-14" />,
    );
    fireEvent.click(container.querySelector('[data-segment="machines"]')!);
    const labels = Array.from(
      container.querySelectorAll('[data-explorer-body] [data-row]'),
    ).map((r) => r.getAttribute('data-label'));
    expect(labels).toEqual(['iMac', 'MacBook-Air']); // 300 > 100
  });

  it('narrows the data when the window changes to today', () => {
    const { container } = render(
      <StatsExplorer dailyStats={dailyStats} machineStats={machineStats} today="2026-05-14" />,
    );
    fireEvent.click(container.querySelector('[data-segment="projects"]')!);
    expect(container.querySelectorAll('[data-explorer-body] [data-row]').length).toBe(2);
    fireEvent.click(container.querySelector('[data-segment="today"]')!);
    // only 2026-05-14 remains => one project
    const rows = container.querySelectorAll('[data-explorer-body] [data-row]');
    expect(rows.length).toBe(1);
    expect(rows[0]?.getAttribute('data-label')).toBe('holden-alt/cc-dashboard');
  });

  it('renders the time-of-day tab as a 24-bar histogram', () => {
    const { container } = render(
      <StatsExplorer dailyStats={dailyStats} machineStats={machineStats} today="2026-05-14" />,
    );
    fireEvent.click(container.querySelector('[data-segment="timeofday"]')!);
    expect(container.querySelectorAll('[data-explorer-body] [data-hour]').length).toBe(24);
  });
});
