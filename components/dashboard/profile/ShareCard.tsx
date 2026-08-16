'use client';

import { useState } from 'react';
import { formatCompact } from '@/lib/format';
import { ogCardToken } from '@/lib/og/version';
import type { Tier } from '@/lib/stats/tier';
import type { Camp } from '@/lib/stats/team';

type Props = {
  handle: string;
  overallTier: Tier; // rolling-90-day tier
  todayTier: Tier; // tier among today's active field
  allTimeTokens: number;
  todayTokens: number;
  percentileToday: number; // "top N%" today (1 = best)
  rank: number;
  viewerIsOwner: boolean;
  team?: Camp | null;
};

const letter = (t: Tier) => (t === 'handcoder' ? 'HC' : t.toUpperCase());

// "Your card" — the shareable holographic rank card. This IS the OG image design
// (overall tier, today's tier, all-time + today tokens, today percentile) with
// loud vibecodestats.dev branding so every share markets the site. Share-on-X
// builds a UNIQUE cache-bust per click so X always re-scrapes a fresh image.
// Secondary: copy the public profile link.
export function ShareCard({ handle, overallTier, todayTier, allTimeTokens, todayTokens, percentileToday, rank, viewerIsOwner, team }: Props) {
  const [hover, setHover] = useState(false);
  const [copied, setCopied] = useState(false);

  // MUST be www, not apex. The apex 301-redirects to www, and X does NOT follow
  // that redirect for card scraping the way a browser/curl does — it falls back
  // to the domain's homepage card (the site "_root.png"). Sharing www directly
  // means X scrapes the actual profile page, no redirect to mishandle.
  const profileUrl = `https://www.vibecodestats.dev/${handle}`;
  // The URL we actually share/copy carries a CONTENT token: it's identical
  // across shares while the card is unchanged (so X reuses its correct cached
  // card), and changes the instant the card content does (so X re-scrapes and
  // shows the new card). Not a per-click bust — that froze junk URLs.
  const shareUrl = `${profileUrl}?v=${ogCardToken({ allTimeTokens, todayTokens, tier: overallTier, rank })}`;
  const teamLabel = team === 'codex' ? 'TEAM CODEX' : team === 'claude_code' ? 'TEAM CLAUDE CODE' : null;

  function shareOnX() {
    const url = shareUrl;
    const tokens = formatCompact(todayTokens);
    const text = viewerIsOwner
      ? `${tokens} AI tokens today — ${letter(overallTier)}-tier, top ${percentileToday}% on vibecodestats.dev, the tokenmaxxing leaderboard for Claude Code + Codex`
      : `@${handle} pushed ${tokens} AI tokens today on vibecodestats.dev — the tokenmaxxing leaderboard`;
    const intentUrl = `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    window.open(intentUrl, '_blank', 'noopener,noreferrer');
  }

  function copyLink() {
    try {
      void navigator.clipboard?.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div
      className="neon-glass neon-sheen neon-enter"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ padding: 'clamp(20px, 4vw, 28px)', animationDelay: '0.1s', background: 'rgba(10,4,20,0.92)' }}
    >
      <span className="neon-sheen-bar" />

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 11, letterSpacing: '0.24em', textTransform: 'uppercase', color: 'var(--team-cx)', textShadow: '0 0 14px rgba(60,216,255,0.6)', marginBottom: 6 }}>
          Your card
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'clamp(18px, 3.5vw, 22px)', color: 'var(--neon-txt)' }}>
          Flex your rank
        </div>
        <p style={{ fontFamily: 'var(--font-body)', color: 'var(--neon-txt-dim)', marginTop: 4, fontSize: '0.92rem' }}>
          Share your card on X — every post links back to vibecodestats.dev. Or copy your profile link.
        </p>
      </div>

      {/* The artifact / OG design — static foil, dark legible text, loud branding */}
      <div
        style={{
          margin: '0 auto 18px',
          width: '100%',
          maxWidth: 400,
          aspectRatio: '16 / 9',
          borderRadius: 18,
          backgroundImage: 'var(--foil-gradient)',
          boxShadow: '0 18px 60px -16px var(--neon-glow-foil)',
          position: 'relative',
          overflow: 'hidden',
          padding: 'clamp(14px, 3.5vw, 20px)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          color: '#0a0010',
        }}
      >
        <span aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(115deg, transparent 0 9px, rgba(255,255,255,0.16) 9px 10px)', mixBlendMode: 'overlay' }} />

        {/* top: wordmark (virality) + team */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', zIndex: 2 }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'clamp(13px, 3vw, 16px)', letterSpacing: '0.08em' }}>VIBECODESTATS.DEV</span>
            <span style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', opacity: 0.8 }}>Strava for AI coding</span>
          </div>
          {teamLabel && <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 10, letterSpacing: '0.1em', opacity: 0.85 }}>{teamLabel}</span>}
        </div>

        {/* middle: tier + handle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, zIndex: 2 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'clamp(40px, 11vw, 56px)', lineHeight: 1, textShadow: '0 2px 0 rgba(255,255,255,0.4)' }}>
            {letter(overallTier)}
          </span>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'clamp(15px, 3.5vw, 18px)' }}>@{handle}</span>
            <span style={{ fontFamily: 'var(--font-num)', fontWeight: 700, fontSize: 11, letterSpacing: '0.04em' }}>NO. {rank} GLOBAL · TOP {percentileToday}% TODAY</span>
          </div>
        </div>

        {/* bottom: stat strip */}
        <div style={{ display: 'flex', gap: 'clamp(10px, 4vw, 22px)', zIndex: 2, flexWrap: 'wrap' }}>
          <CardStat k="Today" v={formatCompact(todayTokens)} />
          <CardStat k="Today tier" v={letter(todayTier)} />
          <CardStat k="All-time" v={formatCompact(allTimeTokens)} />
        </div>
      </div>

      {/* Primary: share on X (unique cache-bust per click) */}
      <button
        type="button"
        onClick={shareOnX}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, width: '100%',
          fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, letterSpacing: '0.06em', textTransform: 'uppercase',
          color: '#110018', padding: '14px 24px', borderRadius: 12, border: 'none', cursor: 'pointer',
          backgroundImage: 'var(--foil-gradient)',
          boxShadow: hover ? '0 0 50px rgba(255,90,200,0.9), 0 16px 50px -8px rgba(60,216,255,0.7)' : '0 0 28px rgba(255,90,200,0.55), 0 10px 40px -8px rgba(60,216,255,0.45)',
          transform: hover ? 'translateY(-3px) scale(1.02)' : 'none',
          transition: 'transform 0.25s ease, box-shadow 0.25s ease', boxSizing: 'border-box',
        }}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
        Share on X
      </button>

      {/* Secondary: copy public profile link */}
      <button
        type="button"
        onClick={copyLink}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', marginTop: 10,
          fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase',
          color: copied ? 'var(--team-cx)' : 'var(--neon-txt-dim)', padding: '11px 16px', borderRadius: 10,
          background: 'transparent', border: `1px solid ${copied ? 'var(--team-cx)' : 'var(--neon-line)'}`, cursor: 'pointer',
          transition: 'color 0.2s ease, border-color 0.2s ease', boxSizing: 'border-box',
        }}
      >
        {copied ? 'Link copied' : 'Copy profile link'}
      </button>
      <div style={{ marginTop: 8, textAlign: 'center', fontFamily: 'var(--font-num)', fontSize: 12, color: 'var(--neon-txt-dim)', opacity: 0.75, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        vibecodestats.dev/{handle}
      </div>
    </div>
  );
}

function CardStat({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <span style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.8 }}>{k}</span>
      <span style={{ fontFamily: 'var(--font-num)', fontWeight: 800, fontSize: 'clamp(13px, 3.2vw, 16px)' }}>{v}</span>
    </div>
  );
}
