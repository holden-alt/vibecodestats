import type { RankedEntry } from '@/lib/stats/leaderboard';
import { formatValue } from '@/components/leaderboard/format';

type RankListProps = {
  entries: RankedEntry[];
};

export function RankList({ entries }: RankListProps) {
  if (entries.length === 0) {
    return (
      <div data-empty className="text-[0.6rem] py-6 text-center" style={{ color: 'var(--color-dim)' }}>
        no one in this scope yet
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1" role="list" aria-label="leaderboard ranking">
      {entries.map((e) => (
        <div
          key={e.userId}
          data-rank-row
          data-rank={e.rank}
          data-handle={e.handle}
          data-viewer={e.isViewer}
          role="listitem"
          className="foil-hover flex items-center gap-2 text-[0.62rem] px-2 py-1 rounded-[2px]"
          style={{
            background: e.isViewer ? 'var(--color-bg-2)' : 'transparent',
            color: 'var(--color-text)',
          }}
        >
          <span
            className="w-[24px] shrink-0 text-right font-semibold"
            style={{ color: e.rank === 1 ? 'var(--color-yellow)' : 'var(--color-dim)' }}
          >
            {e.rank}
          </span>
          <span className="flex-1 truncate" title={e.handle}>
            {e.displayName ?? e.handle}
            {e.isViewer && <span style={{ color: 'var(--color-orange)' }}> · you</span>}
          </span>
          <span className="shrink-0 tabular-nums" style={{ color: 'var(--color-dim)' }}>
            {formatValue(e.value)}
          </span>
        </div>
      ))}
    </div>
  );
}
