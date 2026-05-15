import { describe, it, expect, vi } from 'vitest';
import { getLeaderboardData } from '@/lib/stats/leaderboard-data';

// The mock returns table-specific data. getLeaderboardData issues five reads:
// users, daily_stats, group_members (twice — viewer's groups, then members),
// friendships.
function mockSupabase(tables: {
  users: unknown[];
  daily_stats: unknown[];
  group_members: unknown[];
  friendships: unknown[];
}) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'users') {
        return { select: () => Promise.resolve({ data: tables.users, error: null }) };
      }
      if (table === 'daily_stats') {
        return {
          select: () => ({
            order: () => ({ limit: vi.fn(async () => ({ data: tables.daily_stats, error: null })) }),
          }),
        };
      }
      if (table === 'group_members') {
        return {
          select: () => ({
            in: vi.fn(async () => ({ data: tables.group_members, error: null })),
            eq: vi.fn(async () => ({ data: tables.group_members, error: null })),
          }),
        };
      }
      // friendships
      return {
        select: () => ({ eq: vi.fn(async () => ({ data: tables.friendships, error: null })) }),
      };
    }),
  };
}

describe('getLeaderboardData', () => {
  it('returns users, stats grouped by user, and the viewer relationships', async () => {
    const supabase = mockSupabase({
      users: [
        { id: 'u1', github_handle: 'holden-alt', display_name: 'Holden' },
        { id: 'u2', github_handle: 'mira-builds', display_name: 'Mira' },
      ],
      daily_stats: [
        { user_id: 'u1', date: '2026-05-14', tokens_total: 100, tokens_by_model: {},
          sessions: 1, deep_work_minutes: 10, machines: [], projects_touched: {},
          ships: {}, hourly_tokens: {}, source_synced_at: null },
        { user_id: 'u2', date: '2026-05-14', tokens_total: 200, tokens_by_model: {},
          sessions: 2, deep_work_minutes: 20, machines: [], projects_touched: {},
          ships: {}, hourly_tokens: {}, source_synced_at: null },
      ],
      group_members: [
        { group_id: 'g1', user_id: 'u1' },
        { group_id: 'g1', user_id: 'u2' },
      ],
      friendships: [{ user_id: 'u1', friend_id: 'u2' }],
    });
    const result = await getLeaderboardData(supabase as never, 'u1');
    expect(result.users).toHaveLength(2);
    expect(result.statsByUser['u1']).toHaveLength(1);
    expect(result.statsByUser['u2']?.[0]?.tokens_total).toBe(200);
    expect(result.groupMemberUserIds.sort()).toEqual(['u1', 'u2']);
    expect(result.friendUserIds).toEqual(['u2']);
  });

  it('defaults relationship arrays to empty when the viewer has no groups or friends', async () => {
    const supabase = mockSupabase({
      users: [{ id: 'u1', github_handle: 'holden-alt', display_name: 'Holden' }],
      daily_stats: [],
      group_members: [],
      friendships: [],
    });
    const result = await getLeaderboardData(supabase as never, 'u1');
    expect(result.groupMemberUserIds).toEqual([]);
    expect(result.friendUserIds).toEqual([]);
    expect(result.statsByUser).toEqual({});
  });
});
