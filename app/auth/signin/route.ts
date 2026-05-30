import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { recordSignupEvent } from '@/lib/notify/signup';
import { detectInAppBrowser } from '@/lib/auth/in-app-browser';


export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = url.searchParams.get('next') ?? '/me';
  const origin = url.origin;
  const userAgent = request.headers.get('user-agent');
  const referer = request.headers.get('referer');

  // In-app browsers (Twitter, Facebook, Instagram, LinkedIn, TikTok, etc.) almost
  // always fail the OAuth round-trip — third-party cookie restrictions, session
  // loss on redirect-back, occasional GitHub blocking. Bounce to a helpful
  // interstitial page instead of starting a doomed OAuth dance. Saves the user
  // from clicking "sign in" seven times with no feedback (which is what one
  // X visitor did on 5-23 before this fix).
  const inApp = detectInAppBrowser(userAgent);
  if (inApp) {
    await recordSignupEvent({
      eventType: 'signin_blocked_in_app_browser',
      userAgent,
      referer,
      metadata: { next, inAppBrowser: inApp.id, label: inApp.label },
    });
    return NextResponse.redirect(
      `${origin}/auth/open-in-browser?from=${encodeURIComponent(inApp.id)}&next=${encodeURIComponent(next)}`,
      { status: 302 },
    );
  }

  // Log signin intent before redirect — funnel analytics.
  // Must await on edge runtime; fire-and-forget gets aborted on response return.
  await recordSignupEvent({
    eventType: 'signin_started',
    userAgent,
    referer,
    metadata: { next },
  });

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      scopes: 'read:user user:email',
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error || !data.url) {
    return NextResponse.json({ error: error?.message ?? 'unknown' }, { status: 500 });
  }

  return NextResponse.redirect(data.url, { status: 302 });
}
