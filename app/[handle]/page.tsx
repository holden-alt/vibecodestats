import type { Metadata } from 'next';
import { todayLocal } from '@/lib/date';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getProfileData, getLiveRanking } from '@/lib/stats/profile-data';
import { getLeaderboardData } from '@/lib/stats/leaderboard-data';
import { formatCompact } from '@/lib/format';
import { ogImageUrl } from '@/lib/og/regenerate';
import { ProfileLive } from '@/components/ProfileLive';


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

  // Today-only metadata — cards advertise today's number, not lifetime.
  const today = todayLocal();
  const { data: todayStats } = await supabase
    .from('daily_stats')
    .select('tokens_total')
    .eq('user_id', user.id)
    .eq('date', today)
    .maybeSingle();

  const tokensToday = Number(todayStats?.tokens_total ?? 0);
  const name = user.display_name || `@${handle}`;
  const tokens = tokensToday > 0 ? formatCompact(tokensToday) : null;
  const title = tokens
    ? `@${handle} — ${tokens} AI tokens today`
    : `@${handle} on vibecodestats.dev`;
  const description = tokens
    ? `${name} pushed ${tokens} AI tokens today. Live on the vibecodestats.dev leaderboard — track your own Claude Code + Codex usage too.`
    : `${name} on vibecodestats.dev. Track your Claude Code + Codex daily token usage.`;

  // Point at the pre-rendered static PNG in Supabase Storage rather than the
  // edge-rendered route. X / LinkedIn / FB bots get a boring static asset
  // from a CDN — no edge runtime, no Satori, no cache games. The PNG is
  // refreshed on every /api/ingest push (fire-and-forget, see lib/og/regenerate).
  //
  // The og:image route at /[handle]/opengraph-image still exists as the
  // canonical generator that /api/ingest fetches; we just don't expose it
  // to social crawlers directly. See: vercel/next.js#78511 for the
  // X-crawler-needs-explicit-descriptor regression we sidestep here.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://vibecodestats.dev';
  const staticOgUrl = ogImageUrl(handle);
  const ogImage = {
    url: staticOgUrl,
    secureUrl: staticOgUrl,
    type: 'image/png',
    width: 1200,
    height: 630,
    alt: title,
  };

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'profile',
      url: `${siteUrl}/${handle}`,
      siteName: 'vibecodestats.dev',
      images: [ogImage],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
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
  const today = todayLocal();

  const liveRanking = await getLiveRanking(supabase, data.user.id, today);

  return <ProfileLive initialData={data} leaderboardData={leaderboardData} today={today} initialLiveRanking={liveRanking} viewerIsOwner={viewerIsOwner} hasEverPushed={hasEverPushed} />;
}
