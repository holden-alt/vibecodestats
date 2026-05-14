import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database';

export type ProfileUser = {
  id: string;
  github_handle: string;
  display_name: string | null;
  avatar_url: string | null;
  primary_persona: string | null;
  secondary_personas: string[];
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
): Promise<ProfileData | null> {
  const { data: user } = await supabase
    .from('users')
    .select('id, github_handle, display_name, avatar_url, primary_persona, secondary_personas')
    .eq('github_handle', handle)
    .maybeSingle();

  if (!user) return null;

  const { data: dailyStats } = await supabase
    .from('daily_stats')
    .select('*')
    .eq('user_id', user.id)
    .order('date', { ascending: false })
    .limit(HISTORY_DAYS);

  const { data: machineStats } = await supabase
    .from('machine_daily_stats')
    .select('*')
    .eq('user_id', user.id)
    .order('date', { ascending: false })
    .limit(HISTORY_DAYS * 3);

  return {
    user,
    dailyStats: dailyStats ?? [],
    machineStats: machineStats ?? [],
  };
}
