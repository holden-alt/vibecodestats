import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database';

/**
 * Funnel event kinds for signup_events.event_type. Keep this enum-narrow —
 * the /admin/signups page renders different visuals per type.
 */
export type SignupEventType =
  | 'signin_started'
  | 'signin_blocked_in_app_browser'
  | 'callback_success'
  | 'callback_oauth_error'
  | 'callback_exchange_error'
  | 'callback_missing_code';

export type LogSignupEvent = {
  eventType: SignupEventType;
  authUserId?: string | null;
  userId?: string | null;
  githubHandle?: string | null;
  userAgent?: string | null;
  referer?: string | null;
  errorMessage?: string | null;
  isNewUser?: boolean | null;
  metadata?: Record<string, unknown>;
};

/**
 * Service-role Supabase client for write-side telemetry. Auth routes call this
 * fire-and-forget — never blocks the redirect path.
 */
function serviceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

/** Insert a funnel event. Soft-fails: any error is swallowed so the auth path keeps working. */
export async function logSignupEvent(e: LogSignupEvent): Promise<void> {
  try {
    const supabase = serviceClient();
    await supabase.from('signup_events').insert({
      event_type: e.eventType,
      auth_user_id: e.authUserId ?? null,
      user_id: e.userId ?? null,
      github_handle: e.githubHandle ?? null,
      user_agent: e.userAgent ?? null,
      referer: e.referer ?? null,
      error_message: e.errorMessage ?? null,
      is_new_user: e.isNewUser ?? null,
      metadata: (e.metadata ?? {}) as never,
    });
  } catch {
    // never throw from telemetry
  }
}

/**
 * Email the site owner about a signup event. Gated on RESEND_API_KEY — when
 * the env var is missing this is a no-op, so the system works end-to-end
 * without Resend configured.
 *
 * Sends only for the high-signal events: new user signups and failure modes.
 * Returning sign-ins do not email (would be noisy).
 */
export async function emailOwnerForSignupEvent(e: LogSignupEvent): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const ownerEmail = process.env.OWNER_EMAIL ?? 'holden@holdengr.com';
  const fromEmail = process.env.NOTIFY_FROM_EMAIL ?? 'vibecodestats <noreply@vibecodestats.dev>';

  // Skip noisy events
  const isInteresting =
    (e.eventType === 'callback_success' && e.isNewUser === true) ||
    e.eventType === 'callback_oauth_error' ||
    e.eventType === 'callback_exchange_error' ||
    e.eventType === 'callback_missing_code';
  if (!isInteresting) return;

  const subject =
    e.eventType === 'callback_success'
      ? `vibecodestats: new signup — @${e.githubHandle ?? 'unknown'}`
      : `vibecodestats: signup FAILED — ${e.eventType}`;

  const lines = [
    `Event: ${e.eventType}`,
    e.githubHandle ? `Handle: @${e.githubHandle}` : null,
    e.errorMessage ? `Error: ${e.errorMessage}` : null,
    e.userAgent ? `UA: ${e.userAgent}` : null,
    e.referer ? `Referer: ${e.referer}` : null,
    e.userId ? `User ID: ${e.userId}` : null,
    '',
    'View funnel: https://vibecodestats.dev/admin/signups',
  ].filter(Boolean) as string[];

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [ownerEmail],
        subject,
        text: lines.join('\n'),
      }),
    });
  } catch {
    // never throw from notification path
  }
}

/**
 * Combined helper: log + (gated) email. Use this from auth routes — and
 * AWAIT it. On Cloudflare's edge runtime, fire-and-forget promises get
 * aborted when the response is returned (no waitUntil in Next.js edge yet),
 * so we have to actually await both calls. Adds ~100-300ms to signin path.
 */
export async function recordSignupEvent(e: LogSignupEvent): Promise<void> {
  await Promise.allSettled([
    logSignupEvent(e),
    emailOwnerForSignupEvent(e),
  ]);
}
