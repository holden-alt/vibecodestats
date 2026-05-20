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

  const data = await getProfileData(supabase, handle);
  if (!data) {
    notFound();
  }

  const leaderboardData = await getLeaderboardData(supabase, data.user.id);

  // Server-compute "today" so SSR and client hydration agree.
  const today = new Date().toISOString().slice(0, 10);

  const liveRanking = await getLiveRanking(supabase, data.user.id, today);

  return <ProfileLive initialData={data} leaderboardData={leaderboardData} today={today} initialLiveRanking={liveRanking} />;
}
