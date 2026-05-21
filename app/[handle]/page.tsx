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
  const tokens = formatCompact(allTimeTokens);
  const dayWord = daysActive === 1 ? 'day' : 'days';
  const title = `@${handle} on vibecodestats.dev — ${tokens} Claude Code tokens`;
  const description = `${name} · ${tokens} tokens · ${daysActive} ${dayWord} vibecoding with Claude Code. See the global leaderboard of Claude Code power users at vibecodestats.dev.`;

  // X's crawler requires the FULL image descriptor (type/width/height) to render
  // summary_large_image cards reliably — inferred URLs from the colocated
  // opengraph-image.tsx file aren't enough, even though Facebook/LinkedIn handle them.
  // See: vercel/next.js#78511. Use an absolute URL so X has no path resolution to do.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://vibecodestats.dev';
  // Bump this when the image rendering changes. X aggressively caches OG image
  // responses by URL; a new query param forces a fresh fetch the next time
  // anyone shares this page on X (or LinkedIn, which is also sticky).
  const ogImageVersion = 'v3';
  const ogImageUrl = `${siteUrl}/${handle}/opengraph-image?${ogImageVersion}`;
  const ogImage = {
    url: ogImageUrl,
    secureUrl: ogImageUrl,
    type: 'image/png',
    width: 1200,
    height: 630,
    alt: `@${handle} on vibecodestats.dev — ${tokens} Claude Code tokens`,
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
  const today = new Date().toISOString().slice(0, 10);

  const liveRanking = await getLiveRanking(supabase, data.user.id, today);

  return <ProfileLive initialData={data} leaderboardData={leaderboardData} today={today} initialLiveRanking={liveRanking} viewerIsOwner={viewerIsOwner} hasEverPushed={hasEverPushed} />;
}
