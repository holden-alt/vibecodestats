import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database';
import { windowStart } from './compute';
import type {
  HourlyRow,
  ModelDailyRow,
  ProjectModelDailyRow,
  RepoShipsRow,
} from './types';

// How far back each table is pulled. The page computes every window (7/30/90d)
// client- and server-side from these bounded fetches.
const MODEL_DAYS = 90;
const PROJECT_DAYS = 90;
const SHIPS_DAYS = 90;
const HOURLY_DAYS = 30;

// PostgREST caps result sets; request generously (30d hourly ≈ 24×N×models rows).
const ROW_LIMIT = 50_000;

export type InsightsBundle = {
  today: string;
  modelDaily: ModelDailyRow[];
  projectModel: ProjectModelDailyRow[];
  hourly: HourlyRow[];
  ships: RepoShipsRow[];
  /** true if ANY of the four tables returned rows (used to pick the empty state). */
  hasData: boolean;
};

/**
 * Fetch the raw rows for the insights station via the anon client. Every table
 * is single-user (no user_id), so these are simple date-bounded reads. If the
 * public-read RLS policy isn't in place yet, queries resolve to empty arrays and
 * the page renders its empty state — we never fall back to service keys.
 */
export async function getInsightsBundle(
  supabase: SupabaseClient<Database>,
  today: string,
): Promise<InsightsBundle> {
  const [modelRes, projectRes, hourlyRes, shipsRes] = await Promise.all([
    supabase
      .from('llm_model_daily')
      .select('*')
      .gte('date', windowStart(today, MODEL_DAYS))
      .lte('date', today)
      .order('date', { ascending: true })
      .limit(ROW_LIMIT),
    supabase
      .from('llm_project_model_daily')
      .select('*')
      .gte('date', windowStart(today, PROJECT_DAYS))
      .lte('date', today)
      .order('date', { ascending: true })
      .limit(ROW_LIMIT),
    supabase
      .from('llm_hourly')
      .select('*')
      .gte('date', windowStart(today, HOURLY_DAYS))
      .lte('date', today)
      .order('date', { ascending: true })
      .limit(ROW_LIMIT),
    supabase
      .from('repo_ships_daily')
      .select('*')
      .gte('date', windowStart(today, SHIPS_DAYS))
      .lte('date', today)
      .order('date', { ascending: true })
      .limit(ROW_LIMIT),
  ]);

  const modelDaily = (modelRes.data ?? []) as ModelDailyRow[];
  const projectModel = (projectRes.data ?? []) as ProjectModelDailyRow[];
  const hourly = (hourlyRes.data ?? []) as HourlyRow[];
  const ships = (shipsRes.data ?? []) as RepoShipsRow[];

  const hasData =
    modelDaily.length > 0 || projectModel.length > 0 || hourly.length > 0 || ships.length > 0;

  return { today, modelDaily, projectModel, hourly, ships, hasData };
}
