import type { DatabaseClient } from '@/lib/db/client';
import { computeTier, type Tier } from '@/lib/stats/tier';
import { todayLocal } from '@/lib/date';

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
  // --- today (the v2 share card advertises today's number) ---
  todayTokens: number;      // viewer's tokens_total for today (0 if no push today)
  todayTier: Tier;          // tier among today's ACTIVE field
  todayPercentLabel: number; // "TOP N% TODAY" — max(1, ceil(rank/total*100)); 100 if not on today's board
}

// ---------------------------------------------------------------------------
// Per-user all-time stats (from this user's own daily_stats)
// ---------------------------------------------------------------------------

type DailyRow = { date: string; tokens_total: number; sessions: number };

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
  database: DatabaseClient,
  handle: string,
): Promise<CardData | null> {
  // 1. Resolve the user by github_handle.
  const { data: user } = await database
    .from('users')
    .select('id, github_handle, display_name, team')
    .eq('github_handle', handle)
    .maybeSingle();

  if (!user) return null;

  // 2. Fetch this user's own daily_stats rows (all columns we need).
  const { data: userStats } = await database
    .from('daily_stats')
    .select('date, tokens_total, sessions')
    .eq('user_id', user.id)
    .order('date', { ascending: false })
    .limit(STATS_LIMIT);

  const myRows = (userStats ?? []) as DailyRow[];
  const { allTimeTokens, peakDay, sessions, activeDays } = computeUserStats(myRows);

  // 3. Fetch the cohort: every user's all-time token sum, for ranking.
  //    We pull (user_id, tokens_total) across the whole table and sum in JS.
  //    See the STATS_LIMIT caveat in the module-level comment above.
  const { data: allRows } = await database
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

  // 5. Today's field: tier + "top N% today" among everyone active that day.
  //    "Effective today" = the literal local day, or — if this user hasn't
  //    pushed yet today — their most recent active day, so the card matches the
  //    web profile's effectiveToday fallback instead of flashing "Today 0 / HC"
  //    for an active user on a quiet morning. The cohort is keyed to the SAME
  //    day so the percentile is computed against the right field.
  const today = todayLocal();
  const latestUserDate = myRows[0]?.date ?? today; // myRows is ordered date desc
  const effectiveToday = myRows.some((r) => r.date === today) ? today : latestUserDate;
  const todayTokens = myRows.find((r) => r.date === effectiveToday)?.tokens_total ?? 0;

  const { data: todayRows } = await database
    .from('daily_stats')
    .select('user_id, tokens_total')
    .eq('date', effectiveToday);

  const todayField = ((todayRows ?? []) as { user_id: string; tokens_total: number }[]).map((r) => ({
    user_id: r.user_id,
    tokens: Number(r.tokens_total ?? 0),
  }));
  const todayCohort = todayField.map((r) => r.tokens);
  const todayTier = computeTier(todayTokens, todayCohort).tier;
  // "Top N% today" via rank-over-total (same semantics as the web ShareCard):
  // best possible is max(1, ...). 100 when the user isn't on that day's board.
  const todaySorted = [...todayField].sort((a, b) => b.tokens - a.tokens);
  const todayRank = todaySorted.findIndex((r) => r.user_id === user.id) + 1; // 0 => not found
  const todayTotal = todaySorted.length;
  const todayPercentLabel =
    todayRank > 0 && todayTotal > 0 ? Math.max(1, Math.ceil((todayRank / todayTotal) * 100)) : 100;

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
    todayTokens,
    todayTier,
    todayPercentLabel,
  };
}
