import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/lib/types/database';
import { canonicalRedirectUrl } from '@/lib/canonical';
import { isSocialCrawler } from '@/lib/crawlers';

export async function updateSession(request: NextRequest) {
  // Canonicalize apex -> www for HUMANS (see lib/canonical.ts): the PKCE verifier
  // cookie is host-only, so a sign-in must start and finish on the same host.
  //
  // But NOT for social crawlers: X strips www->apex when a link is posted, then
  // scrapes the apex and refuses to follow the apex->www redirect, falling back
  // to the homepage card. So we serve crawlers the actual page on the apex (its
  // og:image is host-independent — a Supabase Storage URL — so the card is
  // correct regardless of host).
  const canonical = canonicalRedirectUrl(request.url);
  if (canonical && !isSocialCrawler(request.headers.get('user-agent'))) {
    return NextResponse.redirect(canonical, 308);
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );
  await supabase.auth.getUser();
  return response;
}
