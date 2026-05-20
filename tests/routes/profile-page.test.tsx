import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { notFound } from 'next/navigation';

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }),
}));

const getProfileDataMock = vi.fn();
const getLiveRankingMock = vi.fn(async () => ({
  rank: 1, total: 1, percentile: 1, viewerTokens: 0,
  closestAbove: null, closestBelow: null, top: [],
}));
vi.mock('@/lib/stats/profile-data', () => ({
  getProfileData: (...args: unknown[]) => getProfileDataMock(...args),
  getLiveRanking: async (...args: unknown[]) => getLiveRankingMock(...(args as Parameters<typeof getLiveRankingMock>)),
}));
vi.mock('@/lib/stats/leaderboard-data', () => ({
  getLeaderboardData: vi.fn(async () => ({
    users: [],
    statsByUser: {},
    groupMemberUserIds: [],
    friendUserIds: [],
    viewerGroups: [],
  })),
}));
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => ({})) }));
// ProfileLive mounts the browser realtime client on render — stub it so the
// page test doesn't need real Supabase env vars.
vi.mock('@/lib/supabase/browser', () => ({
  createClient: vi.fn(() => ({
    channel: vi.fn(() => {
      const ch = { on: vi.fn(() => ch), subscribe: vi.fn(() => ch) };
      return ch;
    }),
    removeChannel: vi.fn(),
  })),
}));

describe('GET /[handle]', () => {
  it('renders ProfileLive when the user exists', async () => {
    getProfileDataMock.mockResolvedValueOnce({
      user: { id: 'u1', github_handle: 'holden-alt', display_name: 'Holden',
        avatar_url: null, primary_persona: null, secondary_personas: [] },
      dailyStats: [],
      machineStats: [],
    });
    const { default: Page } = await import('../../app/[handle]/page');
    const ui = await Page({ params: Promise.resolve({ handle: 'holden-alt' }) });
    render(ui as React.ReactElement);
    expect(screen.getAllByText('@holden-alt').length).toBeGreaterThan(0);
  });

  it('calls notFound when the user is missing', async () => {
    getProfileDataMock.mockResolvedValueOnce(null);
    const { default: Page } = await import('../../app/[handle]/page');
    await expect(Page({ params: Promise.resolve({ handle: 'ghost' }) })).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalled();
  });
});
