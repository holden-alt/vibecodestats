import type { RankedItem } from '@/lib/stats/aggregations';

type RankedBarListProps = {
  items: RankedItem[];
};

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return Math.round(n / 1_000) + 'K';
  return String(n);
}

export function RankedBarList({ items }: RankedBarListProps) {
  if (items.length === 0) {
    return (
      <div
        data-empty
        className="text-[0.6rem] py-6 text-center"
        style={{ color: 'var(--color-dim)' }}
      >
        no data in this window
      </div>
    );
  }
  const max = Math.max(1, ...items.map((it) => it.value));
  return (
    <div className="flex flex-col gap-1.5" role="list" aria-label="ranked breakdown">
      {items.map((it) => {
        const pct = Math.round((it.value / max) * 100);
        return (
          <div
            key={it.label}
            data-row
            data-label={it.label}
            role="listitem"
            className="flex items-center gap-2 text-[0.6rem]"
          >
            <span
              className="w-[140px] shrink-0 truncate"
              style={{ color: 'var(--color-text)' }}
              title={it.label}
            >
              {it.label}
            </span>
            <div
              className="flex-1 h-[10px] rounded-[1px] overflow-hidden"
              style={{ background: 'var(--color-bg-2)' }}
            >
              <div
                data-bar
                data-pct={pct}
                style={{ width: `${pct}%`, height: '100%', background: 'var(--color-cyan)' }}
              />
            </div>
            <span
              className="w-[52px] shrink-0 text-right"
              style={{ color: 'var(--color-dim)' }}
            >
              {formatTokens(it.value)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
