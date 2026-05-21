import Link from 'next/link';
import type { RankedEntry } from '@/lib/stats/leaderboard';
import { formatCompact, formatNumber } from '@/lib/format';

type BarComparisonProps = {
  entries: RankedEntry[];
};

export function BarComparison({ entries }: BarComparisonProps) {
  if (entries.length === 0) {
    return (
      <div data-empty className="text-[0.6rem] py-6 text-center" style={{ color: 'var(--color-dim)' }}>
        no one in this scope yet
      </div>
    );
  }
  const max = Math.max(1, ...entries.map((e) => e.value));
  return (
    <div className="flex flex-col gap-1.5" role="list" aria-label="leaderboard bar comparison">
      {entries.map((e) => {
        const pct = Math.round((e.value / max) * 100);
        return (
          <Link key={e.userId} href={`/${e.handle}`} prefetch={false} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div
              data-bar-row
              data-handle={e.handle}
              data-viewer={e.isViewer}
              role="listitem"
              className="flex items-center gap-2 text-[0.65rem]"
              style={{
                fontVariantNumeric: 'tabular-nums',
                background: e.isViewer ? 'color-mix(in srgb, var(--chart-1) 10%, transparent)' : 'transparent',
                borderRadius: 2,
                padding: '1px 2px',
                cursor: 'pointer',
              }}
              title={formatNumber(e.value)}
            >
              <span
                className="w-[20px] shrink-0 text-right font-semibold"
                style={{ color: e.rank === 1 ? 'var(--color-yellow)' : 'var(--color-dim)' }}
              >
                {e.rank}
              </span>
              <span className="w-[90px] shrink-0 truncate" style={{ color: 'var(--color-text)' }} title={e.handle}>
                @{e.handle}
              </span>
            <div className="flex-1 h-[7px] rounded-[1px] overflow-hidden" style={{ background: 'var(--color-bg-2)' }}>
              <div
                data-bar
                data-pct={pct}
                style={{
                  width: `${pct}%`,
                  height: '100%',
                  background: e.isViewer ? 'var(--chart-1)' : 'var(--chart-2)',
                  transition: 'width 800ms ease-out',
                }}
              />
            </div>
              <span className="w-[42px] shrink-0 text-right" style={{ color: 'var(--color-dim)' }}>
                {formatCompact(e.value)}
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
