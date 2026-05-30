'use client';

import { useState, useMemo } from 'react';
import { rankUsers } from '@/lib/stats/leaderboard';
import type { LeaderboardData } from '@/lib/stats/leaderboard';
import { formatCompact } from '@/lib/format';

type Window = 'today' | 'week' | 'month' | 'all';

const WINDOWS: Window[] = ['today', 'week', 'month', 'all'];

type Props = {
  data: LeaderboardData;
  viewerId: string;
  today: string;
};

// Tokens-only world leaderboard. Default window is TODAY (the live, swingy view);
// week/month/all are tabs. Metric is fixed to tokens by design — this is the
// headline ranking, not a stats explorer.
export function GlobalLeaderboard({ data, viewerId, today }: Props) {
  const [window, setWindow] = useState<Window>('today');
  const [expanded, setExpanded] = useState(false);

  const ranked = useMemo(
    () => rankUsers(data, { metric: 'tokens', window, scope: 'global', viewerId, today }),
    [data, window, viewerId, today],
  );

  const viewerEntry = ranked.find((e) => e.isViewer);
  const top10 = ranked.slice(0, 10);
  const showViewerRow = viewerEntry && !top10.includes(viewerEntry) && !expanded;
  const max = ranked[0]?.value ?? 1;

  return (
    <div className="neon-glass" style={{ padding: '18px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 12,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'var(--neon-txt-dim)',
          }}
        >
          global leaderboard
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {WINDOWS.map((w) => (
            <button key={w} onClick={() => setWindow(w)} style={pill(w === window)}>{w}</button>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ maxHeight: expanded ? 420 : undefined, overflowY: expanded ? 'auto' : undefined, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {(expanded ? ranked : top10).map((e, i) => (
            <Row key={e.userId} rank={e.rank} handle={e.handle} value={e.value} max={max} viewer={e.isViewer} index={i} />
          ))}
          {ranked.length === 0 && (
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--neon-txt-dim)' }}>no tokens logged yet · {window}</div>
          )}
        </div>
        {showViewerRow && (
          <>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--neon-txt-dim)', textAlign: 'center', margin: '2px 0' }}>···</div>
            <Row rank={viewerEntry!.rank} handle={viewerEntry!.handle} value={viewerEntry!.value} max={max} viewer={true} index={0} />
          </>
        )}
        {ranked.length > 10 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            style={{
              marginTop: 8,
              background: 'transparent',
              border: '1px solid var(--neon-line)',
              color: 'var(--neon-txt-dim)',
              padding: '8px 12px',
              borderRadius: 10,
              cursor: 'pointer',
              fontFamily: 'var(--font-display)',
              fontSize: 11,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              width: '100%',
              textAlign: 'center',
            }}
          >
            {expanded ? 'show less' : `show all ${ranked.length}`}
          </button>
        )}
      </div>
    </div>
  );
}

function Row({ rank, handle, value, max, viewer, index }: { rank: number; handle: string; value: number; max: number; viewer: boolean; index: number }) {
  const isFirst = rank === 1;
  const barColor = viewer ? 'var(--team-cc)' : 'var(--team-cx)';
  return (
    <a href={`/${handle}`} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div
        className="neon-row neon-row-in"
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          fontVariantNumeric: 'tabular-nums',
          // Stagger the one-shot entrance; cap so long lists settle fast.
          animationDelay: `${Math.min(index, 12) * 0.05}s`,
          background: viewer ? 'rgba(255,138,60,0.10)' : 'rgba(14,7,24,0.6)',
          border: `1px solid ${viewer ? 'rgba(255,138,60,0.45)' : 'var(--neon-line)'}`,
          padding: '10px 14px', borderRadius: 14,
          cursor: 'pointer',
        }}
      >
        <span
          className={isFirst ? 'neon-foil-text-static' : undefined}
          style={{
            fontFamily: 'var(--font-num)', fontWeight: 900, fontSize: 16,
            width: 30, textAlign: 'right',
            color: isFirst ? undefined : 'var(--neon-txt-dim)',
          }}
        >
          {rank}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14,
            width: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
        >
          @{handle}
        </span>
        <div style={{ flex: 1, background: 'rgba(60,216,255,0.12)', height: 8, borderRadius: 999, overflow: 'hidden' }}>
          <div
            style={{
              width: `${max > 0 ? (value / max) * 100 : 0}%`,
              background: barColor,
              boxShadow: `0 0 12px ${barColor}`,
              height: '100%',
              borderRadius: 999,
              transition: 'width 800ms ease-out',
            }}
          />
        </div>
        {/* #1 value uses the static (placed) foil — continuous flow is reserved
            for the two signature spots per the motion policy, so list rows stay
            calm and match the static-foil rank number above. */}
        <span
          className={isFirst ? 'neon-foil-text-static' : undefined}
          style={{
            fontFamily: 'var(--font-num)', fontWeight: 800, fontSize: 14,
            minWidth: 56, textAlign: 'right',
            color: isFirst ? undefined : 'var(--neon-txt)',
          }}
        >
          {formatCompact(value)}
        </span>
      </div>
    </a>
  );
}

function pill(active: boolean): React.CSSProperties {
  return {
    background: active ? 'rgba(255,138,60,0.10)' : 'transparent',
    border: `1px solid ${active ? 'var(--team-cc)' : 'var(--neon-line)'}`,
    color: active ? 'var(--team-cc)' : 'var(--neon-txt-dim)',
    padding: '3px 9px',
    borderRadius: 8,
    cursor: 'pointer',
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: 11,
    letterSpacing: '0.04em',
  };
}
