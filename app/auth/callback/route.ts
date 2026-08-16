import { NextResponse } from 'next/server';
import { createClient } from '@/lib/db/server';
import { oauthReturnPath } from '@/lib/auth/github';
import { recordSignupEvent } from '@/lib/notify/signup';


/**
 * Treat a user as "new" if their public users row was created within this
 * window before the callback fired. Generous to avoid false negatives on
 * slow signup-trigger execution.
 */
const NEW_USER_WINDOW_MS = 30_000;

function htmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Render a real, mobile-friendly error page. Replaces the v1 raw-JSON 401/400
 * responses that looked like broken pages on phones.
 */
function errorPage(opts: {
  status: number;
  title: string;
  message: string;
  hint?: string | undefined;
  retryHref?: string | undefined;
}): Response {
  const { status, title, message, hint, retryHref = '/auth/signin' } = opts;
  const html = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${htmlEscape(title)} — vibecodestats.dev</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #0a0a0c; color: #e8e8ed; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; line-height: 1.55; }
  main { max-width: 520px; margin: 0 auto; padding: 64px 20px 80px; }
  .eyebrow { font-size: 11px; opacity: 0.6; text-transform: uppercase; letter-spacing: 0.15em; color: #d97757; }
  h1 { font-size: 1.5rem; font-weight: 700; margin: 8px 0 16px; letter-spacing: -0.01em; line-height: 1.15; }
  p { font-size: 0.95rem; margin: 0 0 16px; opacity: 0.9; }
  .hint { font-size: 0.85rem; opacity: 0.75; padding: 12px 14px; border-left: 2px solid #d97757; background: #15151a; border-radius: 0 3px 3px 0; }
  .actions { display: flex; gap: 12px; margin-top: 24px; }
  .btn { display: inline-block; padding: 10px 18px; border-radius: 3px; text-decoration: none; font-size: 0.9rem; font-weight: 600; }
  .primary { background: #d97757; color: #0a0a0c; }
  .ghost { border: 1px solid #2a2a32; color: #e8e8ed; }
</style></head><body>
<main>
  <div class="eyebrow">sign-in problem</div>
  <h1>${htmlEscape(title)}</h1>
  <p>${htmlEscape(message)}</p>
  ${hint ? `<div class="hint">${htmlEscape(hint)}</div>` : ''}
  <div class="actions">
    <a class="btn primary" href="${htmlEscape(retryHref)}">try again →</a>
    <a class="btn ghost" href="/">home</a>
  </div>
</main>
</body></html>`;
  return new Response(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const oauthError = url.searchParams.get('error');
  const oauthErrorDescription = url.searchParams.get('error_description');
  const next = oauthReturnPath(state);
  const retryHref = `/auth/signin?next=${encodeURIComponent(next)}`;

  const userAgent = request.headers.get('user-agent');
  const referer = request.headers.get('referer');

  // Case 1: GitHub returned an OAuth error (user denied, app misconfigured, etc.)
  if (oauthError) {
    await recordSignupEvent({
      eventType: 'callback_oauth_error',
      userAgent,
      referer,
      errorMessage: oauthErrorDescription ?? oauthError,
      metadata: { oauthError, oauthErrorDescription },
    });
    const isDenied = oauthError === 'access_denied';
    return errorPage({
      status: 401,
      title: isDenied ? "Sign-in was cancelled" : "GitHub returned an error",
      message: isDenied
        ? "Looks like you denied access to GitHub. No worries — try again if it was a mis-tap."
        : (oauthErrorDescription ?? oauthError),
      retryHref,
    });
  }

  // Case 2: Missing code AND no error param — someone hit the URL directly.
  if (!code) {
    await recordSignupEvent({
      eventType: 'callback_missing_code',
      userAgent,
      referer,
      errorMessage: 'callback hit without code or error param',
    });
    return errorPage({
      status: 400,
      title: "This page is part of the sign-in flow",
      message: "You'll see this if you opened the callback URL directly. To sign in, head to the sign-in page.",
      retryHref,
    });
  }

  // Case 3: Exchange the code for a session.
  const database = await createClient();
  const { data: sessionData, error: exchangeError } =
    await database.auth.exchangeCodeForSession(code, state);

  if (exchangeError) {
    await recordSignupEvent({
      eventType: 'callback_exchange_error',
      userAgent,
      referer,
      errorMessage: exchangeError.message,
    });
    const isPkceMismatch = /code (challenge|verifier)/i.test(exchangeError.message);
    return errorPage({
      status: 401,
      title: isPkceMismatch ? "Looks like you tapped sign-in a couple of times" : "Couldn't finish sign-in",
      message: isPkceMismatch
        ? "When the sign-in button gets tapped multiple times in a row, the security cookies get mixed up. Try again and tap just once — it'll go through."
        : exchangeError.message,
      hint: isPkceMismatch ? "Tip: after tapping, give it 2-3 seconds to redirect to GitHub before tapping anywhere else." : undefined,
      retryHref,
    });
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
    const { data: publicUser } = await database
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

  // MUST await: on Cloudflare's edge runtime there is no waitUntil, so a
  // fire-and-forget insert is cancelled when the redirect response returns —
  // which is why callback_success never landed while logins actually succeeded.
  // (Mirrors the awaited error branches above; see lib/notify/signup.ts.)
  await recordSignupEvent({
    eventType: 'callback_success',
    authUserId,
    userId: publicUserId,
    githubHandle: publicHandle,
    userAgent,
    referer,
    isNewUser,
    metadata: { next, hasEmail: !!authUser?.email },
  });

  return NextResponse.redirect(`${url.origin}${next}`, { status: 302 });
}
