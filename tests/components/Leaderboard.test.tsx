import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { Leaderboard } from '@/components/leaderboard/Leaderboard';
import type { LeaderboardData } from '@/lib/stats/leaderboard';
import type { DailyStat } from '@/lib/stats/profile-data';

function stat(partial: Partial<DailyStat>): DailyStat {
  return {
    user_id: 'u1', date: '2026-05-14', tokens_total: 0, tokens_by_model: {},
    sessions: 0, deep_work_minutes: 0, machines: [], projects_touched: {},
    ships: {}, hourly_tokens: {}, source_synced_at: null, ...partial,
  };
}

const data: LeaderboardData = {
  users: [
    { id: 'u1', github_handle: 'holden-alt', display_name: 'Holden' },
    { id: 'u2', github_handle: 'mira-builds', display_name: 'Mira' },
    { id: 'u3', github_handle: 'devon-ships', display_name: 'Devon' },
  ],
  statsByUser: {
    u1: [stat({ user_id: 'u1', tokens_total: 100, sessions: 9 })],
    u2: [stat({ user_id: 'u2', tokens_total: 500, sessions: 1 })],
    u3: [stat({ user_id: 'u3', tokens_total: 300, sessions: 2 })],
  },
  groupMemberUserIds: ['u1', 'u2'],
  friendUserIds: ['u3'],
  viewerGroups: [],
  allTimeByUser: { u1: 100, u2: 500, u3: 300 },
};

describe('Leaderboard', () => {
  it('renders the rank-list view by default (tokens+week), then ranks by tokens when "all" is selected', () => {
    const { container } = render(<Leaderboard data={data} viewerId="u1" today="2026-05-14" />);
    expect(container.querySelectorAll('[data-rank-row]').length).toBe(3);
    // Click the tokens metric to verify token-volume ranking still works.
    fireEvent.click(container.querySelector('[data-segment="tokens"]')!);
    fireEvent.click(container.querySelector('[data-segment="all"]')!);
    const rows = container.querySelectorAll('[data-rank-row]');
    expect(rows[0]?.getAttribute('data-handle')).toBe('mira-builds'); // 500 tokens
  });

  it('has metric, window, scope, and view controls', () => {
    const { container } = render(<Leaderboard data={data} viewerId="u1" today="2026-05-14" />);
    expect(container.querySelector('[data-segment="tokens"]')).toBeTruthy();
    expect(container.querySelector('[data-segment="all"]')).toBeTruthy();
    expect(container.querySelector('[data-segment="global"]')).toBeTruthy();
    expect(container.querySelector('[data-segment="ranklist"]')).toBeTruthy();
  });

  it('switches to the bar-comparison view', () => {
    const { container } = render(<Leaderboard data={data} viewerId="u1" today="2026-05-14" />);
    fireEvent.click(container.querySelector('[data-segment="barcomparison"]')!);
    expect(container.querySelectorAll('[data-bar-row]').length).toBe(3);
    expect(container.querySelectorAll('[data-rank-row]').length).toBe(0);
  });

  it('re-ranks when the metric changes to sessions', () => {
    const { container } = render(<Leaderboard data={data} viewerId="u1" today="2026-05-14" />);
    fireEvent.click(container.querySelector('[data-segment="sessions"]')!);
    const rows = container.querySelectorAll('[data-rank-row]');
    expect(rows[0]?.getAttribute('data-handle')).toBe('holden-alt'); // 9 sessions
  });

  it('narrows to friends scope (viewer + friends)', () => {
    const { container } = render(<Leaderboard data={data} viewerId="u1" today="2026-05-14" />);
    fireEvent.click(container.querySelector('[data-segment="friends"]')!);
    const handles = Array.from(container.querySelectorAll('[data-rank-row]')).map((r) =>
      r.getAttribute('data-handle'),
    );
    expect(handles.sort()).toEqual(['devon-ships', 'holden-alt']);
  });

  const dataWithTwoGroups: LeaderboardData = {
    ...data,
    viewerGroups: [
      { id: 'g1', slug: 'squad', name: 'Squad', color: 'cyan', description: null, memberUserIds: ['u1', 'u2'] },
      { id: 'g2', slug: 'opus-club', name: 'Opus Club', color: 'orange', description: null, memberUserIds: ['u1', 'u3'] },
    ],
  };

  it('hides the scope SegmentedControl when lockedScope is set', () => {
    const { container } = render(
      <Leaderboard
        data={dataWithTwoGroups}
        viewerId="u1"
        today="2026-05-14"
        lockedScope="groups"
        lockedGroupId="g1"
      />,
    );
    // Metric/window/view controls still present
    expect(container.querySelector('[data-segment="tokens"]')).toBeTruthy();
    expect(container.querySelector('[data-segment="all"]')).toBeTruthy();
    expect(container.querySelector('[data-segment="ranklist"]')).toBeTruthy();
    // Scope controls absent
    expect(container.querySelector('[data-segment="global"]')).toBeFalsy();
    expect(container.querySelector('[data-segment="groups"]')).toBeFalsy();
    expect(container.querySelector('[data-segment="friends"]')).toBeFalsy();
  });

  it('with lockedScope=groups + lockedGroupId, restricts the ranking to that group\'s members', () => {
    const { container } = render(
      <Leaderboard
        data={dataWithTwoGroups}
        viewerId="u1"
        today="2026-05-14"
        lockedScope="groups"
        lockedGroupId="g2"
      />,
    );
    const handles = Array.from(container.querySelectorAll('[data-rank-row]'))
      .map((r) => r.getAttribute('data-handle'))
      .sort();
    expect(handles).toEqual(['devon-ships', 'holden-alt']);
  });

  it('with lockedScope=global, restricts to global (all users) and hides the picker', () => {
    const { container } = render(
      <Leaderboard data={dataWithTwoGroups} viewerId="u1" today="2026-05-14" lockedScope="global" />,
    );
    expect(container.querySelectorAll('[data-rank-row]').length).toBe(3);
    expect(container.querySelector('[data-segment="groups"]')).toBeFalsy();
  });
});
