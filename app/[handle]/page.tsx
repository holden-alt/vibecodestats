import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getProfileData, getLiveRanking } from '@/lib/stats/profile-data';
import { getLeaderboardData } from '@/lib/stats/leaderboard-data';
import { formatCompact } from '@/lib/format';
import { ProfileLive } from '@/components/ProfileLive';

export const runtime = 'edge';

type ProfilePageProps = {
  params: Promise<{ handle: string }>;
};

export async function generateMetadata({ params }: ProfilePageProps): Promise<Metadata> {
  const { handle } = await params;
  const supabase = await createClient();

  const { data: user } = await supabase
    .from('users')
    .select('id, github_handle, display_name')
    .eq('github_handle', handle)
    .maybeSingle();

  if (!user) {
    return { title: `${handle} not found · vibecodestats.dev` };
  }

  const { data: stats } = await supabase
    .from('daily_stats')
    .select('tokens_total')
    .eq('user_id', user.id);

  const allTimeTokens = (stats ?? []).reduce((s, r) => s + r.tokens_total, 0);
  const daysActive = (stats ?? []).length;

  const name = user.display_name || `@${handle}`;
  const title = `@${handle} on vibecodestats.dev`;
  const description = `${name} · ${formatCompact(allTimeTokens)} tokens · ${daysActive} day${daysActive === 1 ? '' : 's'} vibecoding with Claude Code`;

  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { handle } = await params;
  const supabase = await createClient();

  const { data: { user: authUser } } = await supabase.auth.getUser();

  const data = await getProfileData(supabase, handle, authUser?.id ?? null);
  if (!data) {
    notFound();
  }
  const viewerIsOwner = !!authUser && data.user.auth_id === authUser.id;
  const hasEverPushed = data.dailyStats.length > 0;

  const leaderboardData = await getLeaderboardData(supabase, data.user.id);

  // Server-compute "today" so SSR and client hydration agree.
  const today = new Date().toISOString().slice(0, 10);

  const liveRanking = await getLiveRanking(supabase, data.user.id, today);

  return <ProfileLive initialData={data} leaderboardData={leaderboardData} today={today} initialLiveRanking={liveRanking} viewerIsOwner={viewerIsOwner} hasEverPushed={hasEverPushed} />;
}
