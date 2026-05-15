import type { RankedEntry } from '@/lib/stats/leaderboard';
import { formatValue } from '@/components/leaderboard/format';

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
          <div
            key={e.userId}
            data-bar-row
            data-handle={e.handle}
            data-viewer={e.isViewer}
            role="listitem"
            className="flex items-center gap-2 text-[0.6rem]"
          >
            <span className="w-[110px] shrink-0 truncate" style={{ color: 'var(--color-text)' }} title={e.handle}>
              {e.displayName ?? e.handle}
            </span>
            <div className="flex-1 h-[12px] rounded-[1px] overflow-hidden" style={{ background: 'var(--color-bg-2)' }}>
              <div
                data-bar
                data-pct={pct}
                style={{
                  width: `${pct}%`,
                  height: '100%',
                  background: e.isViewer ? 'var(--color-orange)' : 'var(--color-cyan)',
                }}
              />
            </div>
            <span className="w-[52px] shrink-0 text-right tabular-nums" style={{ color: 'var(--color-dim)' }}>
              {formatValue(e.value)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
