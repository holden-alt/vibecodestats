import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProfileLive } from '@/components/ProfileLive';
import type { ProfileData } from '@/lib/stats/profile-data';
import type { LiveRanking } from '@/lib/stats/leaderboard-live';
import type { LeaderboardData } from '@/lib/stats/leaderboard';

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
    auth_id: 'auth-1',
    github_handle: 'holden-alt',
    display_name: 'Holden',
    avatar_url: null,
    primary_persona: 'vibe-coder',
    secondary_personas: ['ai-builder'],
    private_project_names: false,
    team: null,
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

const leaderboardData: LeaderboardData = {
  users: [{ id: 'u1', github_handle: 'holden-alt', display_name: 'Holden' }],
  statsByUser: { u1: [] },
  groupMemberUserIds: ['u1'],
  friendUserIds: [],
  viewerGroups: [],
  allTimeByUser: { u1: 487231 },
};

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
        viewerIsOwner={false}
        hasEverPushed={true}
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
        viewerIsOwner={false}
        hasEverPushed={true}
      />,
    );
    expect(screen.getByText(/global rank/i)).toBeInTheDocument();
  });
  it('shows setup banner when viewer is owner and has never pushed', () => {
    render(
      <ProfileLive
        initialData={initialData}
        leaderboardData={leaderboardData}
        today="2026-05-19"
        initialLiveRanking={initialLiveRanking}
        viewerIsOwner={true}
        hasEverPushed={false}
      />,
    );
    expect(screen.getByText(/your stats aren't flowing yet/i)).toBeInTheDocument();
    expect(screen.getByText(/set up sync/i)).toBeInTheDocument();
  });

  it('renders the derived tier badge letter (sole cohort member => S)', () => {
    // allTime.tokens = 487231 and allTimeByUser = { u1: 487231 }, so the single
    // active-cohort member is percentile 0 => S. The S letter is rendered on the
    // identity-header tier pill and the player-card foil tier badge.
    render(
      <ProfileLive
        initialData={initialData}
        leaderboardData={leaderboardData}
        today="2026-05-19"
        initialLiveRanking={initialLiveRanking}
        viewerIsOwner={false}
        hasEverPushed={true}
      />,
    );
    expect(screen.getAllByText('S').length).toBeGreaterThan(0);
  });

  it('renders the Team Scoreboard after switching to the Team Daily view', () => {
    render(
      <ProfileLive
        initialData={initialData}
        leaderboardData={leaderboardData}
        today="2026-05-19"
        initialLiveRanking={initialLiveRanking}
        viewerIsOwner={false}
        hasEverPushed={true}
      />,
    );
    // Team Scoreboard is a primary view, not the default Overview. Switch to it.
    fireEvent.click(screen.getByRole('button', { name: /team daily/i }));
    expect(screen.getByText(/Team Scoreboard · Today/i)).toBeInTheDocument();
  });

  it('exposes Tier Distribution as a primary view with a you-are-here marker', () => {
    render(
      <ProfileLive
        initialData={initialData}
        leaderboardData={leaderboardData}
        today="2026-05-19"
        initialLiveRanking={initialLiveRanking}
        viewerIsOwner={false}
        hasEverPushed={true}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /tier distribution/i }));
    expect(screen.getByText(/where the/i)).toBeInTheDocument();
    expect(screen.getByText(/you are here/i)).toBeInTheDocument();
  });

  it('keeps the TokenTrendChart tile rendered (KEEP guard)', () => {
    render(
      <ProfileLive
        initialData={initialData}
        leaderboardData={leaderboardData}
        today="2026-05-19"
        initialLiveRanking={initialLiveRanking}
        viewerIsOwner={false}
        hasEverPushed={true}
      />,
    );
    // TokenTrendChart lives in the "30-day trend" BentoTile in rolling stats.
    expect(screen.getByText(/30-day trend/i)).toBeInTheDocument();
  });
});
