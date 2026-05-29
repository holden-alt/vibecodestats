import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database';
import { computeTier, type Tier } from '@/lib/stats/tier';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CardData {
  handle: string;
  displayName: string | null;
  team: 'claude_code' | 'codex' | null;
  allTimeTokens: number;
  tier: Tier;
  rank: number;
  cohortSize: number;
  topPercentLabel: number; // e.g. 1 => "TOP 1%"
  isHandcoder: boolean;
  peakDay: number;         // max single-day tokens_total
  sessions: number;        // all-time sessions sum
  activeDays: number;      // count of daily_stats rows with tokens_total > 0
}

// ---------------------------------------------------------------------------
// Per-user all-time stats (from this user's own daily_stats)
// ---------------------------------------------------------------------------

type DailyRow = { tokens_total: number; sessions: number };

function computeUserStats(rows: DailyRow[]): {
  allTimeTokens: number;
  peakDay: number;
  sessions: number;
  activeDays: number;
} {
  let allTimeTokens = 0;
  let peakDay = 0;
  let sessions = 0;
  let activeDays = 0;
  for (const row of rows) {
    const t = Number(row.tokens_total ?? 0);
    const s = Number(row.sessions ?? 0);
    allTimeTokens += t;
    sessions += s;
    if (t > peakDay) peakDay = t;
    if (t > 0) activeDays += 1;
  }
  return { allTimeTokens, peakDay, sessions, activeDays };
}

// ---------------------------------------------------------------------------
// Main data fetcher
// ---------------------------------------------------------------------------

// NOTE: The cohort is built by summing tokens_total per user across all
// daily_stats rows, fetched with a single select('user_id, tokens_total').
// PostgREST returns at most 1 000 rows by default — we raise the limit to
// STATS_LIMIT (same ceiling the leaderboard uses). This is exact while the
// table has fewer than STATS_LIMIT rows total across all users. At current
// user count this is years away from becoming a problem; replace with a
// server-side SUM aggregate (RPC/view) before the cap is reached.
const STATS_LIMIT = 4000;

export async function getCardData(
  supabase: SupabaseClient<Database>,
  handle: string,
): Promise<CardData | null> {
  // 1. Resolve the user by github_handle.
  const { data: user } = await supabase
    .from('users')
    .select('id, github_handle, display_name, team')
    .eq('github_handle', handle)
    .maybeSingle();

  if (!user) return null;

  // 2. Fetch this user's own daily_stats rows (all columns we need).
  const { data: userStats } = await supabase
    .from('daily_stats')
    .select('tokens_total, sessions')
    .eq('user_id', user.id)
    .order('date', { ascending: false })
    .limit(STATS_LIMIT);

  const myRows = (userStats ?? []) as DailyRow[];
  const { allTimeTokens, peakDay, sessions, activeDays } = computeUserStats(myRows);

  // 3. Fetch the cohort: every user's all-time token sum, for ranking.
  //    We pull (user_id, tokens_total) across the whole table and sum in JS.
  //    See the STATS_LIMIT caveat in the module-level comment above.
  const { data: allRows } = await supabase
    .from('daily_stats')
    .select('user_id, tokens_total')
    .order('date', { ascending: false })
    .limit(STATS_LIMIT);

  // Accumulate per-user totals.
  const totalsByUser = new Map<string, number>();
  for (const row of (allRows ?? []) as { user_id: string; tokens_total: number }[]) {
    const prev = totalsByUser.get(row.user_id) ?? 0;
    totalsByUser.set(row.user_id, prev + Number(row.tokens_total ?? 0));
  }

  // Build the flat cohort array (all users' all-time totals, including zeros).
  const cohortTotals: number[] = Array.from(totalsByUser.values());

  // 4. Compute tier + rank from the cohort.
  const tierResult = computeTier(allTimeTokens, cohortTotals);

  return {
    handle: user.github_handle,
    displayName: user.display_name,
    team: user.team,
    allTimeTokens,
    tier: tierResult.tier,
    rank: tierResult.rank,
    cohortSize: tierResult.cohortSize,
    topPercentLabel: tierResult.topPercentLabel,
    isHandcoder: tierResult.isHandcoder,
    peakDay,
    sessions,
    activeDays,
  };
}
