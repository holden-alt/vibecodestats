type TimeOfDayHistogramProps = {
  hourly: number[]; // length 24, index = hour 0..23
};

export function TimeOfDayHistogram({ hourly }: TimeOfDayHistogramProps) {
  const max = Math.max(1, ...hourly);
  return (
    <div
      className="flex items-end gap-[1px] h-[80px]"
      role="img"
      aria-label="tokens by hour of day"
    >
      {hourly.map((n, h) => {
        const pct = Math.round((n / max) * 100);
        return (
          <div
            key={h}
            data-bar
            data-hour={h}
            data-pct={pct}
            title={`${String(h).padStart(2, '0')}:00 · ${n.toLocaleString()} tokens`}
            className="flex-1 rounded-t-[1px]"
            style={{ height: `${pct}%`, minHeight: '1px', background: 'var(--color-magenta)' }}
          />
        );
      })}
    </div>
  );
}
