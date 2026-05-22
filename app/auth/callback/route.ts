import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { recordSignupEvent } from '@/lib/notify/signup';

export const runtime = 'edge';

/**
 * Treat a user as "new" if their public users row was created within this
 * window before the callback fired. Generous to avoid false negatives on
 * slow signup-trigger execution.
 */
const NEW_USER_WINDOW_MS = 30_000;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const oauthError = url.searchParams.get('error');
  const oauthErrorDescription = url.searchParams.get('error_description');
  const next = url.searchParams.get('next') ?? '/me';

  const userAgent = request.headers.get('user-agent');
  const referer = request.headers.get('referer');

  // Case 1: GitHub returned an OAuth error (user denied, app misconfigured, etc.)
  if (oauthError) {
    void recordSignupEvent({
      eventType: 'callback_oauth_error',
      userAgent,
      referer,
      errorMessage: oauthErrorDescription ?? oauthError,
      metadata: { oauthError, oauthErrorDescription },
    });
    return NextResponse.json(
      { error: oauthError, description: oauthErrorDescription },
      { status: 401 },
    );
  }

  // Case 2: Missing code AND no error param — someone hit the URL directly.
  if (!code) {
    void recordSignupEvent({
      eventType: 'callback_missing_code',
      userAgent,
      referer,
      errorMessage: 'callback hit without code or error param',
    });
    return NextResponse.json({ error: 'missing code' }, { status: 400 });
  }

  // Case 3: Exchange the code for a session.
  const supabase = await createClient();
  const { data: sessionData, error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    void recordSignupEvent({
      eventType: 'callback_exchange_error',
      userAgent,
      referer,
      errorMessage: exchangeError.message,
    });
    return NextResponse.json({ error: exchangeError.message }, { status: 401 });
  }

  // Case 4: success. Resolve the public users row to detect new vs returning.
  const authUser = sessionData?.user ?? null;
  const authUserId = authUser?.id ?? null;
  const handleFromMeta =
    (authUser?.user_metadata?.user_name as string | undefined) ??
    (authUser?.user_metadata?.preferred_username as string | undefined) ??
    null;

  let publicUserId: string | null = null;
  let publicHandle: string | null = handleFromMeta;
  let isNewUser: boolean | null = null;

  if (authUserId) {
    const { data: publicUser } = await supabase
      .from('users')
      .select('id, github_handle, created_at')
      .eq('auth_id', authUserId)
      .maybeSingle();

    if (publicUser) {
      publicUserId = publicUser.id;
      publicHandle = publicUser.github_handle ?? handleFromMeta;
      const created = new Date(publicUser.created_at).getTime();
      const now = Date.now();
      isNewUser = now - created <= NEW_USER_WINDOW_MS;
    }
  }

  void recordSignupEvent({
    eventType: 'callback_success',
    authUserId,
    userId: publicUserId,
    githubHandle: publicHandle,
    userAgent,
    referer,
    isNewUser,
    metadata: { next },
  });

  return NextResponse.redirect(`${url.origin}${next}`, { status: 302 });
}
