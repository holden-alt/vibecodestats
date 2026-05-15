import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { LeaderboardSection } from '@/components/LeaderboardSection';
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
  ],
  statsByUser: {
    u1: [stat({ user_id: 'u1', tokens_total: 100 })],
    u2: [stat({ user_id: 'u2', tokens_total: 500 })],
  },
  groupMemberUserIds: ['u1', 'u2'],
  friendUserIds: [],
  viewerGroups: [],
};

describe('LeaderboardSection', () => {
  it('renders a "leaderboard" heading and the Leaderboard component', () => {
    const { container } = render(
      <LeaderboardSection data={data} viewerId="u1" today="2026-05-14" />,
    );
    expect(container.querySelector('[data-leaderboard-section]')).toBeTruthy();
    expect(container.querySelector('[data-leaderboard]')).toBeTruthy();
    expect(container.querySelectorAll('[data-rank-row]').length).toBe(2);
  });
});
