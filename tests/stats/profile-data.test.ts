import { describe, it, expect, vi } from 'vitest';
import { getProfileData } from '@/lib/stats/profile-data';

function mockSupabase(userRow: unknown, statsRows: unknown[], machineRows: unknown[] = []) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'users') {
        return {
          select: () => ({ eq: () => ({ maybeSingle: vi.fn(async () => ({ data: userRow, error: null })) }) }),
        };
      }
      if (table === 'machine_daily_stats') {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: vi.fn(async () => ({ data: machineRows, error: null })),
              }),
            }),
          }),
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
        projects_touched: {}, ships: { commits: 12, repos: 3 }, hourly_tokens: {}, source_synced_at: null },
    ];
    const supabase = mockSupabase(user, stats);
    const result = await getProfileData(supabase as never, 'holden-alt');
    expect(result).not.toBeNull();
    expect(result?.user.github_handle).toBe('holden-alt');
    expect(result?.dailyStats).toHaveLength(1);
    expect(result?.dailyStats[0]?.tokens_total).toBe(487231);
  });

  it('returns the user machine_daily_stats rows', async () => {
    const user = { id: 'u1', github_handle: 'holden-alt', display_name: 'Holden',
      avatar_url: null, primary_persona: null, secondary_personas: [] };
    const machines = [
      { user_id: 'u1', date: '2026-05-14', machine: 'iMac', tokens_total: 300000,
        tokens_by_model: {}, sessions: 3, deep_work_minutes: 120, projects_touched: {},
        ships: {}, hourly_tokens: {}, updated_at: '2026-05-14T12:00:00Z' },
      { user_id: 'u1', date: '2026-05-14', machine: 'MacBook-Air', tokens_total: 187231,
        tokens_by_model: {}, sessions: 3, deep_work_minutes: 120, projects_touched: {},
        ships: {}, hourly_tokens: {}, updated_at: '2026-05-14T12:00:00Z' },
    ];
    const supabase = mockSupabase(user, [], machines);
    const result = await getProfileData(supabase as never, 'holden-alt');
    expect(result?.machineStats).toHaveLength(2);
    expect(result?.machineStats[0]?.machine).toBe('iMac');
    expect(result?.machineStats[1]?.tokens_total).toBe(187231);
  });

  it('defaults machineStats to [] when the query returns null', async () => {
    const user = { id: 'u1', github_handle: 'holden-alt', display_name: 'Holden',
      avatar_url: null, primary_persona: null, secondary_personas: [] };
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'users') {
          return { select: () => ({ eq: () => ({ maybeSingle: vi.fn(async () => ({ data: user, error: null })) }) }) };
        }
        return {
          select: () => ({
            eq: () => ({
              order: () => ({ limit: vi.fn(async () => ({ data: null, error: null })) }),
            }),
          }),
        };
      }),
    };
    const result = await getProfileData(supabase as never, 'holden-alt');
    expect(result?.machineStats).toEqual([]);
    expect(result?.dailyStats).toEqual([]);
  });
});
