import { describe, it, expect, vi } from 'vitest';
import { getHeadToHeadData } from '@/lib/stats/head-to-head-data';

function mockSupabase(tables: { users: unknown[]; daily_stats: unknown[] }) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'users') {
        return { select: () => ({ in: vi.fn(async () => ({ data: tables.users, error: null })) }) };
      }
      // daily_stats
      return {
        select: () => ({
          in: vi.fn(() => ({
            order: vi.fn(async () => ({ data: tables.daily_stats, error: null })),
          })),
        }),
      };
    }),
  };
}

describe('getHeadToHeadData', () => {
  it('returns both users and their daily_stats grouped by user', async () => {
    const supabase = mockSupabase({
      users: [
        { id: 'u1', github_handle: 'holden-alt', display_name: 'Holden' },
        { id: 'u2', github_handle: 'mira-builds', display_name: 'Mira' },
      ],
      daily_stats: [
        { user_id: 'u1', date: '2026-05-14', tokens_total: 100, tokens_by_model: {},
          sessions: 1, deep_work_minutes: 30, machines: [], projects_touched: {},
          ships: { commits: 2 }, hourly_tokens: {}, source_synced_at: null },
        { user_id: 'u2', date: '2026-05-14', tokens_total: 500, tokens_by_model: {},
          sessions: 2, deep_work_minutes: 90, machines: [], projects_touched: {},
          ships: { commits: 8 }, hourly_tokens: {}, source_synced_at: null },
      ],
    });
    const result = await getHeadToHeadData(supabase as never, 'holden-alt', 'mira-builds');
    expect(result).not.toBeNull();
    expect(result!.userA.github_handle).toBe('holden-alt');
    expect(result!.userB.github_handle).toBe('mira-builds');
    expect(result!.statsA).toHaveLength(1);
    expect(result!.statsB).toHaveLength(1);
    expect(result!.statsB[0]?.tokens_total).toBe(500);
  });

  it('returns null when either handle does not exist', async () => {
    const supabase = mockSupabase({
      users: [{ id: 'u1', github_handle: 'holden-alt', display_name: 'Holden' }],
      daily_stats: [],
    });
    const result = await getHeadToHeadData(supabase as never, 'holden-alt', 'no-such-user');
    expect(result).toBeNull();
  });

  it('preserves handle order regardless of database row order', async () => {
    // Supabase returns u2 first, but the caller asked for holden-alt as A.
    const supabase = mockSupabase({
      users: [
        { id: 'u2', github_handle: 'mira-builds', display_name: 'Mira' },
        { id: 'u1', github_handle: 'holden-alt', display_name: 'Holden' },
      ],
      daily_stats: [],
    });
    const result = await getHeadToHeadData(supabase as never, 'holden-alt', 'mira-builds');
    expect(result!.userA.github_handle).toBe('holden-alt');
    expect(result!.userB.github_handle).toBe('mira-builds');
  });
});
