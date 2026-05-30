import type { Metadata } from 'next';
import { Chakra_Petch, Sora, JetBrains_Mono } from 'next/font/google';
import { todayLocal } from '@/lib/date';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getProfileData, getLiveRanking } from '@/lib/stats/profile-data';
import { getLeaderboardData } from '@/lib/stats/leaderboard-data';
import { formatCompact } from '@/lib/format';
import { ProfileLive } from '@/components/ProfileLive';

// Neon Arcade v2 type (legibility overhaul): Chakra Petch (display) + Sora
// (body) + JetBrains Mono (every number). Loaded on the profile (a neon
// surface) the same way the landing page loads them. The `variable` option
// exposes each family as a CSS custom property the .neon-* utilities reference
// once we re-point --font-display / --font-body / --font-num on the
// .neon-surface wrapper below.
const chakraPetch = Chakra_Petch({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--neon-font-display',
  display: 'swap',
});
const sora = Sora({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--neon-font-body',
  display: 'swap',
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--neon-font-num',
  display: 'swap',
});


// Fallback token for the og:image URL on a BARE profile link (no share token).
// Bump on a card-design change to force crawlers to re-scrape the bare URL.
const OG_CARD_VERSION = 'v2';

type ProfilePageProps = {
  params: Promise<{ handle: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params, searchParams }: ProfilePageProps): Promise<Metadata> {
  const { handle } = await params;
  // The "Share on X" button appends ?v=<unique> to the profile link. Thread it
  // into the og:image URL so every share is a brand-new image URL X has never
  // cached → it must fetch the card fresh (X holds images ~7 days per URL).
  const sp = (await searchParams) ?? {};
  const shareToken = typeof sp.v === 'string' ? sp.v : undefined;
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
    ? `@${handle} · ${tokens} AI tokens today`
    : `@${handle} on vibecodestats.dev`;
  const description = tokens
    ? `${name} pushed ${tokens} AI tokens today. Live on the vibecodestats.dev leaderboard. Track your own Claude Code + Codex usage too.`
    : `${name} on vibecodestats.dev. Track your Claude Code + Codex daily token usage.`;

  // og:image points at the DYNAMIC route (/[handle]/opengraph-image), which
  // renders the card live — so a share always gets the EXACT current card, no
  // stored-PNG lag. The token makes the URL unique per share (threaded from the
  // share button) so X re-fetches; a bare link falls back to a daily-stable
  // token. We set the descriptor (width/height/type) explicitly, which is what
  // a crawler wants from a dynamic OG route.
  //
  // The static Storage PNG path (lib/og/regenerate.ts + scripts/regenerate-all-og.mjs)
  // stays in place as a one-line-revert fallback: swap ogUrl back to
  // `${ogImageUrl(handle)}?v=${ogToken}` if a crawler ever mishandles the route.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.vibecodestats.dev';
  const ogToken = shareToken ?? `${OG_CARD_VERSION}-${today}`;
  const ogUrl = `${siteUrl}/${encodeURIComponent(handle)}/opengraph-image?v=${encodeURIComponent(ogToken)}`;
  const ogImage = {
    url: ogUrl,
    secureUrl: ogUrl,
    type: 'image/png',
    width: 1200,
    height: 630,
    alt: title,
  };

  return {
    title,
    description,
    alternates: { canonical: `/${handle}` },
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

  // ProfilePage / Person structured data so search + AI crawlers understand the
  // page is a person's profile. `<` is escaped so a GitHub-derived name/handle
  // can never break out of the <script> tag.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.vibecodestats.dev';
  const profileJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    url: `${siteUrl}/${data.user.github_handle}`,
    mainEntity: {
      '@type': 'Person',
      name: data.user.display_name || `@${data.user.github_handle}`,
      alternateName: `@${data.user.github_handle}`,
      url: `${siteUrl}/${data.user.github_handle}`,
      ...(data.user.avatar_url ? { image: data.user.avatar_url } : {}),
    },
  };

  return (
    <div
      className={`neon-surface ${chakraPetch.variable} ${sora.variable} ${jetbrainsMono.variable}`}
      style={{
        ['--font-display' as string]: 'var(--neon-font-display), "Chakra Petch", ui-monospace, monospace',
        ['--font-body' as string]: 'var(--neon-font-body), "Sora", system-ui, sans-serif',
        ['--font-num' as string]: 'var(--neon-font-num), "JetBrains Mono", ui-monospace, monospace',
        minHeight: '100vh',
      }}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(profileJsonLd).replace(/</g, '\\u003c') }}
      />
      <ProfileLive
        initialData={data}
        leaderboardData={leaderboardData}
        today={today}
        initialLiveRanking={liveRanking}
        viewerIsOwner={viewerIsOwner}
        hasEverPushed={hasEverPushed}
      />
    </div>
  );
}
