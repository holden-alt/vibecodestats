import { describe, it, expect, vi } from 'vitest';
import { getProfileData } from '@/lib/stats/profile-data';

function mockSupabase(userRow: unknown, statsRows: unknown[]) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'users') {
        return {
          select: () => ({ eq: () => ({ maybeSingle: vi.fn(async () => ({ data: userRow, error: null })) }) }),
        };
      }
      // daily_stats
      return {
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: vi.fn(async () => ({ data: statsRows, error: null })),
            }),
          }),
        }),
      };
    }),
  };
}

describe('getProfileData', () => {
  it('returns null when the user does not exist', async () => {
    const supabase = mockSupabase(null, []);
    const result = await getProfileData(supabase as never, 'ghost');
    expect(result).toBeNull();
  });

  it('returns the user and their daily_stats rows', async () => {
    const user = { id: 'u1', github_handle: 'holden-alt', display_name: 'Holden',
      avatar_url: null, primary_persona: null, secondary_personas: [] };
    const stats = [
      { date: '2026-05-14', tokens_total: 487231, tokens_by_model: { 'claude-opus-4-7': 487231 },
        sessions: 6, deep_work_minutes: 240, machines: ['iMac'],
        projects_touched: {}, ships: { commits: 12, repos: 3 }, source_synced_at: null },
    ];
    const supabase = mockSupabase(user, stats);
    const result = await getProfileData(supabase as never, 'holden-alt');
    expect(result).not.toBeNull();
    expect(result?.user.github_handle).toBe('holden-alt');
    expect(result?.dailyStats).toHaveLength(1);
    expect(result?.dailyStats[0]?.tokens_total).toBe(487231);
  });
});
