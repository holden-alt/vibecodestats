import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

const leaderboardData = {
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
    { id: 'g1', slug: 'default', name: 'The Squad', color: 'cyan',
      description: 'demo vibecoders', memberUserIds: ['u1', 'u2'] },
    { id: 'g2', slug: 'opus-club', name: 'Opus Club', color: 'orange',
      description: null, memberUserIds: ['u1', 'u3'] },
  ],
  allTimeByUser: { u1: 100, u2: 500, u3: 300 },
};

const notFoundMock = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
vi.mock('next/navigation', () => ({ notFound: notFoundMock }));

vi.mock('@/lib/db/server', () => ({
  createClient: vi.fn(async () => ({
    from: vi.fn((table: string) => {
      if (table === 'users') {
        return { select: () => ({ eq: () => ({ maybeSingle: vi.fn(async () => ({ data: { id: 'u1' }, error: null })) }) }) };
      }
      if (table === 'groups') {
        return { select: () => ({ eq: () => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) }) }) };
      }
      return { select: () => Promise.resolve({ data: [], error: null }) };
    }),
  })),
}));

vi.mock('@/lib/stats/leaderboard-data', () => ({
  getLeaderboardData: vi.fn(async () => leaderboardData),
}));

describe('/groups/[slug] route', () => {
  it('renders the group header and the leaderboard scoped to the group', async () => {
    // For this test, swap in a mock that returns the matching group.
    const { createClient } = await import('@/lib/db/server');
    (createClient as ReturnType<typeof vi.fn>).mockImplementationOnce(async () => ({
      from: vi.fn((table: string) => {
        if (table === 'users') {
          return { select: () => ({ eq: () => ({ maybeSingle: vi.fn(async () => ({ data: { id: 'u1' }, error: null })) }) }) };
        }
        if (table === 'groups') {
          return { select: () => ({ eq: () => ({ maybeSingle: vi.fn(async () => ({
            data: { id: 'g1', slug: 'default', name: 'The Squad', color: 'cyan', description: 'demo vibecoders' },
            error: null,
          })) }) }) };
        }
        return { select: () => Promise.resolve({ data: [], error: null }) };
      }),
    }));

    const { default: GroupPage } = await import('../../app/groups/[slug]/page');
    const ui = await GroupPage({ params: Promise.resolve({ slug: 'default' }) });
    const { container } = render(ui);
    expect(container.querySelector('[data-group-header]')).toBeTruthy();
    expect(container.textContent).toContain('The Squad');
    expect(container.textContent).toContain('demo vibecoders');
    expect(container.querySelector('[data-leaderboard]')).toBeTruthy();
    // scope locked to "default" group = members u1, u2 only
    const handles = Array.from(container.querySelectorAll('[data-rank-row]'))
      .map((r) => r.getAttribute('data-handle'))
      .sort();
    expect(handles).toEqual(['holden-alt', 'mira-builds']);
    // scope SegmentedControl is hidden
    expect(container.querySelector('[data-segment="global"]')).toBeFalsy();
  });

  it('calls notFound() when the slug does not match any group', async () => {
    const { default: GroupPage } = await import('../../app/groups/[slug]/page');
    await expect(
      GroupPage({ params: Promise.resolve({ slug: 'no-such-group' }) }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
  });
});
