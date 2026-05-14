import type { ModelTotals } from '@/lib/stats/aggregations';

type ModelDonutProps = {
  totals: ModelTotals;
};

const SEGMENTS = [
  { key: 'opus', label: 'opus', color: 'var(--color-orange)' },
  { key: 'sonnet', label: 'sonnet', color: 'var(--color-cyan)' },
  { key: 'haiku', label: 'haiku', color: 'var(--color-green)' },
  { key: 'other', label: 'other', color: 'var(--color-dim)' },
] as const;

export function ModelDonut({ totals }: ModelDonutProps) {
  const total = SEGMENTS.reduce((s, seg) => s + totals[seg.key], 0) || 1;
  let cursor = 0;
  const stops: string[] = [];
  const legend: { key: string; label: string; pct: number; color: string }[] = [];
  for (const seg of SEGMENTS) {
    const pct = (totals[seg.key] / total) * 100;
    stops.push(`${seg.color} ${cursor}% ${cursor + pct}%`);
    legend.push({ key: seg.key, label: seg.label, pct: Math.round(pct), color: seg.color });
    cursor += pct;
  }
  return (
    <div className="flex items-center gap-3">
      <div
        data-donut
        role="img"
        aria-label="model token split"
        className="w-[72px] h-[72px] rounded-full shrink-0"
        style={{
          background: `conic-gradient(${stops.join(', ')})`,
          mask: 'radial-gradient(circle, transparent 38%, black 39%)',
          WebkitMask: 'radial-gradient(circle, transparent 38%, black 39%)',
        }}
      />
      <div className="flex flex-col gap-0.5 text-[0.6rem]">
        {legend.map((l) => (
          <span
            key={l.key}
            data-legend={l.key}
            data-pct={l.pct}
            style={{ color: 'var(--color-dim)' }}
          >
            <i
              className="inline-block w-2 h-2 rounded-[2px] mr-1 align-middle"
              style={{ background: l.color }}
            />
            {l.label} {l.pct}%
          </span>
        ))}
      </div>
    </div>
  );
}
