import { createClient } from '@supabase/supabase-js';

/**
 * Install/ingest telemetry. One row per /api/ingest attempt so we can see who
 * tried, whether it worked, and why it failed. Mirrors lib/notify/signup.ts.
 */
export type IngestOutcome =
  | 'success'
  | 'invalid_token'
  | 'missing_auth'
  | 'bad_payload'
  | 'error';

export type LogIngestEvent = {
  outcome: IngestOutcome;
  userId?: string | null;
  githubHandle?: string | null;
  machine?: string | null;
  detail?: string | null;
  userAgent?: string | null;
  payloadDate?: string | null;
  tokensTotal?: number | null;
};

/**
 * Insert an ingest funnel event. Soft-fails: any error is swallowed so the
 * ingest path keeps working. Uses an UNtyped service-role client on purpose —
 * ingest_events isn't in the generated Database type and this is write-only
 * telemetry. MUST be awaited from the route: on Cloudflare's edge runtime a
 * fire-and-forget insert is cancelled when the response returns.
 */
export async function logIngestEvent(e: LogIngestEvent): Promise<void> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    await supabase.from('ingest_events').insert({
      outcome: e.outcome,
      user_id: e.userId ?? null,
      github_handle: e.githubHandle ?? null,
      machine: e.machine ?? null,
      detail: e.detail ?? null,
      user_agent: e.userAgent ?? null,
      payload_date: e.payloadDate ?? null,
      tokens_total: e.tokensTotal ?? null,
    });
  } catch {
    // never throw from telemetry
  }
}
