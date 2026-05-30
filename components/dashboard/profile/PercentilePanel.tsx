'use client';

import { useMemo, useState } from 'react';
import { rankUsers, type LeaderboardData } from '@/lib/stats/leaderboard';
import type { StatsWindow } from '@/lib/stats/aggregations';

type W = 'today' | 'week' | 'month' | 'year' | 'all';
const WINDOWS: { id: W; label: string }[] = [
  { id: 'today', label: 'today' },
  { id: 'week', label: 'week' },
  { id: 'month', label: 'month' },
  { id: 'year', label: 'year' },
  { id: 'all', label: 'all' },
];

type Props = { data: LeaderboardData; viewerId: string; today: string };

// "Your percentile" — how you rank by token volume across the field, per window.
// Sits under the tier distribution to fill the standings column. Numbers use the
// monospace stat font; foil reserved for the one hero percentile.
export function PercentilePanel({ data, viewerId, today }: Props) {
  const [w, setW] = useState<W>('month');

  const { topPct, rank, total } = useMemo(() => {
    const ranked = rankUsers(data, { metric: 'tokens', window: w as StatsWindow, scope: 'global', viewerId, today });
    const me = ranked.find((e) => e.isViewer);
    const total = ranked.length;
    if (!me || total === 0) return { topPct: null as number | null, rank: null as number | null, total };
    // "Top X%": rank 1 of 100 → top 1%. Bar fill = how far above the floor.
    const topPct = Math.max(1, Math.ceil((me.rank / total) * 100));
    return { topPct, rank: me.rank, total };
  }, [data, viewerId, today, w]);

  const fillPct = topPct == null ? 0 : 100 - topPct + 1; // higher = better

  return (
    <div className="neon-glass" style={{ padding: 'clamp(18px, 3.5vw, 24px)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 12,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'var(--team-cx)',
            textShadow: '0 0 14px rgba(60,216,255,0.6)',
          }}
        >
          Your percentile
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {WINDOWS.map((win) => (
            <button key={win.id} onClick={() => setW(win.id)} style={pill(win.id === w)}>{win.label}</button>
          ))}
        </div>
      </div>

      {topPct == null ? (
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--neon-txt-dim)' }}>
          No tokens logged in this window yet.
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span
              className="neon-foil-text-static"
              style={{ fontFamily: 'var(--font-num)', fontWeight: 800, fontSize: 'clamp(34px, 7vw, 48px)', lineHeight: 1 }}
            >
              Top {topPct}%
            </span>
            <span style={{ fontFamily: 'var(--font-num)', fontSize: 14, color: 'var(--neon-txt-dim)', fontVariantNumeric: 'tabular-nums' }}>
              #{rank} of {total}
            </span>
          </div>

          {/* percentile bar — fills toward the top */}
          <div style={{ position: 'relative', height: 12, borderRadius: 999, background: 'rgba(255,255,255,0.05)', marginTop: 16, overflow: 'hidden' }}>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                width: `${fillPct}%`,
                backgroundImage: 'var(--foil-gradient)',
                boxShadow: '0 0 18px var(--neon-glow-foil)',
                borderRadius: 999,
                transition: 'width 0.8s cubic-bezier(0.2,0.9,0.2,1)',
              }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontFamily: 'var(--font-body)', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--neon-txt-dim)' }}>
            <span>bottom</span>
            <span>top</span>
          </div>
        </>
      )}
    </div>
  );
}

function pill(active: boolean): React.CSSProperties {
  return {
    background: active ? 'rgba(60,216,255,0.14)' : 'transparent',
    border: `1px solid ${active ? 'var(--team-cx)' : 'var(--neon-line)'}`,
    color: active ? 'var(--team-cx)' : 'var(--neon-txt-dim)',
    padding: '3px 9px',
    borderRadius: 8,
    cursor: 'pointer',
    fontFamily: 'var(--font-display)',
    fontSize: 11,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  };
}
