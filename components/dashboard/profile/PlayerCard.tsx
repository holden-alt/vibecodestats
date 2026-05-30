'use client';

import { useState } from 'react';
import { RollingNumber } from '@/components/dashboard/RollingNumber';
import { formatNumber } from '@/lib/format';
import type { ProfileUser } from '@/lib/stats/profile-data';
import type { Tier } from '@/lib/stats/tier';
import type { Camp } from '@/lib/stats/team';

// Stat pill with an interaction-only hover lift (motion policy: no idle motion).
function StatPill({ value, label }: { value: string; label: string }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        textAlign: 'center',
        padding: '16px 8px',
        borderRadius: 14,
        background: 'rgba(255,255,255,0.04)',
        border: `1px solid ${hover ? 'rgba(60,216,255,0.6)' : 'var(--neon-line)'}`,
        transform: hover ? 'translateY(-4px)' : 'none',
        boxShadow: hover ? '0 10px 30px -10px var(--neon-glow-cyan)' : 'none',
        transition: 'transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease',
      }}
    >
      <div
        className="neon-foil-text-static"
        style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'clamp(16px, 4vw, 22px)' }}
      >
        {value}
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
        {label}
      </div>
    </div>
  );
}

type Props = {
  user: ProfileUser;
  tier: Tier;
  rank: number;
  topPercentLabel: number;
  isHandcoder: boolean;
  allTimeTokens: number;
  team: Camp | null;
  peakDayTokens: number;
  peakDayDate: string | null;
  sessionsAllTime: number;
  activeDays: number;
};

// THE player card — the holographic trading-card look from neon-arcade.html.
// Identity + foil tier badge (glow-breathe + one-shot reveal) + all-time-tokens
// hero (count-up on load) + rank line + stat pills.
//
// MOTION POLICY: the only continuous motion is the foil text flow (headline /
// "S TIER") and the tier-badge glow-breathe — the two allowed signature spots.
// The token count-up, tier reveal, and card entrance are ONE-SHOT on load; the
// stat pills lift on hover only. globals.css carries the reduced-motion kill.
export function PlayerCard({
  user,
  tier,
  rank,
  topPercentLabel,
  isHandcoder,
  allTimeTokens,
  team,
  peakDayTokens,
  peakDayDate,
  sessionsAllTime,
  activeDays,
}: Props) {
  const tierLetter = tier === 'handcoder' ? 'HC' : tier.toUpperCase();
  const tierLabel = tier === 'handcoder' ? 'HANDCODER' : `${tier.toUpperCase()} TIER`;
  const activeHandcoder = isHandcoder && allTimeTokens > 0;
  const zeroTokenHandcoder = isHandcoder && allTimeTokens === 0;

  // Rank line copy — letter-only tier, no em dashes, no banned vocabulary.
  const rankLine = zeroTokenHandcoder
    ? 'No AI tokens on file yet'
    : activeHandcoder
      ? `No. ${rank} GLOBAL · bottom 10%`
      : `No. ${rank} GLOBAL · TOP ${topPercentLabel}%`;

  const tierSubline = zeroTokenHandcoder
    ? "You're a handcoder until proven otherwise"
    : activeHandcoder
      ? 'Still mostly raw dogging it'
      : `TOP ${topPercentLabel}% OF ALL PLAYERS`;

  return (
    <div
      className="neon-frame neon-card-in"
      style={{
        padding: 'clamp(22px, 5vw, 34px) clamp(18px, 5vw, 30px)',
        overflow: 'hidden',
        background:
          'radial-gradient(120% 90% at 30% 0%, rgba(255,45,179,0.18), transparent 55%), radial-gradient(120% 90% at 80% 100%, rgba(60,216,255,0.16), transparent 55%), rgba(8,3,16,0.85)',
      }}
    >
      {/* Card header — who + global rank pill */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          position: 'relative',
          zIndex: 2,
          flexWrap: 'wrap',
          rowGap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: '50%',
              flexShrink: 0,
              background: user.avatar_url
                ? `url(${user.avatar_url}) center/cover`
                : 'var(--foil-gradient)',
              boxShadow: '0 0 18px var(--neon-glow-foil)',
            }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: 'clamp(20px, 4vw, 26px)',
                letterSpacing: '0.02em',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {user.display_name || `@${user.github_handle}`}
            </div>
            <div
              style={{
                color: 'var(--team-cx)',
                fontFamily: 'var(--font-body)',
                fontWeight: 600,
                letterSpacing: '0.05em',
                fontSize: 15,
              }}
            >
              @{user.github_handle}
            </div>
          </div>
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
          {rankLine}
        </div>
      </div>

      {/* Tier badge — letter only, glow-breathe + one-shot reveal */}
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
          style={{ width: 'clamp(96px, 28vw, 128px)', height: 'clamp(96px, 28vw, 128px)', flex: '0 0 auto' }}
        >
          <span className="neon-tier-letter" style={{ fontSize: 'clamp(54px, 16vw, 76px)' }}>
            {tierLetter}
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
            className="neon-foil-text"
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 'clamp(24px, 6vw, 30px)',
              margin: '3px 0 6px',
            }}
          >
            {tierLabel}
          </div>
          <div
            style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 700,
              color: 'var(--team-cc)',
              letterSpacing: '0.04em',
              textShadow: '0 0 14px rgba(255,138,60,0.6)',
              textTransform: 'uppercase',
            }}
          >
            {tierSubline}
          </div>
          {team != null && (
            <div
              style={{
                marginTop: 8,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                fontFamily: 'var(--font-display)',
                fontSize: 11,
                letterSpacing: '0.1em',
                color: team === 'codex' ? 'var(--team-cx)' : 'var(--team-cc)',
              }}
            >
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 4,
                  background: team === 'codex' ? 'var(--team-cx)' : 'var(--team-cc)',
                  boxShadow: `0 0 14px ${team === 'codex' ? 'var(--team-cx)' : 'var(--team-cc)'}`,
                }}
              />
              {team === 'codex' ? 'TEAM CODEX' : 'TEAM CLAUDE CODE'}
            </div>
          )}
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
            fontSize: 'clamp(44px, 9vw, 80px)',
            lineHeight: 1,
            marginTop: 6,
          }}
        >
          <RollingNumber
            value={allTimeTokens}
            compact
            durationMs={1600}
            animateOnMount
            className="neon-foil-text-static"
          />
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
          Peak day {formatNumber(peakDayTokens)}
          {peakDayDate ? ` · ${peakDayDate}` : ''} · still climbing
        </div>
      </div>

      {/* Stat row — pills lift on hover */}
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
          { v: formatNumber(peakDayTokens), k: 'Peak day' },
          { v: formatNumber(sessionsAllTime), k: 'Sessions' },
          { v: formatNumber(activeDays), k: 'Active days' },
        ].map((s) => (
          <StatPill key={s.k} value={s.v} label={s.k} />
        ))}
      </div>
    </div>
  );
}
