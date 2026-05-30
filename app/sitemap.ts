import type { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';
import { compareTools } from '@/lib/seo/compare-data';
import { guideSlugs } from '@/lib/seo/guides-data';
import { glossarySlugs } from '@/lib/seo/glossary-data';
import { listSlugs } from '@/lib/seo/lists-data';
import { helpSlugs } from '@/lib/seo/help-data';

const SITE = 'https://www.vibecodestats.dev';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE}/`, lastModified: now, changeFrequency: 'daily', priority: 1.0 },
    { url: `${SITE}/leaderboard`, lastModified: now, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${SITE}/setup`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE}/methodology`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
  ];

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const { data: realUsers } = await sb
    .from('users')
    .select('github_handle')
    .not('auth_id', 'is', null);
  const profileRoutes: MetadataRoute.Sitemap = (realUsers ?? [])
    .filter((u) => !!u.github_handle)
    .map((u) => ({
      url: `${SITE}/${u.github_handle}`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.6,
    }));

  const compareRoutes = compareTools.map((t) => ({
    url: `${SITE}/compare/${t.slug}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  const guideRoutes = guideSlugs.map((slug) => ({
    url: `${SITE}/guides/${slug}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  const glossaryRoutes = glossarySlugs.map((slug) => ({
    url: `${SITE}/glossary/${slug}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  const listRoutes = listSlugs.map((slug) => ({
    url: `${SITE}/lists/${slug}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  const helpRoutes = helpSlugs.map((slug) => ({
    url: `${SITE}/help/${slug}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.5,
  }));

  return [
    ...staticRoutes,
    ...profileRoutes,
    ...compareRoutes,
    ...guideRoutes,
    ...glossaryRoutes,
    ...listRoutes,
    ...helpRoutes,
  ];
}
