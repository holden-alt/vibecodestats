import type { DatabaseClient } from '@/lib/db/client';
import { windowStart } from './compute';
import type { HistoryDayRow, HourlyRow, ModelDailyRow, ProjectModelDailyRow, RepoShipsRow } from './types';

// The station shows all-time views, so model, project, and hourly rows are read
// in full (one person's history: hundreds to a few thousand rows each). Ships
// only feed today's commit count.
const SHIPS_DAYS = 7;

// daily_stats is the multi-user leaderboard table; the station is one person's.
// Its full-history read is pinned to this account so another user's days can
// never land in the Lifetime board or the day rankings.
export const STATION_HANDLE = 'holden-alt';

// A safety cap, not a window: all-time hourly grows ~30 rows a day.
const ROW_LIMIT = 50_000;

export type InsightsBundle = {
  today: string;
  /** FULL-history model rows. */
  modelDaily: ModelDailyRow[];
  projectModel: ProjectModelDailyRow[];
  hourly: HourlyRow[];
  /** Per-repo commit counts (git ships) over the trend window. */
  ships: RepoShipsRow[];
  /** FULL-history day totals from daily_stats (~1 row/day since 2026-04-20).
   *  This store outlives transcript cleanup, so records/odometer read it
   *  instead of anything recomputed from raw session files. */
  history: HistoryDayRow[];
  /** true if any usage data was returned. */
  hasData: boolean;
};

/**
 * Fetch the raw usage rows for the station via the anon client. Every table is
 * single-user (no user_id), so these are simple date-bounded reads. If a
 * public-read RLS policy isn't in place yet, queries resolve to empty arrays and
 * the page renders its empty state — we never fall back to service keys.
 *
 * 2026-08-04: the outcome/problem/systems tables are no longer read — the miner
 * that fed them was retired 7/29 and the station is usage-only now.
 */
export async function getInsightsBundle(
  database: DatabaseClient,
  today: string,
): Promise<InsightsBundle> {
  const { data: stationUser } = await database
    .from('users')
    .select('id')
    .eq('github_handle', STATION_HANDLE)
    .maybeSingle();
  const stationUserId = (stationUser as { id?: string } | null)?.id ?? null;

  const [modelRes, projectRes, hourlyRes, shipsRes, historyRes] = await Promise.all([
    database
      .from('llm_model_daily')
      .select('*')
      .lte('date', today)
      .order('date', { ascending: true })
      .limit(ROW_LIMIT),
    database
      .from('llm_project_model_daily')
      .select('*')
      .lte('date', today)
      .order('date', { ascending: true })
      .limit(ROW_LIMIT),
    database
      .from('llm_hourly')
      .select('*')
      .lte('date', today)
      .order('date', { ascending: true })
      .limit(ROW_LIMIT),
    database
      .from('repo_ships_daily')
      .select('*')
      .gte('date', windowStart(today, SHIPS_DAYS))
      .lte('date', today)
      .order('date', { ascending: true })
      .limit(ROW_LIMIT),
    stationUserId
      ? database
          .from('daily_stats')
          .select('date, tokens_total, sessions, deep_work_minutes, ships')
          .eq('user_id', stationUserId)
          .lte('date', today)
          .order('date', { ascending: true })
          .limit(ROW_LIMIT)
      : Promise.resolve({ data: [] as HistoryDayRow[] }),
  ]);

  const modelDaily = (modelRes.data ?? []) as ModelDailyRow[];
  const projectModel = (projectRes.data ?? []) as ProjectModelDailyRow[];
  const hourly = (hourlyRes.data ?? []) as HourlyRow[];
  const ships = (shipsRes.data ?? []) as RepoShipsRow[];
  const history = (historyRes.data ?? []) as HistoryDayRow[];

  const hasData = modelDaily.length > 0 || projectModel.length > 0 || hourly.length > 0;

  return { today, modelDaily, projectModel, hourly, ships, history, hasData };
}
