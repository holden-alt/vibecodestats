'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { rankUsers } from '@/lib/stats/leaderboard';
import type { LeaderboardData } from '@/lib/stats/leaderboard';
import { formatCompact } from '@/lib/format';

type Metric = 'tokens' | 'vbw' | 'sessions' | 'ships';
type Window = 'today' | 'week' | 'month' | 'all';

const METRICS: Metric[] = ['tokens', 'vbw', 'sessions', 'ships'];
const WINDOWS: Window[] = ['today', 'week', 'month', 'all'];

type Props = {
  data: LeaderboardData;
  viewerId: string;
  today: string;
};

export function GlobalLeaderboard({ data, viewerId, today }: Props) {
  const [metric, setMetric] = useState<Metric>('tokens');
  const [window, setWindow] = useState<Window>('today');
  const [expanded, setExpanded] = useState(false);

  const ranked = useMemo(
    () => rankUsers(data, { metric, window, scope: 'global', viewerId, today }),
    [data, metric, window, viewerId, today],
  );

  const viewerEntry = ranked.find((e) => e.isViewer);
  const top10 = ranked.slice(0, 10);
  const showViewerRow = viewerEntry && !top10.includes(viewerEntry) && !expanded;
  const max = ranked[0]?.value ?? 1;

  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: 3, padding: '16px 20px', background: 'transparent' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
        <div style={{ fontSize: '0.65rem', opacity: 0.55, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          global leaderboard
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ display: 'flex', gap: 3 }}>
            {METRICS.map((m) => (
              <button key={m} onClick={() => setMetric(m)} style={pill(m === metric)}>{m}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 3 }}>
            {WINDOWS.map((w) => (
              <button key={w} onClick={() => setWindow(w)} style={pill(w === window)}>{w}</button>
            ))}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ maxHeight: expanded ? 400 : undefined, overflowY: expanded ? 'auto' : undefined, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {(expanded ? ranked : top10).map((e) => (
            <Row key={e.userId} rank={e.rank} handle={e.handle} value={e.value} max={max} viewer={e.isViewer} />
          ))}
          {ranked.length === 0 && (
            <div style={{ fontSize: '0.65rem', opacity: 0.6 }}>no data yet for {metric} · {window}</div>
          )}
        </div>
        {showViewerRow && (
          <>
            <div style={{ fontSize: '0.65rem', opacity: 0.4, textAlign: 'center', margin: '2px 0' }}>···</div>
            <Row rank={viewerEntry!.rank} handle={viewerEntry!.handle} value={viewerEntry!.value} max={max} viewer={true} />
          </>
        )}
        {ranked.length > 10 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            style={{
              marginTop: 8,
              background: 'transparent',
              border: '1px solid var(--color-border)',
              color: 'var(--color-dim)',
              padding: '4px 10px',
              borderRadius: 2,
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: '0.65rem',
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

function Row({ rank, handle, value, max, viewer }: { rank: number; handle: string; value: number; max: number; viewer: boolean }) {
  return (
    <Link href={`/${handle}`} prefetch={false} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: '0.7rem', fontVariantNumeric: 'tabular-nums',
          background: viewer ? 'rgba(217,119,87,0.08)' : 'transparent',
          padding: '3px 4px', borderRadius: 2,
          cursor: 'pointer',
        }}
      >
        <span style={{ width: 22, textAlign: 'right', opacity: 0.6 }}>#{rank}</span>
        <span style={{ width: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>@{handle}</span>
        <div style={{ flex: 1, background: 'var(--color-bg-2)', height: 7, borderRadius: 1, overflow: 'hidden' }}>
          <div style={{ width: `${(value / max) * 100}%`, background: viewer ? 'var(--chart-1)' : 'var(--chart-2)', height: '100%', transition: 'width 800ms ease-out' }} />
        </div>
        <span style={{ opacity: 0.85, minWidth: 52, textAlign: 'right' }}>{formatCompact(value)}</span>
      </div>
    </Link>
  );
}

function pill(active: boolean): React.CSSProperties {
  return {
    background: 'transparent',
    border: `1px solid ${active ? 'var(--chart-1)' : 'var(--color-border)'}`,
    color: active ? 'var(--chart-1)' : 'inherit',
    padding: '1px 6px',
    borderRadius: 2,
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '0.65rem',
  };
}
