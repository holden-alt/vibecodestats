'use client';

import { Line, LineChart, ResponsiveContainer } from 'recharts';
import { RollingNumber } from '@/components/dashboard/RollingNumber';
import type { DailyStat } from '@/lib/stats/profile-data';
import type { Tier } from '@/lib/stats/tier';

type Props = {
  allTimeTokens: number;
  tier: Tier;
  topPercentLabel: number;
  rank: number;
  isHandcoder: boolean;
  sessionsToday: number;
  shipsToday: { commits: number; repos: number };
  projectsTouchedCount: number;
  trendStats: DailyStat[]; // last ~30 days for the ghosted sparkline
};

export function HeroBlock({
  allTimeTokens,
  tier,
  topPercentLabel,
  rank,
  isHandcoder,
  sessionsToday,
  shipsToday,
  projectsTouchedCount,
  trendStats,
}: Props) {
  const sparkData = [...trendStats]
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(-30)
    .map((s) => ({ d: s.date, v: s.tokens_total }));
  // Two handcoder sub-cases (SPEC line 35): zero tokens = nothing to rank;
  // active bottom-10% = they DO have stats, so show the number + rank.
  const zeroTokenHandcoder = isHandcoder && allTimeTokens === 0;
  const tierLetter = tier === 'handcoder' ? 'HANDCODER' : tier.toUpperCase();
  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        padding: 'clamp(20px, 5vw, 32px) clamp(16px, 5vw, 36px) clamp(20px, 4vw, 28px)',
        border: '1px solid var(--color-border)',
        borderLeft: '3px solid var(--chart-1)',
        background: 'linear-gradient(180deg, var(--color-bg-2), var(--color-bg))',
        borderRadius: 3,
      }}
    >
      {/* Ghosted sparkline as background texture (KEEP - separate from TokenTrendChart). */}
      <div style={{ position: 'absolute', inset: 0, opacity: 0.22, pointerEvents: 'none' }}>
        <ResponsiveContainer>
          <LineChart data={sparkData} margin={{ left: 0, right: 0, top: 8, bottom: 4 }}>
            <Line dataKey="v" stroke="var(--chart-1)" strokeWidth={1} dot={false} isAnimationActive animationDuration={1500} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div style={{ position: 'relative' }}>
        {zeroTokenHandcoder ? (
          <>
            <div style={{ fontSize: '0.65rem', opacity: 0.55, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              all-time tokens
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 'clamp(0.95rem, 3.5vw, 1.4rem)', fontWeight: 600, lineHeight: 1.3 }}>
                No AI tokens on file. You&apos;re a handcoder until proven otherwise.
              </span>
              <span
                className="tier-reveal"
                style={{ ...badge('var(--chart-5)'), boxShadow: `0 0 16px var(--glow-color)` }}
              >
                {tierLetter}
              </span>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: '0.65rem', opacity: 0.55, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              all-time tokens
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 4, flexWrap: 'wrap' }}>
              <RollingNumber value={allTimeTokens} compact className="hero-token" durationMs={900} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span
                  className={tier === 'S' ? 'foil tier-reveal tier-reveal-s' : 'tier-reveal'}
                  style={tier === 'S'
                    ? { ...badge('var(--chart-5)'), background: undefined, boxShadow: `0 0 20px var(--glow-color)` }
                    : { ...badge('var(--chart-5)'), boxShadow: `0 0 16px var(--glow-color)` }}
                >
                  {tierLetter}
                </span>
                <span style={{ fontSize: '0.62rem', opacity: 0.7, letterSpacing: '0.06em', fontFamily: 'ui-monospace, monospace' }}>
                  No. {rank} GLOBAL · TOP {topPercentLabel}%
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, fontSize: '0.65rem', flexWrap: 'wrap' }}>
              <span style={{ opacity: 0.65 }}>
                {sessionsToday} sessions · {shipsToday.commits} ships · {projectsTouchedCount} projects today
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Solid bright tier-letter badge. S-tier overrides background with `.foil`.
function badge(color: string): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.95rem',
    fontWeight: 700,
    padding: '4px 12px',
    borderRadius: 3,
    background: color,
    color: 'var(--color-bg)',
    fontFamily: 'ui-monospace, monospace',
    letterSpacing: '0.04em',
  };
}
