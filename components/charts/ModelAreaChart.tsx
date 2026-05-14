import type { TrendDay } from '@/lib/stats/aggregations';

type ModelAreaChartProps = {
  days: TrendDay[];
};

const LAYERS = [
  { key: 'opus', color: 'var(--color-orange)' },
  { key: 'sonnet', color: 'var(--color-cyan)' },
  { key: 'haiku', color: 'var(--color-green)' },
  { key: 'other', color: 'var(--color-dim)' },
] as const;

export function ModelAreaChart({ days }: ModelAreaChartProps) {
  return (
    <div
      className="flex items-stretch gap-[2px] h-[80px]"
      role="img"
      aria-label="30-day model mix"
    >
      {days.map((d) => {
        const total = d.opus + d.sonnet + d.haiku + d.other;
        return (
          <div
            key={d.date}
            data-col
            data-date={d.date}
            className="flex-1 flex flex-col-reverse rounded-[1px] overflow-hidden"
            style={{ background: 'var(--color-bg-2)' }}
            title={`${d.date} · ${d.tokens.toLocaleString()} tokens`}
          >
            {total > 0 &&
              LAYERS.map((layer) => {
                const pct = Math.round((d[layer.key] / total) * 100);
                if (pct === 0) return null;
                return (
                  <div
                    key={layer.key}
                    data-layer={layer.key}
                    data-pct={pct}
                    style={{ height: `${pct}%`, background: layer.color }}
                  />
                );
              })}
          </div>
        );
      })}
    </div>
  );
}
