'use client';

import { useState } from 'react';
import { formatCompact } from '@/lib/format';
import type { Tier } from '@/lib/stats/tier';

type Props = {
  handle: string;
  tier: Tier;
  allTimeTokens: number;
  rank: number;
  tokensToday: number;
  liveRank: number | null;
  viewerIsOwner: boolean;
};

// Holographic share-card block — the "card you'll want to share" teaser from
// neon-arcade.html. A foil mini-holo preview (tier letter + handle + tokens +
// rank) over a glass panel, with a one-tap share-on-X button that reuses the
// existing X intent + daily cache-bust.
//
// MOTION POLICY: the mini-holo foil fill is STATIC (placed, not flowing) and the
// sheen sweep is hover-only. No idle motion here.
export function ShareCard({
  handle,
  tier,
  allTimeTokens,
  rank,
  tokensToday,
  liveRank,
  viewerIsOwner,
}: Props) {
  const [hover, setHover] = useState(false);
  const tierLetter = tier === 'handcoder' ? 'HC' : tier.toUpperCase();

  // Daily cache-bust so X re-fetches the OG image each day (matches ShareOnX).
  const v = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const url = `https://vibecodestats.dev/${handle}?v=${v}`;
  const tokens = formatCompact(tokensToday);
  const rankPart = liveRank != null ? ` (#${liveRank} today)` : '';

  let text: string;
  if (viewerIsOwner) {
    text =
      tokensToday > 0
        ? `${tokens} AI tokens today${rankPart} on vibecodestats.dev`
        : liveRank != null
          ? `Ranked #${liveRank} on vibecodestats.dev's leaderboard today`
          : `Tracking my AI coding stats on vibecodestats.dev`;
  } else {
    text =
      tokensToday > 0
        ? `@${handle} pushed ${tokens} AI tokens today${rankPart} on vibecodestats.dev`
        : `@${handle} on vibecodestats.dev's leaderboard`;
  }
  const intentUrl = `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;

  return (
    <div
      className="neon-frame neon-sheen neon-enter"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ padding: '24px 22px', textAlign: 'center', animationDelay: '0.18s' }}
    >
      <span className="neon-sheen-bar" />
      <h3
        className="neon-foil-text-static"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 18,
          letterSpacing: '0.04em',
          marginBottom: 6,
        }}
      >
        Holographic share card
      </h3>
      <p
        style={{
          fontFamily: 'var(--font-body)',
          color: 'var(--neon-txt-dim)',
          marginBottom: 18,
          fontSize: '0.95rem',
        }}
      >
        One tap to share. Drop it anywhere.
      </p>

      {/* Mini-holo preview (static foil) */}
      <div
        style={{
          margin: '0 auto 18px',
          width: '100%',
          maxWidth: 280,
          aspectRatio: '16 / 10',
          borderRadius: 16,
          backgroundImage: 'var(--foil-gradient)',
          display: 'grid',
          placeItems: 'center',
          boxShadow: '0 16px 50px -16px var(--neon-glow-foil)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'repeating-linear-gradient(115deg, transparent 0 8px, rgba(255,255,255,0.16) 8px 9px)',
            mixBlendMode: 'overlay',
          }}
        />
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 900,
            fontSize: 56,
            color: '#0a0010',
            textShadow: '0 2px 0 rgba(255,255,255,0.4)',
            zIndex: 2,
          }}
        >
          {tierLetter}
        </span>
        <span
          style={{
            position: 'absolute',
            bottom: 12,
            left: 0,
            right: 0,
            textAlign: 'center',
            fontFamily: 'var(--font-display)',
            fontSize: 11,
            letterSpacing: '0.1em',
            color: '#0a0010',
            fontWeight: 700,
            zIndex: 2,
          }}
        >
          @{handle.toUpperCase()} · {formatCompact(allTimeTokens)} · NO. {rank}
        </span>
      </div>

      <a
        href={intentUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'block',
          width: '100%',
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: 14,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: '#110018',
          padding: '15px 24px',
          borderRadius: 12,
          backgroundImage: 'var(--foil-gradient)',
          boxShadow: hover
            ? '0 0 50px rgba(255,90,200,0.9), 0 16px 50px -8px rgba(60,216,255,0.7)'
            : '0 0 30px rgba(255,90,200,0.6), 0 10px 40px -8px rgba(60,216,255,0.5)',
          transform: hover ? 'translateY(-3px) scale(1.02)' : 'none',
          transition: 'transform 0.25s ease, box-shadow 0.25s ease',
          textDecoration: 'none',
          boxSizing: 'border-box',
        }}
      >
        Share my card on X
      </a>
    </div>
  );
}
