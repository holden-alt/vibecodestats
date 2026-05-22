import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { recordSignupEvent } from '@/lib/notify/signup';

export const runtime = 'edge';

export async function GET(request: Request) {
  const supabase = await createClient();
  const url = new URL(request.url);
  const next = url.searchParams.get('next') ?? '/me';
  const origin = url.origin;

  // Log signin intent before redirect — funnel analytics.
  // Must await on edge runtime; fire-and-forget gets aborted on response return.
  await recordSignupEvent({
    eventType: 'signin_started',
    userAgent: request.headers.get('user-agent'),
    referer: request.headers.get('referer'),
    metadata: { next },
  });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      scopes: 'read:user',
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error || !data.url) {
    return NextResponse.json({ error: error?.message ?? 'unknown' }, { status: 500 });
  }

  return NextResponse.redirect(data.url, { status: 302 });
}
