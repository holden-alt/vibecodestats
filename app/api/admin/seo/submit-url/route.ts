import { createClient } from '@/lib/supabase/server';
import { submitUrls, type IndexingResult } from '@/lib/seo/google-indexing';
import { compareTools } from '@/lib/seo/compare-data';

export const runtime = 'edge';

const OWNER_HANDLES = (process.env.OWNER_HANDLES ?? 'holden-alt,realholdengr')
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean);

/**
 * Owner-only: submit URL(s) to Google's Indexing API.
 *
 * POST /api/admin/seo/submit-url
 *
 * Body shapes:
 *   { "url": "https://vibecodestats.dev/compare/cursor" }
 *     → submits a single URL.
 *   { "urls": ["...", "..."] }
 *     → submits a list.
 *   { "all": true }
 *     → submits every URL currently in the sitemap (currently: 3 static + 5 compare).
 *
 * Auth: signed-in user's github_handle must be in OWNER_HANDLES env var.
 * Quota: Google Indexing API limit is 200 publish/day per project.
 */
export async function POST(request: Request): Promise<Response> {
  // Auth gate
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) {
    return Response.json({ error: 'not signed in' }, { status: 401 });
  }
  const { data: me } = await supabase
    .from('users')
    .select('github_handle')
    .eq('auth_id', authUser.id)
    .maybeSingle();
  if (!me || !OWNER_HANDLES.includes(me.github_handle)) {
    return Response.json({ error: 'owner-only' }, { status: 403 });
  }

  // Parse body
  let body: { url?: string; urls?: string[]; all?: boolean };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: 'invalid json' }, { status: 400 });
  }

  // Resolve URL list
  let urls: string[];
  if (body.all) {
    const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://vibecodestats.dev';
    urls = [
      `${site}/`,
      `${site}/leaderboard`,
      `${site}/setup`,
      ...compareTools.map((t) => `${site}/compare/${t.slug}`),
    ];
  } else if (body.urls && Array.isArray(body.urls)) {
    urls = body.urls;
  } else if (typeof body.url === 'string') {
    urls = [body.url];
  } else {
    return Response.json(
      { error: 'body must include {url}, {urls: [...]}, or {all: true}' },
      { status: 400 },
    );
  }

  // Validate URLs are on our site (defense against this endpoint being used to
  // submit unrelated URLs and burn quota or abuse the SA credentials).
  const allowedHost = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://vibecodestats.dev')
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '');
  const invalid = urls.filter((u) => {
    try {
      const host = new URL(u).host;
      return host !== allowedHost && host !== `www.${allowedHost}`;
    } catch {
      return true;
    }
  });
  if (invalid.length > 0) {
    return Response.json(
      { error: 'urls must be on vibecodestats.dev', invalid },
      { status: 400 },
    );
  }

  // Submit
  let results: IndexingResult[];
  try {
    results = await submitUrls(urls, 'URL_UPDATED');
  } catch (e) {
    return Response.json(
      { error: 'submission failed', detail: (e as Error).message },
      { status: 500 },
    );
  }

  const succeeded = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  return Response.json({
    submitted: urls.length,
    succeeded,
    failed,
    results,
  });
}

/** Convenience GET — returns the list of URLs currently in the sitemap. */
export async function GET(): Promise<Response> {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://vibecodestats.dev';
  const urls = [
    `${site}/`,
    `${site}/leaderboard`,
    `${site}/setup`,
    ...compareTools.map((t) => `${site}/compare/${t.slug}`),
  ];
  return Response.json({ count: urls.length, urls });
}
