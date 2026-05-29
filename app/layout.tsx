import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { SignInWithGithubButton } from '@/components/SignInWithGithubButton';

// The site-level OG image is a STATIC PNG in Supabase Storage. The image
// renders the same live-aggregate-stats layout as per-profile cards
// (developers / active today / tokens today / top rank), but is generated
// out-of-band by scripts/generate-site-og.mjs and re-uploaded periodically
// rather than per-request. Tried an inline edge route: pushed CF Pages
// bundle past its 25 MiB limit. Storage path is stable; we just overwrite
// the bytes when we want to refresh the stats.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://vibecodestats.dev';
const SITE_OG_IMAGE = `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://srexmxntzjdhbuicqvso.supabase.co'}/storage/v1/object/public/og/_root.png`;

const siteOgImage = {
  url: SITE_OG_IMAGE,
  secureUrl: SITE_OG_IMAGE,
  type: 'image/png',
  width: 1200,
  height: 630,
  alt: 'vibecodestats.dev: the tokenmaxxing leaderboard',
};

const SITE_TITLE = 'vibecodestats.dev: the tokenmaxxing leaderboard';
const SITE_DESCRIPTION =
  'Free public leaderboard for Claude Code + Codex token usage. Your all-time tokens put you in a tier (S/A/B/C/D/HANDCODER). Pick Team Claude Code or Team Codex. Find out where you rank. No email required.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    type: 'website',
    url: SITE_URL,
    siteName: 'vibecodestats.dev',
    images: [siteOgImage],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [siteOgImage],
  },
};

async function AuthWidget() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const wrapStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    right: 0,
    padding: '0.5rem 0.9rem',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: '0.8rem',
    zIndex: 50,
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    borderBottomLeftRadius: '6px',
  };
  const dot = (color: string): React.CSSProperties => ({
    display: 'inline-block',
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: color,
  });
  const linkStyle: React.CSSProperties = {
    color: 'inherit',
    textDecoration: 'underline',
  };
  const buttonStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    padding: 0,
    color: 'inherit',
    fontFamily: 'inherit',
    fontSize: 'inherit',
    cursor: 'pointer',
    textDecoration: 'underline',
  };

  if (!user) {
    return (
      <div
        className="cc-auth-widget"
        style={{
          ...wrapStyle,
          background: '#2a1818',
          color: '#ff9a9a',
          border: '1px solid #553030',
        }}
        data-auth="anon"
      >
        <span style={dot('#ff5a5a')} />
        <span>not signed in</span>
        <SignInWithGithubButton>
          [ sign in ]
        </SignInWithGithubButton>
      </div>
    );
  }

  const handle =
    user.user_metadata?.user_name ||
    user.user_metadata?.preferred_username ||
    user.email ||
    'you';

  return (
    <div
      className="cc-auth-widget"
      style={{
        ...wrapStyle,
        background: '#142214',
        color: '#9ee59e',
        border: '1px solid #2f5a2f',
      }}
      data-auth="signed-in"
      data-handle={handle}
    >
      <span style={dot('#5ade5a')} />
      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '50vw' }}>
        @{handle}
      </span>
      <Link href="/me" prefetch={false} style={linkStyle}>[ profile ]</Link>
      <form method="post" action="/auth/signout" style={{ display: 'inline' }}>
        <button type="submit" style={buttonStyle}>[ out ]</button>
      </form>
    </div>
  );
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthWidget />
        {/* Spacer for the fixed-position AuthWidget so content doesn't render
            under it on desktop. Height covers AuthWidget at typical font size. */}
        <div aria-hidden="true" style={{ height: '2.75rem' }} />
        {children}
      </body>
    </html>
  );
}
