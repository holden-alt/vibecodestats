import type { DatabaseClient } from '@/lib/db/client';
import { windowStart } from './compute';
import type { HistoryDayRow, HourlyRow, ModelDailyRow, ProjectModelDailyRow, RepoShipsRow } from './types';

// How far back each table is pulled. The page computes every window (7/30/90d)
// client- and server-side from these bounded fetches. The weekly (90d) views
// use 13 full weeks, so the model/project/ships pulls reach back 91 days.
const MODEL_DAYS = 91;
const PROJECT_DAYS = 91;
const SHIPS_DAYS = 91;
const HOURLY_DAYS = 30;

// PostgREST caps result sets; request generously (30d hourly ≈ 24×N×models rows).
const ROW_LIMIT = 50_000;

export type InsightsBundle = {
  today: string;
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
  const [modelRes, projectRes, hourlyRes, shipsRes, historyRes] = await Promise.all([
    database
      .from('llm_model_daily')
      .select('*')
      .gte('date', windowStart(today, MODEL_DAYS))
      .lte('date', today)
      .order('date', { ascending: true })
      .limit(ROW_LIMIT),
    database
      .from('llm_project_model_daily')
      .select('*')
      .gte('date', windowStart(today, PROJECT_DAYS))
      .lte('date', today)
      .order('date', { ascending: true })
      .limit(ROW_LIMIT),
    database
      .from('llm_hourly')
      .select('*')
      .gte('date', windowStart(today, HOURLY_DAYS))
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
    database
      .from('daily_stats')
      .select('date, tokens_total, sessions, deep_work_minutes, ships')
      .lte('date', today)
      .order('date', { ascending: true })
      .limit(ROW_LIMIT),
  ]);

  const modelDaily = (modelRes.data ?? []) as ModelDailyRow[];
  const projectModel = (projectRes.data ?? []) as ProjectModelDailyRow[];
  const hourly = (hourlyRes.data ?? []) as HourlyRow[];
  const ships = (shipsRes.data ?? []) as RepoShipsRow[];
  const history = (historyRes.data ?? []) as HistoryDayRow[];

  const hasData = modelDaily.length > 0 || projectModel.length > 0 || hourly.length > 0;

  return { today, modelDaily, projectModel, hourly, ships, history, hasData };
}
