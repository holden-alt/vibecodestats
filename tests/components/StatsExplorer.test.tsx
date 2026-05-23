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
    const { container, getByText } = render(
      <StatsExplorer dailyStats={dailyStats} machineStats={machineStats} today="2026-05-14" />,
    );
    expect(container.querySelector('[data-stats-explorer]')).toBeTruthy();
    // trends tab label is visible in the tab control
    expect(getByText('trends')).toBeTruthy();
    // tab + window controls each render their segments
    expect(container.querySelectorAll('[data-segment]').length).toBe(13); // 7 tabs (incl. vbw) + 6 windows
  });

  it('switches to the projects tab and renders project names', () => {
    const { container, getByText } = render(
      <StatsExplorer dailyStats={dailyStats} machineStats={machineStats} today="2026-05-14" />,
    );
    fireEvent.click(container.querySelector('[data-segment="projects"]')!);
    // both projects appear in the body (all-window default)
    const body = container.querySelector('[data-explorer-body]')!;
    expect(body.textContent).toContain('holden-alt/cc-dashboard');
    expect(body.textContent).toContain('realsavvy/agnt-portal');
  });

  it('switches to the machines tab and shows machines sorted by tokens', () => {
    const { container } = render(
      <StatsExplorer dailyStats={dailyStats} machineStats={machineStats} today="2026-05-14" />,
    );
    fireEvent.click(container.querySelector('[data-segment="machines"]')!);
    const body = container.querySelector('[data-explorer-body]')!;
    const text = body.textContent ?? '';
    // iMac (300) should appear before MacBook-Air (100)
    expect(text.indexOf('iMac')).toBeLessThan(text.indexOf('MacBook-Air'));
  });

  it('narrows the data when the window changes to today', () => {
    const { container } = render(
      <StatsExplorer dailyStats={dailyStats} machineStats={machineStats} today="2026-05-14" />,
    );
    fireEvent.click(container.querySelector('[data-segment="projects"]')!);
    const bodyAll = container.querySelector('[data-explorer-body]')!;
    // both projects visible in all window
    expect(bodyAll.textContent).toContain('holden-alt/cc-dashboard');
    expect(bodyAll.textContent).toContain('realsavvy/agnt-portal');

    fireEvent.click(container.querySelector('[data-segment="today"]')!);
    // only 2026-05-14 remains => one project visible
    const bodyToday = container.querySelector('[data-explorer-body]')!;
    expect(bodyToday.textContent).toContain('holden-alt/cc-dashboard');
    expect(bodyToday.textContent).not.toContain('realsavvy/agnt-portal');
  });

  it('renders the time-of-day tab without error', () => {
    const { container } = render(
      <StatsExplorer dailyStats={dailyStats} machineStats={machineStats} today="2026-05-14" />,
    );
    fireEvent.click(container.querySelector('[data-segment="timeofday"]')!);
    // v2 TimeOfDayHistogram renders a Recharts chart; just confirm the body is present
    expect(container.querySelector('[data-explorer-body]')).toBeTruthy();
    expect(container.querySelector('[data-stats-explorer]')).toBeTruthy();
  });
});
