import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ProfileLive } from '@/components/ProfileLive';
import type { ProfileData } from '@/lib/stats/profile-data';

// Capture the realtime callback so the test can fire a fake update.
let realtimeCallback: ((payload: unknown) => void) | null = null;
const channelMock = {
  on: vi.fn((_evt: string, _filter: unknown, cb: (p: unknown) => void) => {
    realtimeCallback = cb;
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

const baseData: ProfileData = {
  user: {
    id: 'u1', github_handle: 'holden-alt', display_name: 'Holden',
    avatar_url: null, primary_persona: null, secondary_personas: [],
  },
  dailyStats: [
    {
      date: '2026-05-14', user_id: 'u1', tokens_total: 100000,
      tokens_by_model: { 'claude-opus-4-7': 100000 }, sessions: 2,
      deep_work_minutes: 60, machines: ['iMac'], projects_touched: {},
      ships: { commits: 1, repos: 1 }, hourly_tokens: {}, source_synced_at: null,
    },
  ],
};

beforeEach(() => {
  realtimeCallback = null;
  vi.clearAllMocks();
});

describe('ProfileLive', () => {
  it('renders the StatusBar with the initial token total', () => {
    render(<ProfileLive initialData={baseData} today="2026-05-14" />);
    // 100000 -> "100K tokens"
    expect(screen.getByText(/100K tokens/)).toBeInTheDocument();
  });

  it('updates the token total when a realtime event for today arrives', () => {
    render(<ProfileLive initialData={baseData} today="2026-05-14" />);
    expect(realtimeCallback).not.toBeNull();
    act(() => {
      realtimeCallback!({
        new: {
          date: '2026-05-14', user_id: 'u1', tokens_total: 487000,
          tokens_by_model: { 'claude-opus-4-7': 487000 }, sessions: 6,
          deep_work_minutes: 240, machines: ['iMac'], projects_touched: {},
          ships: { commits: 12, repos: 3 }, source_synced_at: null,
        },
      });
    });
    expect(screen.getByText(/487K tokens/)).toBeInTheDocument();
  });

  it('ignores realtime events for other dates', () => {
    render(<ProfileLive initialData={baseData} today="2026-05-14" />);
    act(() => {
      realtimeCallback!({
        new: { date: '2026-05-13', user_id: 'u1', tokens_total: 999999,
          tokens_by_model: {}, sessions: 0, deep_work_minutes: 0, machines: [],
          projects_touched: {}, ships: { commits: 0, repos: 0 }, source_synced_at: null },
      });
    });
    expect(screen.getByText(/100K tokens/)).toBeInTheDocument();
    expect(screen.queryByText(/999/)).not.toBeInTheDocument();
  });

  it('renders the trends and charts sections', () => {
    const initialData = {
      user: {
        id: 'u1',
        github_handle: 'holden-alt',
        display_name: 'Holden',
        avatar_url: null,
        primary_persona: null,
        secondary_personas: [],
      },
      dailyStats: [
        {
          user_id: 'u1',
          date: '2026-05-14',
          tokens_total: 300,
          tokens_by_model: { 'claude-opus-4-7': 300 },
          sessions: 2,
          deep_work_minutes: 60,
          machines: ['iMac'],
          projects_touched: {},
          ships: {},
          hourly_tokens: { '14': 300 },
          source_synced_at: null,
        },
      ],
    };
    const { container } = render(<ProfileLive initialData={initialData} today="2026-05-14" />);
    // TrendsSection: 30 token bars + 30 model-mix columns
    expect(container.querySelectorAll('[data-bar]').length).toBeGreaterThanOrEqual(30);
    expect(container.querySelectorAll('[data-col]').length).toBe(30);
    // ChartsSection: donut + 24 hour bars
    expect(container.querySelector('[data-donut]')).toBeTruthy();
    expect(container.querySelectorAll('[data-hour]').length).toBe(24);
  });
});
