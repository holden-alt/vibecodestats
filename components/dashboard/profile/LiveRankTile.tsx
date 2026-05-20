'use client';

import { useLiveRank } from '@/hooks/useLiveRank';
import { RollingNumber } from '@/components/dashboard/RollingNumber';
import { PercentileBar } from './PercentileBar';
import { formatCompact, formatNumber } from '@/lib/format';
import type { LiveRanking } from '@/lib/stats/leaderboard-live';

type Props = {
  viewerId: string;
  date: string;
  initial: LiveRanking;
};

export function LiveRankTile({ viewerId, date, initial }: Props) {
  const r = useLiveRank(viewerId, date, initial);
  const pctText = r.rank != null ? `top ${Math.max(1, Math.round((1 - r.percentile) * 100))}%` : '—';
  return (
    <div
      style={{
        position: 'relative',
        padding: '14px 16px 12px',
        border: '1px solid var(--color-border)',
        borderLeft: '3px solid var(--chart-5)',
        background: 'linear-gradient(180deg, var(--color-bg-2), var(--color-bg))',
        borderRadius: 3,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ fontSize: '0.55rem', opacity: 0.55, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            global rank · today (live)
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 4 }}>
            <span style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--chart-5)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              {r.rank != null ? <>#<RollingNumber value={r.rank} /></> : '—'}
            </span>
            <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>
              of {r.total}
            </span>
            <span style={{
              fontSize: '0.65rem', padding: '2px 6px', borderRadius: 2,
              background: 'var(--chart-3)', color: 'var(--color-bg)', fontWeight: 600,
            }}>
              {pctText}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: '0.6rem', minWidth: 200 }}>
          {r.closestAbove ? (
            <div>↑ <strong>@{r.closestAbove.handle}</strong> is {formatCompact(r.closestAbove.tokensAhead)} ahead</div>
          ) : (
            <div style={{ opacity: 0.6 }}>you&apos;re at the top — no one above</div>
          )}
          {r.closestBelow ? (
            <div>↓ <strong>@{r.closestBelow.handle}</strong> is {formatCompact(r.closestBelow.tokensBehind)} behind</div>
          ) : (
            <div style={{ opacity: 0.5 }}>no one ranked below yet</div>
          )}
        </div>
      </div>
      <div style={{ marginTop: 10 }}>
        <PercentileBar percentile={r.percentile} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.5rem', opacity: 0.55, marginTop: 2 }}>
          <span>bottom</span>
          <span>top</span>
        </div>
      </div>
    </div>
  );
}
