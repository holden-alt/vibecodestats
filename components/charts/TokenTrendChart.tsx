type TokenTrendChartProps = {
  days: { date: string; tokens: number }[];
};

export function TokenTrendChart({ days }: TokenTrendChartProps) {
  const max = Math.max(1, ...days.map((d) => d.tokens));
  return (
    <div
      className="flex items-end gap-[2px] h-[80px]"
      role="img"
      aria-label="30-day daily token trend"
    >
      {days.map((d) => {
        const pct = Math.round((d.tokens / max) * 100);
        return (
          <div
            key={d.date}
            data-bar
            data-date={d.date}
            data-pct={pct}
            title={`${d.date} · ${d.tokens.toLocaleString()} tokens`}
            className="flex-1 rounded-t-[1px]"
            style={{ height: `${pct}%`, minHeight: '1px', background: 'var(--color-orange)' }}
          />
        );
      })}
    </div>
  );
}
