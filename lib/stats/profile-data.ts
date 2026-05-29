import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database';
import { computeLiveDailyRanking, type LiveRanking } from './leaderboard-live';
import { fuzzProjects } from './privacy';
import type { Camp } from '@/lib/stats/team';

export type ProfileUser = {
  id: string;
  auth_id: string | null;
  github_handle: string;
  display_name: string | null;
  avatar_url: string | null;
  primary_persona: string | null;
  secondary_personas: string[];
  private_project_names: boolean;
  team: Camp | null;
};

export type DailyStat = Database['public']['Tables']['daily_stats']['Row'];
export type MachineDailyStat = Database['public']['Tables']['machine_daily_stats']['Row'];

export type ProfileData = {
  user: ProfileUser;
  dailyStats: DailyStat[];
  machineStats: MachineDailyStat[];
};

const HISTORY_DAYS = 366;

export async function getProfileData(
  supabase: SupabaseClient<Database>,
  handle: string,
  viewerAuthId?: string | null,
): Promise<ProfileData | null> {
  const { data: user } = await supabase
    .from('users')
    .select('id, auth_id, github_handle, display_name, avatar_url, primary_persona, secondary_personas, private_project_names, team')
    .eq('github_handle', handle)
    .maybeSingle();

  if (!user) return null;

  const { data: rawDailyStats } = await supabase
    .from('daily_stats')
    .select('*')
    .eq('user_id', user.id)
    .order('date', { ascending: false })
    .limit(HISTORY_DAYS);

  const { data: rawMachineStats } = await supabase
    .from('machine_daily_stats')
    .select('*')
    .eq('user_id', user.id)
    .order('date', { ascending: false })
    .limit(HISTORY_DAYS * 3); // up to ~3 machines per day

  const isOwner = viewerAuthId != null && viewerAuthId === user.auth_id;

  let dailyStats = rawDailyStats ?? [];
  let machineStats = rawMachineStats ?? [];

  if (user.private_project_names && !isOwner) {
    dailyStats = fuzzProjects(dailyStats);
    machineStats = fuzzProjects(machineStats);
  }

  return {
    user,
    dailyStats,
    machineStats,
  };
}

export async function getLiveRanking(
  supabase: SupabaseClient<Database>,
  viewerId: string,
  date: string,
): Promise<LiveRanking> {
  const { data } = await supabase
    .from('daily_stats')
    .select('user_id, tokens_total, users:user_id (github_handle)')
    .eq('date', date);
  type RawRow = { user_id: string; tokens_total: number; users: { github_handle: string } | null };
  const rows = (data as RawRow[] ?? []).map((r) => ({
    user_id: r.user_id,
    github_handle: r.users?.github_handle ?? '',
    tokens_total: r.tokens_total,
  })).filter((r) => r.github_handle);
  return computeLiveDailyRanking(rows, viewerId);
}
