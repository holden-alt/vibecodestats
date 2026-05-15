import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { GroupLeaderboardSection } from '@/components/GroupLeaderboardSection';
import type { LeaderboardData } from '@/lib/stats/leaderboard';

const data: LeaderboardData = {
  users: [
    { id: 'u1', github_handle: 'holden-alt', display_name: 'Holden' },
    { id: 'u2', github_handle: 'mira-builds', display_name: 'Mira' },
    { id: 'u3', github_handle: 'devon-ships', display_name: 'Devon' },
  ],
  statsByUser: {
    u1: [{ user_id: 'u1', date: '2026-05-14', tokens_total: 100, tokens_by_model: {},
      sessions: 1, deep_work_minutes: 0, machines: [], projects_touched: {},
      ships: {}, hourly_tokens: {}, source_synced_at: null }],
    u2: [{ user_id: 'u2', date: '2026-05-14', tokens_total: 500, tokens_by_model: {},
      sessions: 1, deep_work_minutes: 0, machines: [], projects_touched: {},
      ships: {}, hourly_tokens: {}, source_synced_at: null }],
    u3: [{ user_id: 'u3', date: '2026-05-14', tokens_total: 300, tokens_by_model: {},
      sessions: 1, deep_work_minutes: 0, machines: [], projects_touched: {},
      ships: {}, hourly_tokens: {}, source_synced_at: null }],
  },
  groupMemberUserIds: ['u1', 'u2', 'u3'],
  friendUserIds: [],
  viewerGroups: [
    { id: 'g1', slug: 'default', name: 'The Squad', color: 'cyan', description: null, memberUserIds: ['u1', 'u2'] },
  ],
};

describe('GroupLeaderboardSection', () => {
  it('renders the group name in the section heading', () => {
    const { container } = render(
      <GroupLeaderboardSection
        data={data}
        viewerId="u1"
        today="2026-05-14"
        group={data.viewerGroups[0]!}
      />,
    );
    expect(container.textContent).toContain('the squad');
    expect(container.querySelector('[data-leaderboard-section]')).toBeTruthy();
  });

  it('renders a leaderboard scoped to this group only', () => {
    const { container } = render(
      <GroupLeaderboardSection
        data={data}
        viewerId="u1"
        today="2026-05-14"
        group={data.viewerGroups[0]!}
      />,
    );
    const handles = Array.from(container.querySelectorAll('[data-rank-row]'))
      .map((r) => r.getAttribute('data-handle'))
      .sort();
    expect(handles).toEqual(['holden-alt', 'mira-builds']);
    // scope SegmentedControl is hidden
    expect(container.querySelector('[data-segment="global"]')).toBeFalsy();
  });
});
