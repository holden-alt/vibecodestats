import './globals.css';
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'vibecodestats.dev',
  description: 'Your public Claude Code vibe-coding profile.',
};

async function AuthWidget() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const wrapStyle: React.CSSProperties = {
    position: 'fixed',
    top: '0.75rem',
    right: '1rem',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: '0.85rem',
    color: '#7ad17a',
    zIndex: 50,
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  };
  const linkStyle: React.CSSProperties = {
    color: '#7ad17a',
    textDecoration: 'underline',
  };
  const buttonStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    padding: 0,
    color: '#7ad17a',
    fontFamily: 'inherit',
    fontSize: 'inherit',
    cursor: 'pointer',
    textDecoration: 'underline',
  };

  if (!user) {
    return (
      <div style={wrapStyle}>
        <a href="/auth/signin" style={linkStyle}>$ sign in</a>
      </div>
    );
  }

  return (
    <div style={wrapStyle}>
      <a href="/me" style={linkStyle}>$ me</a>
      <form method="post" action="/auth/signout" style={{ display: 'inline' }}>
        <button type="submit" style={buttonStyle}>$ sign out</button>
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
