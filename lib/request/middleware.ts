import { NextResponse, type NextRequest } from 'next/server';
import { canonicalRedirectUrl } from '@/lib/canonical';
import { isSocialCrawler } from '@/lib/crawlers';

export async function updateRequest(request: NextRequest): Promise<NextResponse> {
  // Canonicalize apex -> www for human-facing pages. API routes keep their
  // original host because some ingest clients do not replay POST redirects.
  // Social crawlers also stay on the requested host so they receive the page's
  // real OG metadata instead of falling back to the home card.
  const isApiRoute = new URL(request.url).pathname.startsWith('/api/');
  const canonical = canonicalRedirectUrl(request.url);
  if (canonical && !isApiRoute && !isSocialCrawler(request.headers.get('user-agent'))) {
    return NextResponse.redirect(canonical, 308);
  }
  return NextResponse.next({ request });
}
