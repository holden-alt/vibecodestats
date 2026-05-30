import { redirect } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { createClient as createSsrClient } from '@/lib/supabase/server';
import { CopyLinkButton } from '@/components/CopyLinkButton';
import { SignupsFunnel } from '@/components/admin/SignupsFunnel';
import type { SignupEvent } from '@/components/admin/SignupsFunnel';
import type { Database } from '@/lib/types/database';
import { ogImageUrl } from '@/lib/og/regenerate';


const OWNER_HANDLES = (process.env.OWNER_HANDLES ?? 'holden-alt,realholdengr')
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean);

export default async function AdminPage() {
  // Auth gate: same pattern as /admin/signups.
  const ssr = await createSsrClient();
  const {
    data: { user: authUser },
  } = await ssr.auth.getUser();

  if (!authUser) {
    redirect('/auth/signin?next=/admin');
  }

  const { data: me } = await ssr
    .from('users')
    .select('github_handle')
    .eq('auth_id', authUser.id)
    .maybeSingle();

  if (!me || !OWNER_HANDLES.includes(me.github_handle)) {
    return (
      <main
        style={{
          padding: '48px 24px',
          maxWidth: 720,
          margin: '0 auto',
          fontFamily: 'ui-monospace, monospace',
        }}
      >
        <h1 style={{ fontSize: 24, color: '#ff7a7a' }}>403</h1>
        <p style={{ opacity: 0.7, marginTop: 8 }}>
          this page is owner-only. signed in as{' '}
          <strong>@{me?.github_handle ?? 'unknown'}</strong>.
        </p>
      </main>
    );
  }

  // Service-role client for RLS-free reads.
  const svc = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Fetch all users for per-handle OG cards.
  const { data: usersData } = await svc
    .from('users')
    .select('github_handle')
    .order('github_handle', { ascending: true });

  const userHandles = (usersData ?? [])
    .map((u) => u.github_handle)
    .filter((h): h is string => !!h);

  // Fetch signup events for the funnel section.
  const { data: events } = await svc
    .from('signup_events')
    .select(
      'id, created_at, event_type, github_handle, error_message, is_new_user, user_agent, referer, metadata',
    )
    .order('created_at', { ascending: false })
    .limit(200);

  const signupRows = (events ?? []) as SignupEvent[];

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://vibecodestats.dev').replace(/\/$/, '');
  const teamOgUrl = `${siteUrl}/api/og/team`;
  const siteOgUrl = ogImageUrl('_root');

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
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Admin</h1>
      <p style={{ opacity: 0.6, marginBottom: 36 }}>owner-only</p>

      {/* ------------------------------------------------------------------ */}
      {/* OG Images section                                                    */}
      {/* ------------------------------------------------------------------ */}
      <section style={{ marginBottom: 56 }}>
        <h2 style={{ fontSize: 16, marginBottom: 20, borderBottom: '1px solid #2a2a32', paddingBottom: 8 }}>
          OG images
        </h2>

        {/* Team scoreboard */}
        <OgCard label="Team scoreboard" url={teamOgUrl} />

        {/* Site-level OG (static PNG in Storage) */}
        <OgCard label="Site OG (_root.png)" url={siteOgUrl} />

        {/* Per-handle profile cards */}
        {userHandles.length > 0 && (
          <div style={{ marginTop: 32 }}>
            <h3 style={{ fontSize: 13, opacity: 0.7, marginBottom: 16, textTransform: 'uppercase', letterSpacing: '1px' }}>
              Profile cards
            </h3>
            {userHandles.map((handle) => (
              <OgCard
                key={handle}
                label={`@${handle}`}
                url={`${siteUrl}/${handle}/opengraph-image`}
              />
            ))}
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Signup funnel section                                                */}
      {/* ------------------------------------------------------------------ */}
      <section>
        <h2 style={{ fontSize: 16, marginBottom: 8, borderBottom: '1px solid #2a2a32', paddingBottom: 8 }}>
          Signup funnel
        </h2>
        <p style={{ opacity: 0.6, marginBottom: 24 }}>
          last 200 events · auto-refreshes on page reload
        </p>
        <SignupsFunnel rows={signupRows} />
      </section>
    </main>
  );
}

function OgCard({ label, url }: { label: string; url: string }) {
  return (
    <div
      style={{
        border: '1px solid #2a2a32',
        background: '#15151a',
        borderRadius: 4,
        padding: '16px',
        marginBottom: 16,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 12,
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontWeight: 600 }}>{label}</span>
        <code
          style={{
            fontSize: 11,
            opacity: 0.75,
            background: '#0e0e12',
            padding: '2px 6px',
            borderRadius: 2,
            wordBreak: 'break-all',
          }}
        >
          {url}
        </code>
        <CopyLinkButton value={url} label="copy url" />
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={label}
        style={{
          display: 'block',
          maxWidth: 480,
          width: '100%',
          border: '1px solid #2a2a32',
          borderRadius: 2,
        }}
      />
    </div>
  );
}
