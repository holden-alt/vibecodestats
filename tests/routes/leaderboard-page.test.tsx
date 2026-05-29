import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { todayLocal } from '@/lib/date';

// Mock the server supabase client + the data fetch so the page renders synchronously.
// Use the app's LOCAL "today" (matching the page) so the seeded stats land inside
// the default tokens+week window — the page keys "today" to the user's timezone, not UTC.
const TODAY = todayLocal();
const leaderboardData = {
  users: [
    { id: 'u1', github_handle: 'holden-alt', display_name: 'Holden' },
    { id: 'u2', github_handle: 'mira-builds', display_name: 'Mira' },
  ],
  statsByUser: {
    u1: [{ user_id: 'u1', date: TODAY, tokens_total: 100, tokens_by_model: {},
      sessions: 1, deep_work_minutes: 0, machines: [], projects_touched: {},
      ships: {}, hourly_tokens: {}, source_synced_at: null }],
    u2: [{ user_id: 'u2', date: TODAY, tokens_total: 500, tokens_by_model: {},
      sessions: 1, deep_work_minutes: 0, machines: [], projects_touched: {},
      ships: {}, hourly_tokens: {}, source_synced_at: null }],
  },
  groupMemberUserIds: ['u1', 'u2'],
  friendUserIds: [],
  viewerGroups: [],
  allTimeByUser: { u1: 100, u2: 500 },
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: vi.fn(() => ({
      select: () => ({ eq: () => ({ maybeSingle: vi.fn(async () => ({ data: { id: 'u1' }, error: null })) }) }),
    })),
  })),
}));
vi.mock('@/lib/stats/leaderboard-data', () => ({
  getLeaderboardData: vi.fn(async () => leaderboardData),
}));

describe('/leaderboard route', () => {
  it('renders the leaderboard with the seeded users', async () => {
    const { default: LeaderboardPage } = await import('../../app/leaderboard/page');
    const ui = await LeaderboardPage();
    const { container } = render(ui);
    expect(container.querySelector('[data-leaderboard]')).toBeTruthy();
    expect(container.querySelectorAll('[data-rank-row]').length).toBe(2);
    // Default metric is tokens + week. mira has 500 tokens, holden 100.
    expect(container.querySelector('[data-rank-row]')?.getAttribute('data-handle')).toBe('mira-builds');
  });
});
