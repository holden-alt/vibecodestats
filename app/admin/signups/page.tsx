import { redirect } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { createClient as createSsrClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/types/database';

export const runtime = 'edge';

const OWNER_HANDLES = (process.env.OWNER_HANDLES ?? 'holden-alt,realholdengr')
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean);

type Event = {
  id: string;
  created_at: string;
  event_type: string;
  github_handle: string | null;
  error_message: string | null;
  is_new_user: boolean | null;
  user_agent: string | null;
  referer: string | null;
  metadata: Record<string, unknown> | null;
};

const eventColor: Record<string, string> = {
  signin_started: '#8a8a95',
  callback_success: '#7ad17a',
  callback_oauth_error: '#ff7a7a',
  callback_exchange_error: '#ff7a7a',
  callback_missing_code: '#ffd400',
};

const eventLabel: Record<string, string> = {
  signin_started: 'started',
  callback_success: 'success',
  callback_oauth_error: 'oauth error',
  callback_exchange_error: 'exchange error',
  callback_missing_code: 'missing code',
};

function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
}

function shortUA(ua: string | null) {
  if (!ua) return '';
  if (ua.includes('iPhone')) return 'iPhone';
  if (ua.includes('iPad')) return 'iPad';
  if (ua.includes('Android')) return 'Android';
  if (ua.includes('Mac OS X')) return 'Mac';
  if (ua.includes('Windows')) return 'Windows';
  if (ua.includes('Linux')) return 'Linux';
  if (ua.includes('curl')) return 'curl';
  return ua.slice(0, 30);
}

export default async function AdminSignupsPage() {
  // Auth gate: only owner handles see this page.
  const ssr = await createSsrClient();
  const {
    data: { user: authUser },
  } = await ssr.auth.getUser();

  if (!authUser) {
    redirect('/auth/signin?next=/admin/signups');
  }

  const { data: me } = await ssr
    .from('users')
    .select('github_handle')
    .eq('auth_id', authUser.id)
    .maybeSingle();

  if (!me || !OWNER_HANDLES.includes(me.github_handle)) {
    return (
      <main style={{ padding: '48px 24px', maxWidth: 720, margin: '0 auto', fontFamily: 'ui-monospace, monospace' }}>
        <h1 style={{ fontSize: 24, color: '#ff7a7a' }}>403</h1>
        <p style={{ opacity: 0.7, marginTop: 8 }}>
          this page is owner-only. signed in as <strong>@{me?.github_handle ?? 'unknown'}</strong>.
        </p>
      </main>
    );
  }

  // Read recent events via service role (RLS-free).
  const svc = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const { data: events } = await svc
    .from('signup_events')
    .select(
      'id, created_at, event_type, github_handle, error_message, is_new_user, user_agent, referer, metadata',
    )
    .order('created_at', { ascending: false })
    .limit(200);

  const rows = (events ?? []) as Event[];

  // Summary counters
  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.event_type] = (acc[r.event_type] ?? 0) + 1;
    return acc;
  }, {});
  const newUsers = rows.filter((r) => r.event_type === 'callback_success' && r.is_new_user).length;

  return (
    <main
      style={{
        padding: '32px 24px 96px',
        maxWidth: 1100,
        margin: '0 auto',
        fontFamily: 'ui-monospace, monospace',
        fontSize: 13,
      }}
    >
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Signup funnel</h1>
      <p style={{ opacity: 0.6, marginBottom: 24 }}>
        last 200 events · auto-refreshes on page reload
      </p>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        <Counter label="New signups" value={newUsers} color="#7ad17a" />
        <Counter label="Signin starts" value={counts.signin_started ?? 0} />
        <Counter label="Successes" value={counts.callback_success ?? 0} color="#7ad17a" />
        <Counter label="OAuth errors" value={counts.callback_oauth_error ?? 0} color="#ff7a7a" />
        <Counter label="Exchange errors" value={counts.callback_exchange_error ?? 0} color="#ff7a7a" />
        <Counter label="Missing code" value={counts.callback_missing_code ?? 0} color="#ffd400" />
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #2a2a32', textAlign: 'left' }}>
              <th style={{ padding: '8px 10px' }}>Time</th>
              <th style={{ padding: '8px 10px' }}>Event</th>
              <th style={{ padding: '8px 10px' }}>Handle</th>
              <th style={{ padding: '8px 10px' }}>UA</th>
              <th style={{ padding: '8px 10px' }}>Referer</th>
              <th style={{ padding: '8px 10px' }}>Error</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 24, opacity: 0.55 }}>
                  no events yet — wait for the first sign-in attempt
                </td>
              </tr>
            ) : (
              rows.map((e) => (
                <tr key={e.id} style={{ borderBottom: '1px solid #1f1f26' }}>
                  <td style={{ padding: '6px 10px', opacity: 0.7, whiteSpace: 'nowrap' }}>
                    {fmtTime(e.created_at)}
                  </td>
                  <td style={{ padding: '6px 10px' }}>
                    <span
                      style={{
                        color: eventColor[e.event_type] ?? '#ece6dc',
                        borderBottom: e.is_new_user ? '1px dashed #7ad17a' : 'none',
                      }}
                    >
                      {eventLabel[e.event_type] ?? e.event_type}
                    </span>
                    {e.is_new_user ? (
                      <span style={{ color: '#7ad17a', marginLeft: 6, fontWeight: 700 }}>NEW</span>
                    ) : null}
                  </td>
                  <td style={{ padding: '6px 10px' }}>
                    {e.github_handle ? `@${e.github_handle}` : ''}
                  </td>
                  <td style={{ padding: '6px 10px', opacity: 0.65 }}>{shortUA(e.user_agent)}</td>
                  <td style={{ padding: '6px 10px', opacity: 0.65, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.referer ? new URL(e.referer).hostname : ''}
                  </td>
                  <td style={{ padding: '6px 10px', color: '#ff9a9a', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.error_message ?? ''}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function Counter({ label, value, color = '#ece6dc' }: { label: string; value: number; color?: string }) {
  return (
    <div
      style={{
        border: '1px solid #2a2a32',
        background: '#15151a',
        padding: '10px 14px',
        borderRadius: 3,
        minWidth: 110,
      }}
    >
      <div style={{ fontSize: 11, opacity: 0.6, textTransform: 'uppercase', letterSpacing: '1px' }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color, marginTop: 2 }}>{value}</div>
    </div>
  );
}
