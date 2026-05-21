import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getProfileData, getLiveRanking } from '@/lib/stats/profile-data';
import { getLeaderboardData } from '@/lib/stats/leaderboard-data';
import { ProfileLive } from '@/components/ProfileLive';

export const runtime = 'edge';

type ProfilePageProps = {
  params: Promise<{ handle: string }>;
};

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
