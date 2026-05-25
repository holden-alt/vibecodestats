import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { formatCompact } from '@/lib/format';
import { ShareSiteOnX } from '@/components/ShareSiteOnX';

export const runtime = 'edge';

export default async function HomePage() {
  const supabase = await createClient();
  // pull today's top 5 for social proof
  const today = new Date().toISOString().slice(0, 10);
  const { data: stats } = await supabase
    .from('daily_stats')
    .select('tokens_total, users:user_id (github_handle)')
    .eq('date', today)
    .order('tokens_total', { ascending: false })
    .limit(5);
  type Row = { tokens_total: number; users: { github_handle: string } | null };
  const top = ((stats ?? []) as Row[])
    .filter((r) => r.users?.github_handle)
    .map((r) => ({ handle: r.users!.github_handle, tokens: r.tokens_total }));

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '64px 24px 80px', fontFamily: 'ui-monospace, monospace', color: 'var(--color-text)' }}>
      <section style={{ marginBottom: 48 }}>
        <div style={{ fontSize: '0.7rem', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--chart-1)' }}>
          vibecodestats.dev
        </div>
        <h1 style={{ fontSize: '3rem', fontWeight: 700, margin: '8px 0 16px', letterSpacing: '-0.02em', lineHeight: 1.05 }}>
          Strava for AI coding.
        </h1>
        <p style={{ fontSize: '1.1rem', opacity: 0.8, lineHeight: 1.5, margin: '0 0 28px', maxWidth: 640 }}>
          Public stats profiles, global leaderboard, live token counter. Track Claude Code + Codex daily usage and your VBW productivity score against every other AI-coding power user.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <Link
            href="/auth/signin"
            prefetch={false}
            style={{ background: 'var(--chart-1)', color: 'var(--color-bg)', padding: '12px 22px', borderRadius: 3, fontSize: '0.9rem', fontWeight: 600, textDecoration: 'none' }}
          >
            sign in with github →
          </Link>
          <ShareSiteOnX />
          <Link href="/holden-alt" prefetch={false} style={{ color: 'var(--chart-1)', fontSize: '0.85rem', textDecoration: 'underline' }}>
            see my profile
          </Link>
        </div>
      </section>

      <section style={{ marginBottom: 48 }}>
        <div style={{ fontSize: '0.65rem', opacity: 0.55, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
          live · top 5 today
        </div>
        <div style={{ border: '1px solid var(--color-border)', borderRadius: 3, padding: '14px 18px' }}>
          {top.length === 0 ? (
            <div style={{ opacity: 0.6, fontSize: '0.85rem' }}>no activity yet today — be the first.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {top.map((r, i) => (
                <Link key={r.handle} href={`/${r.handle}`} prefetch={false} style={{ display: 'flex', alignItems: 'baseline', gap: 12, fontSize: '0.85rem', color: 'inherit', textDecoration: 'none', padding: '4px 6px', borderRadius: 2 }}>
                  <span style={{ width: 24, opacity: 0.5 }}>#{i + 1}</span>
                  <span style={{ flex: 1 }}>@{r.handle}</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--chart-1)', fontWeight: 600 }}>{formatCompact(r.tokens)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <section style={{ marginBottom: 48 }}>
        <div style={{ fontSize: '0.65rem', opacity: 0.55, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
          how it works
        </div>
        <ol style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 0, listStyle: 'none', counterReset: 'step' }}>
          <Step n={1} title="sign in with github" body="OAuth. We use your handle as your profile URL. Read-only scope." />
          <Step n={2} title="run a one-line installer" body="Drops a tiny script that hooks into Claude Code. Reads aggregate stats from your local session logs (never your code or prompts)." />
          <Step n={3} title="watch your numbers go up" body="Profile updates live as you code. Climb the leaderboard. Share your card." />
        </ol>
      </section>

      <footer style={{ borderTop: '1px solid var(--color-border)', paddingTop: 18, fontSize: '0.7rem', opacity: 0.55, display: 'flex', gap: 18, flexWrap: 'wrap' }}>
        <a href="https://github.com/holden-alt/vibecodestats" style={{ color: 'inherit' }}>github</a>
        <Link href="/holden-alt" prefetch={false} style={{ color: 'inherit' }}>my profile</Link>
        <span style={{ marginLeft: 'auto' }}>made by <a href="https://x.com/realholdengr" style={{ color: 'inherit' }}>@realholdengr</a></span>
      </footer>
    </main>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <li style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--color-bg-2)', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--chart-1)', flexShrink: 0 }}>
        {n}
      </div>
      <div>
        <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{title}</div>
        <div style={{ opacity: 0.7, fontSize: '0.8rem', marginTop: 2, lineHeight: 1.5 }}>{body}</div>
      </div>
    </li>
  );
}
