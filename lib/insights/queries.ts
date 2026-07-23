import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database';
import { windowStart } from './compute';
import type {
  HourlyRow,
  ModelDailyRow,
  ProblemEventRow,
  ProjectModelDailyRow,
  SessionOutcomeRow,
  SystemHealthRow,
} from './types';

// How far back each table is pulled. The page computes every window (7/30/90d)
// client- and server-side from these bounded fetches.
const MODEL_DAYS = 90;
const PROJECT_DAYS = 90;
const HOURLY_DAYS = 30;
const OUTCOME_DAYS = 90;
const PROBLEM_DAYS = 90;
const HEALTH_DAYS = 30;

// PostgREST caps result sets; request generously (30d hourly ≈ 24×N×models rows).
const ROW_LIMIT = 50_000;

export type InsightsBundle = {
  today: string;
  modelDaily: ModelDailyRow[];
  projectModel: ProjectModelDailyRow[];
  hourly: HourlyRow[];
  outcomes: SessionOutcomeRow[];
  problems: ProblemEventRow[];
  health: SystemHealthRow[];
  /** true if any usage OR outcome/problem/health data was returned. */
  hasData: boolean;
  /** true if the outcome/systems telemetry has any rows yet (drives empty-state copy). */
  hasOutcomeData: boolean;
};

/**
 * Fetch the raw rows for the insights station via the anon client. Every table
 * is single-user (no user_id), so these are simple date-bounded reads. If a
 * public-read RLS policy isn't in place yet, queries resolve to empty arrays and
 * the page renders its empty state — we never fall back to service keys.
 */
export async function getInsightsBundle(
  supabase: SupabaseClient<Database>,
  today: string,
): Promise<InsightsBundle> {
  const [modelRes, projectRes, hourlyRes, outcomeRes, problemRes, healthRes] = await Promise.all([
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
      .from('session_outcomes')
      .select('*')
      .gte('date', windowStart(today, OUTCOME_DAYS))
      .lte('date', today)
      .order('date', { ascending: true })
      .limit(ROW_LIMIT),
    supabase
      .from('problem_events')
      .select('*')
      .gte('date', windowStart(today, PROBLEM_DAYS))
      .lte('date', today)
      .order('date', { ascending: true })
      .limit(ROW_LIMIT),
    supabase
      .from('system_health_daily')
      .select('*')
      .gte('date', windowStart(today, HEALTH_DAYS))
      .lte('date', today)
      .order('date', { ascending: true })
      .limit(ROW_LIMIT),
  ]);

  const modelDaily = (modelRes.data ?? []) as ModelDailyRow[];
  const projectModel = (projectRes.data ?? []) as ProjectModelDailyRow[];
  const hourly = (hourlyRes.data ?? []) as HourlyRow[];
  const outcomes = (outcomeRes.data ?? []) as SessionOutcomeRow[];
  const problems = (problemRes.data ?? []) as ProblemEventRow[];
  const health = (healthRes.data ?? []) as SystemHealthRow[];

  const hasOutcomeData = outcomes.length > 0 || problems.length > 0 || health.length > 0;
  const hasData = modelDaily.length > 0 || projectModel.length > 0 || hourly.length > 0 || hasOutcomeData;

  return { today, modelDaily, projectModel, hourly, outcomes, problems, health, hasData, hasOutcomeData };
}
