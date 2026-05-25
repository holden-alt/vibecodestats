import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { detectInAppBrowser, detectPlatform } from '@/lib/auth/in-app-browser';
import { CopyLinkButton } from '@/components/CopyLinkButton';

export const runtime = 'edge';

export const metadata: Metadata = {
  title: 'Open in your real browser — vibecodestats.dev',
  description:
    'GitHub sign-in does not work inside in-app browsers. Open vibecodestats.dev in Safari or Chrome to continue.',
  robots: { index: false, follow: false },
};

type Props = {
  searchParams: Promise<{ from?: string; next?: string }>;
};

export default async function OpenInBrowserPage({ searchParams }: Props) {
  const params = await searchParams;
  const next = params.next ?? '/me';
  const h = await headers();
  const ua = h.get('user-agent');
  // The `from` query param is set by the signin route based on UA at click time.
  // We also re-detect in case the user typed the URL or refreshed in a different app.
  const detected = detectInAppBrowser(ua);
  const platform = detectPlatform(ua);

  const appLabel =
    detected?.label ??
    (params.from === 'twitter' ? 'X (Twitter)' :
     params.from === 'facebook' ? 'Facebook' :
     params.from === 'instagram' ? 'Instagram' :
     params.from === 'linkedin' ? 'LinkedIn' :
     params.from === 'tiktok' ? 'TikTok' :
     'this app');

  // Site URL the user should open in their real browser. We send them to the
  // homepage so they pick up the sign-in flow cleanly from there.
  const siteUrl = 'https://vibecodestats.dev/';

  const platformHint =
    platform === 'ios'
      ? 'Tap the share icon ⎙ at the bottom (or ⋯ in the corner) and choose “Open in Safari”.'
      : platform === 'android'
      ? 'Tap the three-dot menu ⋮ in the corner and choose “Open in Chrome” (or “Open in browser”).'
      : 'Open this URL in your default browser to continue.';

  return (
    <main
      style={{
        maxWidth: 560,
        margin: '0 auto',
        padding: '64px 24px 96px',
        fontFamily: 'ui-monospace, monospace',
        color: 'var(--color-text)',
        lineHeight: 1.55,
      }}
    >
      <div
        style={{
          fontSize: '0.65rem',
          opacity: 0.6,
          textTransform: 'uppercase',
          letterSpacing: '0.15em',
          color: 'var(--chart-1)',
        }}
      >
        sign-in
      </div>
      <h1
        style={{
          fontSize: '1.7rem',
          fontWeight: 700,
          margin: '8px 0 16px',
          letterSpacing: '-0.01em',
          lineHeight: 1.15,
        }}
      >
        Open in your real browser to sign in
      </h1>
      <p style={{ fontSize: '1rem', opacity: 0.85, margin: '0 0 24px' }}>
        GitHub doesn&apos;t allow OAuth sign-in from {appLabel}&apos;s in-app browser
        — the session cookies get blocked on the way back. You&apos;ll need to open
        vibecodestats.dev in {platform === 'ios' ? 'Safari' : platform === 'android' ? 'Chrome' : 'your default browser'} to sign in.
      </p>

      <div
        style={{
          border: '1px solid var(--color-border)',
          background: 'var(--color-bg-2)',
          borderRadius: 3,
          padding: '18px 20px',
          marginBottom: 24,
        }}
      >
        <div
          style={{
            fontSize: '0.65rem',
            opacity: 0.55,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: 8,
          }}
        >
          how
        </div>
        <p style={{ margin: '0 0 14px', fontSize: '0.95rem' }}>
          {platformHint}
        </p>

        <div
          style={{
            fontSize: '0.65rem',
            opacity: 0.55,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            margin: '14px 0 6px',
          }}
        >
          the URL
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 10px',
            background: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            borderRadius: 2,
            fontSize: '0.85rem',
            fontFamily: 'ui-monospace, monospace',
            wordBreak: 'break-all',
          }}
        >
          <span style={{ flex: 1 }}>{siteUrl}</span>
          <CopyLinkButton value={siteUrl} />
        </div>
      </div>

      <details style={{ fontSize: '0.78rem', opacity: 0.7, marginTop: 16 }}>
        <summary style={{ cursor: 'pointer', userSelect: 'none' }}>
          Why doesn&apos;t this just work?
        </summary>
        <p style={{ marginTop: 8 }}>
          In-app browsers (the embedded ones inside X, Facebook, Instagram, etc.)
          don&apos;t share cookies with your real browser, often block third-party
          cookies entirely, and sometimes get killed mid-OAuth. GitHub also
          actively rejects some in-app browsers for security reasons. The result
          is a sign-in flow that looks like it&apos;s working but silently fails
          on the way back. Opening vibecodestats.dev in your real browser
          bypasses all of that and takes ~5 seconds.
        </p>
      </details>

      <p style={{ marginTop: 36, fontSize: '0.75rem', opacity: 0.55 }}>
        Headed there in {platform === 'ios' ? 'Safari' : 'your browser'}?{' '}
        <a
          href={`/auth/signin?next=${encodeURIComponent(next)}`}
          style={{ color: 'var(--chart-1)' }}
        >
          continue sign-in →
        </a>
      </p>
    </main>
  );
}
