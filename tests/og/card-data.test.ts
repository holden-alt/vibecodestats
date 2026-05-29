import { describe, it, expect, vi } from 'vitest';
import { getCardData } from '@/lib/og/card-data';

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

// getCardData issues daily_stats twice:
//   1st: .select('tokens_total, sessions').eq(user_id).order().limit()  → per-user stats
//   2nd: .select('user_id, tokens_total').order().limit()               → cohort totals
// We dispatch by tracking how many times from('daily_stats') has been called.

function mockSupabase(
  userRow: unknown,
  userDailyStats: { tokens_total: number; sessions: number }[],
  cohortRows: { user_id: string; tokens_total: number }[],
) {
  let dailyStatsCallCount = 0;

  return {
    from: vi.fn((table: string) => {
      if (table === 'users') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: vi.fn(async () => ({ data: userRow, error: null })),
            }),
          }),
        };
      }

      // daily_stats — first call = per-user query, second call = cohort query
      dailyStatsCallCount += 1;
      const callIndex = dailyStatsCallCount;

      if (callIndex === 1) {
        // Per-user chain: .select().eq().order().limit()
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: vi.fn(async () => ({ data: userDailyStats, error: null })),
              }),
            }),
          }),
        };
      }

      // Cohort chain: .select().order().limit()
      return {
        select: () => ({
          order: () => ({
            limit: vi.fn(async () => ({ data: cohortRows, error: null })),
          }),
        }),
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------

const USER_TOP = {
  id: 'u1',
  github_handle: 'top-coder',
  display_name: 'Top Coder',
  team: 'claude_code' as const,
};

const USER_MID = {
  id: 'u2',
  github_handle: 'mid-coder',
  display_name: null,
  team: 'codex' as const,
};

const USER_ZERO = {
  id: 'u3',
  github_handle: 'no-tokens',
  display_name: 'Zero Coder',
  team: null,
};

// top-coder has 3 active days
const TOP_USER_STATS = [
  { tokens_total: 5_000_000, sessions: 10 },
  { tokens_total: 3_000_000, sessions: 8 },
  { tokens_total: 2_000_000, sessions: 6 },
];

// Cohort: top-coder total=10M, mid-coder total=1M, no-tokens=0
const COHORT_ROWS = [
  { user_id: 'u1', tokens_total: 5_000_000 },
  { user_id: 'u1', tokens_total: 3_000_000 },
  { user_id: 'u1', tokens_total: 2_000_000 },
  { user_id: 'u2', tokens_total: 600_000 },
  { user_id: 'u2', tokens_total: 400_000 },
  { user_id: 'u3', tokens_total: 0 },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getCardData', () => {
  it('returns null for an unknown handle', async () => {
    const supabase = mockSupabase(null, [], []);
    const result = await getCardData(supabase as never, 'ghost');
    expect(result).toBeNull();
  });

  it('returns S tier + rank 1 for the top-tokens user', async () => {
    const supabase = mockSupabase(USER_TOP, TOP_USER_STATS, COHORT_ROWS);
    const result = await getCardData(supabase as never, 'top-coder');
    expect(result).not.toBeNull();
    expect(result!.tier).toBe('S');
    expect(result!.rank).toBe(1);
    expect(result!.isHandcoder).toBe(false);
  });

  it('computes allTimeTokens, peakDay, sessions, activeDays correctly', async () => {
    const supabase = mockSupabase(USER_TOP, TOP_USER_STATS, COHORT_ROWS);
    const result = await getCardData(supabase as never, 'top-coder');
    expect(result!.allTimeTokens).toBe(10_000_000);   // 5M + 3M + 2M
    expect(result!.peakDay).toBe(5_000_000);           // max single-day
    expect(result!.sessions).toBe(24);                  // 10 + 8 + 6
    expect(result!.activeDays).toBe(3);                 // all 3 have tokens > 0
  });

  it('passes handle, displayName, and team through untouched', async () => {
    const supabase = mockSupabase(USER_MID, [{ tokens_total: 1_000_000, sessions: 5 }], COHORT_ROWS);
    const result = await getCardData(supabase as never, 'mid-coder');
    expect(result!.handle).toBe('mid-coder');
    expect(result!.displayName).toBeNull();
    expect(result!.team).toBe('codex');
  });

  it('marks a zero-token user as isHandcoder true', async () => {
    const supabase = mockSupabase(USER_ZERO, [{ tokens_total: 0, sessions: 0 }], COHORT_ROWS);
    const result = await getCardData(supabase as never, 'no-tokens');
    expect(result).not.toBeNull();
    expect(result!.isHandcoder).toBe(true);
    expect(result!.allTimeTokens).toBe(0);
    expect(result!.activeDays).toBe(0);
  });

  it('zero-token user: isHandcoder true even with empty daily_stats', async () => {
    const supabase = mockSupabase(USER_ZERO, [], COHORT_ROWS);
    const result = await getCardData(supabase as never, 'no-tokens');
    expect(result!.isHandcoder).toBe(true);
    expect(result!.allTimeTokens).toBe(0);
    expect(result!.peakDay).toBe(0);
    expect(result!.sessions).toBe(0);
    expect(result!.activeDays).toBe(0);
  });

  it('cohortSize counts only users with tokens > 0', async () => {
    // cohort: u1=10M, u2=1M, u3=0 → active cohort = 2
    const supabase = mockSupabase(USER_TOP, TOP_USER_STATS, COHORT_ROWS);
    const result = await getCardData(supabase as never, 'top-coder');
    expect(result!.cohortSize).toBe(2);
  });

  it('topPercentLabel is at least 1', async () => {
    const supabase = mockSupabase(USER_TOP, TOP_USER_STATS, COHORT_ROWS);
    const result = await getCardData(supabase as never, 'top-coder');
    expect(result!.topPercentLabel).toBeGreaterThanOrEqual(1);
  });

  it('activeDays excludes zero-token rows', async () => {
    const stats = [
      { tokens_total: 1_000_000, sessions: 3 },
      { tokens_total: 0, sessions: 0 },          // zero-token day
      { tokens_total: 500_000, sessions: 2 },
    ];
    const supabase = mockSupabase(USER_TOP, stats, [
      { user_id: 'u1', tokens_total: 1_000_000 },
      { user_id: 'u1', tokens_total: 500_000 },
    ]);
    const result = await getCardData(supabase as never, 'top-coder');
    expect(result!.activeDays).toBe(2);         // only the two non-zero rows
    expect(result!.allTimeTokens).toBe(1_500_000); // zero row excluded from sum correctly
  });
});
