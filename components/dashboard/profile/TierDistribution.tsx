'use client';

import { useEffect, useState } from 'react';
import { tierDistribution } from '@/lib/stats/tier-distribution';
import type { Tier } from '@/lib/stats/tier';

type Props = {
  cohortAllTime: number[];
  viewerTier: Tier;
};

// Per-tier accent colors. S/A lean foil/warm (the top), the lower tiers cool
// down to dim. Bars are foil-tinted; the viewer's bar gets the full foil fill.
const TIER_LABEL: Record<Tier, string> = {
  S: 'S',
  A: 'A',
  B: 'B',
  C: 'C',
  D: 'D',
  handcoder: 'HANDCODER',
};
const TIER_ACCENT: Record<Tier, string> = {
  S: '#ffe93c',
  A: '#ff8a3c',
  B: '#ff2db3',
  C: '#9b5cff',
  D: '#3cd8ff',
  handcoder: 'rgba(179,154,214,0.5)',
};

// TIER DISTRIBUTION bar chart — a PRIMARY profile view. One bar per tier
// (S -> handcoder), length by player count, foil-accented, with a clear
// "you are here" marker on the VIEWER'S tier.
//
// MOTION POLICY: bars grow once on load (one-shot width transition) and settle.
// No looping. Reduced-motion renders them at full width immediately.
export function TierDistribution({ cohortAllTime, viewerTier }: Props) {
  const buckets = tierDistribution(cohortAllTime);
  const maxCount = Math.max(1, ...buckets.map((b) => b.count));

  // One-shot grow-in on mount. Start at 0 width, transition to live width.
  // Reduced-motion: render at full width immediately with no transition so the
  // bars resolve statically (matches the global reduced-motion calm-everything
  // policy; the inline width transition below is gated on the same flag).
  const [grown, setGrown] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    if (prefersReduced) {
      setReducedMotion(true);
      setGrown(true);
      return;
    }
    const id = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      className="neon-frame neon-enter"
      style={{ padding: 'clamp(20px, 4vw, 28px)' }}
    >
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 12,
          letterSpacing: '0.28em',
          textTransform: 'uppercase',
          color: 'var(--team-cx)',
          textShadow: '0 0 14px rgba(60,216,255,0.6)',
          marginBottom: 6,
        }}
      >
        Tier distribution
      </div>
      <h3
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          fontSize: 'clamp(20px, 4vw, 28px)',
          textTransform: 'uppercase',
          letterSpacing: '-0.01em',
          marginBottom: 4,
        }}
      >
        Where the <span className="neon-foil-text">field</span> lands
      </h3>
      <p
        style={{
          fontFamily: 'var(--font-body)',
          color: 'var(--neon-txt-dim)',
          fontSize: '0.9rem',
          marginBottom: 22,
        }}
      >
        Players per tier across the whole cohort. The arrow marks your tier.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {buckets.map((b) => {
          const isViewer = b.tier === viewerTier;
          const widthPct = grown ? (b.count / maxCount) * 100 : 0;
          const accent = TIER_ACCENT[b.tier];
          return (
            <div
              key={b.tier}
              style={{
                display: 'grid',
                gridTemplateColumns: '108px 1fr auto',
                alignItems: 'center',
                gap: 12,
              }}
            >
              {/* Tier label + you-are-here marker */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontFamily: 'var(--font-display)',
                  fontWeight: isViewer ? 900 : 700,
                  fontSize: b.tier === 'handcoder' ? 11 : 16,
                  letterSpacing: '0.04em',
                  color: isViewer ? undefined : 'var(--neon-txt-dim)',
                }}
                className={isViewer ? 'neon-foil-text-static' : undefined}
              >
                {isViewer && (
                  <span
                    aria-label="your tier"
                    style={{
                      fontSize: 14,
                      WebkitTextFillColor: 'var(--team-cc)',
                      color: 'var(--team-cc)',
                      filter: 'drop-shadow(0 0 6px rgba(255,138,60,0.7))',
                    }}
                  >
                    ▶
                  </span>
                )}
                {TIER_LABEL[b.tier]}
              </div>

              {/* Bar */}
              <div
                style={{
                  position: 'relative',
                  height: isViewer ? 22 : 16,
                  borderRadius: 6,
                  background: 'rgba(255,255,255,0.04)',
                  border: isViewer ? '1px solid rgba(255,255,255,0.18)' : '1px solid var(--neon-line)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    right: 'auto',
                    width: `${widthPct}%`,
                    minWidth: b.count > 0 ? 6 : 0,
                    borderRadius: 6,
                    backgroundImage: isViewer ? 'var(--foil-gradient)' : undefined,
                    background: isViewer ? undefined : accent,
                    boxShadow: isViewer
                      ? '0 0 22px var(--neon-glow-foil)'
                      : `0 0 12px ${accent}`,
                    opacity: isViewer ? 1 : 0.85,
                    transition: reducedMotion
                      ? 'none'
                      : 'width 1s cubic-bezier(0.2,0.9,0.2,1)',
                  }}
                />
              </div>

              {/* Count */}
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: isViewer ? 900 : 700,
                  fontSize: 15,
                  fontVariantNumeric: 'tabular-nums',
                  minWidth: 34,
                  textAlign: 'right',
                  color: isViewer ? undefined : 'var(--neon-txt-dim)',
                }}
                className={isViewer ? 'neon-foil-text-static' : undefined}
              >
                {b.count}
              </div>
            </div>
          );
        })}
      </div>

      {/* You-are-here callout */}
      <div
        style={{
          marginTop: 20,
          paddingTop: 16,
          borderTop: '1px solid var(--neon-line)',
          fontFamily: 'var(--font-body)',
          fontSize: '0.85rem',
          color: 'var(--neon-txt-dim)',
        }}
      >
        <span style={{ color: 'var(--team-cc)', fontWeight: 700 }}>You are here:</span>{' '}
        {viewerTier === 'handcoder' ? 'HANDCODER' : `${viewerTier.toUpperCase()} tier`}
      </div>
    </div>
  );
}
