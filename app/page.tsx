import Link from 'next/link';
import { Orbitron, Rajdhani } from 'next/font/google';
import { todayLocal } from '@/lib/date';
import { createClient } from '@/lib/supabase/server';
import { formatCompact } from '@/lib/format';
import { LandingHero, HeroCardPreview } from '@/components/landing/LandingHero';

// Neon Arcade display + body type. Loaded here (the landing page) rather than
// in the root layout: root-layout.test.tsx asserts the layout imports no
// Google font, and the arcade type is only needed where neon surfaces mount.
// The `variable` option exposes the families as CSS custom properties that the
// .neon-* utility classes (which reference --font-display / --font-body) pick up
// when we re-point those vars on the .neon-surface wrapper.
const orbitron = Orbitron({
  subsets: ['latin'],
  weight: ['500', '700', '900'],
  variable: '--neon-font-display',
  display: 'swap',
});
const rajdhani = Rajdhani({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--neon-font-body',
  display: 'swap',
});

export default async function HomePage() {
  const supabase = await createClient();
  // pull today's top 5 for social proof
  const today = todayLocal();
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
    <main
      className={`neon-surface ${orbitron.variable} ${rajdhani.variable}`}
      style={{
        // Re-point the literal font-family vars the .neon-* utilities reference
        // at the hashed next/font families, with the loaded fonts first.
        ['--font-display' as string]: `var(--neon-font-display), "Orbitron", ${'ui-monospace, monospace'}`,
        ['--font-body' as string]: `var(--neon-font-body), "Rajdhani", system-ui, sans-serif`,
        minHeight: '100vh',
      }}
    >
      <LandingHero />

      <HeroCardPreview />

      {/* LIVE TOP 5 TODAY — neon leaderboard preview */}
      <section style={{ maxWidth: 1120, margin: '0 auto', padding: '0 24px 64px' }}>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 12,
            letterSpacing: '0.32em',
            textTransform: 'uppercase',
            color: 'var(--team-cx)',
            textShadow: '0 0 14px rgba(60,216,255,0.6)',
            marginBottom: 10,
          }}
        >
          Live · Top 5 today
        </div>
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 'clamp(24px, 4vw, 36px)',
            textTransform: 'uppercase',
            letterSpacing: '-0.01em',
            marginBottom: 24,
          }}
        >
          Climb the <span className="neon-foil-text">ranks</span>
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {top.length === 0 ? (
            <div
              className="neon-glass"
              style={{
                padding: '20px 22px',
                color: 'var(--neon-txt-dim)',
                fontFamily: 'var(--font-body)',
                fontSize: '0.95rem',
              }}
            >
              No activity yet today — be the first.
            </div>
          ) : (
            top.map((r, i) => (
              <Link
                key={r.handle}
                href={`/${r.handle}`}
                prefetch={false}
                className="neon-row neon-glass neon-row-in"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '48px 1fr auto',
                  alignItems: 'center',
                  gap: 18,
                  padding: '16px 22px',
                  color: 'inherit',
                  textDecoration: 'none',
                  animationDelay: `${i * 0.08}s`,
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 900,
                    fontSize: 22,
                    textAlign: 'center',
                    color: i === 0 ? undefined : 'var(--neon-txt-dim)',
                  }}
                  className={i === 0 ? 'neon-foil-text-static' : undefined}
                >
                  {i + 1}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    fontSize: 17,
                  }}
                >
                  @{r.handle}
                </span>
                <span
                  className={i === 0 ? 'neon-foil-text-static' : undefined}
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 800,
                    fontSize: 20,
                    fontVariantNumeric: 'tabular-nums',
                    color: i === 0 ? undefined : 'var(--team-cc)',
                    textAlign: 'right',
                  }}
                >
                  {formatCompact(r.tokens)}
                </span>
              </Link>
            ))
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: 28 }}>
          <Link
            href="/leaderboard"
            prefetch={false}
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 13,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--team-cx)',
              textDecoration: 'none',
              borderBottom: '1px solid rgba(60,216,255,0.4)',
              paddingBottom: 2,
            }}
          >
            See the full leaderboard →
          </Link>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section style={{ maxWidth: 1120, margin: '0 auto', padding: '0 24px 64px' }}>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 12,
            letterSpacing: '0.32em',
            textTransform: 'uppercase',
            color: 'var(--team-cx)',
            textShadow: '0 0 14px rgba(60,216,255,0.6)',
            marginBottom: 10,
          }}
        >
          How it works
        </div>
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 'clamp(24px, 4vw, 36px)',
            textTransform: 'uppercase',
            letterSpacing: '-0.01em',
            marginBottom: 24,
          }}
        >
          Three steps to a <span className="neon-foil-text">card</span>
        </h2>
        <ol
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 16,
            padding: 0,
            listStyle: 'none',
          }}
        >
          <Step
            n={1}
            title="Sign in with GitHub"
            body="OAuth. We use your handle as your profile URL. Read-only scope."
          />
          <Step
            n={2}
            title="Run a one-line installer"
            body="Drops a tiny script that hooks into Claude Code. Reads aggregate stats from your local session logs (never your code or prompts)."
          />
          <Step
            n={3}
            title="Watch your numbers go up"
            body="Profile updates live as you code. Climb the leaderboard. Share your card."
          />
        </ol>
      </section>

      {/* FOOTER */}
      <footer
        style={{
          textAlign: 'center',
          padding: '40px 24px 64px',
          borderTop: '1px solid var(--neon-line)',
          color: 'var(--neon-txt-dim)',
          fontFamily: 'var(--font-body)',
        }}
      >
        <div
          className="neon-foil-text-static"
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 900,
            fontSize: 16,
            letterSpacing: '0.06em',
            marginBottom: 12,
          }}
        >
          VIBECODESTATS.DEV
        </div>
        <div
          style={{
            display: 'flex',
            gap: 18,
            justifyContent: 'center',
            flexWrap: 'wrap',
            fontSize: 13,
            letterSpacing: '0.04em',
          }}
        >
          <a href="https://github.com/holden-alt/vibecodestats" style={{ color: 'inherit' }}>
            github
          </a>
          <Link href="/methodology" prefetch={false} style={{ color: 'inherit' }}>
            tiers + teams
          </Link>
          <Link href="/holden-alt" prefetch={false} style={{ color: 'inherit' }}>
            my profile
          </Link>
          <a href="https://x.com/realholdengr" style={{ color: 'inherit' }}>
            @realholdengr
          </a>
        </div>
        <div style={{ marginTop: 14, fontSize: 12, letterSpacing: '0.06em', opacity: 0.7 }}>
          The tokenmaxxing leaderboard · Season 1 · America/New_York
        </div>
      </footer>
    </main>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <li className="neon-glass" style={{ padding: '22px 22px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
      <div
        className="neon-foil-text-static"
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 900,
          fontSize: 28,
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        {n}
      </div>
      <div>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: '1rem',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-body)',
            color: 'var(--neon-txt-dim)',
            fontSize: '0.95rem',
            marginTop: 6,
            lineHeight: 1.5,
          }}
        >
          {body}
        </div>
      </div>
    </li>
  );
}
