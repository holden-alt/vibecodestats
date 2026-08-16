import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProfileLive } from '@/components/ProfileLive';
import type { ProfileData } from '@/lib/stats/profile-data';
import type { LiveRanking } from '@/lib/stats/leaderboard-live';
import type { LeaderboardData } from '@/lib/stats/leaderboard';

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
  }] as unknown as ProfileData['dailyStats'],
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

describe('ProfileLive (v2 single-page layout)', () => {
  const baseProps = {
    initialData,
    leaderboardData,
    today: '2026-05-19',
    initialLiveRanking,
    viewerIsOwner: false,
    hasEverPushed: true,
  } as const;

  it('renders the handle in the identity bar', () => {
    render(<ProfileLive {...baseProps} />);
    expect(screen.getAllByText('@holden-alt').length).toBeGreaterThan(0);
  });

  it('derives the rolling-90d tier badge letter (sole cohort member => S)', () => {
    // recent90ByUser is absent here, so the tier falls back to allTimeByUser =
    // { u1: 487231 }: a single active-cohort member is percentile 0 => S. The S
    // letter shows on the IdentityBar tier badge (and other surfaces).
    render(<ProfileLive {...baseProps} />);
    expect(screen.getAllByText('S').length).toBeGreaterThan(0);
  });

  it('shows the Standings and Your-tokens sections by default (no view tabs)', () => {
    render(<ProfileLive {...baseProps} />);
    expect(screen.getByText(/standings/i)).toBeInTheDocument();
    expect(screen.getByText(/your tokens/i)).toBeInTheDocument();
  });

  it('renders the Team Scoreboard inline (no view switch needed)', () => {
    render(<ProfileLive {...baseProps} />);
    expect(screen.getByText(/Team Scoreboard · Today/i)).toBeInTheDocument();
  });

  it('shows the setup banner when viewer is owner and has never pushed', () => {
    render(<ProfileLive {...baseProps} viewerIsOwner hasEverPushed={false} />);
    expect(screen.getByText(/your stats aren't flowing yet/i)).toBeInTheDocument();
    expect(screen.getByText(/set up sync/i)).toBeInTheDocument();
  });

  it('keeps the deep-dive (More stats) collapsed by default and expands on click', () => {
    render(<ProfileLive {...baseProps} />);
    // "More stats" trigger is present and collapsed (aria-expanded=false).
    expect(screen.getByText('More stats')).toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: /show more/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    // After expanding, the trigger flips to Hide / aria-expanded=true.
    expect(screen.getByRole('button', { name: /hide/i })).toHaveAttribute('aria-expanded', 'true');
  });
});
