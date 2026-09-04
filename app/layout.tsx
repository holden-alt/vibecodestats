import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';
import { IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';
import { createClient } from '@/lib/db/server';
import { SignInWithGithubButton } from '@/components/SignInWithGithubButton';

// Brand typography (Richardson Applied AI BRAND-SPEC.md): IBM Plex Sans for
// headings/body, IBM Plex Mono for numerals, labels, and machine text. The
// kit's woff2 files are wordmark subsets, so the full families load from
// Google Fonts at build time; globals.css exposes them as --font-sans/--font-mono.
const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex-sans',
  display: 'swap',
});
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-mono',
  display: 'swap',
});

// Site-level Open Graph card: the approved RAI 1200×630 export, mirrored from
// the canonical brand package (hash receipt in public/brand/BRAND-SOURCE.json).
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.vibecodestats.dev';
const SITE_OG_IMAGE = `${SITE_URL}/brand/og-image.png`;

const siteOgImage = {
  url: SITE_OG_IMAGE,
  secureUrl: SITE_OG_IMAGE,
  type: 'image/png',
  width: 1200,
  height: 630,
  alt: 'Richardson Applied AI',
};

const SITE_TITLE = 'Usage station · Richardson Applied AI';
const SITE_DESCRIPTION =
  'Richardson Applied AI usage station: how much, when, which models, which projects, and what shipped — across Claude Code, Codex, Grok, and Kimi.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    type: 'website',
    url: SITE_URL,
    siteName: 'Richardson Applied AI',
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
  const database = await createClient();
  const { data: { user } } = await database.auth.getUser();

  const wrapStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    right: 0,
    padding: '0.45rem 0.9rem',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.72rem',
    zIndex: 50,
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    borderBottomLeftRadius: 4,
    background: 'var(--color-bg-2)',
    color: 'var(--color-dim)',
    border: '1px solid var(--color-border)',
    borderTop: 'none',
    borderRight: 'none',
  };
  const dot = (color: string): React.CSSProperties => ({
    display: 'inline-block',
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: color,
  });
  const linkStyle: React.CSSProperties = {
    color: 'var(--color-text)',
    textDecoration: 'none',
  };
  const buttonStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    padding: 0,
    color: 'var(--color-text)',
    fontFamily: 'inherit',
    fontSize: 'inherit',
    cursor: 'pointer',
  };

  if (!user) {
    return (
      <div className="cc-auth-widget" style={wrapStyle} data-auth="anon">
        <span style={dot('var(--color-dim-2)')} />
        <span>not signed in</span>
        <SignInWithGithubButton>[ sign in ]</SignInWithGithubButton>
      </div>
    );
  }

  const handle = String(
    user.user_metadata?.user_name ??
      user.user_metadata?.preferred_username ??
      user.email ??
      'you',
  );

  return (
    <div className="cc-auth-widget" style={wrapStyle} data-auth="signed-in" data-handle={handle}>
      <span style={dot('var(--color-green)')} />
      <span
        style={{
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: '50vw',
          color: 'var(--color-text)',
        }}
      >
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
    <html lang="en" className={`${plexSans.variable} ${plexMono.variable}`}>
      <body>
        <AuthWidget />
        {/* Spacer for the fixed-position AuthWidget so content doesn't render
            under it on desktop. Height covers AuthWidget at typical font size. */}
        <div aria-hidden="true" style={{ height: '2.5rem' }} />
        {children}
      </body>
    </html>
  );
}
