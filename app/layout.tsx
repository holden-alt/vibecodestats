import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://vibecodestats.dev',
  ),
  title: 'vibecodestats.dev',
  description: 'Your public Claude Code vibe-coding profile.',
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
        <Link href="/auth/signin" prefetch={false} style={linkStyle}>
          [ sign in with github ]
        </Link>
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
      <span>signed in as <strong>@{handle}</strong></span>
      <Link href="/me" prefetch={false} style={linkStyle}>[ my profile ]</Link>
      <form method="post" action="/auth/signout" style={{ display: 'inline' }}>
        <button type="submit" style={buttonStyle}>[ sign out ]</button>
      </form>
    </div>
  );
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthWidget />
        {children}
      </body>
    </html>
  );
}
