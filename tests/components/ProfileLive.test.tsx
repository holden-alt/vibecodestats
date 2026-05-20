import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProfileLive } from '@/components/ProfileLive';
import type { ProfileData } from '@/lib/stats/profile-data';
import type { LiveRanking } from '@/lib/stats/leaderboard-live';

// Mock supabase so the realtime useEffect doesn't blow up in jsdom
const channelMock = {
  on: vi.fn((_evt: string, _filter: unknown, cb: (p: unknown) => void) => {
    void cb;
    return channelMock;
  }),
  subscribe: vi.fn(() => channelMock),
};
vi.mock('@/lib/supabase/browser', () => ({
  createClient: vi.fn(() => ({
    channel: vi.fn(() => channelMock),
    removeChannel: vi.fn(),
  })),
}));

const initialData: ProfileData = {
  user: {
    id: 'u1',
    github_handle: 'holden-alt',
    display_name: 'Holden',
    avatar_url: null,
    primary_persona: 'vibe-coder',
    secondary_personas: ['ai-builder'],
  },
  dailyStats: [{
    user_id: 'u1', date: '2026-05-19', tokens_total: 487231,
    tokens_by_model: { 'claude-opus-4-7': 480000 },
    sessions: 6, deep_work_minutes: 240, machines: ['mbp'],
    projects_touched: { 'cc-dashboard': 320000, 'holden': 167231 },
    ships: { commits: 3, repos: 2 }, hourly_tokens: { '14': 100000 },
    source_synced_at: null,
  }] as any,
  machineStats: [],
};

const leaderboardData = {
  users: [{ id: 'u1', github_handle: 'holden-alt', display_name: 'Holden' }],
  statsByUser: { u1: [] },
  groupMemberUserIds: ['u1'],
  friendUserIds: [],
  viewerGroups: [],
} as any;

const initialLiveRanking: LiveRanking = {
  rank: 1,
  total: 1,
  percentile: 1,
  viewerTokens: 0,
  closestAbove: null,
  closestBelow: null,
  top: [],
};

describe('ProfileLive (new layout)', () => {
  it('renders the handle in the identity strip', () => {
    render(
      <ProfileLive
        initialData={initialData}
        leaderboardData={leaderboardData}
        today="2026-05-19"
        initialLiveRanking={initialLiveRanking}
      />,
    );
    expect(screen.getAllByText('@holden-alt').length).toBeGreaterThan(0);
  });
  it('renders the global rank label in the live rank tile', () => {
    render(
      <ProfileLive
        initialData={initialData}
        leaderboardData={leaderboardData}
        today="2026-05-19"
        initialLiveRanking={initialLiveRanking}
      />,
    );
    expect(screen.getByText(/global rank/i)).toBeInTheDocument();
  });
});
