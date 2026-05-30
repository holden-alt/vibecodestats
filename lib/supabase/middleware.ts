import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/lib/types/database';
import { canonicalRedirectUrl } from '@/lib/canonical';

export async function updateSession(request: NextRequest) {
  // Canonicalize apex -> www BEFORE auth (see lib/canonical.ts): the apex
  // worker-route is wedged on CF's edge, so www is the served + canonical host.
  // The PKCE verifier cookie is host-only, so a sign-in must start and finish on
  // the same host. Keep one canonical origin.
  const canonical = canonicalRedirectUrl(request.url);
  if (canonical) return NextResponse.redirect(canonical, 308);

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
