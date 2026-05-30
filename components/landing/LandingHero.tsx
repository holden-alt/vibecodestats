import Link from 'next/link';
import { ShareSiteOnX } from '@/components/ShareSiteOnX';
import { CountUp } from './CountUp';
import { LandingSignIn } from './LandingSignIn';
import { LandingStyles } from './LandingStyles';

// Neon Arcade landing hero — ported from redesign-mockups/neon-arcade.html.
// Server component (no client state of its own); the only interactive bit is
// the <CountUp> island and the existing client CTA buttons.
//
// MOTION POLICY: the only continuous animation here is the headline foil-text
// flow (.neon-foil-text) and the tier-badge glow-breathe (.neon-tier-badge) —
// the two allowed signature spots. The count-up + tier reveal + section
// entrances are ONE-SHOT on load; CTAs / cards lift on hover only. globals.css
// carries the prefers-reduced-motion kill block for all of it.

const PRIMARY_VIEWS = [
  { label: 'Tiers', href: '/methodology' },
  { label: 'All-time', href: '/leaderboard' },
  { label: 'Team Claude Code vs Codex', href: '/compare/codex-cli' },
];

export function LandingHero() {
  return (
    <header
      className="neon-enter"
      style={{
        position: 'relative',
        textAlign: 'center',
        padding: '72px 24px 56px',
      }}
    >
      <LandingStyles />

      {/* Eyebrow — live season badge */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
          fontFamily: 'var(--font-display)',
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.25em',
          textTransform: 'uppercase',
          padding: '9px 18px',
          borderRadius: 999,
          color: '#ffd9f2',
          border: '1px solid rgba(255,45,179,0.5)',
          background: 'rgba(255,45,179,0.08)',
          boxShadow:
            '0 0 24px rgba(255,45,179,0.35), inset 0 0 18px rgba(255,45,179,0.18)',
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#3cff8a',
            boxShadow: '0 0 12px #3cff8a',
          }}
        />
        Season 1 · Live now
      </div>

      {/* Foil headline — the signature continuous-flow spot */}
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 900,
          fontSize: 'clamp(38px, 7vw, 84px)',
          lineHeight: 0.98,
          letterSpacing: '-0.01em',
          margin: '26px auto 14px',
          maxWidth: '16ch',
          textTransform: 'uppercase',
          textShadow: '0 0 40px rgba(155,92,255,0.5)',
        }}
      >
        The <span className="neon-foil-text">tokenmaxxing</span> leaderboard
      </h1>

      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 'clamp(17px, 2.4vw, 23px)',
          color: 'var(--neon-txt-dim)',
          maxWidth: '52ch',
          margin: '0 auto',
          fontWeight: 500,
          lineHeight: 1.4,
        }}
      >
        Public leaderboard for Claude Code and Codex token usage. Your all-time
        tokens put you in a tier. Pick a team. Find out where you{' '}
        <b style={{ color: '#fff', fontWeight: 700 }}>rank</b>, or stay a{' '}
        <b style={{ color: '#fff', fontWeight: 700 }}>handcoder</b>.
      </p>

      {/* Primary CTAs */}
      <div
        style={{
          marginTop: 34,
          display: 'flex',
          gap: 16,
          justifyContent: 'center',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <LandingSignIn>Drop your GitHub handle</LandingSignIn>
        <Link href="/holden-alt" prefetch={false} className="vcs-cta-ghost">
          See where you rank
        </Link>
        <ShareSiteOnX />
      </div>

      {/* Primary-view nav chips — Tiers / All-time / Team Claude Code vs Codex */}
      <nav
        aria-label="Primary views"
        style={{
          marginTop: 30,
          display: 'flex',
          gap: 12,
          justifyContent: 'center',
          flexWrap: 'wrap',
        }}
      >
        {PRIMARY_VIEWS.map((v) => (
          <Link
            key={v.href}
            href={v.href}
            prefetch={false}
            className="vcs-chip"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 11,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              padding: '8px 16px',
              borderRadius: 999,
              border: '1px solid var(--neon-line)',
              background: 'rgba(255,255,255,0.03)',
              color: 'var(--neon-txt-dim)',
              textDecoration: 'none',
            }}
          >
            {v.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

// A homepage-only showcase of the real #1 card — the "card you'll want to
// share" preview. All values are the real all-time leader's published stats.
export function HeroCardPreview() {
  return (
    <section
      className="neon-card-in"
      style={{ maxWidth: 1120, margin: '0 auto', padding: '0 24px 64px' }}
    >
      <div
        className="neon-frame"
        style={{
          padding: '34px 30px',
          overflow: 'hidden',
          background:
            'radial-gradient(120% 90% at 30% 0%, rgba(255,45,179,0.18), transparent 55%), radial-gradient(120% 90% at 80% 100%, rgba(60,216,255,0.16), transparent 55%), rgba(8,3,16,0.85)',
        }}
      >
        {/* Card header — who + global rank */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 16,
            position: 'relative',
            zIndex: 2,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: 26,
                letterSpacing: '0.02em',
              }}
            >
              Holden
            </div>
            <Link
              href="/holden-alt"
              prefetch={false}
              style={{
                color: 'var(--team-cx)',
                fontFamily: 'var(--font-body)',
                fontWeight: 600,
                letterSpacing: '0.05em',
                fontSize: 15,
                textDecoration: 'none',
              }}
            >
              @holden-alt
            </Link>
          </div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 11,
              letterSpacing: '0.12em',
              padding: '8px 12px',
              borderRadius: 10,
              border: '1px solid rgba(255,233,60,0.5)',
              color: '#ffe93c',
              background: 'rgba(255,233,60,0.08)',
              textShadow: '0 0 10px rgba(255,233,60,0.7)',
              whiteSpace: 'nowrap',
            }}
          >
            No. 1 GLOBAL · TOP 1%
          </div>
        </div>

        {/* Tier badge — letter only, with the gentle glow-breathe + one-shot reveal */}
        <div
          style={{
            position: 'relative',
            zIndex: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 22,
            margin: '26px 0 8px',
            flexWrap: 'wrap',
          }}
        >
          <div
            className="neon-tier-badge neon-tier-reveal"
            style={{ width: 128, height: 128, flex: '0 0 auto' }}
          >
            <span className="neon-tier-letter" style={{ fontSize: 76 }}>
              S
            </span>
          </div>
          <div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 12,
                letterSpacing: '0.22em',
                color: 'var(--neon-txt-dim)',
                textTransform: 'uppercase',
              }}
            >
              Current tier
            </div>
            <div
              className="neon-foil-text-static"
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: 30,
                margin: '3px 0 6px',
              }}
            >
              S TIER
            </div>
            <div
              style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 700,
                color: 'var(--team-cc)',
                letterSpacing: '0.04em',
                textShadow: '0 0 14px rgba(255,138,60,0.6)',
              }}
            >
              TOP 1% OF ALL PLAYERS
            </div>
          </div>
        </div>

        {/* All-time tokens — one-shot count-up */}
        <div
          style={{
            position: 'relative',
            zIndex: 2,
            marginTop: 24,
            paddingTop: 22,
            borderTop: '1px solid var(--neon-line)',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 12,
              letterSpacing: '0.22em',
              color: 'var(--neon-txt-dim)',
              textTransform: 'uppercase',
            }}
          >
            All-time tokens
          </div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 900,
              fontSize: 'clamp(54px, 9vw, 88px)',
              lineHeight: 1,
              marginTop: 6,
              display: 'flex',
              alignItems: 'baseline',
              gap: 6,
            }}
          >
            <CountUp to={5.2} decimals={1} className="neon-foil-text-static" />
            <span style={{ fontSize: '0.5em', color: 'var(--neon-txt)' }}>B</span>
          </div>
          <div
            style={{
              fontFamily: 'var(--font-body)',
              color: 'var(--neon-txt-dim)',
              marginTop: 8,
              fontWeight: 600,
              letterSpacing: '0.04em',
            }}
          >
            Peak day 419.1M · still climbing
          </div>
        </div>

        {/* Stat row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 12,
            marginTop: 22,
            position: 'relative',
            zIndex: 2,
          }}
        >
          {[
            { v: '419.1M', k: 'Peak day' },
            { v: '2,137', k: 'Sessions' },
            { v: '41', k: 'Active days' },
          ].map((s) => (
            <div
              key={s.k}
              style={{
                textAlign: 'center',
                padding: '16px 8px',
                borderRadius: 14,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--neon-line)',
              }}
            >
              <div
                className="neon-foil-text-static"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  fontSize: 22,
                }}
              >
                {s.v}
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 12,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: 'var(--neon-txt-dim)',
                  marginTop: 4,
                }}
              >
                {s.k}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
