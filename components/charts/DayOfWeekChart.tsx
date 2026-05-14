type DayOfWeekChartProps = {
  averages: number[]; // length 7, index 0 = Sunday
};

const LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function DayOfWeekChart({ averages }: DayOfWeekChartProps) {
  const max = Math.max(1, ...averages);
  return (
    <div
      className="flex items-end gap-1 h-[80px]"
      role="img"
      aria-label="average tokens by day of week"
    >
      {averages.map((avg, i) => {
        const pct = Math.round((avg / max) * 100);
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
            <div
              data-bar
              data-day={i}
              data-pct={pct}
              title={`${LABELS[i]!} · ${avg.toLocaleString()} avg tokens`}
              className="w-full rounded-t-[1px]"
              style={{ height: `${pct}%`, minHeight: '1px', background: 'var(--color-yellow)' }}
            />
            <span className="text-[0.55rem]" style={{ color: 'var(--color-dim)' }}>
              {LABELS[i]!}
            </span>
          </div>
        );
      })}
    </div>
  );
}
